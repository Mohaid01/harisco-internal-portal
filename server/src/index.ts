import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendStatusEmail } from './utils/mailer.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'harisco_super_secret_dev_key';

app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = user;
    next();
  });
};

// --- Activity Logger Helper ---
const logActivity = async (action: string, details: string, performedBy: string = 'Admin') => {
  await prisma.activityLog.create({
    data: { action, details, performedBy },
  });
};

// --- Backup Service ---
const DB_PATH = path.join(__dirname, '../prisma/dev.db');
const BACKUP_DIR = path.join(__dirname, '../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Schedule backup every day at midnight
cron.schedule('0 0 * * *', () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
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
app.post('/api/admin/backup', (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `manual-backup-${timestamp}.db`);
    fs.copyFileSync(DB_PATH, backupPath);
    res.json({ message: 'Backup created successfully', path: backupPath });
  } catch (error) {
    res.status(500).json({ error: 'Backup failed' });
  }
});

// --- API Routes ---

app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/health') {
    return next();
  }
  return authenticateToken(req, res, next);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Employee Routes
app.get('/api/employees', async (req, res) => {
  const employees = await prisma.employee.findMany();
  res.json(employees);
});

app.post('/api/employees', async (req, res) => {
  const { name, email, department, designation, cnic, phoneNumber } = req.body;
  try {
    const employee = await prisma.employee.create({
      data: { name, email, department, designation, cnic, phoneNumber },
    });
    await logActivity('CREATE_EMPLOYEE', `Added employee: ${name} (${email})`);
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Inventory Routes
app.get('/api/inventory', async (req, res) => {
  const devices = await prisma.device.findMany({ include: { repairs: true } });
  res.json(devices);
});

app.post('/api/inventory', async (req, res) => {
  const { serial, model, type, status } = req.body;
  try {
    const device = await prisma.device.create({
      data: { serial, model, type, status },
    });
    await logActivity('CREATE_DEVICE', `Added device: ${model} [${serial}]`);
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create device' });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  const { id } = req.params;
  const { serial, model, type, status } = req.body;
  try {
    const device = await prisma.device.update({
      where: { id: parseInt(id) },
      data: { serial, model, type, status },
    });
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

app.post('/api/inventory/:id/issue', async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;
  try {
    const device = await prisma.device.update({
      where: { id: parseInt(id) },
      data: { status: 'ISSUED', assignedTo },
    });
    await logActivity('ISSUE_DEVICE', `Issued device ID ${id} to ${assignedTo}`);
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to issue device' });
  }
});

// Procurement Routes
app.get('/api/procurement', async (req, res) => {
  const requests = await prisma.procurement.findMany();
  res.json(requests);
});

app.post('/api/procurement', async (req, res) => {
  const { item, estimatedCost, requester, type } = req.body;
  try {
    const procurement = await prisma.procurement.create({
      data: { item, estimatedCost, requester, type, status: 'PENDING_IT' },
    });
    await logActivity('CREATE_PROCUREMENT', `Requested: ${item} (Est: ${estimatedCost})`);
    res.json(procurement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create request' });
  }
});

app.patch('/api/procurement/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const request = await prisma.procurement.update({
      where: { id: parseInt(id) },
      data: { status },
    });
    await logActivity('UPDATE_PROCUREMENT_STATUS', `Updated PRQ-${id} to ${status}`);

    // Send email notification
    await sendStatusEmail(
      'requester@harisco.com', // In a real app, fetch the actual requester's email
      `Procurement PRQ-${id} Status Update`,
      `<h2>Status Update</h2><p>Your procurement request for <strong>${request.item}</strong> has been updated to <strong>${status}</strong>.</p>`
    );

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

app.post('/api/procurement/:id/intake', async (req, res) => {
  const { id } = req.params;
  const { serial, model, type } = req.body;
  try {
    // 1. Create the Device in Inventory
    const device = await prisma.device.create({
      data: { serial, model, type, status: 'IN_STOCK' },
    });

    // 2. Mark Procurement as PURCHASED
    const request = await prisma.procurement.update({
      where: { id: parseInt(id) },
      data: { status: 'PURCHASED' },
    });

    await logActivity('PROCUREMENT_INTAKE', `Stocked ${model} [${serial}] from PRQ-${id}`);
    res.json({ device, request });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process intake' });
  }
});

// Repairs Routes
app.get('/api/repairs', async (req, res) => {
  const repairs = await prisma.repair.findMany({ include: { device: true } });
  res.json(repairs);
});

app.post('/api/repairs', async (req, res) => {
  const { deviceId, requester, description } = req.body;
  try {
    const repair = await prisma.repair.create({
      data: { deviceId, requester, description, status: 'PENDING_IT' },
    });
    // Update device status to REPAIR
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: 'REPAIR' },
    });
    await logActivity(
      'CREATE_REPAIR',
      `Repair requested for Device ID ${deviceId} by ${requester}`
    );
    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create repair request' });
  }
});

app.patch('/api/repairs/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const repair = await prisma.repair.update({
      where: { id: parseInt(id) },
      data: { status },
      include: { device: true },
    });
    await logActivity('UPDATE_REPAIR_STATUS', `Updated REP-${id} to ${status}`);

    // Send email notification
    await sendStatusEmail(
      'requester@harisco.com', // In a real app, fetch the actual requester's email
      `Repair REP-${id} Status Update`,
      `<h2>Status Update</h2><p>Your repair request for <strong>${repair.device.model}</strong> has been updated to <strong>${status}</strong>.</p>`
    );

    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Activity Log Routes
app.get('/api/activity', async (req, res) => {
  const logs = await prisma.activityLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 20,
  });
  res.json(logs);
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: '8h',
    });

    res.json({ token, role: user.role });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});
app.post('/api/activity', async (req, res) => {
  const { action, details, performedBy } = req.body;
  try {
    const log = await prisma.activityLog.create({
      data: { action, details, performedBy: performedBy || 'Admin' },
    });
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// --- Production Frontend Serving ---
// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../public')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📂 Database: ${DB_PATH}`);
  console.log(`💾 Backups: ${BACKUP_DIR}`);
});
