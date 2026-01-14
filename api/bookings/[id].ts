import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { google, Auth } from 'googleapis';

const prisma = new PrismaClient();

// ====== Google Calendar設定 ======
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'ifjuku@gmail.com';

async function getCalendarClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    console.error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
    return null;
  }

  try {
    let jsonStr: string;

    // Base64かJSONかを判定（{で始まるならJSON）
    if (credentials.trim().startsWith('{')) {
      jsonStr = credentials;
    } else {
      jsonStr = Buffer.from(credentials, 'base64').toString('utf-8');
    }

    const key = JSON.parse(jsonStr);
    const auth = new Auth.GoogleAuth({
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const authClient = await auth.getClient();
    return google.calendar({ version: 'v3', auth: authClient as Auth.OAuth2Client });
  } catch (error) {
    console.error('Failed to initialize calendar client:', error);
    return null;
  }
}

async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const calendar = await getCalendarClient();
  if (!calendar) return false;

  try {
    await calendar.events.delete({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: eventId,
    });
    return true;
  } catch (error) {
    console.error('Calendar event deletion failed:', error);
    return false;
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
  const message = `${actionText}\n\n👤 ${userName}\n📅 ${dateStr}\n🕐 ${time}\n\n体験授業の予約${action === 'created' ? 'が入りました' : 'がキャンセルされました'}。`;

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
        user: { select: { displayName: true } },
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

      // 予約をキャンセル
      await prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Googleカレンダーから削除
      if (booking.calendarEventId) {
        deleteCalendarEvent(booking.calendarEventId);
      }

      // LINE通知を送信
      const formattedDate = formatDate(booking.timeSlot.date);
      const timeRange = `${booking.timeSlot.startTime}〜${booking.timeSlot.endTime}`;
      sendLineNotification(booking.user.displayName, formattedDate, timeRange, 'cancelled');

      return res.status(200).json({ message: 'Booking cancelled' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
