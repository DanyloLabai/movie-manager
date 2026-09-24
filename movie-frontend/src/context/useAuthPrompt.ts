import { createContext, useContext } from "react";

export interface AuthPromptContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const AuthPromptContext = createContext<
  AuthPromptContextType | undefined
>(undefined);

export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) {
    throw new Error("useAuthPrompt must be used within an AuthPromptProvider");
  }
  return ctx;
}
