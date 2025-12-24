import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date } = req.query;

  try {
    if (date && typeof date === 'string') {
      const targetDate = new Date(date);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const slots = await prisma.timeSlot.findMany({
        where: {
          date: {
            gte: targetDate,
            lt: nextDate,
          },
          isActive: true,
        },
        include: {
          _count: {
            select: {
              bookings: {
                where: {
                  status: 'CONFIRMED',
                },
              },
            },
          },
        },
        orderBy: { startTime: 'asc' },
      });

      const response = slots.map((slot) => ({
        id: slot.id,
        date: slot.date.toISOString().split('T')[0],
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxCapacity: slot.maxCapacity,
        currentBookings: slot._count.bookings,
        available: slot._count.bookings < slot.maxCapacity,
      }));

      return res.status(200).json(response);
    }

    // 日付が指定されていない場合は空配列を返す
    return res.status(200).json([]);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
