import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { google, Auth } from 'googleapis';

const prisma = new PrismaClient();

// ====== Google Calendar設定 ======
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'ifjuku@gmail.com';

// デフォルトの予約可能時間枠（10:00〜18:00の1時間枠）
const DEFAULT_TIME_SLOTS = [
  { startTime: '10:00', endTime: '11:00' },
  { startTime: '11:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '14:00' },
  { startTime: '14:00', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:00' },
  { startTime: '16:00', endTime: '17:00' },
  { startTime: '17:00', endTime: '18:00' },
];

interface CalendarEvent {
  start: string; // ISO datetime or date
  end: string;   // ISO datetime or date
}

// Googleカレンダーから既存の予定を取得
async function getCalendarEvents(date: string): Promise<CalendarEvent[]> {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    console.log('No Google Calendar credentials configured');
    return [];
  }

  try {
    // Base64かJSONかを判定
    const jsonStr = credentials.trim().startsWith('{')
      ? credentials
      : Buffer.from(credentials, 'base64').toString('utf-8');

    const key = JSON.parse(jsonStr);
    if (!key.private_key) {
      console.log('Invalid Google Calendar credentials');
      return [];
    }

    // GoogleAuthを使用（google.auth.JWTはVercelで動作しない）
    const auth = new Auth.GoogleAuth({
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient as Auth.OAuth2Client });

    // 指定日の0:00〜23:59の予定を取得
    const timeMin = new Date(`${date}T00:00:00+09:00`).toISOString();
    const timeMax = new Date(`${date}T23:59:59+09:00`).toISOString();

    const response = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events: CalendarEvent[] = [];
    if (response.data.items) {
      for (const event of response.data.items) {
        if (event.start && event.end) {
          // dateTime（時間指定あり）またはdate（終日）
          const start = event.start.dateTime || event.start.date || '';
          const end = event.end.dateTime || event.end.date || '';
          if (start && end) {
            events.push({ start, end });
          }
        }
      }
    }

    return events;
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return [];
  }
}

// 時間文字列をその日の分数に変換（例: "10:30" -> 630）
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// ISO日時から時間部分を抽出して分数に変換
function dateTimeToMinutes(dateTimeStr: string, targetDate: string): number | null {
  try {
    // 終日イベントの場合（日付のみ、時間なし）
    if (dateTimeStr.length === 10) { // "2024-01-01" format
      // 終日イベントの場合は0:00〜23:59として扱う
      return dateTimeStr === targetDate ? 0 : null;
    }

    const dateTime = new Date(dateTimeStr);
    // 日本時間に変換
    const jstString = dateTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const jstDate = new Date(jstString);

    const eventDate = dateTime.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

    // 対象日と同じ日かチェック
    if (!eventDate.includes(targetDate.slice(5))) { // 月日部分だけ比較
      return null;
    }

    return jstDate.getHours() * 60 + jstDate.getMinutes();
  } catch {
    return null;
  }
}

// 時間枠が既存の予定と重複しているかチェック
function isSlotOverlapping(
  slotStart: number,
  slotEnd: number,
  events: CalendarEvent[],
  targetDate: string
): boolean {
  for (const event of events) {
    // 終日イベントの場合
    if (event.start.length === 10) {
      // 終日イベントはその日全体をブロック
      return true;
    }

    const eventStart = dateTimeToMinutes(event.start, targetDate);
    const eventEnd = dateTimeToMinutes(event.end, targetDate);

    if (eventStart === null || eventEnd === null) continue;

    // 重複チェック: 時間枠と予定が重なっているか
    // 重なる条件: slotStart < eventEnd && slotEnd > eventStart
    if (slotStart < eventEnd && slotEnd > eventStart) {
      return true;
    }
  }
  return false;
}

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
      // Googleカレンダーの既存予定を取得
      const calendarEvents = await getCalendarEvents(date);
      console.log(`Found ${calendarEvents.length} calendar events for ${date}`);

      // データベースから既存の予約（Booking）を取得
      const targetDate = new Date(date);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      // TimeSlotテーブルからデータを取得（存在する場合）
      const existingSlots = await prisma.timeSlot.findMany({
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

      // TimeSlotが存在する場合はそれを使用、なければデフォルト時間枠を動的生成
      let response;

      if (existingSlots.length > 0) {
        // 既存のTimeSlotを使用
        response = existingSlots
          .map((slot) => {
            const slotStartMinutes = timeToMinutes(slot.startTime);
            const slotEndMinutes = timeToMinutes(slot.endTime);
            const isOverlapping = isSlotOverlapping(slotStartMinutes, slotEndMinutes, calendarEvents, date);

            // 既存予定と重複している場合は表示しない
            if (isOverlapping) {
              return null;
            }

            return {
              id: slot.id,
              date: slot.date.toISOString().split('T')[0],
              startTime: slot.startTime,
              endTime: slot.endTime,
              maxCapacity: slot.maxCapacity,
              currentBookings: slot._count.bookings,
              available: slot._count.bookings < slot.maxCapacity,
            };
          })
          .filter((slot) => slot !== null);
      } else {
        // デフォルト時間枠を動的に生成
        // 当日の場合は現在時刻以降の枠のみ表示
        const now = new Date();
        const isToday = date === now.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        const currentMinutes = isToday
          ? now.getHours() * 60 + now.getMinutes() + 60 // 1時間後から予約可能
          : 0;

        response = DEFAULT_TIME_SLOTS
          .map((slot, index) => {
            const slotStartMinutes = timeToMinutes(slot.startTime);
            const slotEndMinutes = timeToMinutes(slot.endTime);

            // 当日で過ぎた時間枠はスキップ
            if (slotStartMinutes < currentMinutes) {
              return null;
            }

            // 既存予定と重複している場合はスキップ
            const isOverlapping = isSlotOverlapping(slotStartMinutes, slotEndMinutes, calendarEvents, date);
            if (isOverlapping) {
              return null;
            }

            // 動的に生成したスロットにはTimeSlotを作成して返す
            return {
              id: `dynamic-${date}-${index}`,
              date: date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              maxCapacity: 1,
              currentBookings: 0,
              available: true,
            };
          })
          .filter((slot) => slot !== null);
      }

      return res.status(200).json(response);
    }

    // 日付が指定されていない場合は空配列を返す
    return res.status(200).json([]);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
