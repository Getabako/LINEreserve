import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCalendarDays, HiUserGroup, HiClipboardDocumentList, HiAcademicCap } from 'react-icons/hi2';
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
      <Header title="体験授業予約" />

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
          <h2 className="text-lg font-semibold mb-4">体験授業を予約する</h2>
          <button
            onClick={() => navigate('/booking')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <HiCalendarDays className="w-5 h-5" />
            予約へ進む
          </button>
        </div>

        {/* メニュー */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/teachers')}
            className="card flex flex-col items-center py-6"
          >
            <HiUserGroup className="w-8 h-8 text-line-green mb-2" />
            <span className="text-sm font-medium">講師一覧</span>
          </button>

          <button
            onClick={() => navigate('/bookings')}
            className="card flex flex-col items-center py-6"
          >
            <HiClipboardDocumentList className="w-8 h-8 text-line-green mb-2" />
            <span className="text-sm font-medium">予約履歴</span>
          </button>
        </div>

        {/* お知らせ */}
        <div className="card">
          <h3 className="font-semibold mb-2">体験授業について</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>・1回60分の無料体験授業です</li>
            <li>・お好きな科目・講師をお選びいただけます</li>
            <li>・予約の変更・キャンセルは前日まで可能です</li>
          </ul>
        </div>
      </main>
    </div>
  );
};
