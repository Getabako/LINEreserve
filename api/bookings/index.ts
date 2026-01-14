import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { google, Auth } from 'googleapis';

const prisma = new PrismaClient();

// ====== Google Calendar設定 ======
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'ifjuku@gmail.com';

async function addCalendarEvent(
  summary: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<string | null> {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) return null;

  try {
    // Base64かJSONかを判定
    const jsonStr = credentials.trim().startsWith('{')
      ? credentials
      : Buffer.from(credentials, 'base64').toString('utf-8');

    const key = JSON.parse(jsonStr);
    if (!key.private_key) return null;

    // GoogleAuthを使用（google.auth.JWTはVercelで動作しない）
    const auth = new Auth.GoogleAuth({
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient as Auth.OAuth2Client });

    const response = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary,
        start: { dateTime: `${date}T${startTime}:00`, timeZone: 'Asia/Tokyo' },
        end: { dateTime: `${date}T${endTime}:00`, timeZone: 'Asia/Tokyo' },
      },
    });

    return response.data.id || null;
  } catch (error) {
    console.error('Calendar event creation failed:', error);
    return null;
  }
}

// ====== LINE通知設定 ======
async function sendLineNotification(
  userName: string,
  dateStr: string,
  time: string,
  action: 'created' | 'cancelled'
): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const adminUserId = process.env.LINE_ADMIN_USER_ID;

  if (!token || !adminUserId) return;

  const actionText = action === 'created' ? '🆕 新規予約' : '❌ キャンセル';
  const message = `${actionText}\n\n👤 ${userName}\n📅 ${dateStr}\n🕐 ${time}\n\n無料相談の予約${action === 'created' ? 'が入りました' : 'がキャンセルされました'}。`;

  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/push',
      { to: adminUserId, messages: [{ type: 'text', text: message }] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    console.error('LINE notification failed:', error);
  }
}

// ====== LIFF認証 ======
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

  // 開発環境のみモックトークンを許可
  if (process.env.NODE_ENV !== 'production' && accessToken === 'mock-access-token-for-development') {
    return { userId: 'U_dev_user_12345', displayName: '開発ユーザー' };
  }

  try {
    const response = await axios.get<LiffProfile>('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch {
    return null;  // 認証失敗時はnullを返す（フォールバックしない）
  }
}

// ====== 日付フォーマット ======
function formatDate(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = days[date.getDay()];
  return `${y}年${m}月${d}日(${day})`;
}

// ====== メインハンドラー ======
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
          timeSlot: { select: { date: true, startTime: true, endTime: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json(
        bookings.map((b) => ({
          id: b.id,
          date: b.timeSlot.date.toISOString().split('T')[0],
          startTime: b.timeSlot.startTime,
          endTime: b.timeSlot.endTime,
          status: b.status,
          notes: b.notes,
          createdAt: b.createdAt.toISOString(),
        }))
      );
    }

    if (req.method === 'POST') {
      const { timeSlotId, date, notes } = req.body;

      if (!timeSlotId) {
        return res.status(400).json({ error: 'timeSlotId is required' });
      }

      let slot;
      let actualTimeSlotId = timeSlotId;

      // 動的に生成されたスロットかどうかをチェック
      if (timeSlotId.startsWith('dynamic-')) {
        // dynamic-{date}-{index} 形式から情報を抽出
        const parts = timeSlotId.split('-');
        const slotDate = `${parts[1]}-${parts[2]}-${parts[3]}`;
        const slotIndex = parseInt(parts[4], 10);

        // デフォルトの時間枠定義
        const DEFAULT_TIME_SLOTS = [
          { startTime: '10:00', endTime: '11:00' },
          { startTime: '11:00', endTime: '12:00' },
          { startTime: '13:00', endTime: '14:00' },
          { startTime: '14:00', endTime: '15:00' },
          { startTime: '15:00', endTime: '16:00' },
          { startTime: '16:00', endTime: '17:00' },
          { startTime: '17:00', endTime: '18:00' },
        ];

        const slotInfo = DEFAULT_TIME_SLOTS[slotIndex];
        if (!slotInfo) {
          return res.status(400).json({ error: 'Invalid time slot' });
        }

        // TimeSlotがすでに存在するかチェック（同じ日付と開始時間）
        const targetDate = new Date(slotDate);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);

        const existingSlot = await prisma.timeSlot.findFirst({
          where: {
            date: {
              gte: targetDate,
              lt: nextDate,
            },
            startTime: slotInfo.startTime,
          },
          include: {
            _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
          },
        });

        if (existingSlot) {
          // 既存のスロットを使用
          slot = existingSlot;
          actualTimeSlotId = existingSlot.id;

          if (slot._count.bookings >= slot.maxCapacity) {
            return res.status(400).json({ error: 'This time slot is fully booked' });
          }
        } else {
          // 新しいTimeSlotを作成
          slot = await prisma.timeSlot.create({
            data: {
              date: targetDate,
              startTime: slotInfo.startTime,
              endTime: slotInfo.endTime,
              maxCapacity: 1,
              isActive: true,
            },
          });
          actualTimeSlotId = slot.id;
          // 作成したばかりなので予約数は0
          (slot as typeof slot & { _count: { bookings: number } })._count = { bookings: 0 };
        }
      } else {
        // 既存のTimeSlotを使用
        slot = await prisma.timeSlot.findUnique({
          where: { id: timeSlotId },
          include: {
            _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
          },
        });

        if (!slot) {
          return res.status(404).json({ error: 'Time slot not found' });
        }

        if (slot._count.bookings >= slot.maxCapacity) {
          return res.status(400).json({ error: 'This time slot is fully booked' });
        }
      }

      const existingBooking = await prisma.booking.findFirst({
        where: { userId: user.id, timeSlotId: actualTimeSlotId, status: 'CONFIRMED' },
      });

      if (existingBooking) {
        return res.status(400).json({ error: 'You have already booked this time slot' });
      }

      // 予約を作成
      const booking = await prisma.booking.create({
        data: { userId: user.id, timeSlotId: actualTimeSlotId, notes },
        include: { timeSlot: { select: { date: true, startTime: true, endTime: true } } },
      });

      const dateStr = booking.timeSlot.date.toISOString().split('T')[0];
      const formattedDate = formatDate(booking.timeSlot.date);
      const timeRange = `${booking.timeSlot.startTime}〜${booking.timeSlot.endTime}`;

      // Googleカレンダーに追加（非同期で実行、エラーでも予約は成功）
      const calendarEventId = await addCalendarEvent(
        `【無料相談】${user.displayName}様`,
        dateStr,
        booking.timeSlot.startTime,
        booking.timeSlot.endTime
      );

      // カレンダーイベントIDを保存
      if (calendarEventId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { calendarEventId },
        });
      }

      // LINE通知を送信（非同期で実行）
      sendLineNotification(user.displayName, formattedDate, timeRange, 'created');

      return res.status(201).json({
        id: booking.id,
        date: dateStr,
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
