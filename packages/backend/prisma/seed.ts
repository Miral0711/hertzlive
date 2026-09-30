// Prototype auth foundation: one demo organization + the six existing sample
// users/roles from the frontend, all sharing the mock password "password".
//
// This is intentionally NOT how production onboarding will work — it exists so the
// login page has real, working accounts while the app is still a single-tenant
// prototype. Real signup/organization-provisioning can replace this later without
// touching the auth/session code that consumes it.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

const DEMO_ORG = {
  slug: 'hertz-demo',
  name: 'Hertz Studio',
};

// email/role chosen to match packages/frontend/src/desktop/data.js PERSONAS and
// packages/frontend/src/shared/data.js USERS (u1, u5, u10, u12, c1, x1).
const DEMO_USERS = [
  { email: 'harshal.patel@hertzstudio.demo', name: 'Harshal Patel', role: 'partner' as const },
  { email: 'priya.shah@hertzstudio.demo', name: 'Priya Shah', role: 'designer' as const },
  { email: 'rohan.gandhi@hertzstudio.demo', name: 'Rohan Gandhi', role: 'site_manager' as const },
  { email: 'bhavna.rao@hertzstudio.demo', name: 'Bhavna Rao', role: 'hr' as const },
  { email: 'anjali.jagwani@hertzstudio.demo', name: 'Anjali Jagwani', role: 'client' as const },
  { email: 'om.civilworks@hertzstudio.demo', name: 'Om Civil Works', role: 'contractor' as const },
];

const DEMO_PASSWORD = 'password';

// Leave Management: a starter policy for the demo org. Every field a tenant's HR might want to
// change later lives here, not hardcoded into the app - see LeaveType in schema.prisma.
const DEMO_LEAVE_TYPES = [
  { name: 'Casual Leave', paid: true, annualAllowance: 12, allowHalfDay: true },
  { name: 'Sick Leave', paid: true, annualAllowance: 8, allowHalfDay: true },
  { name: 'Earned / Privilege Leave', paid: true, annualAllowance: 15, allowHalfDay: true },
  { name: 'Unpaid Leave', paid: false, annualAllowance: 0, allowHalfDay: true },
];

// Holiday Management: sample holidays for the demo org, not universal defaults for every tenant.
const DEMO_HOLIDAYS = [
  { name: 'Republic Day', date: '2027-01-26', type: 'mandatory', description: 'National holiday.' },
  { name: 'Holi', date: '2027-03-04', type: 'optional', description: 'Festival of colours.' },
  { name: 'Independence Day', date: '2027-08-15', type: 'mandatory', description: 'National holiday.' },
  { name: 'Ganesh Visarjan', date: '2027-09-06', type: 'optional', description: 'Regional festival.' },
  { name: 'Gandhi Jayanti', date: '2027-10-02', type: 'mandatory', description: 'National holiday.' },
  { name: 'Diwali', date: '2027-11-08', type: 'mandatory', description: 'Studio shutdown.' },
];

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORG.slug },
    update: { name: DEMO_ORG.name },
    create: DEMO_ORG,
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const users = [];
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, organizationId: org.id },
      create: { ...u, passwordHash, organizationId: org.id },
    });
    users.push(user);
  }

  const leaveTypes = [];
  for (const t of DEMO_LEAVE_TYPES) {
    const leaveType = await prisma.leaveType.upsert({
      where: { organizationId_name: { organizationId: org.id, name: t.name } },
      update: { paid: t.paid, annualAllowance: t.annualAllowance, allowHalfDay: t.allowHalfDay },
      create: { ...t, organizationId: org.id },
    });
    leaveTypes.push(leaveType);
  }

  const year = new Date().getFullYear();
  for (const user of users) {
    for (const leaveType of leaveTypes.filter((t) => t.paid)) {
      await prisma.leaveBalance.upsert({
        where: {
          organizationId_employeeId_leaveTypeId_year: {
            organizationId: org.id,
            employeeId: user.id,
            leaveTypeId: leaveType.id,
            year,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          employeeId: user.id,
          leaveTypeId: leaveType.id,
          year,
          allocated: leaveType.annualAllowance,
          used: 0,
          pending: 0,
          remaining: leaveType.annualAllowance,
        },
      });
    }
  }

  for (const h of DEMO_HOLIDAYS) {
    const existing = await prisma.holiday.findFirst({ where: { organizationId: org.id, name: h.name, date: new Date(h.date) } });
    if (!existing) {
      await prisma.holiday.create({ data: { ...h, date: new Date(h.date), organizationId: org.id } });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded organization "${org.name}" (${org.id}) with ${DEMO_USERS.length} demo users, ${leaveTypes.length} leave types, and ${DEMO_HOLIDAYS.length} holidays.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
