import { create } from "zustand";
import { persist } from "zustand/middleware";
import bcrypt from "bcryptjs";

// =============================================================
// AUTH STORE
// - isAuthenticated IS persisted — stays logged in across reloads
// - Only resets to false when user explicitly calls logout()
// - Passwords stored as bcrypt hashes — never plain text
// =============================================================

export interface AuthUser {
  name: string;
  mobile: string;
  passwordHash: string;
  registeredAt: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  lastSeenName: string | null;

  register: (name: string, mobile: string, password: string) => Promise<void>;
  login: (mobile: string, password: string) => Promise<boolean>;
  logout: () => void;
  isRegistered: () => boolean;
  updateName: (name: string) => void;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      lastSeenName: null,

      register: async (name, mobile, password) => {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const user: AuthUser = {
          name: name.trim(),
          mobile: mobile.trim(),
          passwordHash,
          registeredAt: new Date().toISOString(),
        };
        set({ user, isAuthenticated: true, lastSeenName: user.name });
      },

      login: async (mobile, password) => {
        const { user } = get();
        if (!user) return false;
        if (user.mobile !== mobile.trim()) return false;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (valid) {
          set({ isAuthenticated: true, lastSeenName: user.name });
        }
        return valid;
      },

      // Explicit logout — only this resets isAuthenticated
      logout: () => {
        set({ isAuthenticated: false });
      },

      isRegistered: () => get().user !== null,

      updateName: (name: string) => {
        const { user } = get();
        if (!user) return;
        const updated = { ...user, name: name.trim() };
        set({ user: updated, lastSeenName: updated.name });
      },

      updatePassword: async (currentPassword, newPassword) => {
        const { user } = get();
        if (!user) return { ok: false, error: "Not logged in" };
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) return { ok: false, error: "Current password is incorrect" };
        if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters" };
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        set({ user: { ...user, passwordHash } });
        return { ok: true };
      },
    }),
    {
      name: "orizo-auth",
      // Persist ALL state including isAuthenticated
      // so the user stays logged in across page reloads / app restarts
      partialize: (state) => ({
        user: state.user,
        lastSeenName: state.lastSeenName,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
