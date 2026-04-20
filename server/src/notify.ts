import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';

/**
 * Creates a Notification record and delivers it in real-time
 * via Socket.io if the target user is currently online.
 */
export async function notify(
  prisma: PrismaClient,
  io: Server,
  userSockets: Map<number, string>,
  payload: {
    userId: number;
    type: string;
    title: string;
    message: string;
    link?: string;
  }
) {
  try {
    const notification = await (prisma as any).notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link || null,
      },
    });

    // Deliver in real-time if user is online
    const socketId = userSockets.get(payload.userId);
    if (socketId) {
      io.to(socketId).emit('notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('[Notify] Failed to create notification:', error);
  }
}

/**
 * Notifies all users that have one of the given roles.
 */
export async function notifyRole(
  prisma: PrismaClient,
  io: Server,
  userSockets: Map<number, string>,
  roles: string[],
  payload: Omit<Parameters<typeof notify>[3], 'userId'>
) {
  const targets = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true },
  });

  await Promise.all(
    targets.map((u) => notify(prisma, io, userSockets, { ...payload, userId: u.id }))
  );
}
