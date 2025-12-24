import { create } from 'zustand';
import { bookingApi, type Booking } from '../lib/api';

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;

  // 予約フォームの状態
  selectedDate: string | null;
  selectedSlotId: string | null;

  fetchBookings: () => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;

  setSelectedDate: (date: string | null) => void;
  setSelectedSlot: (id: string | null) => void;
  resetSelection: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  bookings: [],
  isLoading: false,
  error: null,

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

  cancelBooking: async (id) => {
    await bookingApi.cancel(id);
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id ? { ...b, status: 'CANCELLED' as const } : b
      ),
    }));
  },

  setSelectedDate: (date) => set({ selectedDate: date, selectedSlotId: null }),
  setSelectedSlot: (id) => set({ selectedSlotId: id }),

  resetSelection: () => set({
    selectedDate: null,
    selectedSlotId: null,
  }),
}));
