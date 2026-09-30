import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

export const holidayRouter = Router();

// Matches the frontend's RBAC table (shared/core.js `holiday` entity): everyone but
// client/contractor can view; only hr can manage.
const VIEW_ROLES = ['partner', 'designer', 'site_manager', 'hr'] as const;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
const holidaySchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  date: dateOnly,
  type: z.enum(['mandatory', 'optional']).default('mandatory'),
  description: z.string().max(2000).optional(),
});

holidayRouter.get('/holidays', requireAuth, requireRole(...VIEW_ROLES), async (req, res) => {
  const holidays = await prisma.holiday.findMany({
    where: { organizationId: req.user!.organizationId },
    orderBy: { date: 'asc' },
  });
  res.json({ holidays });
});

holidayRouter.post('/holidays', requireAuth, requireRole('hr'), async (req, res) => {
  const parsed = holidaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input.' });
  const { name, date, type, description } = parsed.data;
  const holiday = await prisma.holiday.create({
    data: { name, date: new Date(`${date}T00:00:00.000Z`), type, description, organizationId: req.user!.organizationId },
  });
  res.status(201).json({ holiday });
});

holidayRouter.patch('/holidays/:id', requireAuth, requireRole('hr'), async (req, res) => {
  const parsed = holidaySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input.' });
  const existing = await prisma.holiday.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) return res.status(404).json({ error: 'Holiday not found.' });
  const { date, ...rest } = parsed.data;
  const holiday = await prisma.holiday.update({
    where: { id: existing.id },
    data: { ...rest, ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}) },
  });
  res.json({ holiday });
});

holidayRouter.delete('/holidays/:id', requireAuth, requireRole('hr'), async (req, res) => {
  const existing = await prisma.holiday.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) return res.status(404).json({ error: 'Holiday not found.' });
  await prisma.holiday.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
