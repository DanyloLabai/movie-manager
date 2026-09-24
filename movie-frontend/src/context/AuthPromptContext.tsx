import { useState } from "react";
import type { ReactNode } from "react";
import { AuthPromptContext, type AuthPromptContextType } from "./useAuthPrompt";

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value: AuthPromptContextType = {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };

  return (
    <AuthPromptContext.Provider value={value}>
      {children}
    </AuthPromptContext.Provider>
  );
}
