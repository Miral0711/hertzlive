import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

export const leaveRouter = Router();

// Matches the frontend's RBAC table (shared/core.js): client/contractor have no leave access at
// all; partner/hr can approve, everyone employee-side (including partner/hr themselves) can apply.
const EMPLOYEE_ROLES = ['partner', 'designer', 'site_manager', 'hr'] as const;
const APPROVER_ROLES = ['partner', 'hr'] as const;
const isApprover = (role: string) => (APPROVER_ROLES as readonly string[]).includes(role);

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
const toDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

const leaveTypeSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  paid: z.boolean().default(true),
  annualAllowance: z.number().min(0).default(0),
  allowHalfDay: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  active: z.boolean().default(true),
});

const applySchema = z.object({
  leaveTypeId: z.string().min(1, 'Leave type is required.'),
  startDate: dateOnly,
  endDate: dateOnly,
  halfDay: z.boolean().default(false),
  reason: z.string().max(2000).optional(),
});

type Tx = Prisma.TransactionClient;

// Creates the year's balance row on first use of a leave type, seeded from its current
// annualAllowance - so a leave type added after the initial seed, or a new calendar year, still
// has somewhere for pending/used to accumulate without a cron job backfilling it.
async function ensureBalance(
  db: Tx,
  organizationId: string,
  employeeId: string,
  leaveType: { id: string; annualAllowance: number },
  year: number,
) {
  return db.leaveBalance.upsert({
    where: { organizationId_employeeId_leaveTypeId_year: { organizationId, employeeId, leaveTypeId: leaveType.id, year } },
    update: {},
    create: {
      organizationId,
      employeeId,
      leaveTypeId: leaveType.id,
      year,
      allocated: leaveType.annualAllowance,
      used: 0,
      pending: 0,
      remaining: leaveType.annualAllowance,
    },
  });
}

// The only place `used`/`pending` change. `remaining` is always re-derived here, never accepted
// from a caller - see LeaveBalance in schema.prisma.
async function bumpBalance(
  db: Tx,
  key: { organizationId: string; employeeId: string; leaveTypeId: string; year: number },
  deltas: { usedDelta?: number; pendingDelta?: number },
) {
  const updated = await db.leaveBalance.update({
    where: { organizationId_employeeId_leaveTypeId_year: key },
    data: {
      used: { increment: deltas.usedDelta ?? 0 },
      pending: { increment: deltas.pendingDelta ?? 0 },
    },
  });
  await db.leaveBalance.update({
    where: { id: updated.id },
    data: { remaining: updated.allocated - updated.used - updated.pending },
  });
}

// ---------- Leave types ----------

leaveRouter.get('/leave-types', requireAuth, requireRole(...EMPLOYEE_ROLES), async (req, res) => {
  const leaveTypes = await prisma.leaveType.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { name: 'asc' },
  });
  res.json({ leaveTypes });
});

leaveRouter.post('/leave-types', requireAuth, requireRole('hr'), async (req, res) => {
  const parsed = leaveTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input.' });
  try {
    const leaveType = await prisma.leaveType.create({ data: { ...parsed.data, organizationId: req.user!.organizationId } });
    res.status(201).json({ leaveType });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'A leave type with this name already exists.' });
    }
    throw e;
  }
});

leaveRouter.patch('/leave-types/:id', requireAuth, requireRole('hr'), async (req, res) => {
  const parsed = leaveTypeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input.' });
  const existing = await prisma.leaveType.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) return res.status(404).json({ error: 'Leave type not found.' });
  const leaveType = await prisma.leaveType.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ leaveType });
});

// ---------- Balance ----------

leaveRouter.get('/leave/balance', requireAuth, requireRole(...EMPLOYEE_ROLES), async (req, res) => {
  const organizationId = req.user!.organizationId;
  const requested = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
  if (requested && requested !== req.user!.sub && !isApprover(req.user!.role)) {
    return res.status(403).json({ error: 'You can only view your own leave balance.' });
  }
  const employeeId = requested || req.user!.sub;
  const year = typeof req.query.year === 'string' && /^\d{4}$/.test(req.query.year)
    ? Number(req.query.year) : new Date().getFullYear();

  const activeTypes = await prisma.leaveType.findMany({ where: { organizationId, active: true, paid: true } });
  await Promise.all(activeTypes.map((t) => ensureBalance(prisma, organizationId, employeeId, t, year)));

  const balances = await prisma.leaveBalance.findMany({
    where: { organizationId, employeeId, year },
    include: { leaveType: true },
    orderBy: { leaveType: { name: 'asc' } },
  });
  res.json({ balances });
});

// ---------- Requests ----------

leaveRouter.get('/leave/requests', requireAuth, requireRole(...EMPLOYEE_ROLES), async (req, res) => {
  const organizationId = req.user!.organizationId;
  const approver = isApprover(req.user!.role);
  const q = req.query;

  const where: Prisma.LeaveRequestWhereInput = { organizationId };
  if (!approver) {
    where.employeeId = req.user!.sub; // employees only ever see their own history
  } else if (typeof q.employeeId === 'string') {
    where.employeeId = q.employeeId; // hr/partner may narrow to one employee...
  } // ...or leave it unset to see every request in the org
  if (typeof q.leaveTypeId === 'string') where.leaveTypeId = q.leaveTypeId;
  if (typeof q.status === 'string' && (STATUSES as readonly string[]).includes(q.status)) {
    where.status = q.status as (typeof STATUSES)[number];
  }
  if (typeof q.from === 'string' && dateOnly.safeParse(q.from).success) {
    where.endDate = { gte: toDate(q.from) };
  }
  if (typeof q.to === 'string' && dateOnly.safeParse(q.to).success) {
    where.startDate = { lte: toDate(q.to) };
  }

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      leaveType: true,
      employee: { select: { id: true, name: true, email: true, role: true } },
      approver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ requests });
});

leaveRouter.post('/leave/requests', requireAuth, requireRole(...EMPLOYEE_ROLES), async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input.' });
  const { leaveTypeId, startDate: startStr, endDate: endStr, halfDay, reason } = parsed.data;
  const organizationId = req.user!.organizationId;
  const employeeId = req.user!.sub; // always the caller - a request can never be filed for someone else

  const leaveType = await prisma.leaveType.findFirst({ where: { id: leaveTypeId, organizationId, active: true } });
  if (!leaveType) return res.status(404).json({ error: 'Leave type not found.' });
  if (halfDay && !leaveType.allowHalfDay) {
    return res.status(400).json({ error: 'Half-day is not allowed for this leave type.' });
  }

  const startDate = toDate(startStr);
  const endDate = toDate(endStr);
  if (endDate < startDate) return res.status(400).json({ error: 'End date cannot be before start date.' });

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      organizationId,
      employeeId,
      status: { in: ['pending', 'approved'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlap) return res.status(409).json({ error: 'You already have a leave request that overlaps these dates.' });

  // Inclusive day span; a half-day request is always 0.5 regardless of the span. Weekend/holiday
  // exclusion is deliberately not applied here - it's a future per-organization policy toggle,
  // not something to assume on or off today.
  const totalDays = halfDay ? 0.5 : Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const year = startDate.getUTCFullYear();

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: { organizationId, employeeId, leaveTypeId, startDate, endDate, halfDay, totalDays, reason, status: 'pending' },
    });
    if (leaveType.paid) {
      await ensureBalance(tx, organizationId, employeeId, leaveType, year);
      await bumpBalance(tx, { organizationId, employeeId, leaveTypeId, year }, { pendingDelta: totalDays });
    }
    return created;
  });

  res.status(201).json({ request });
});

leaveRouter.post('/leave/requests/:id/cancel', requireAuth, requireRole(...EMPLOYEE_ROLES), async (req, res) => {
  const organizationId = req.user!.organizationId;
  const employeeId = req.user!.sub;
  const existing = await prisma.leaveRequest.findFirst({
    where: { id: req.params.id, organizationId, employeeId },
    include: { leaveType: true },
  });
  if (!existing) return res.status(404).json({ error: 'Leave request not found.' });
  if (existing.status !== 'pending') return res.status(409).json({ error: 'Only a pending request can be cancelled.' });

  const year = existing.startDate.getUTCFullYear();
  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({ where: { id: existing.id }, data: { status: 'cancelled' } });
    if (existing.leaveType.paid) {
      await bumpBalance(
        tx,
        { organizationId, employeeId, leaveTypeId: existing.leaveTypeId, year },
        { pendingDelta: -existing.totalDays },
      );
    }
  });
  res.json({ ok: true });
});

async function decide(req: Request, res: Response, decision: 'approved' | 'rejected') {
  const organizationId = req.user!.organizationId;
  const approverId = req.user!.sub;
  // Scoped by organizationId first - a request from another tenant simply doesn't exist here,
  // never a 403 that would confirm it exists elsewhere.
  const existing = await prisma.leaveRequest.findFirst({
    where: { id: req.params.id, organizationId },
    include: { leaveType: true },
  });
  if (!existing) return res.status(404).json({ error: 'Leave request not found.' });
  if (existing.status !== 'pending') return res.status(409).json({ error: 'Only a pending request can be decided.' });
  if (existing.employeeId === approverId) {
    return res.status(403).json({ error: 'You cannot approve or reject your own leave request.' });
  }

  const year = existing.startDate.getUTCFullYear();
  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: existing.id },
      data: { status: decision, approvedBy: approverId, approvedAt: new Date() },
    });
    if (existing.leaveType.paid) {
      await bumpBalance(
        tx,
        { organizationId, employeeId: existing.employeeId, leaveTypeId: existing.leaveTypeId, year },
        decision === 'approved'
          ? { pendingDelta: -existing.totalDays, usedDelta: existing.totalDays }
          : { pendingDelta: -existing.totalDays },
      );
    }
  });
  res.json({ ok: true });
}

leaveRouter.post('/leave/requests/:id/approve', requireAuth, requireRole(...APPROVER_ROLES), (req, res) => decide(req, res, 'approved'));
leaveRouter.post('/leave/requests/:id/reject', requireAuth, requireRole(...APPROVER_ROLES), (req, res) => decide(req, res, 'rejected'));
