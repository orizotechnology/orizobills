import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@styles/globals.css";
import { App } from "@app/App";

// =============================================================
// APPLICATION ENTRY POINT
// =============================================================

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Root element #root not found. Ensure index.html has <div id='root'></div>."
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
