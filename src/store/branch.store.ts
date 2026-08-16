import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================
// BRANCH STORE
// Tracks the list of branches and the currently active branch.
// Branches fetched from backend; active branch persisted locally.
// =============================================================

export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BranchState {
  branches: Branch[];
  activeBranchId: string | null;

  // Setters
  setBranches: (branches: Branch[]) => void;
  addBranch: (branch: Branch) => void;
  setActiveBranch: (id: string) => void;
  getActiveBranch: () => Branch | null;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      branches: [],
      activeBranchId: null,

      setBranches: (branches) => {
        const current = get().activeBranchId;
        const stillValid = current && branches.some((b) => b.id === current);
        // If the persisted ID is still in the fresh list, keep it.
        // Otherwise recover to the default branch so the UI and the
        // X-Branch-Id header always agree on the same branch.
        const fallback = branches.find((b) => b.isDefault) ?? branches[0];
        set({
          branches,
          activeBranchId: stillValid ? current : (fallback?.id ?? null),
        });
      },

      addBranch: (branch) => {
        set((state) => ({
          branches: [...state.branches, branch],
          // Auto-select newly added branch
          activeBranchId: branch.id,
        }));
      },

      setActiveBranch: (id) => set({ activeBranchId: id }),

      getActiveBranch: () => {
        const { branches, activeBranchId } = get();
        // Only match by exact ID — never silently fall back to branches[0],
        // which would show the wrong branch in the UI while sending a
        // different ID in the X-Branch-Id header.
        if (!activeBranchId) return branches.find((b) => b.isDefault) ?? branches[0] ?? null;
        const matched = branches.find((b) => b.id === activeBranchId);
        if (matched) return matched;
        // Persisted ID is stale (branch was deleted or not yet loaded).
        // Recover to the default branch and fix the stored ID so the
        // header and the UI always agree.
        const fallback = branches.find((b) => b.isDefault) ?? branches[0] ?? null;
        if (fallback) set({ activeBranchId: fallback.id });
        return fallback;
      },
    }),
    {
      name: "orizo-branch",
      partialize: (state) => ({
        activeBranchId: state.activeBranchId,
      }),
    }
  )
);
