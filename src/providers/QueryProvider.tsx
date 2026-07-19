import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// =============================================================
// QUERY CLIENT CONFIGURATION
// =============================================================

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: 1 minute — data won't refetch if still fresh
        staleTime: 60 * 1000,
        // GC time: 5 minutes — inactive queries cleaned up after
        gcTime: 5 * 60 * 1000,
        // Retry failed requests 1 time
        retry: 1,
        // Retry delay with exponential backoff, capped at 30s
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
        // Don't refetch on window focus in desktop Tauri app
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// =============================================================
// QUERY PROVIDER
// =============================================================

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // useState ensures a new QueryClient is only created once per component lifetime
  const [queryClient] = useState(() => makeQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
