import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, addDays, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Header } from '../../components/common/Header';
import { Loading } from '../../components/common/Loading';
import { useBookingStore } from '../../stores/bookingStore';
import { slotApi, bookingApi, type TimeSlot } from '../../lib/api';

export const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedDate,
    selectedSlotId,
    setSelectedDate,
    setSelectedSlot,
  } = useBookingStore();

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: 日程選択, 2: 確認

  // 2週間分の日付を生成
  const dates = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(startOfDay(new Date()), i);
    return format(date, 'yyyy-MM-dd');
  });

  useEffect(() => {
    if (selectedDate) {
      const fetchSlots = async () => {
        setIsLoading(true);
        try {
          const slotsData = await slotApi.getByDate(selectedDate);
          setSlots(slotsData);
        } catch (error) {
          console.error('Failed to fetch slots:', error);
          setSlots([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchSlots();
    }
  }, [selectedDate]);

  const handleSubmit = async () => {
    if (!selectedSlotId || !selectedDate) return;

    setIsSubmitting(true);
    try {
      await bookingApi.create({
        timeSlotId: selectedSlotId,
        date: selectedDate,
      });
      navigate('/booking/complete');
    } catch (error) {
      console.error('Booking failed:', error);
      alert('予約に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  return (
    <div className="min-h-screen bg-line-light">
      <Header title="体験授業予約" showBack />

      <main className="p-4 pb-24">
        {/* ステップ表示 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s <= step ? 'bg-line-green text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 2 && <div className={`w-8 h-0.5 ${s < step ? 'bg-line-green' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: 日程選択 */}
        {step === 1 && (
          <div className="space-y-6">
            {/* 日付選択 */}
            <div className="card">
              <h3 className="font-semibold mb-3">日付を選択</h3>
              <div className="grid grid-cols-4 gap-2">
                {dates.map((date) => {
                  const dateObj = parseISO(date);
                  const isToday = date === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <button
                      key={date}
                      onClick={() => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                      }}
                      className={`p-2 rounded-lg border text-center transition ${
                        selectedDate === date
                          ? 'border-line-green bg-line-green/10 text-line-green'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-xs text-gray-500">
                        {isToday ? '今日' : format(dateObj, 'E', { locale: ja })}
                      </p>
                      <p className="font-medium">{format(dateObj, 'M/d')}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 時間枠選択 */}
            {selectedDate && (
              <div className="card">
                <h3 className="font-semibold mb-3">
                  {format(parseISO(selectedDate), 'M月d日(E)', { locale: ja })}の時間を選択
                </h3>
                {isLoading ? (
                  <div className="py-8">
                    <Loading text="読み込み中..." />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">この日は予約枠がありません</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => slot.available && setSelectedSlot(slot.id)}
                        disabled={!slot.available}
                        className={`p-3 rounded-lg border text-center transition ${
                          !slot.available
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : selectedSlotId === slot.id
                            ? 'border-line-green bg-line-green/10 text-line-green'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-medium">{slot.startTime}</p>
                        {!slot.available && <p className="text-xs">満席</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: 確認 */}
        {step === 2 && (
          <div className="card">
            <h3 className="font-semibold mb-4">予約内容の確認</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">日付</span>
                <span className="font-medium">
                  {selectedDate && format(parseISO(selectedDate), 'yyyy年M月d日(E)', { locale: ja })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">時間</span>
                <span className="font-medium">
                  {selectedSlot?.startTime}〜{selectedSlot?.endTime}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">内容</span>
                <span className="font-medium">体験授業（60分）</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              ※ キャンセルは予約一覧から行えます
            </p>
          </div>
        )}
      </main>

      {/* フッターボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="btn-secondary flex-1"
            >
              戻る
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!selectedSlotId}
              className="btn-primary flex-1"
            >
              次へ
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary flex-1"
            >
              {isSubmitting ? '予約中...' : '予約を確定する'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
