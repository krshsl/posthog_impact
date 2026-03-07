import { create } from 'zustand';

interface AppState {
  daysWindow: number;
  setDaysWindow: (days: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  daysWindow: 90,
  setDaysWindow: (days) => set({ daysWindow: days }),
}));
