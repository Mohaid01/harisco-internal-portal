import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION USER SEED
// OVERWRITE MODE: This script will upsert the users below and DELETE any other users.
// Add real email addresses below before deploying.
// Roles: IT, Admin, Manager, Employee
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTION_USERS = [
  {
    email: 'mohidb.shahid01@gmail.com',
    role: 'IT',
  },
  {
    email: 'mohaidbinshahis@gmail.com',
    role: 'Employee',
  },
  // ── Add more users below ──────────────────────────────────────────────────
  // { email: "manager@harisco.com", role: "Manager" },
  // { email: "admin@harisco.com", role: "Admin" },
  // { email: "employee@harisco.com", role: "Employee" },
];

async function main() {
  console.log('🌱 Running production user seed (OVERWRITE mode)...\n');

  // 1. Upsert official users
  for (const user of PRODUCTION_USERS) {
    const result = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        role: user.role,
      },
      create: {
        email: user.email,
        role: user.role,
      },
    });

    console.log(`✅ Upserted: ${user.email} (${user.role})`);
  }

  // 2. Overwrite: Delete anyone NOT in the list
  const authorizedEmails = PRODUCTION_USERS.map(u => u.email);
  const deleted = await prisma.user.deleteMany({
    where: {
      email: { notIn: authorizedEmails },
    },
  });

  if (deleted.count > 0) {
    console.log(`\n🗑️  Deleted ${deleted.count} unauthorized user(s) not in the seed list.`);
  }

  console.log(`\n✨ Production seed sync complete! Authorized users: ${PRODUCTION_USERS.length}`);
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
