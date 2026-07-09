import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import * as usersApi from "../api/users.api";
import * as moviesApi from "../api/movies.api";
import { useLang } from "../context/LanguageContext";

const POLL_INTERVAL_MS = 60000;
const VISIBLE_ROUTES = [
  "/ai-chat",
  "/search",
  "/watchlist",
  "/notifications",
  "/settings",
];

const ICONS = {
  chat: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  ),
  search: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z"
    />
  ),
  profile: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  ),
  bell: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  ),
  settings: (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </>
  ),
};

export default function BottomNav() {
  const { t } = useLang();
  const location = useLocation();
  const [notifCount, setNotifCount] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const [requests, notifications] = await Promise.all([
          usersApi.getFriendRequests(),
          moviesApi.getNotifications(),
        ]);
        const unread = (notifications || []).filter((n) => !n.isRead).length;
        setNotifCount((requests || []).length + unread);
      } catch {
        // silent — badge stays at last known count
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Hide while the on-screen keyboard is open (visual viewport shrinks
  // noticeably), so the bar doesn't float above the keyboard and fight a
  // page's own input for space.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setIsKeyboardOpen(vv.height < window.innerHeight * 0.75);
    };
    vv.addEventListener("resize", update);
    update();
    return () => vv.removeEventListener("resize", update);
  }, []);

  const tabs = [
    { key: "ai-chat", to: "/ai-chat", label: t("nav_ai_chat"), icon: ICONS.chat },
    { key: "search", to: "/search", label: t("nav_search"), icon: ICONS.search },
    { key: "watchlist", to: "/watchlist", label: t("nav_profile"), icon: ICONS.profile },
    {
      key: "notifications",
      to: "/notifications",
      label: t("nav_notifications"),
      icon: ICONS.bell,
      badge: notifCount,
    },
    { key: "settings", to: "/settings", label: t("nav_settings"), icon: ICONS.settings },
  ];

  if (isKeyboardOpen || !VISIBLE_ROUTES.some((r) => location.pathname.startsWith(r))) {
    return null;
  }

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[#12100e]/95 backdrop-blur-md border-t border-[#c8963c]/10 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-1 py-2">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.key}
              to={tab.to}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px]"
            >
              <svg
                className={`w-5 h-5 ${isActive ? "text-[#c8963c]" : "text-[#f0e6cc]/50"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {tab.icon}
              </svg>
              <span
                className={`text-[8px] font-bold uppercase tracking-wide ${isActive ? "text-[#c8963c]" : "text-[#f0e6cc]/40"}`}
              >
                {tab.label}
              </span>
              {tab.badge ? (
                <span className="absolute top-0 right-1 min-w-[14px] h-[14px] px-1 flex items-center justify-center bg-red-500 text-white text-[7px] font-black rounded-full border border-[#12100e] leading-none">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
