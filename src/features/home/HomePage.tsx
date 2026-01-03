import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCalendarDays, HiClipboardDocumentList, HiAcademicCap } from 'react-icons/hi2';
import { Header } from '../../components/common/Header';
import { Loading } from '../../components/common/Loading';
import { userApi, type User } from '../../lib/api';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await userApi.getMe();
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  if (isLoading) {
    return <Loading fullScreen text="読み込み中..." />;
  }

  return (
    <div className="min-h-screen bg-line-light">
      <Header title="無料相談予約" />

      <main className="p-4 pb-8 space-y-6">
        {/* ウェルカムカード */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-line-green/10 flex items-center justify-center">
              <HiAcademicCap className="w-8 h-8 text-line-green" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">ようこそ</p>
              <p className="text-lg font-semibold">{user?.displayName ?? 'ゲスト'}さん</p>
            </div>
          </div>
        </div>

        {/* メインアクション */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">無料相談を予約する</h2>
          <button
            onClick={() => navigate('/booking')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <HiCalendarDays className="w-5 h-5" />
            予約へ進む
          </button>
        </div>

        {/* 予約履歴へのリンク */}
        <button
          onClick={() => navigate('/bookings')}
          className="card w-full flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <HiClipboardDocumentList className="w-6 h-6 text-gray-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">予約履歴</p>
            <p className="text-sm text-gray-500">予約の確認・キャンセル</p>
          </div>
        </button>

        {/* お知らせ */}
        <div className="card">
          <h3 className="font-semibold mb-2">無料相談について</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>・1回60分の無料相談です</li>
            <li>・カレンダーからお好きな日時をお選びください</li>
            <li>・予約のキャンセルは予約履歴から行えます</li>
          </ul>
        </div>
      </main>
    </div>
  );
};
