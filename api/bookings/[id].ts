import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

async function verifyLiffToken(req: VercelRequest): Promise<LiffProfile | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const accessToken = authHeader.substring(7);

  if (accessToken === 'mock-access-token-for-development') {
    return { userId: 'U_dev_user_12345', displayName: '開発ユーザー' };
  }

  try {
    const response = await axios.get<LiffProfile>('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const profile = await verifyLiffToken(req);
  if (!profile) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Booking ID is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { lineUserId: profile.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const booking = await prisma.booking.findFirst({
      where: { id, userId: user.id },
      include: {
        timeSlot: { select: { date: true, startTime: true, endTime: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        id: booking.id,
        date: booking.timeSlot.date.toISOString().split('T')[0],
        startTime: booking.timeSlot.startTime,
        endTime: booking.timeSlot.endTime,
        status: booking.status,
        notes: booking.notes,
        createdAt: booking.createdAt.toISOString(),
      });
    }

    if (req.method === 'DELETE') {
      if (booking.status !== 'CONFIRMED') {
        return res.status(400).json({ error: 'Only confirmed bookings can be cancelled' });
      }

      await prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      return res.status(200).json({ message: 'Booking cancelled' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
