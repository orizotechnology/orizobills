import { useEffect, useState } from "react";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { useBranchStore } from "@/store/branch.store";
import { http } from "@/lib/axios";

// =============================================================
// BackendGate
// Shows a spinner while the Fastify backend boots.
// Once /api/health responds 200:
//   1. Fetches branches and seeds the active branch store.
//   2. Renders the real app.
// =============================================================

interface BackendGateProps {
  children: React.ReactNode;
}

export function BackendGate({ children }: BackendGateProps) {
  const status = useBackendStatus();
  const { setBranches, branches } = useBranchStore();
  const [elapsed, setElapsed] = useState(0);

  // Tick elapsed seconds while not online
  useEffect(() => {
    if (status === "online") { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Once backend is online, fetch branches so activeBranchId is set
  // before any API call is made by child components.
  useEffect(() => {
    if (status !== "online") return;
    if (branches.length > 0) return; // already loaded
    http.get<{ success: boolean; data: typeof branches }>("/branches")
      .then((r) => { if (r.success && r.data?.length) setBranches(r.data); })
      .catch(() => {});
  }, [status, branches.length, setBranches]);

  // Backend is up — render the app
  if (status === "online") return <>{children}</>;

  // Dynamic subtitle based on elapsed time
  const checkingMsg =
    elapsed < 8  ? "Connecting to backend server…" :
    elapsed < 25 ? `Starting backend server… (${elapsed}s)` :
    elapsed < 55 ? `Initializing database… first run can take ~30s (${elapsed}s)` :
                   `Still starting — please wait… (${elapsed}s)`;

  // Still checking — show spinner with elapsed time
  if (status === "checking") {
    return (
      <>
        <div style={{ display: "none" }}>{children}</div>
        <Overlay>
          <StatusCard
            title="Starting Orizo Bills"
            subtitle={checkingMsg}
            showSpinner
          />
        </Overlay>
      </>
    );
  }

  // Offline — show error but useBackendStatus keeps retrying in background
  return (
    <>
      <div style={{ display: "none" }}>{children}</div>
      <Overlay>
        <StatusCard
          title="Cannot reach the server"
          subtitle={
            "Backend on port 5000 is not responding.\n" +
            "Retrying automatically every few seconds…\n\n" +
            "If this persists: run  npm run dev  from the project root."
          }
          showSpinner={false}
          error
        />
      </Overlay>
    </>
  );
}

// ── Internal components ───────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#F8FAFC",
      fontFamily: "system-ui, sans-serif",
      gap: 20,
      zIndex: 9999,
    }}>
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatusCard({
  title, subtitle, showSpinner, error = false,
}: {
  title: string;
  subtitle: string;
  showSpinner: boolean;
  error?: boolean;
}) {
  return (
    <>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: error ? "#FEE2E2" : "#F97316",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 8,
      }}>
        {error ? (
          <span style={{ color: "#DC2626", fontWeight: 800, fontSize: 28 }}>!</span>
        ) : (
          <img
            src="/logo.png"
            alt="Orizo Bills"
            style={{ width: 52, height: 52, objectFit: "contain" }}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              const parent = el.parentElement;
              if (parent) parent.innerHTML = `<span style="color:#fff;font-weight:800;font-size:28px">O</span>`;
            }}
          />
        )}
      </div>

      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: error ? "#DC2626" : "#0F172A", marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, whiteSpace: "pre-line" }}>
          {subtitle}
        </div>
      </div>

      {showSpinner && (
        <div style={{
          width: 36, height: 36,
          border: "4px solid #FED7AA",
          borderTopColor: "#F97316",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      )}

      {error && (
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: "10px 24px",
            background: "#F97316", color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Retry
        </button>
      )}
    </>
  );
}
