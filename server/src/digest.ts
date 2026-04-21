import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';
import { notify } from './notify';

/** Returns the start of today in PKT (UTC+5) as a UTC Date */
function startOfDayPKT(): Date {
  const now = new Date();
  // PKT is UTC+5; shift now to PKT midnight then back to UTC
  const pktOffset = 5 * 60 * 60 * 1000;
  const pktNow = new Date(now.getTime() + pktOffset);
  const pktMidnight = new Date(
    Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), pktNow.getUTCDate())
  );
  // Convert PKT midnight back to UTC
  return new Date(pktMidnight.getTime() - pktOffset);
}

/**
 * Generates a role-specific daily digest notification for a user.
 * Idempotent: will not send more than once per calendar day (PKT).
 */
export async function generateDailyDigest(
  prisma: PrismaClient,
  io: Server,
  userSockets: Map<number, string>,
  user: { id: number; role: string; name?: string | null; email: string }
) {
  try {
    const todayStart = startOfDayPKT();

    // Idempotency check: skip if already sent today
    const existing = await (prisma as any).notification.findFirst({
      where: {
        userId: user.id,
        type: 'DIGEST',
        createdAt: { gte: todayStart },
      },
    });
    if (existing) return;

    const digest = await buildDigest(prisma, user);
    if (!digest) return; // Nothing to report — no digest

    await notify(prisma, io, userSockets, {
      userId: user.id,
      type: 'DIGEST',
      title: digest.title,
      message: digest.message,
      link: digest.link,
    });
  } catch (error) {
    console.error('[Digest] Failed to generate digest:', error);
  }
}

async function buildDigest(
  prisma: PrismaClient,
  user: { id: number; role: string; name?: string | null; email: string }
): Promise<{ title: string; message: string; link: string } | null> {
  const role = user.role;

  if (role === 'IT') {
    const [pendingRepairs, pendingProc, inRepair, stalledRepairs, newEmployees] = await Promise.all([
      prisma.repair.count({ where: { status: 'PENDING', itApproved: false } }),
      prisma.procurement.count({ where: { status: 'PENDING', itApproved: false } }),
      prisma.repair.count({ where: { status: 'IN_REPAIR' } }),
      prisma.repair.count({
        where: {
          status: 'PENDING',
          createdAt: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
      }),
      prisma.employee.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const parts: string[] = [];
    if (pendingRepairs > 0) parts.push(`${pendingRepairs} repair${pendingRepairs > 1 ? 's' : ''} need your approval`);
    if (pendingProc > 0) parts.push(`${pendingProc} procurement${pendingProc > 1 ? 's' : ''} need your approval`);
    if (inRepair > 0) parts.push(`${inRepair} device${inRepair > 1 ? 's' : ''} in repair`);
    if (stalledRepairs > 0) parts.push(`⚠️ ${stalledRepairs} repair${stalledRepairs > 1 ? 's' : ''} stalled for 48h+`);
    if (newEmployees > 0) parts.push(`${newEmployees} new employee${newEmployees > 1 ? 's' : ''} this week`);

    if (parts.length === 0) return null;

    return {
      title: 'Your Daily IT Summary',
      message: parts.join(' · '),
      link: pendingRepairs > 0 ? '/repairs' : '/procurement',
    };
  }

  if (role === 'Admin') {
    const [pendingRepairs, pendingProc, readyToPurchase] = await Promise.all([
      prisma.repair.count({ where: { status: 'PENDING', adminApproved: false } }),
      prisma.procurement.count({ where: { status: 'PENDING', adminApproved: false } }),
      prisma.procurement.count({ where: { status: 'APPROVED' } }),
    ]);

    const parts: string[] = [];
    const needsSig = pendingRepairs + pendingProc;
    if (needsSig > 0) parts.push(`${needsSig} request${needsSig > 1 ? 's' : ''} need your signature`);
    if (readyToPurchase > 0) parts.push(`${readyToPurchase} procurement${readyToPurchase > 1 ? 's' : ''} ready to purchase`);

    if (parts.length === 0) return null;

    return {
      title: 'Your Daily Admin Summary',
      message: parts.join(' · '),
      link: readyToPurchase > 0 ? '/procurement' : '/repairs',
    };
  }

  if (role === 'Manager') {
    const [pendingRepairs, pendingProc, activeRepairs] = await Promise.all([
      prisma.repair.count({ where: { status: 'PENDING', managerApproved: false } }),
      prisma.procurement.count({ where: { status: 'PENDING', managerApproved: false } }),
      prisma.repair.count({ where: { status: { in: ['APPROVED', 'IN_REPAIR'] } } }),
    ]);

    const parts: string[] = [];
    const needsSig = pendingRepairs + pendingProc;
    if (needsSig > 0) parts.push(`${needsSig} item${needsSig > 1 ? 's' : ''} need your sign-off`);
    if (activeRepairs > 0) parts.push(`${activeRepairs} active repair${activeRepairs > 1 ? 's' : ''} in progress`);
    if (pendingProc > 0) parts.push(`${pendingProc} procurement${pendingProc > 1 ? 's' : ''} pending`);

    if (parts.length === 0) return null;

    return {
      title: 'Your Daily Operations Summary',
      message: parts.join(' · '),
      link: '/dashboard',
    };
  }

  if (role === 'Employee') {
    const [activeRepairs, activeProc] = await Promise.all([
      prisma.repair.findMany({
        where: {
          requester: user.name || user.email,
          status: { notIn: ['RESOLVED', 'REJECTED'] },
        },
        include: { device: { select: { model: true } } },
        take: 3,
      }),
      prisma.procurement.findMany({
        where: {
          requestedBy: user.name || user.email,
          status: { notIn: ['PURCHASED', 'REJECTED'] },
        },
        take: 3,
      }),
    ]);

    if (activeRepairs.length === 0 && activeProc.length === 0) return null;

    const parts: string[] = [];

    activeRepairs.forEach((r: any) => {
      const statusLabel: Record<string, string> = {
        PENDING: 'awaiting approval',
        APPROVED: 'approved — starting soon',
        IN_REPAIR: 'in progress',
      };
      parts.push(`${r.device.model} repair is ${statusLabel[r.status] || r.status.toLowerCase()}`);
    });

    activeProc.forEach((p: any) => {
      const statusLabel: Record<string, string> = {
        PENDING: 'awaiting approval',
        APPROVED: 'approved',
      };
      parts.push(`${p.item} procurement is ${statusLabel[p.status] || p.status.toLowerCase()}`);
    });

    return {
      title: 'Your Request Updates',
      message: parts.join(' · '),
      link: activeRepairs.length > 0 ? '/repairs' : '/procurement',
    };
  }

  return null;
}
