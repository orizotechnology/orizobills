import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TitleBar } from "./TitleBar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
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
          <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#F8FAFC" }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
