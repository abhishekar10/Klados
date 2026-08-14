import { create } from 'zustand';

import { getSettings, updateSettings, type Settings } from '../lib/settings';

interface SettingsStore {
  settings: Settings | null; // null until loadSettings() resolves
  loadSettings: () => Promise<void>;
  setSettings: (updates: Partial<Omit<Settings, 'id'>>) => Promise<void>;
}

/**
 * In-memory cache of the single settings row, loaded once at app startup (app/_layout.tsx)
 * so screens read it synchronously instead of re-querying SQLite on every render.
 */
export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  loadSettings: async () => {
    set({ settings: await getSettings() });
  },
  setSettings: async (updates) => {
    set({ settings: await updateSettings(updates) });
  },
}));
