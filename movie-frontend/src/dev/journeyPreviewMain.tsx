import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { LanguageProvider } from "../context/LanguageContext";
import JourneyPreviewHarness from "./JourneyPreviewHarness";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <JourneyPreviewHarness />
    </LanguageProvider>
  </StrictMode>,
);
