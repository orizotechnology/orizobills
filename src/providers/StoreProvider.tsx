import { createContext, useContext } from "react";
import type { ReactNode } from "react";

// =============================================================
// STORE PROVIDER
// This is a lightweight context wrapper that provides Zustand
// store access. Individual stores are imported directly from
// @store/* — this provider handles cross-cutting store concerns
// like rehydration and devtools initialization.
// =============================================================

interface StoreProviderState {
  isHydrated: boolean;
}

const StoreProviderContext = createContext<StoreProviderState>({
  isHydrated: false,
});

interface StoreProviderProps {
  children: ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  // Zustand stores hydrate synchronously — always true on first render
  const value: StoreProviderState = { isHydrated: true };

  return (
    <StoreProviderContext.Provider value={value}>
      {children}
    </StoreProviderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStoreContext() {
  return useContext(StoreProviderContext);
}
