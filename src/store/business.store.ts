import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================
// BUSINESS STORE
// Holds the store / business profile details that appear on
// invoices, receipts, and the profile panel.
// =============================================================

export interface BusinessProfile {
  storeName: string;
  address: string;
  phone: string;
  email: string;
  upiId: string;
  website: string;
  logoUrl: string; // base64 data URL or empty string
}

interface BusinessState {
  profile: BusinessProfile;
  updateProfile: (patch: Partial<BusinessProfile>) => void;
}

const DEFAULT_PROFILE: BusinessProfile = {
  storeName: "",
  address: "",
  phone: "",
  email: "",
  upiId: "",
  website: "",
  logoUrl: "",
};

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,

      updateProfile: (patch) =>
        set((state) => ({
          profile: { ...state.profile, ...patch },
        })),
    }),
    {
      name: "orizo-business",
    }
  )
);
