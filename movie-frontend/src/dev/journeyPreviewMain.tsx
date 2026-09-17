import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { LanguageProvider } from "../context/LanguageContext";
import JourneyPath from "../components/journey/JourneyPath";

function PreviewHarness() {
  const [totalCount] = useState(45);
  return (
    <div style={{ minHeight: "100vh", background: "#0f0d0a", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <JourneyPath totalCount={totalCount} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <PreviewHarness />
    </LanguageProvider>
  </StrictMode>,
);
