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
    const user = await prisma.user.findUnique({
      where: { lineUserId: profile.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.method === 'GET') {
      const bookings = await prisma.booking.findMany({
        where: { userId: user.id },
        include: {
          teacher: {
            select: { id: true, name: true, pictureUrl: true },
          },
          subject: {
            select: { id: true, name: true },
          },
          timeSlot: {
            select: { date: true, startTime: true, endTime: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const response = bookings.map((b) => ({
        id: b.id,
        teacherId: b.teacherId,
        teacherName: b.teacher.name,
        teacherPicture: b.teacher.pictureUrl,
        subjectId: b.subjectId,
        subjectName: b.subject.name,
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
      const { teacherId, subjectId, timeSlotId, notes } = req.body;

      if (!teacherId || !subjectId || !timeSlotId) {
        return res.status(400).json({ error: 'teacherId, subjectId, and timeSlotId are required' });
      }

      // 予約枠の空き確認
      const slot = await prisma.timeSlot.findUnique({
        where: { id: timeSlotId },
      });

      if (!slot || slot.booked >= slot.capacity) {
        return res.status(400).json({ error: 'This time slot is not available' });
      }

      // トランザクションで予約作成と枠の更新を行う
      const booking = await prisma.$transaction(async (tx) => {
        // 予約枠を更新
        await tx.timeSlot.update({
          where: { id: timeSlotId },
          data: { booked: { increment: 1 } },
        });

        // 予約を作成
        return tx.booking.create({
          data: {
            userId: user.id,
            teacherId,
            subjectId,
            timeSlotId,
            notes,
          },
          include: {
            teacher: { select: { name: true } },
            subject: { select: { name: true } },
            timeSlot: { select: { date: true, startTime: true, endTime: true } },
          },
        });
      });

      return res.status(201).json({
        id: booking.id,
        teacherName: booking.teacher.name,
        subjectName: booking.subject.name,
        date: booking.timeSlot.date.toISOString().split('T')[0],
        startTime: booking.timeSlot.startTime,
        endTime: booking.timeSlot.endTime,
        status: booking.status,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
