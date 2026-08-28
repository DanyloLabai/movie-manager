import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface AuthPromptContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const AuthPromptContext = createContext<AuthPromptContextType | undefined>(
  undefined,
);

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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) {
    throw new Error("useAuthPrompt must be used within an AuthPromptProvider");
  }
  return ctx;
}
