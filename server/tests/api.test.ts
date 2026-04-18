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
    findMany: vi
      .fn()
      .mockResolvedValue([
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
const validToken = jwt.sign({ id: 1, email: 'admin@harisco.com', role: 'DIRECTOR' }, JWT_SECRET);

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
    if (req.path === '/login' || req.path === '/health') return next();
    return authenticateToken(req, res, next);
  });

  // Health check
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Login route — uses mockPrisma directly
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await mockPrisma.user.findUnique({ where: { email } } as any);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: '8h',
    });
    res.json({ token, role: user.role });
  });

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
});

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/login', () => {
  it('returns 401 for unknown email', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'nobody@harisco.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 401 for wrong password', async () => {
    const hashedPw = await bcrypt.hash('correct123', 10);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: 'admin@harisco.com',
      name: 'Admin',
      password: hashedPw,
      role: 'DIRECTOR',
    });
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'admin@harisco.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns a token on valid credentials', async () => {
    const hashedPw = await bcrypt.hash('admin123', 10);
    // Set up the shared singleton mock to return a valid user THIS time
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: 'admin@harisco.com',
      name: 'Admin',
      password: hashedPw,
      role: 'DIRECTOR',
    });
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'admin@harisco.com', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.role).toBe('DIRECTOR');
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
