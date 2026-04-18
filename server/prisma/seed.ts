import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.repair.deleteMany();
  await prisma.procurement.deleteMany();
  await prisma.device.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  console.log("🌱 Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 10);
  const itPassword = await bcrypt.hash("it123", 10);
  const managerPassword = await bcrypt.hash("manager123", 10);
  const staffPassword = await bcrypt.hash("staff123", 10);

  // Create Admin User
  await prisma.user.create({
    data: {
      email: "admin@harisco.com",
      name: "Admin User",
      password: adminPassword,
      role: "DIRECTOR",
    },
  });

  await prisma.user.create({
    data: {
      email: "it@harisco.com",
      name: "IT Manager",
      password: itPassword,
      role: "IT",
    },
  });

  await prisma.user.create({
    data: {
      email: "manager@harisco.com",
      name: "Manager User",
      password: managerPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.create({
    data: {
      email: "staff@harisco.com",
      name: "Staff User",
      password: staffPassword,
      role: "STAFF",
    },
  });

  // Create Employees
  const emp1 = await prisma.employee.create({
    data: {
      name: "John Doe",
      email: "john.doe@harisco.com",
      department: "Engineering",
      designation: "Software Engineer",
    },
  });

  const emp2 = await prisma.employee.create({
    data: {
      name: "Jane Smith",
      email: "jane.smith@harisco.com",
      department: "Operations",
      designation: "Operations Manager",
    },
  });

  // Create Devices
  await prisma.device.create({
    data: {
      serial: "SN-98231",
      model: "MacBook Pro M3",
      type: "Laptop",
      status: "ISSUED",
      assignedTo: "John Doe",
    },
  });

  await prisma.device.create({
    data: {
      serial: "SN-44122",
      model: "Dell UltraSharp",
      type: "Monitor",
      status: "IN_STOCK",
    },
  });

  // Create Procurement Requests
  await prisma.procurement.create({
    data: {
      item: "MacBook Air M3 (16GB RAM)",
      estimatedCost: "Rs. 350,000",
      requester: "HR Department",
      status: "PENDING_ADMIN",
    },
  });

  console.log("✅ Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
