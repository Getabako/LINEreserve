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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const profile = await verifyLiffToken(req);
  if (!profile) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ユーザーを取得または作成
    let user = await prisma.user.findUnique({
      where: { lineUserId: profile.userId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        },
      });
    }

    if (req.method === 'GET') {
      const bookings = await prisma.booking.findMany({
        where: { userId: user.id },
        include: {
          timeSlot: {
            select: { date: true, startTime: true, endTime: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const response = bookings.map((b) => ({
        id: b.id,
        date: b.timeSlot.date.toISOString().split('T')[0],
        startTime: b.timeSlot.startTime,
        endTime: b.timeSlot.endTime,
        status: b.status,
        notes: b.notes,
        createdAt: b.createdAt.toISOString(),
      }));

      return res.status(200).json(response);
    }

    if (req.method === 'POST') {
      const { timeSlotId, notes } = req.body;

      if (!timeSlotId) {
        return res.status(400).json({ error: 'timeSlotId is required' });
      }

      // 予約枠の空き確認
      const slot = await prisma.timeSlot.findUnique({
        where: { id: timeSlotId },
        include: {
          _count: {
            select: {
              bookings: {
                where: { status: 'CONFIRMED' },
              },
            },
          },
        },
      });

      if (!slot) {
        return res.status(404).json({ error: 'Time slot not found' });
      }

      if (slot._count.bookings >= slot.maxCapacity) {
        return res.status(400).json({ error: 'This time slot is fully booked' });
      }

      // 同じユーザーが同じ時間枠に予約済みかチェック
      const existingBooking = await prisma.booking.findFirst({
        where: {
          userId: user.id,
          timeSlotId,
          status: 'CONFIRMED',
        },
      });

      if (existingBooking) {
        return res.status(400).json({ error: 'You have already booked this time slot' });
      }

      // 予約を作成
      const booking = await prisma.booking.create({
        data: {
          userId: user.id,
          timeSlotId,
          notes,
        },
        include: {
          timeSlot: { select: { date: true, startTime: true, endTime: true } },
        },
      });

      return res.status(201).json({
        id: booking.id,
        date: booking.timeSlot.date.toISOString().split('T')[0],
        startTime: booking.timeSlot.startTime,
        endTime: booking.timeSlot.endTime,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
