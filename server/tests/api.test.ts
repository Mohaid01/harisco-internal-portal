import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ─── Shared mock Prisma singleton ────────────────────────────────────────────
// We define the mock object OUTSIDE vi.mock so every test can reference the
// same instance that the app uses internally.
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  procurement: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 1,
        item: 'Test Laptop',
        estimatedCost: 'Rs. 100,000',
        requester: 'IT',
        status: 'PENDING_IT',
      },
    ]),
    create: vi.fn().mockResolvedValue({
      id: 1,
      item: 'Test Laptop',
      estimatedCost: 'Rs. 100,000',
      requester: 'IT',
      status: 'PENDING_IT',
    }),
    update: vi.fn().mockResolvedValue({
      id: 1,
      item: 'Test Laptop',
      estimatedCost: 'Rs. 100,000',
      requester: 'IT',
      status: 'PENDING_ADMIN',
    }),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  repair: { findMany: vi.fn().mockResolvedValue([]) },
  device: { findMany: vi.fn().mockResolvedValue([]) },
  employee: { findMany: vi.fn().mockResolvedValue([]) },
  $disconnect: vi.fn(),
};

// Mock PrismaClient to always return the shared singleton
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
}));

// Mock mailer so tests don't hit real SMTP
vi.mock('../src/utils/mailer.ts', () => ({
  sendStatusEmail: vi.fn().mockResolvedValue(undefined),
}));

const JWT_SECRET = 'test_secret';
const validToken = jwt.sign(
  { id: 1, email: 'it@harisco.com', role: 'IT', name: 'IT Admin' },
  JWT_SECRET
);
const employeeToken = jwt.sign(
  { id: 2, email: 'emp@harisco.com', role: 'Employee', name: 'Joe Employee' },
  JWT_SECRET
);

let app: express.Application;

beforeAll(async () => {
  app = express();
  app.use(express.json());

  // Auth middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied.' });
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Invalid token.' });
      req.user = user;
      next();
    });
  };

  // Protect non-login routes
  app.use('/api', (req: any, res: any, next: any) => {
    if (req.path === '/health') return next();
    return authenticateToken(req, res, next);
  });

  // Health check
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Procurement routes
  app.get('/api/procurement', async (_req, res) => {
    const data = await mockPrisma.procurement.findMany();
    res.json(data);
  });

  app.post('/api/procurement', async (req, res) => {
    const { item, estimatedCost, requester, type } = req.body;
    const data = await mockPrisma.procurement.create({
      data: { item, estimatedCost, requester, type, status: 'PENDING_IT' },
    } as any);
    res.json(data);
  });

  // Simplified Repair route for testing restrictions
  app.post('/api/repairs', async (req: any, res) => {
    const { deviceId } = req.body;
    const user = req.user;

    // Simulate restriction logic
    const device = await mockPrisma.device.findUnique({ where: { id: deviceId } } as any);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    if (user.role === 'Employee') {
      if (device.assignedTo !== user.email && device.assignedTo !== user.name) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    res.json({ id: 1, success: true });
  });
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Role & Restriction Tests', () => {
  it('allows IT to request repair for any device', async () => {
    mockPrisma.device.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 99, assignedTo: 'someone_else' });
    const res = await request(app)
      .post('/api/repairs')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ deviceId: 99 });
    expect(res.status).toBe(200);
  });

  it('blocks Employee from requesting repair for unassigned device', async () => {
    mockPrisma.device.findUnique = vi.fn().mockResolvedValue({ id: 99, assignedTo: 'Other User' });
    const res = await request(app)
      .post('/api/repairs')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ deviceId: 99 });
    expect(res.status).toBe(403);
  });

  it('allows Employee to request repair for their OWN device', async () => {
    mockPrisma.device.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 99, assignedTo: 'Joe Employee' });
    const res = await request(app)
      .post('/api/repairs')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ deviceId: 99 });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/procurement (protected route)', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/procurement');
    expect(res.status).toBe(401);
  });

  it('returns 403 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/procurement')
      .set('Authorization', 'Bearer invalid_token_here');
    expect(res.status).toBe(403);
  });

  it('returns data with a valid token', async () => {
    const res = await request(app)
      .get('/api/procurement')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/procurement (protected route)', () => {
  it('creates a new procurement request with valid auth', async () => {
    const res = await request(app)
      .post('/api/procurement')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        item: 'Dell Monitor',
        estimatedCost: 'Rs. 50,000',
        requester: 'IT Department',
        type: 'Monitor',
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });
});
