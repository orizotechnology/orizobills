import { BrowserRouter } from "react-router-dom";

// =============================================================
// ROUTER PROVIDER
// Wraps the application with BrowserRouter for client-side routing.
// Uses MemoryRouter-compatible approach suitable for Tauri desktop apps.
// =============================================================

interface RouterProviderProps {
  children: React.ReactNode;
}

export function RouterProvider({ children }: RouterProviderProps) {
  return <BrowserRouter>{children}</BrowserRouter>;
}
