import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- Activity Logger Helper ---
const logActivity = async (
  action: string,
  details: string,
  performedBy: string = "Admin",
) => {
  await prisma.activityLog.create({
    data: { action, details, performedBy },
  });
};

// --- Backup Service ---
const DB_PATH = path.join(__dirname, "../prisma/dev.db");
const BACKUP_DIR = path.join(__dirname, "../backups");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Schedule backup every day at midnight
cron.schedule("0 0 * * *", () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.db`);

  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`[Backup] Database backed up to ${backupPath}`);

    // Cleanup: Keep only last 14 days of backups
    const files = fs.readdirSync(BACKUP_DIR);
    if (files.length > 14) {
      const sortedFiles = files.sort((a, b) => {
        return (
          fs.statSync(path.join(BACKUP_DIR, a)).birthtimeMs -
          fs.statSync(path.join(BACKUP_DIR, b)).birthtimeMs
        );
      });
      fs.unlinkSync(path.join(BACKUP_DIR, sortedFiles[0]));
      console.log(`[Backup] Cleaned up oldest backup: ${sortedFiles[0]}`);
    }
  }
});

// Manual backup endpoint (optional)
app.post("/api/admin/backup", (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `manual-backup-${timestamp}.db`);
    fs.copyFileSync(DB_PATH, backupPath);
    res.json({ message: "Backup created successfully", path: backupPath });
  } catch (error) {
    res.status(500).json({ error: "Backup failed" });
  }
});

// --- API Routes ---

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Employee Routes
app.get("/api/employees", async (req, res) => {
  const employees = await prisma.employee.findMany();
  res.json(employees);
});

app.post("/api/employees", async (req, res) => {
  const { name, email, department, designation, cnic, phoneNumber } = req.body;
  try {
    const employee = await prisma.employee.create({
      data: { name, email, department, designation, cnic, phoneNumber },
    });
    await logActivity("CREATE_EMPLOYEE", `Added employee: ${name} (${email})`);
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: "Failed to create employee" });
  }
});

// Inventory Routes
app.get("/api/inventory", async (req, res) => {
  const devices = await prisma.device.findMany({ include: { repairs: true } });
  res.json(devices);
});

app.post("/api/inventory", async (req, res) => {
  const { serial, model, type, status } = req.body;
  try {
    const device = await prisma.device.create({
      data: { serial, model, type, status },
    });
    await logActivity("CREATE_DEVICE", `Added device: ${model} [${serial}]`);
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: "Failed to create device" });
  }
});

app.put("/api/inventory/:id", async (req, res) => {
  const { id } = req.params;
  const { serial, model, type, status } = req.body;
  try {
    const device = await prisma.device.update({
      where: { id: parseInt(id) },
      data: { serial, model, type, status },
    });
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: "Failed to update device" });
  }
});

app.post("/api/inventory/:id/issue", async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;
  try {
    const device = await prisma.device.update({
      where: { id: parseInt(id) },
      data: { status: "ISSUED", assignedTo },
    });
    await logActivity(
      "ISSUE_DEVICE",
      `Issued device ID ${id} to ${assignedTo}`,
    );
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: "Failed to issue device" });
  }
});

// Procurement Routes
app.get("/api/procurement", async (req, res) => {
  const requests = await prisma.procurement.findMany();
  res.json(requests);
});

app.post("/api/procurement", async (req, res) => {
  const { item, estimatedCost, requester, type } = req.body;
  try {
    const procurement = await prisma.procurement.create({
      data: { item, estimatedCost, requester, type, status: "PENDING_IT" },
    });
    await logActivity(
      "CREATE_PROCUREMENT",
      `Requested: ${item} (Est: ${estimatedCost})`,
    );
    res.json(procurement);
  } catch (error) {
    res.status(500).json({ error: "Failed to create request" });
  }
});

app.patch("/api/procurement/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const request = await prisma.procurement.update({
      where: { id: parseInt(id) },
      data: { status },
    });
    await logActivity(
      "UPDATE_PROCUREMENT_STATUS",
      `Updated PRQ-${id} to ${status}`,
    );
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

app.post("/api/procurement/:id/intake", async (req, res) => {
  const { id } = req.params;
  const { serial, model, type } = req.body;
  try {
    // 1. Create the Device in Inventory
    const device = await prisma.device.create({
      data: { serial, model, type, status: "IN_STOCK" },
    });

    // 2. Mark Procurement as PURCHASED
    const request = await prisma.procurement.update({
      where: { id: parseInt(id) },
      data: { status: "PURCHASED" },
    });

    await logActivity(
      "PROCUREMENT_INTAKE",
      `Stocked ${model} [${serial}] from PRQ-${id}`,
    );
    res.json({ device, request });
  } catch (error) {
    res.status(500).json({ error: "Failed to process intake" });
  }
});

// Repairs Routes
app.get("/api/repairs", async (req, res) => {
  const repairs = await prisma.repair.findMany({ include: { device: true } });
  res.json(repairs);
});

app.post("/api/repairs", async (req, res) => {
  const { deviceId, requester, description } = req.body;
  try {
    const repair = await prisma.repair.create({
      data: { deviceId, requester, description, status: "PENDING_IT" },
    });
    // Update device status to REPAIR
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: "REPAIR" },
    });
    await logActivity(
      "CREATE_REPAIR",
      `Repair requested for Device ID ${deviceId} by ${requester}`,
    );
    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: "Failed to create repair request" });
  }
});

app.patch("/api/repairs/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const repair = await prisma.repair.update({
      where: { id: parseInt(id) },
      data: { status },
    });
    await logActivity("UPDATE_REPAIR_STATUS", `Updated REP-${id} to ${status}`);
    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

// Activity Log Routes
app.get("/api/activity", async (req, res) => {
  const logs = await prisma.activityLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 20,
  });
  res.json(logs);
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  // In a real app, we'd check the hashed password.
  // For now, we fetch the role configured in the DB.
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      res.json({ role: user.role });
    } else if (email === "admin@harisco.com" && password === "admin123") {
      // Default fallback for initial setup
      res.json({ role: "DIRECTOR" });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});
app.post("/api/activity", async (req, res) => {
  const { action, details, performedBy } = req.body;
  try {
    const log = await prisma.activityLog.create({
      data: { action, details, performedBy: performedBy || "Admin" },
    });
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: "Failed to log activity" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📂 Database: ${DB_PATH}`);
  console.log(`💾 Backups: ${BACKUP_DIR}`);
});
