import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TitleBar } from "./TitleBar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();

  // ── Global keyboard shortcuts ────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      // Don't fire if the user is typing in an input / textarea / select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "d": e.preventDefault(); navigate("/app/dashboard");         break;
        case "p": e.preventDefault(); navigate("/app/pos");               break;
        case "i": e.preventDefault(); navigate("/app/sales/invoices");    break;
        case "r": e.preventDefault(); navigate("/app/products/all");      break;
        case "v": e.preventDefault(); navigate("/app/inventory");         break;
        case "e": e.preventDefault(); navigate("/app/expenses");          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", width: "100vw",
      overflow: "hidden", background: "#F8FAFC",
    }}>
      {/* Custom title bar */}
      <TitleBar />

      {/* Sidebar + content row */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Sidebar />

        {/* Main area */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden" }}>
          <TopBar />
          <main style={{ flex: 1, overflowY: "auto", overflowX: "clip", background: "#F8FAFC" }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
