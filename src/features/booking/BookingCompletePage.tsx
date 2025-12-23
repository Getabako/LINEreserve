import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCheckCircle } from 'react-icons/hi2';

export const BookingCompletePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-line-light flex flex-col items-center justify-center p-4">
      <div className="card text-center max-w-sm w-full">
        <HiCheckCircle className="w-16 h-16 text-line-green mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">予約が完了しました</h1>
        <p className="text-gray-600 mb-6">
          体験授業のご予約ありがとうございます。<br />
          当日お会いできることを楽しみにしております。
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/bookings')}
            className="btn-primary w-full"
          >
            予約内容を確認
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary w-full"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    </div>
  );
};
