import { create } from 'zustand';
import { bookingApi, type Booking } from '../lib/api';

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;

  // 予約フォームの状態
  selectedTeacherId: string | null;
  selectedSubjectId: string | null;
  selectedDate: string | null;
  selectedSlotId: string | null;

  fetchBookings: () => Promise<void>;
  createBooking: (data: { teacherId: string; subjectId: string; timeSlotId: string; notes?: string }) => Promise<Booking>;
  cancelBooking: (id: string) => Promise<void>;

  setSelectedTeacher: (id: string | null) => void;
  setSelectedSubject: (id: string | null) => void;
  setSelectedDate: (date: string | null) => void;
  setSelectedSlot: (id: string | null) => void;
  resetSelection: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  isLoading: false,
  error: null,

  selectedTeacherId: null,
  selectedSubjectId: null,
  selectedDate: null,
  selectedSlotId: null,

  fetchBookings: async () => {
    set({ isLoading: true, error: null });
    try {
      const bookings = await bookingApi.getAll();
      set({ bookings, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch bookings',
        isLoading: false,
      });
    }
  },

  createBooking: async (data) => {
    const booking = await bookingApi.create(data);
    set((state) => ({ bookings: [booking, ...state.bookings] }));
    get().resetSelection();
    return booking;
  },

  cancelBooking: async (id) => {
    await bookingApi.cancel(id);
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id ? { ...b, status: 'CANCELLED' as const } : b
      ),
    }));
  },

  setSelectedTeacher: (id) => set({ selectedTeacherId: id }),
  setSelectedSubject: (id) => set({ selectedSubjectId: id }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedSlotId: null }),
  setSelectedSlot: (id) => set({ selectedSlotId: id }),

  resetSelection: () => set({
    selectedTeacherId: null,
    selectedSubjectId: null,
    selectedDate: null,
    selectedSlotId: null,
  }),
}));
