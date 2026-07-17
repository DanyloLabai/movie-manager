import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { NAV_ICONS as ICONS } from "./navIcons";

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
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-[100] glass-panel rounded-t-2xl border-t border-x border-[#c8963c]/20 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.6)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-1 py-2">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.key}
              to={tab.to}
              className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[56px] rounded-xl transition-colors ${
                isActive ? "bg-[#c8963c]/10" : ""
              }`}
            >
              <svg
                className={`w-5 h-5 ${isActive ? "text-[#c8963c] drop-shadow-[0_0_6px_rgba(200,150,60,0.6)]" : "text-[#f0e6cc]/50"}`}
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
