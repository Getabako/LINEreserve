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

  const { date, teacherId } = req.query;

  try {
    // 日付が指定されている場合、その日の予約枠を取得
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
          ...(teacherId && typeof teacherId === 'string' && { teacherId }),
        },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              pictureUrl: true,
            },
          },
        },
        orderBy: [{ startTime: 'asc' }, { teacherId: 'asc' }],
      });

      const response = slots.map((slot) => ({
        id: slot.id,
        teacherId: slot.teacherId,
        teacherName: slot.teacher.name,
        teacherPicture: slot.teacher.pictureUrl,
        date: slot.date.toISOString().split('T')[0],
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: slot.booked < slot.capacity,
        remainingSeats: slot.capacity - slot.booked,
      }));

      return res.status(200).json(response);
    }

    // 日付が指定されていない場合、今後2週間の予約可能な日を返す
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

    const slots = await prisma.timeSlot.findMany({
      where: {
        date: {
          gte: today,
          lt: twoWeeksLater,
        },
        isActive: true,
      },
      select: {
        date: true,
      },
      distinct: ['date'],
      orderBy: { date: 'asc' },
    });

    const availableDates = slots.map((slot) => slot.date.toISOString().split('T')[0]);

    return res.status(200).json({ availableDates });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
