import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, addDays, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Header } from '../../components/common/Header';
import { Loading } from '../../components/common/Loading';
import { useBookingStore } from '../../stores/bookingStore';
import { teacherApi, subjectApi, slotApi, type Teacher, type Subject, type TimeSlot } from '../../lib/api';

export const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    selectedTeacherId,
    selectedSubjectId,
    selectedDate,
    selectedSlotId,
    setSelectedTeacher,
    setSelectedSubject,
    setSelectedDate,
    setSelectedSlot,
    createBooking,
  } = useBookingStore();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: 科目・講師, 2: 日程, 3: 確認

  // 2週間分の日付を生成
  const dates = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(startOfDay(new Date()), i);
    return format(date, 'yyyy-MM-dd');
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teachersData, subjectsData] = await Promise.all([
          teacherApi.getAll(),
          subjectApi.getAll(),
        ]);
        setTeachers(teachersData);
        setSubjects(subjectsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedDate && selectedTeacherId) {
      const fetchSlots = async () => {
        try {
          const slotsData = await slotApi.getByDate(selectedDate, selectedTeacherId);
          setSlots(slotsData);
        } catch (error) {
          console.error('Failed to fetch slots:', error);
          setSlots([]);
        }
      };
      fetchSlots();
    }
  }, [selectedDate, selectedTeacherId]);

  const handleSubmit = async () => {
    if (!selectedTeacherId || !selectedSubjectId || !selectedSlotId) return;

    setIsSubmitting(true);
    try {
      await createBooking({
        teacherId: selectedTeacherId,
        subjectId: selectedSubjectId,
        timeSlotId: selectedSlotId,
      });
      navigate('/booking/complete');
    } catch (error) {
      alert('予約に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  return (
    <div className="min-h-screen bg-line-light">
      <Header title="体験授業予約" showBack />

      <main className="p-4 pb-24">
        {/* ステップ表示 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s <= step ? 'bg-line-green text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-line-green' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: 科目・講師選択 */}
        {step === 1 && (
          <div className="space-y-6">
            {/* 科目選択 */}
            <div className="card">
              <h3 className="font-semibold mb-3">科目を選択</h3>
              <div className="grid grid-cols-2 gap-2">
                {subjects.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubject(subject.id)}
                    className={`p-3 rounded-lg border text-sm transition ${
                      selectedSubjectId === subject.id
                        ? 'border-line-green bg-line-green/10 text-line-green'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {subject.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 講師選択 */}
            <div className="card">
              <h3 className="font-semibold mb-3">講師を選択</h3>
              <div className="space-y-2">
                {teachers.map((teacher) => (
                  <button
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher.id)}
                    className={`w-full p-3 rounded-lg border flex items-center gap-3 transition ${
                      selectedTeacherId === teacher.id
                        ? 'border-line-green bg-line-green/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                      {teacher.pictureUrl ? (
                        <img src={teacher.pictureUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                          {teacher.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{teacher.name}</p>
                      {teacher.specialties.length > 0 && (
                        <p className="text-xs text-gray-500">{teacher.specialties.join('・')}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 日程選択 */}
        {step === 2 && (
          <div className="space-y-6">
            {/* 日付選択 */}
            <div className="card">
              <h3 className="font-semibold mb-3">日付を選択</h3>
              <div className="grid grid-cols-4 gap-2">
                {dates.map((date) => {
                  const dateObj = parseISO(date);
                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`p-2 rounded-lg border text-center transition ${
                        selectedDate === date
                          ? 'border-line-green bg-line-green/10 text-line-green'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-xs text-gray-500">{format(dateObj, 'E', { locale: ja })}</p>
                      <p className="font-medium">{format(dateObj, 'd')}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 時間枠選択 */}
            {selectedDate && (
              <div className="card">
                <h3 className="font-semibold mb-3">時間を選択</h3>
                {slots.length === 0 ? (
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

        {/* Step 3: 確認 */}
        {step === 3 && (
          <div className="card">
            <h3 className="font-semibold mb-4">予約内容の確認</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">科目</span>
                <span className="font-medium">{selectedSubject?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">講師</span>
                <span className="font-medium">{selectedTeacher?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">日時</span>
                <span className="font-medium">
                  {selectedDate && format(parseISO(selectedDate), 'M月d日(E)', { locale: ja })}
                  {' '}
                  {selectedSlot?.startTime}〜{selectedSlot?.endTime}
                </span>
              </div>
            </div>
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
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && (!selectedSubjectId || !selectedTeacherId)) ||
                (step === 2 && !selectedSlotId)
              }
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
