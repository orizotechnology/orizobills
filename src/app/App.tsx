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

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <QueryProvider>
          <StoreProvider>
            <ThemeProvider defaultTheme="light">
              <LayoutProvider>
                {/* Wait for Fastify backend to be ready before rendering the app */}
                <BackendGate>
                  <AuthGuard>
                    <AppRoutes />
                  </AuthGuard>
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
