import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================
// PRINT STORE
// Persists the chosen template + print config from BillDesigner
// so that PosPage uses the same settings when printing receipts.
// =============================================================

export type PaperType = "A4" | "A5" | "Thermal 80mm" | "Thermal 58mm";

export interface PrintSettings {
  templateId:        string;
  paperType:         PaperType;
  primaryColor:      string;
  fontFamily:        string;
  fontSize:          "small" | "medium" | "large";
  showLogo:          boolean;
  showQR:            boolean;
  showTerms:         boolean;
  showAmountInWords: boolean;
  showSignature:     boolean;
  footerText:        string;
  termsText:         string;
  marginTop:         number;
  marginBottom:      number;
  marginLeft:        number;
  marginRight:       number;
  copies:            number;
  tableStyle:        "striped" | "bordered" | "minimal";
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  templateId:        "th-retail",
  paperType:         "Thermal 80mm",
  primaryColor:      "#F97316",
  fontFamily:        "Inter",
  fontSize:          "medium",
  showLogo:          true,
  showQR:            true,
  showTerms:         true,
  showAmountInWords: false,
  showSignature:     false,
  footerText:        "Thank you for your business!",
  termsText:         "Goods once sold will not be taken back.",
  marginTop:         8,
  marginBottom:      8,
  marginLeft:        8,
  marginRight:       8,
  copies:            1,
  tableStyle:        "minimal",
};

interface PrintState {
  settings: PrintSettings;
  updateSettings: (patch: Partial<PrintSettings>) => void;
}

export const usePrintStore = create<PrintState>()(
  persist(
    (set) => ({
      settings: DEFAULT_PRINT_SETTINGS,
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "orizo-print",
      // Migrate existing users who had A4/A5 stored to Thermal 80mm
      onRehydrateStorage: () => (state) => {
        if (state && (state.settings.paperType === "A4" || state.settings.paperType === "A5")) {
          state.updateSettings({
            paperType:  "Thermal 80mm",
            templateId: "th-retail",
          });
        }
      },
    }
  )
);
