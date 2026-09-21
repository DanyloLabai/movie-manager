import { useState } from "react";
import JourneyPath from "../components/journey/JourneyPath";

export default function JourneyPreviewHarness() {
  const [totalCount] = useState(45);
  return (
    <div style={{ minHeight: "100vh", background: "#0f0d0a", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <JourneyPath totalCount={totalCount} />
      </div>
    </div>
  );
}
