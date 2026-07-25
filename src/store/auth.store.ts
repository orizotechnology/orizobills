import { create } from "zustand";
import { persist } from "zustand/middleware";
import bcrypt from "bcryptjs";

// =============================================================
// AUTH STORE — Role-based (Admin + Officers)
//
// Storage:
//   "orizo-admin"    → single AdminUser (business owner)
//   "orizo-officers" → OfficerUser[] (staff accounts)
//   "orizo-session"  → active session (who is logged in now)
//
// Rules:
//   - First run: admin registers with name, mobile, password,
//     role="admin", businessType
//   - If admin is already logged in → only officers can log in
//   - Admin logout → both roles can log in again
//   - Officers are created by admin from Settings
//   - Each user has independent credentials
// =============================================================

export type UserRole = "admin" | "officer";

export const BUSINESS_TYPES = [
  "Retail Shop",
  "Wholesale",
  "Clothing & Apparel",
  "Electronics",
  "Grocery & Supermarket",
  "Pharmacy / Medical",
  "Restaurant / Food",
  "Hardware & Tools",
  "Furniture",
  "Jewellery",
  "Auto Parts",
  "Stationery & Books",
  "Agriculture & Seeds",
  "Mobile & Accessories",
  "General Trading",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface AdminUser {
  name:         string;
  mobile:       string;
  passwordHash: string;
  businessType: BusinessType | string;
  registeredAt: string;
  role:         "admin";
}

export interface OfficerUser {
  id:           string;
  name:         string;
  mobile:       string;
  passwordHash: string;
  createdAt:    string;
  role:         "officer";
  isActive:     boolean;
}

export interface ActiveSession {
  name:         string;
  mobile:       string;
  role:         UserRole;
  businessType: string;
  loginAt:      string;
}

interface AuthState {
  // Persisted separately
  admin:         AdminUser | null;
  officers:      OfficerUser[];
  session:       ActiveSession | null;
  _hasHydrated:  boolean;

  // Computed
  isAuthenticated: boolean;
  lastSeenName:    string | null;

  setHasHydrated: (v: boolean) => void;

  // Admin registration (first run)
  registerAdmin: (
    name: string, mobile: string, password: string, businessType: string
  ) => Promise<void>;

  // Login — picks admin or officer based on role
  login: (mobile: string, password: string, role: UserRole) => Promise<{ ok: boolean; error?: string }>;

  // Logout current session
  logout: () => void;

  // Officer management (admin only)
  addOfficer:    (name: string, mobile: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  removeOfficer: (id: string) => void;
  toggleOfficer: (id: string) => void;

  // Helpers
  isAdminRegistered:  () => boolean;
  isAdminLoggedIn:    () => boolean;
  canAdminLogin:      () => boolean;  // false if admin already active
  getActiveSession:   () => ActiveSession | null;
  updateAdminPassword:(current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
  updateAdminName:    (name: string) => void;
}

// ── Admin store (single object) ───────────────────────────────
const adminStore = create<{ admin: AdminUser | null; set: (a: AdminUser | null) => void }>()(
  persist(
    (set) => ({ admin: null, set: (a) => set({ admin: a }) }),
    { name: "orizo-admin" }
  )
);

// ── Officers store (array) ────────────────────────────────────
const officersStore = create<{ officers: OfficerUser[]; set: (o: OfficerUser[]) => void }>()(
  persist(
    (set) => ({ officers: [], set: (o) => set({ officers: o }) }),
    { name: "orizo-officers" }
  )
);

// ── Main session store ────────────────────────────────────────
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      admin:           null,
      officers:        [],
      session:         null,
      _hasHydrated:    false,
      isAuthenticated: false,
      lastSeenName:    null,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      registerAdmin: async (name, mobile, password, businessType) => {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const admin: AdminUser = {
          name: name.trim(), mobile: mobile.trim(),
          passwordHash, businessType,
          registeredAt: new Date().toISOString(), role: "admin",
        };
        const session: ActiveSession = {
          name: admin.name, mobile: admin.mobile,
          role: "admin", businessType, loginAt: new Date().toISOString(),
        };
        set({ admin, session, isAuthenticated: true, lastSeenName: admin.name });
      },

      login: async (mobile, password, role) => {
        const state = get();

        if (role === "admin") {
          const admin = state.admin;
          if (!admin) return { ok: false, error: "No admin account found." };
          // Block if admin is already in an active session
          if (state.session?.role === "admin")
            return { ok: false, error: "Admin is already logged in on this device. Only officers can log in now." };
          if (admin.mobile !== mobile.trim()) return { ok: false, error: "Incorrect mobile number or password." };
          const valid = await bcrypt.compare(password, admin.passwordHash);
          if (!valid) return { ok: false, error: "Incorrect mobile number or password." };
          const session: ActiveSession = {
            name: admin.name, mobile: admin.mobile,
            role: "admin", businessType: admin.businessType,
            loginAt: new Date().toISOString(),
          };
          set({ session, isAuthenticated: true, lastSeenName: admin.name });
          return { ok: true };
        }

        // Officer login
        const officer = state.officers.find(
          (o) => o.mobile === mobile.trim() && o.isActive
        );
        if (!officer) return { ok: false, error: "Incorrect mobile number or password." };
        const valid = await bcrypt.compare(password, officer.passwordHash);
        if (!valid) return { ok: false, error: "Incorrect mobile number or password." };
        const session: ActiveSession = {
          name: officer.name, mobile: officer.mobile,
          role: "officer", businessType: state.admin?.businessType ?? "",
          loginAt: new Date().toISOString(),
        };
        set({ session, isAuthenticated: true, lastSeenName: officer.name });
        return { ok: true };
      },

      logout: () => set({ session: null, isAuthenticated: false }),

      addOfficer: async (name, mobile, password) => {
        const { officers } = get();
        if (officers.some((o) => o.mobile === mobile.trim()))
          return { ok: false, error: "An officer with this mobile already exists." };
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const officer: OfficerUser = {
          id: `off_${Date.now()}`,
          name: name.trim(), mobile: mobile.trim(),
          passwordHash, createdAt: new Date().toISOString(),
          role: "officer", isActive: true,
        };
        set({ officers: [...officers, officer] });
        return { ok: true };
      },

      removeOfficer: (id) => set({ officers: get().officers.filter((o) => o.id !== id) }),

      toggleOfficer: (id) => set({
        officers: get().officers.map((o) => o.id === id ? { ...o, isActive: !o.isActive } : o),
      }),

      isAdminRegistered: () => !!get().admin,

      isAdminLoggedIn: () => get().session?.role === "admin",

      canAdminLogin: () => get().session?.role !== "admin",

      getActiveSession: () => get().session,

      updateAdminName: (name) => {
        const { admin } = get();
        if (!admin) return;
        const updated = { ...admin, name: name.trim() };
        set({ admin: updated, lastSeenName: updated.name });
      },

      updateAdminPassword: async (current, next) => {
        const { admin } = get();
        if (!admin) return { ok: false, error: "Not logged in" };
        const valid = await bcrypt.compare(current, admin.passwordHash);
        if (!valid) return { ok: false, error: "Current password is incorrect" };
        if (next.length < 6) return { ok: false, error: "New password must be at least 6 characters" };
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(next, salt);
        set({ admin: { ...admin, passwordHash } });
        return { ok: true };
      },
    }),
    {
      name: "orizo-session",
      partialize: (state) => ({
        admin:           state.admin,
        officers:        state.officers,
        session:         state.session,
        isAuthenticated: state.isAuthenticated,
        lastSeenName:    state.lastSeenName,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
