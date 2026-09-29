// Maps the six existing prototype personas (see PERSONAS in ../desktop/data.js and USERS in
// ../shared/data.js) to the real accounts seeded in the backend's "hertz-demo" organization
// (packages/backend/prisma/seed.ts). Keep all three lists in sync if a persona is added/renamed.
export const DEMO_ACCOUNTS = [
  { personaId: 'u1', email: 'harshal.patel@hertzstudio.demo', label: 'Harshal Patel · Partner' },
  { personaId: 'u5', email: 'priya.shah@hertzstudio.demo', label: 'Priya Shah · Designer' },
  { personaId: 'u10', email: 'rohan.gandhi@hertzstudio.demo', label: 'Rohan Gandhi · Site manager' },
  { personaId: 'u12', email: 'bhavna.rao@hertzstudio.demo', label: 'Bhavna Rao · HR' },
  { personaId: 'c1', email: 'anjali.jagwani@hertzstudio.demo', label: 'Anjali Jagwani · Client' },
  { personaId: 'x1', email: 'om.civilworks@hertzstudio.demo', label: 'Om Civil Works · Contractor' },
];

export const personaForEmail = (email) => DEMO_ACCOUNTS.find((a) => a.email === email) || null;
