import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import multer from 'multer';
import { sendStatusEmail } from './utils/mailer.ts';

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      role: string;
      name?: string | null;
    }
  }
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Adjust for production
    methods: ['GET', 'POST'],
  },
});
const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || '5000', 10);

const JWT_SECRET = process.env.JWT_SECRET || 'harisco_super_secret_dev_key';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// --- Backup Service ---

const DB_PATH = path.join(__dirname, '../prisma/dev.db');
const BACKUP_DIR = path.join(__dirname, '../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const triggerBackup = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.db`);

    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, backupPath);
      console.log(`[Backup] Activity-triggered backup created: ${backupPath}`);

      // Cleanup: Keep only last 10 activity-based backups
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup-'));
      if (files.length > 10) {
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
  } catch (error) {
    console.error('[Backup] Failed to create triggered backup:', error);
  }
};

// --- Activity Logger Helper ---
const logActivity = async (action: string, details: string, performedBy?: string | null) => {
  const actor = performedBy || 'System';
  await prisma.activityLog.create({
    data: { action, details, performedBy: actor },
  });

  // Trigger backup on every system change/log
  await triggerBackup();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'));
    }
  },
});

// --- Session and Passport Configuration ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'harisco_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || 'http://portal.harisco.com:8080/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) return done(new Error('No email found in Google profile'));

        // Find user by email (from our seed)
        let user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          // Fetch official name from Employee table
          const employee = await prisma.employee.findUnique({ where: { email } });
          const officialName = employee?.name || profile.displayName;

          // Update user with googleId and name
          user = await prisma.user.update({
            where: { email },
            data: {
              googleId: profile.id,
              name: officialName,
            },
          });

          // Log login activity
          await logActivity('LOGIN', `User logged in via Google: ${email}`, officialName);

          return done(null, user);
        } else {
          // REJECT unknown emails as requested
          console.warn(`[Auth] Blocked login attempt from unauthorized email: ${email}`);

          await logActivity(
            'LOGIN_BLOCKED',
            `Unauthorized login attempt blocked: ${email}`,
            'System'
          );

          return done(null, false, { message: 'You are not allowed. Please contact IT.' });
        }
      } catch (error) {
        return done(error);
      }
    }
  )
);

// --- Local Dev Auth Bypass ---
app.post('/api/auth/local', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Local login disabled in production' });
  }

  const { username } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email: username } });

    if (!user) {
      return res.status(404).json({ error: 'User not found in authorized list' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name || user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await logActivity(
      'LOGIN',
      `User logged in via local dev bypass: ${user.email}`,
      user.name || user.email
    );
    res.json({ token, role: user.role, name: user.name || user.email, userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Google Auth Routes ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err: any, user: any, info: any) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://portal.harisco.com:80';

    if (err) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
    }
    if (!user) {
      const message = info?.message || 'Authentication failed';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(message)}`);
    }

    // Success - sign token and redirect
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      {
        expiresIn: '8h',
      }
    );
    res.redirect(
      `${frontendUrl}/login?token=${token}&role=${user.role}&name=${encodeURIComponent(user.name || '')}&userId=${user.id}`
    );
  })(req, res, next);
});

// --- Authentication & Authorization Middleware ---
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

const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// ... inside API routes section ...
// These will be added after the authenticateToken middleware is applied to /api

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
  // Whitelist login routes and health check from token requirement
  if (req.path === '/login' || req.path === '/auth/local' || req.path === '/health') {
    return next();
  }
  return authenticateToken(req, res, next);
});

// User Management Routes (IT Only)
app.get('/api/users', authorizeRoles('IT'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', authorizeRoles('IT'), async (req, res) => {
  const { email, role } = req.body;
  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role },
      create: { email, role },
    });
    await logActivity(
      'UPDATE_USER_ACCESS',
      `Updated access for ${email} to ${role}`,
      req.user?.name || 'System'
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', authorizeRoles('IT'), async (req, res) => {
  const { id } = req.params;
  try {
    const userToDelete = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    await prisma.user.delete({ where: { id: parseInt(id) } });
    await logActivity(
      'DELETE_USER_ACCESS',
      `Removed access for ${userToDelete?.email}`,
      req.user?.name || 'System'
    );
    res.json({ message: 'User removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

// --- Chat Routes ---

app.get('/api/chat/users', async (req: any, res) => {
  const myId = req.user.id;
  try {
    const users = await prisma.user.findMany({
      where: {
        NOT: { id: myId },
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Get unread counts for each user
    const unreadCounts = await prisma.chatMessage.groupBy({
      by: ['senderId'],
      where: {
        receiverId: myId,
        isRead: false,
      },
      _count: true,
    });

    // Get last message timestamp for each user
    const lastMessages = await prisma.chatMessage.findMany({
      where: {
        OR: [{ senderId: myId }, { receiverId: myId }],
      },
      orderBy: { timestamp: 'desc' },
    });

    const usersWithUnread = users.map(user => {
      const unread = unreadCounts.find(c => c.senderId === user.id);

      // Find the latest message timestamp involving this specific user
      const latestMsg = lastMessages.find(
        m =>
          (m.senderId === user.id && m.receiverId === myId) ||
          (m.senderId === myId && m.receiverId === user.id)
      );

      return {
        ...user,
        unreadCount: unread ? unread._count : 0,
        lastMessageAt: latestMsg ? latestMsg.timestamp : null,
      };
    });

    res.json(usersWithUnread);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat users' });
  }
});

app.get('/api/chat/history/:otherUserId', async (req: any, res) => {
  const { otherUserId } = req.params;
  const myId = req.user.id;
  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: myId, receiverId: parseInt(otherUserId) },
          { senderId: parseInt(otherUserId), receiverId: myId },
        ],
      },
      orderBy: { timestamp: 'asc' },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

app.post('/api/chat/read/:senderId', async (req: any, res) => {
  const { senderId } = req.params;
  const myId = req.user.id;
  try {
    await prisma.chatMessage.updateMany({
      where: {
        senderId: parseInt(senderId),
        receiverId: myId,
        isRead: false,
      },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update read status' });
  }
});

app.get('/api/chat/unread-count', async (req: any, res) => {
  const myId = req.user.id;
  try {
    const count = await prisma.chatMessage.count({
      where: {
        receiverId: myId,
        isRead: false,
      },
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

app.get('/api/chat/unread-messages', async (req: any, res) => {
  const myId = req.user.id;
  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        receiverId: myId,
        isRead: false,
      },
      include: {
        sender: { select: { name: true, email: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
    res.json(
      messages.map((m: any) => ({
        id: `chat-${m.id}`,
        details: `New message from ${m.sender.name || m.sender.email}: ${m.content}`,
        timestamp: m.timestamp,
        action: 'CHAT',
      }))
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread messages' });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Employee Routes
app.get('/api/employees', async (req: any, res) => {
  if (req.user.role === 'Employee') return res.json([]);
  const employees = await prisma.employee.findMany();
  res.json(employees);
});

app.post('/api/employees', async (req: any, res) => {
  const { name, email, department, designation, cnic, phoneNumber } = req.body;
  try {
    const employee = await prisma.employee.create({
      data: { name, email, department, designation, cnic, phoneNumber },
    });
    await logActivity('CREATE_EMPLOYEE', `Added employee: ${name} (${email})`, req.user?.name);
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Inventory Routes
app.get('/api/inventory', async (req: any, res) => {
  if (req.user.role === 'Employee') {
    const devices = await prisma.device.findMany({
      where: {
        OR: [{ assignedTo: req.user.email }, { assignedTo: req.user.name || '' }],
      },
      include: { repairs: true },
    });
    return res.json(devices);
  }
  const devices = await prisma.device.findMany({ include: { repairs: true } });
  res.json(devices);
});

app.post('/api/inventory', async (req: any, res) => {
  const { serial, model, type, status } = req.body;
  try {
    const device = await prisma.device.create({
      data: { serial, model, type, status },
    });
    await logActivity('CREATE_DEVICE', `Added device: ${model} [${serial}]`, req.user?.name);
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

app.post('/api/inventory/:id/issue', async (req: any, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;
  try {
    const device = await prisma.device.update({
      where: { id: parseInt(id) },
      data: { status: 'ISSUED', assignedTo },
    });
    await logActivity('ISSUE_DEVICE', `Issued device ID ${id} to ${assignedTo}`, req.user?.name);
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to issue device' });
  }
});

// Procurement Routes
app.get('/api/procurement', async (req: any, res) => {
  if (req.user.role === 'Employee') {
    const requests = await prisma.procurement.findMany({
      where: { requester: req.user.name || req.user.email },
    });
    return res.json(requests);
  }
  const requests = await prisma.procurement.findMany();
  res.json(requests);
});

app.post('/api/procurement', async (req, res) => {
  const { item, estimatedCost, requester, type } = req.body;
  try {
    const procurement = await prisma.procurement.create({
      data: { item, estimatedCost, requester, type, status: 'PENDING_IT' },
    });
    await logActivity(
      'CREATE_PROCUREMENT',
      `Requested: ${item} (Est: ${estimatedCost})`,
      req.user?.name
    );

    // Notify all IT users
    const itUsers = await prisma.user.findMany({ where: { role: 'IT' } });
    for (const it of itUsers) {
      await sendStatusEmail(
        it.email,
        `🛒 New Procurement Request: ${item}`,
        `<h2>New Procurement Request</h2>
         <p>A new item has been requested by <strong>${requester}</strong>.</p>
         <ul>
           <li><strong>Item:</strong> ${item}</li>
           <li><strong>Est. Cost:</strong> ${estimatedCost}</li>
           <li><strong>Type:</strong> ${type}</li>
         </ul>
         <p>Please review it in the IT Portal.</p>`
      );
    }

    res.json(procurement);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create request' });
  }
});

app.patch('/api/procurement/:id/status', async (req: any, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const request = await prisma.procurement.update({
      where: { id: parseInt(id) },
      data: { status },
    });
    await logActivity(
      'UPDATE_PROCUREMENT_STATUS',
      `Updated PRQ-${id} to ${status}`,
      req.user?.name
    );

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

app.post('/api/procurement/:id/intake', async (req: any, res) => {
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

    await logActivity(
      'PROCUREMENT_INTAKE',
      `Stocked ${model} [${serial}] from PRQ-${id}`,
      req.user?.name
    );
    res.json({ device, request });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process intake' });
  }
});

// Repairs Routes
app.get('/api/repairs', async (req: any, res) => {
  if (req.user.role === 'Employee') {
    const repairs = await prisma.repair.findMany({
      where: { requester: req.user.name || req.user.email },
      include: { device: true },
    });
    return res.json(repairs);
  }
  const repairs = await prisma.repair.findMany({ include: { device: true } });
  res.json(repairs);
});

app.post('/api/repairs', async (req: any, res) => {
  const { deviceId, description } = req.body;
  const user = req.user; // From authenticateToken middleware

  try {
    // Fetch the device to check ownership
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Restriction: Cannot request repair for a device already in the repair workflow
    if (device.status === 'REPAIR') {
      return res.status(400).json({ error: 'This device is already in the repair workflow.' });
    }

    // Restriction: Employees can only request repairs for their OWN assigned devices
    if (user.role === 'Employee') {
      if (device.assignedTo !== user.email && device.assignedTo !== user.name) {
        return res.status(403).json({
          error: 'Access denied. You can only request repairs for devices issued to you.',
        });
      }
    }

    const repair = await prisma.repair.create({
      data: {
        deviceId,
        requester: user.name || user.email,
        description,
        status: 'PENDING_IT',
      },
    });

    // Update device status to REPAIR
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: 'REPAIR' },
    });

    await logActivity(
      'CREATE_REPAIR',
      `Repair requested for ${device.model} [${device.serial}] by ${user.name}`,
      user.name
    );

    // Notify all IT users
    const itUsers = await prisma.user.findMany({ where: { role: 'IT' } });
    for (const it of itUsers) {
      await sendStatusEmail(
        it.email,
        `🚨 New Repair Request: ${device.model}`,
        `<h2>New Repair Request</h2>
         <p>A new repair has been requested by <strong>${user.name}</strong>.</p>
         <ul>
           <li><strong>Device:</strong> ${device.model}</li>
           <li><strong>Serial:</strong> ${device.serial}</li>
           <li><strong>Problem:</strong> ${description}</li>
         </ul>
         <p>Please review it in the IT Portal.</p>`
      );
    }

    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create repair request' });
  }
});

app.patch('/api/repairs/:id/status', async (req: any, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const repair = await prisma.repair.update({
      where: { id: parseInt(id) },
      data: { status },
      include: { device: true },
    });
    await logActivity('UPDATE_REPAIR_STATUS', `Updated REP-${id} to ${status}`, req.user?.name);

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

app.patch('/api/repairs/:id/in-repair', async (req: any, res) => {
  const { id } = req.params;
  try {
    const repair = await prisma.repair.update({
      where: { id: parseInt(id) },
      data: { status: 'IN_REPAIR' },
      include: { device: true },
    });
    await logActivity('UPDATE_REPAIR_STATUS', `Updated REP-${id} to IN_REPAIR`, req.user?.name);
    res.json(repair);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as in-repair' });
  }
});

app.post('/api/repairs/:id/resolve', upload.single('receiptImage'), async (req: any, res: any) => {
  const { id } = req.params;
  const { repairType, fixDetails, partsReplaced, vendorName, vendorContact, repairCost } = req.body;

  if (!repairType || !fixDetails) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (repairType === 'VENDOR' && (!vendorName || !vendorContact || !repairCost)) {
    return res.status(400).json({ error: 'Missing required vendor fields' });
  }

  try {
    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (repairType === 'VENDOR' && !receiptUrl) {
      return res.status(400).json({ error: 'Vendor repair requires a receipt upload' });
    }

    const repair = await prisma.repair.update({
      where: { id: parseInt(id) },
      data: {
        status: 'RESOLVED',
        repairType,
        fixDetails,
        partsReplaced: partsReplaced || null,
        vendorName: vendorName || null,
        vendorContact: vendorContact || null,
        repairCost: repairCost || null,
        receiptUrl,
        resolvedAt: new Date(),
      },
    });

    // Update the device status back to ISSUED
    await prisma.device.update({
      where: { id: repair.deviceId },
      data: { status: 'ISSUED' },
    });

    await logActivity('REPAIR_RESOLVED', `Resolved REP-${id} via ${repairType}`, req.user?.name);
    res.json(repair);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to resolve repair' });
  }
});

app.get('/api/activity', async (req: any, res) => {
  if (req.user.role === 'Employee') {
    const userName = req.user.name || '';
    const userEmail = req.user.email || '';
    const identifiers = [userName, userEmail].filter(i => i && i.length > 0);

    // Get all identifiers relevant to the employee
    const repairs = await prisma.repair.findMany({
      where: { requester: { in: identifiers } },
      select: { id: true },
    });
    const procs = await prisma.procurement.findMany({
      where: { requester: { in: identifiers } },
      select: { id: true },
    });
    const devices = await prisma.device.findMany({
      where: { assignedTo: { in: identifiers } },
      select: { serial: true },
    });

    const orConditions: any[] = [{ performedBy: { in: identifiers } }];

    // Add fallback for name/email in details (to catch "Added employee: John Doe" etc)
    identifiers.forEach(id => {
      orConditions.push({ details: { contains: id } });
    });

    repairs.forEach(r => orConditions.push({ details: { contains: `REP-${r.id}` } }));
    procs.forEach(p => orConditions.push({ details: { contains: `PRQ-${p.id}` } }));
    devices.forEach(d => {
      if (d.serial) orConditions.push({ details: { contains: d.serial } });
    });

    const logs = await prisma.activityLog.findMany({
      where: { OR: orConditions },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });
    return res.json(logs);
  }
  const logs = await prisma.activityLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 20,
  });
  res.json(logs);
});

// Legacy login removed - now using /auth/google

app.post('/api/activity', async (req, res) => {
  const { action, details, performedBy } = req.body;
  try {
    const log = await prisma.activityLog.create({
      data: { action, details, performedBy: performedBy || 'System' },
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

// --- Socket.io Chat Implementation ---
const userSockets = new Map<number, string>(); // userId -> socketId

io.on('connection', socket => {
  console.log(`[Socket] User connected: ${socket.id}`);

  socket.on('register', (userId: any) => {
    const id = typeof userId === 'string' ? parseInt(userId) : userId;
    if (!isNaN(id)) {
      userSockets.set(id, socket.id);
      console.log(`[Socket] User ${id} registered to socket ${socket.id}`);
    } else {
      console.error(`[Socket] Invalid userId during registration: ${userId}`);
    }
  });

  socket.on('send_message', async (data: { receiverId: any; content: string; senderId: any }) => {
    try {
      const senderId = typeof data.senderId === 'string' ? parseInt(data.senderId) : data.senderId;
      const receiverId =
        typeof data.receiverId === 'string' ? parseInt(data.receiverId) : data.receiverId;

      if (!senderId || !receiverId || isNaN(senderId) || isNaN(receiverId)) return;

      const message = await prisma.chatMessage.create({
        data: {
          content: data.content,
          senderId: senderId,
          receiverId: receiverId,
        },
        include: {
          sender: { select: { name: true, role: true } },
        },
      });

      // Send to receiver if online
      const receiverSocketId = userSockets.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive_message', message);
      }

      // Send confirmation to sender
      socket.emit('message_sent', message);
    } catch (error) {
      console.error('[Socket] Error saving message:', error);
    }
  });

  socket.on('mark_read', async (data: { senderId: any; receiverId: any }) => {
    try {
      const senderId = typeof data.senderId === 'string' ? parseInt(data.senderId) : data.senderId;
      const receiverId =
        typeof data.receiverId === 'string' ? parseInt(data.receiverId) : data.receiverId;

      if (!senderId || !receiverId || isNaN(senderId) || isNaN(receiverId)) return;

      await prisma.chatMessage.updateMany({
        where: {
          senderId: senderId,
          receiverId: receiverId,
          isRead: false,
        },
        data: { isRead: true },
      });

      const senderSocketId = userSockets.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('messages_read', { byUserId: receiverId });
      }
    } catch (error) {
      console.error('[Socket] Error marking messages as read:', error);
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

const BIND_IP = '0.0.0.0';
httpServer.listen(PORT, BIND_IP, () => {
  console.log(`🚀 Server running on http://${BIND_IP}:${PORT}`);
  console.log(`📂 Database: ${DB_PATH}`);
  console.log(`💾 Backups: ${BACKUP_DIR}`);
});
