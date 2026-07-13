import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";

const VISIBLE_ROUTES = [
  "/ai-chat",
  "/search",
  "/quiz",
  "/watchlist",
  "/settings",
];

const MOBILE_BREAKPOINT_PX = 640; // Tailwind `sm`
const SWIPE_MIN_DISTANCE_PX = 60;
const SWIPE_MAX_VERTICAL_RATIO = 0.5; // vertical drift must stay well under the horizontal distance

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
  quiz: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0c-.703.703-1.278 1.605-1.313 2.6a1 1 0 01-1 .961h-2.516a1 1 0 01-1-.962c-.035-.994-.61-1.896-1.313-2.6z"
    />
  ),
};

export default function BottomNav() {
  const { t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(
    null,
  );

  // Hide while the on-screen keyboard is open, so the bar never sits on top
  // of (or rides up together with) a page's own input. We can't rely on
  // visualViewport resize alone: that event lags behind focus by however
  // long the keyboard takes to animate in, which is exactly the window
  // where the bar would otherwise cover the focused input. Hiding on
  // focus/focusin is immediate; the visualViewport check is what keeps the
  // bar hidden until the keyboard has actually finished closing again.
  useEffect(() => {
    const vv = window.visualViewport;
    const isTextInput = (el: Element | null) =>
      !!el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        (el as HTMLElement).isContentEditable);

    // Tracks whether a text input was actually focused. The viewport-ratio
    // check below is only trusted once that's happened — otherwise a
    // shrunken visualViewport right after navigation (browser chrome/URL
    // bar not yet settled, common in PWA/standalone mode) is mistaken for
    // an open keyboard and hides the bar until something recalculates it.
    let wasFocused = false;

    const update = () => {
      const textInputFocused = isTextInput(document.activeElement);
      if (textInputFocused) wasFocused = true;

      const keyboardShrunkViewport = vv
        ? vv.height < window.innerHeight * 0.75
        : false;
      const keyboardOpen =
        textInputFocused || (wasFocused && keyboardShrunkViewport);

      if (!keyboardOpen) wasFocused = false;
      setIsKeyboardOpen(keyboardOpen);
    };
    const updateOnFocusOut = () => setTimeout(update, 0);

    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", updateOnFocusOut);
    update();
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", updateOnFocusOut);
    };
  }, []);

  const tabs = [
    { key: "ai-chat", to: "/ai-chat", label: t("nav_ai_chat"), icon: ICONS.chat },
    { key: "search", to: "/search", label: t("nav_search"), icon: ICONS.search },
    { key: "quiz", to: "/quiz", label: t("nav_quiz"), icon: ICONS.quiz },
    { key: "watchlist", to: "/watchlist", label: t("nav_profile"), icon: ICONS.profile },
    { key: "settings", to: "/settings", label: t("nav_settings"), icon: ICONS.settings },
  ];

  const isVisible = VISIBLE_ROUTES.some((r) => location.pathname.startsWith(r));

  // Swipe left/right between the tab pages, mirroring the bottom nav order.
  // Ignored while typing, and ignored when the swipe starts inside a
  // horizontally-scrolling carousel or a text field, so it doesn't fight
  // those gestures.
  useEffect(() => {
    if (!isVisible || isKeyboardOpen) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, target: e.target };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || window.innerWidth >= MOBILE_BREAKPOINT_PX) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return;
      if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_VERTICAL_RATIO) return;

      const startEl = start.target instanceof Element ? start.target : null;
      if (startEl?.closest(".overflow-x-auto, input, textarea")) return;

      const currentIndex = tabs.findIndex((tab) =>
        location.pathname.startsWith(tab.to),
      );
      if (currentIndex === -1) return;
      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= tabs.length) return;
      navigate(tabs[nextIndex].to);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, isKeyboardOpen, location.pathname]);

  if (isKeyboardOpen || !isVisible) {
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
