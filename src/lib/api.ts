import { getAccessToken } from './liff';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
};

export const api = {
  get: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse<T>(response);
  },

  post: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<T>(response);
  },
};

// Types
export interface User {
  id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  email?: string;
  phone?: string;
}

export interface Teacher {
  id: string;
  name: string;
  pictureUrl?: string;
  bio?: string;
  specialties: string[];
}

export interface Subject {
  id: string;
  name: string;
  description?: string;
  duration: number;
}

export interface TimeSlot {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherPicture?: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  remainingSeats: number;
}

export interface Booking {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherPicture?: string;
  subjectId: string;
  subjectName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  notes?: string;
  createdAt: string;
}

// API functions
export const userApi = {
  getMe: () => api.get<User>('/users/me'),
};

export const teacherApi = {
  getAll: () => api.get<Teacher[]>('/teachers'),
};

export const subjectApi = {
  getAll: () => api.get<Subject[]>('/subjects'),
};

export const slotApi = {
  getByDate: (date: string, teacherId?: string) => {
    const params = new URLSearchParams({ date });
    if (teacherId) params.append('teacherId', teacherId);
    return api.get<TimeSlot[]>(`/slots?${params}`);
  },
  getAvailableDates: () => api.get<{ availableDates: string[] }>('/slots'),
};

export const bookingApi = {
  getAll: () => api.get<Booking[]>('/bookings'),
  create: (data: { teacherId: string; subjectId: string; timeSlotId: string; notes?: string }) =>
    api.post<Booking>('/bookings', data),
  cancel: (id: string) => api.delete<void>(`/bookings/${id}`),
};
