import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================
// PRINT STORE
// Persists the chosen template + print config from BillDesigner
// so that PosPage uses the same settings when printing receipts.
// =============================================================

export type PaperType = "A4" | "A5" | "Thermal 80mm" | "Thermal 58mm" | "Thermal 72mm" | "Thermal 76mm";

export interface PrintSettings {
  templateId:        string;
  paperType:         PaperType;
  primaryColor:      string;
  fontFamily:        string;
  fontSize:          "small" | "medium" | "large";
  fontBold:          boolean;
  logoSize:          number;   // px — thermal logo size, default 48
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
  fontFamily:        "Arial",
  fontSize:          "medium",
  fontBold:          false,
  logoSize:          48,
  showLogo:          true,
  showQR:            true,
  showTerms:         true,
  showAmountInWords: false,
  showSignature:     false,
  footerText:        "Thank you for your business!",
  termsText:         "Goods once sold will not be taken back.",
  marginTop:         6,
  marginBottom:      6,
  marginLeft:        6,
  marginRight:       6,
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
      name: "orizo-print-v3",
    }
  )
);
