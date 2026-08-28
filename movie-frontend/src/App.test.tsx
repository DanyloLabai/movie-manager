import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthPromptProvider } from "./context/AuthPromptContext";

describe("App", () => {
  it("renders without crashing", () => {
    render(
      <AuthProvider>
        <LanguageProvider>
          <AuthPromptProvider>
            <App />
          </AuthPromptProvider>
        </LanguageProvider>
      </AuthProvider>,
    );

    expect(screen.getAllByText("LUMEN").length).toBeGreaterThan(0);
  });
});
