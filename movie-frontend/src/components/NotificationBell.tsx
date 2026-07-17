import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import * as usersApi from "../api/users.api";
import * as moviesApi from "../api/movies.api";
import { useLang } from "../context/LanguageContext";

const POLL_INTERVAL_MS = 60000;

export default function NotificationBell({
  variant = "icon",
}: {
  variant?: "icon" | "row";
}) {
  const { t } = useLang();
  const location = useLocation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const [requests, notifications] = await Promise.all([
          usersApi.getFriendRequests(),
          moviesApi.getNotifications(),
        ]);
        const unreadNotifs = (notifications || []).filter(
          (n) => !n.isRead,
        ).length;
        setCount((requests || []).length + unreadNotifs);
      } catch {
        // silent — badge just stays at last known count
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const icon = (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );

  if (variant === "row") {
    const isActive = location.pathname.startsWith("/notifications");
    return (
      <Link
        to="/notifications"
        className={`flex items-center gap-4 px-6 py-3 border-l-4 text-sm font-bold uppercase tracking-wide transition-all ${
          isActive
            ? "text-[#c8963c] bg-gradient-to-r from-[#c8963c]/20 to-transparent border-[#c8963c]"
            : "text-[#f0e6cc]/60 border-transparent hover:text-[#c8963c] hover:bg-[#c8963c]/10"
        }`}
      >
        {icon}
        <span className="flex-1">{t("notif_bell_title")}</span>
        {count > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full leading-none shadow-[0_0_10px_-1px_rgba(239,68,68,0.8)]">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      to="/notifications"
      className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#f0e6cc]/60 hover:text-[#c8963c] transition shrink-0"
      title={t("notif_bell_title")}
    >
      {icon}
      {count > 0 && (
        <span className="absolute top-0 right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center bg-red-500 text-white text-[8px] font-black rounded-full border border-[#12100e] leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
