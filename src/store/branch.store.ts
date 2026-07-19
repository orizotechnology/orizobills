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
        // If no active branch set, use the default one
        const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
        set({
          branches,
          activeBranchId: current ?? defaultBranch?.id ?? null,
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
        return branches.find((b) => b.id === activeBranchId) ?? branches[0] ?? null;
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
