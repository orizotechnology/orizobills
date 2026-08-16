import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, Check, Plus, MapPin, Loader2 } from "lucide-react";
import { useBranchStore } from "@/store/branch.store";
import { AddBranchDialog } from "./AddBranchDialog";
import { useQueryClient } from "@tanstack/react-query";

// =============================================================
// BRANCH SELECTOR
// Dropdown in the TopBar for switching between branches.
// Shows current branch name + chevron.
// Opens a menu listing all branches + "Add Branch" button.
// =============================================================

export function BranchSelector() {
  const { branches, activeBranchId, setActiveBranch, getActiveBranch } = useBranchStore();
  const [open,          setOpen]          = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [switching,     setSwitching]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc  = useQueryClient();

  const activeBranch = getActiveBranch();

  // ── Invalidate entire React Query cache when branch changes ──
  // This ensures every mounted page refetches from the new branch DB.
  useEffect(() => {
    if (!activeBranchId) return;
    // Small delay so the X-Branch-Id header is already in place before refetches fire
    const t = setTimeout(async () => {
      await qc.invalidateQueries();
      setSwitching(false);
    }, 80);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasBranches = branches.length > 0;

  return (
    <>
      <div ref={ref} style={{ position: "relative" }}>
        {/* Trigger button */}
        <button
          onClick={() => setOpen((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 36,
            padding: "0 12px",
            border: "1.5px solid #E2E8F0",
            borderRadius: 9,
            background: open ? "#FFF7ED" : "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
            outline: "none",
            transition: "all 0.15s",
            minWidth: 140,
            maxWidth: 200,
            borderColor: open ? "#F97316" : "#E2E8F0",
          }}
        >
          {/* Icon */}
          {switching
            ? <Loader2 size={15} color="#F97316" style={{ flexShrink: 0, animation: "spin 0.6s linear infinite" }} />
            : <Building2 size={15} color={hasBranches ? "#F97316" : "#94A3B8"} style={{ flexShrink: 0 }} />
          }

          {/* Label */}
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: hasBranches ? "#1E293B" : "#94A3B8",
              flex: 1,
              textAlign: "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeBranch?.name ?? "Select Branch"}
          </span>

          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.18 }}
          >
            <ChevronDown size={13} color="#94A3B8" />
          </motion.div>
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                minWidth: 220,
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                zIndex: 500,
                overflow: "hidden",
              }}
            >
              {/* Branch list */}
              {branches.length > 0 && (
                <div style={{ padding: "6px 6px 0" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", padding: "4px 8px 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Your Branches
                  </div>
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        if (branch.id === activeBranchId) { setOpen(false); return; }
                        setSwitching(true);
                        setActiveBranch(branch.id);
                        setOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 10px",
                        border: "none",
                        borderRadius: 8,
                        background: activeBranchId === branch.id ? "#FFF7ED" : "transparent",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        outline: "none",
                        textAlign: "left",
                        marginBottom: 2,
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        if (activeBranchId !== branch.id)
                          (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        if (activeBranchId !== branch.id)
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      {/* Branch icon */}
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: activeBranchId === branch.id ? "rgba(249,115,22,0.12)" : "#F1F5F9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <Building2
                          size={14}
                          color={activeBranchId === branch.id ? "#F97316" : "#64748B"}
                        />
                      </div>

                      {/* Branch info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: activeBranchId === branch.id ? 600 : 500,
                          color: activeBranchId === branch.id ? "#F97316" : "#1E293B",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {branch.name}
                        </div>
                        {branch.address && (
                          <div style={{
                            fontSize: 11, color: "#94A3B8",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            display: "flex", alignItems: "center", gap: 3, marginTop: 1,
                          }}>
                            <MapPin size={9} />
                            {branch.address}
                          </div>
                        )}
                        {branch.isDefault && (
                          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
                            Default
                          </div>
                        )}
                      </div>

                      {/* Active check */}
                      {activeBranchId === branch.id && (
                        <Check size={14} color="#F97316" style={{ flexShrink: 0 }} />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {branches.length === 0 && (
                <div style={{ padding: "16px 16px 8px", textAlign: "center" }}>
                  <Building2 size={24} color="#CBD5E1" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>
                    No branches yet
                  </div>
                  <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 2 }}>
                    Create your first branch below
                  </div>
                </div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: "#F1F5F9", margin: "6px 0" }} />

              {/* Add Branch button */}
              <div style={{ padding: "0 6px 6px" }}>
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowAddDialog(true);
                  }}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px",
                    border: "none", borderRadius: 8,
                    background: "transparent",
                    cursor: "pointer", fontFamily: "inherit",
                    outline: "none", transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: "rgba(249,115,22,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Plus size={15} color="#F97316" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#F97316" }}>
                    Add New Branch
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Branch Dialog */}
      <AnimatePresence>
        {showAddDialog && (
          <AddBranchDialog onClose={() => setShowAddDialog(false)} />
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
