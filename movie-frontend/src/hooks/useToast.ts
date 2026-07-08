import { useState } from "react";

export function useToast(initial: string | null = null) {
  const [toastMessage, setToastMessage] = useState<string | null>(initial);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return { toastMessage, showToast, setToastMessage } as const;
}

export default useToast;
