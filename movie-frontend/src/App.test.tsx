import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

describe("App", () => {
  it("renders without crashing", () => {
    render(
      <AuthProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </AuthProvider>,
    );

    expect(screen.getByText("LUMEN")).toBeInTheDocument();
  });
});
