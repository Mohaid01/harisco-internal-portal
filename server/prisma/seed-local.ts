import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL DEVELOPMENT SEED
// These are simple usernames for the local login bypass.
// Roles: IT, Admin, Manager, Employee
// ─────────────────────────────────────────────────────────────────────────────
const LOCAL_USERS = [
  { email: 'it', role: 'IT', name: 'Local IT Support' },
  { email: 'admin', role: 'Admin', name: 'Local Admin' },
  { email: 'manager', role: 'Manager', name: 'Local Manager' },
  { email: 'employee', role: 'Employee', name: 'Local Employee' },
];

async function main() {
  console.log('🌱 Seeding Local Development Database...');

  // 1. Clean up existing users
  await prisma.user.deleteMany();

  // 2. Create Local Users
  for (const user of LOCAL_USERS) {
    await prisma.user.create({
      data: {
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
    console.log(`✅ Local Bypass User Created: ${user.email} (${user.role})`);
  }

  console.log("🚀 Local Seed Completed! You can now log in with just 'it', 'admin', etc.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
