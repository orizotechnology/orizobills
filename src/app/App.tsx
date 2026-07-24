import {
  ThemeProvider,
  QueryProvider,
  RouterProvider,
  StoreProvider,
  ToastProvider,
  LayoutProvider,
} from "@/providers";
import { AppRoutes } from "@/routes";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { BackendGate } from "@/components/common/BackendGate";
import { DbPasswordGate } from "@/components/common/DbPasswordGate";

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <QueryProvider>
          <StoreProvider>
            <ThemeProvider defaultTheme="light">
              <LayoutProvider>
                {/* 1. Wait for Fastify backend to be ready */}
                <BackendGate>
                  {/* 2. Ask for MySQL password on first run (before login) */}
                  <DbPasswordGate>
                    {/* 3. Normal app login */}
                    <AuthGuard>
                      <AppRoutes />
                    </AuthGuard>
                  </DbPasswordGate>
                  <ToastProvider />
                </BackendGate>
              </LayoutProvider>
            </ThemeProvider>
          </StoreProvider>
        </QueryProvider>
      </RouterProvider>
    </ErrorBoundary>
  );
}
