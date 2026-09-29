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

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORG.slug },
    update: { name: DEMO_ORG.name },
    create: DEMO_ORG,
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, organizationId: org.id },
      create: { ...u, passwordHash, organizationId: org.id },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded organization "${org.name}" (${org.id}) with ${DEMO_USERS.length} demo users.`);
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
