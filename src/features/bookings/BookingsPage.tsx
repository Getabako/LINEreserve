import React, { useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Header } from '../../components/common/Header';
import { Loading } from '../../components/common/Loading';
import { useBookingStore } from '../../stores/bookingStore';

export const BookingsPage: React.FC = () => {
  const { bookings, isLoading, fetchBookings, cancelBooking } = useBookingStore();

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancel = async (id: string) => {
    if (confirm('この予約をキャンセルしますか？')) {
      try {
        await cancelBooking(id);
      } catch (error) {
        alert('キャンセルに失敗しました');
      }
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return { text: '予約確定', color: 'bg-green-100 text-green-800' };
      case 'CANCELLED':
        return { text: 'キャンセル', color: 'bg-gray-100 text-gray-600' };
      case 'COMPLETED':
        return { text: '完了', color: 'bg-blue-100 text-blue-800' };
      default:
        return { text: status, color: 'bg-gray-100 text-gray-600' };
    }
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="min-h-screen bg-line-light">
      <Header title="予約履歴" showBack />

      <main className="p-4 space-y-4">
        {bookings.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            予約履歴がありません
          </div>
        ) : (
          bookings.map((booking) => {
            const status = getStatusLabel(booking.status);
            const dateObj = parseISO(booking.date);

            return (
              <div key={booking.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-lg">
                      {format(dateObj, 'yyyy年M月d日(E)', { locale: ja })}
                    </p>
                    <p className="text-line-green font-medium text-xl">
                      {booking.startTime} - {booking.endTime}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${status.color}`}>
                    {status.text}
                  </span>
                </div>

                <div className="border-t pt-3">
                  <p className="text-gray-600">体験授業（60分）</p>
                </div>

                {booking.status === 'CONFIRMED' && (
                  <button
                    onClick={() => handleCancel(booking.id)}
                    className="mt-4 w-full py-2 text-red-500 border border-red-300 rounded-lg text-sm hover:bg-red-50 transition"
                  >
                    キャンセルする
                  </button>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
};
