'use client';

import { create } from 'zustand';
import { StorageData } from '@/lib/types';

interface Notification {
  message: string;
  type: 'success' | 'error' | '';
}

interface AppState {
  // Data state
  data: StorageData | null;

  // UI state
  notification: Notification | null;

  // Actions
  setData: (data: StorageData) => void;
  showNotification: (message: string, type?: 'success' | 'error' | '') => void;
  clearNotification: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  data: null,
  notification: null,

  setData: (data) => set({ data }),
  showNotification: (message, type = '') => set({ notification: { message, type } }),
  clearNotification: () => set({ notification: null }),
}));
