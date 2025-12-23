import React, { useEffect, useState } from 'react';
import { Header } from '../../components/common/Header';
import { Loading } from '../../components/common/Loading';
import { teacherApi, type Teacher } from '../../lib/api';

export const TeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const data = await teacherApi.getAll();
        setTeachers(data);
      } catch (error) {
        console.error('Failed to fetch teachers:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTeachers();
  }, []);

  if (isLoading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="min-h-screen bg-line-light">
      <Header title="講師一覧" showBack />

      <main className="p-4 space-y-4">
        {teachers.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            講師情報がありません
          </div>
        ) : (
          teachers.map((teacher) => (
            <div key={teacher.id} className="card">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                  {teacher.pictureUrl ? (
                    <img
                      src={teacher.pictureUrl}
                      alt={teacher.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                      {teacher.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{teacher.name}</h3>
                  {teacher.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {teacher.specialties.map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-line-green/10 text-line-green px-2 py-0.5 rounded"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {teacher.bio && (
                    <p className="text-sm text-gray-600 mt-2">{teacher.bio}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};
