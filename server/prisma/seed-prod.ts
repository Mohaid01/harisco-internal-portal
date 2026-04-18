import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION USER SEED
// Safe to run at any time - uses upsert so it NEVER deletes existing data.
// Add real email addresses below before deploying.
// Roles: IT, Admin, Manager, Employee
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTION_USERS = [
  {
    email: 'mohidb.shahid01@gmail.com',
    name: 'Mohid Shahid',
    role: 'IT',
  },
  {
    email: 'mohaidbinshahis@gmail.com',
    name: 'Mohid Bin Shahid',
    role: 'Employee',
  },
  // ── Add more users below ──────────────────────────────────────────────────
  // { email: "manager@harisco.com", name: "Manager Name", role: "Manager" },
  // { email: "admin@harisco.com", name: "Admin Name", role: "Admin" },
  // { email: "employee@harisco.com", name: "Employee Name", role: "Employee" },
];

async function main() {
  console.log('🌱 Running production user seed (safe upsert mode)...\n');

  for (const user of PRODUCTION_USERS) {
    const result = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        // No password — authentication is via Google OAuth
      },
    });

    const verb = result.id ? '✅ Upserted' : '✅ Created';
    console.log(`${verb}: ${user.email} (${user.role})`);
  }

  console.log(`\n✅ Production seed complete! ${PRODUCTION_USERS.length} user(s) processed.`);
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
