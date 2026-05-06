import { useEffect, useState } from "react";
import { apiEventBus } from "../api";

export const ApiNotification = () => {
  const [notification, setNotification] = useState<{
    type: "retry" | "error";
    message: string;
    visible: boolean;
  }>({
    type: "retry",
    message: "",
    visible: false,
  });

  useEffect(() => {
    const handleRetry = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { attempt, maxAttempts, delay } = customEvent.detail;

      setNotification({
        type: "retry",
        message: `Retry attempt ${attempt}/${maxAttempts}. Retrying in ${Math.round(delay / 1000)}s...`,
        visible: true,
      });

      // Auto-hide after delay
      const timeout = setTimeout(() => {
        setNotification((prev) => ({ ...prev, visible: false }));
      }, delay + 500);

      return () => clearTimeout(timeout);
    };

    const handleMaxRetriesExceeded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { message } = customEvent.detail;

      setNotification({
        type: "error",
        message,
        visible: true,
      });

      // Auto-hide after 5 seconds
      const timeout = setTimeout(() => {
        setNotification((prev) => ({ ...prev, visible: false }));
      }, 5000);

      return () => clearTimeout(timeout);
    };

    apiEventBus.addEventListener("api:retry", handleRetry);
    apiEventBus.addEventListener(
      "api:maxRetriesExceeded",
      handleMaxRetriesExceeded,
    );

    return () => {
      apiEventBus.removeEventListener("api:retry", handleRetry);
      apiEventBus.removeEventListener(
        "api:maxRetriesExceeded",
        handleMaxRetriesExceeded,
      );
    };
  }, []);

  if (!notification.visible) {
    return null;
  }

  const bgColor =
    notification.type === "retry" ? "bg-blue-500/80" : "bg-red-500/80";
  const textColor =
    notification.type === "retry" ? "text-blue-50" : "text-red-50";

  return (
    <div
      className={`fixed bottom-4 left-4 px-4 py-3 rounded-lg ${bgColor} ${textColor} shadow-lg z-50 animate-pulse`}
    >
      <p className="text-sm font-medium">{notification.message}</p>
    </div>
  );
};
