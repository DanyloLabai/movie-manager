import { useRef, useState } from 'react';

export function useToast(initial: string | null = null) {
  const [toastMessage, setToastMessage] = useState<string | null>(initial);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToastMessage(message);
    timeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  return { toastMessage, showToast, setToastMessage } as const;
}

export default useToast;
