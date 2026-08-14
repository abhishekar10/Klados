import { create } from 'zustand';

interface ToastState {
  toast: { id: number; message: string } | null;
  show: (message: string) => void;
  hide: () => void;
}

let nextId = 0;

/** In-app (not OS) notification banner state, shown via components/Toast.tsx mounted once at the root. */
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message) => set({ toast: { id: nextId++, message } }),
  hide: () => set({ toast: null }),
}));
