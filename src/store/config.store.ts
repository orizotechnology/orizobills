import { create } from "zustand";

// =============================================================
// CONFIG STORE
// Tracks whether the MySQL connection has been configured.
// The actual credentials live in the OS keychain via the backend.
// Passwords never touch localStorage — only the backend reads/writes
// to keytar.
// =============================================================

interface ConfigState {
  configured: boolean;
  setConfigured: (v: boolean) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  configured: false,
  setConfigured: (v) => set({ configured: v }),
}));
