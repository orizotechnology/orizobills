import { QueryClient } from "@tanstack/react-query";

// =============================================================
// SINGLETON QUERY CLIENT
// Used for programmatic access outside React tree (e.g. in services)
// The primary QueryClient is created in QueryProvider.tsx
// =============================================================

let queryClientSingleton: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (!queryClientSingleton) {
    queryClientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          gcTime: 5 * 60 * 1000,
          retry: 1,
        },
      },
    });
  }
  return queryClientSingleton;
}
