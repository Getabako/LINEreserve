import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 時間枠の設定
const TIME_SLOTS = [
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
  { start: '17:00', end: '18:00' },
  { start: '18:00', end: '19:00' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 今日から2週間分の日付を生成
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    // 既存の予約枠を削除（開発用）
    await prisma.timeSlot.deleteMany({});

    // 各日に時間枠を作成
    const slotsToCreate = [];
    for (const date of dates) {
      for (const slot of TIME_SLOTS) {
        slotsToCreate.push({
          date,
          startTime: slot.start,
          endTime: slot.end,
          maxCapacity: 1,
          isActive: true,
        });
      }
    }

    await prisma.timeSlot.createMany({
      data: slotsToCreate,
    });

    return res.status(200).json({
      message: 'Seed completed',
      created: slotsToCreate.length,
      dates: dates.map((d) => d.toISOString().split('T')[0]),
    });
  } catch (error) {
    console.error('Seed Error:', error);
    return res.status(500).json({ error: 'Seed failed' });
  }
}
