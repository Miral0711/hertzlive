import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { signToken } from '../lib/jwt';
import { requireAuth } from '../middleware/requireAuth';

export const authRouter = Router();

const ROLES = ['partner', 'designer', 'site_manager', 'hr', 'client', 'contractor'] as const;

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum(ROLES).default('designer'),
});

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const publicUser = (u: {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  createdAt: Date;
}) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  organizationId: u.organizationId,
  createdAt: u.createdAt,
});

// Prototype has exactly one tenant; new self-registrations land here until a real
// organization-signup flow exists.
const DEFAULT_ORG_SLUG = 'hertz-demo';

async function defaultOrganizationId() {
  const org = await prisma.organization.findUnique({ where: { slug: DEFAULT_ORG_SLUG } });
  if (!org) throw new Error(`Default organization "${DEFAULT_ORG_SLUG}" is not seeded.`);
  return org.id;
}

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input.' });
  }
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await hashPassword(password);
  const organizationId = await defaultOrganizationId();
  const user = await prisma.user.create({ data: { name, email, passwordHash, role, organizationId } });

  const token = signToken({ sub: user.id, role: user.role, email: user.email, organizationId: user.organizationId });
  res.status(201).json({ token, user: publicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input.' });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Same error for "no such user" and "wrong password" so login can't be used to enumerate accounts.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken({ sub: user.id, role: user.role, email: user.email, organizationId: user.organizationId });
  res.json({ token, user: publicUser(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});
