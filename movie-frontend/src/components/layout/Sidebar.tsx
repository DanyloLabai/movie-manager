import { Link, useLocation } from "react-router-dom";
import LogoImg from "../../assets/logo.png";
import { useLang } from "../../context/LanguageContext";
import NotificationBell from "../NotificationBell";
import { NAV_ICONS } from "../navIcons";

export const SIDEBAR_WIDTH_CLASS = "sm:w-60";
export const SIDEBAR_PADDING_CLASS = "sm:pl-60";

const navItemClass = (isActive: boolean) =>
  `flex items-center gap-4 px-6 py-3 border-l-4 text-sm font-bold uppercase tracking-wide transition-all ${
    isActive
      ? "text-[#c8963c] bg-gradient-to-r from-[#c8963c]/20 to-transparent border-[#c8963c]"
      : "text-[#f0e6cc]/60 border-transparent hover:text-[#c8963c] hover:bg-[#c8963c]/10"
  }`;

const SidebarLink = ({
  to,
  isActive,
  icon,
  label,
}: {
  to: string;
  isActive: boolean;
  icon: React.ReactNode;
  label: string;
}) => (
  <Link to={to} className={navItemClass(isActive)}>
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icon}
    </svg>
    {label}
  </Link>
);

export default function Sidebar() {
  const { t } = useLang();
  const location = useLocation();

  const tabs = [
    { key: "ai-chat", to: "/ai-chat", label: t("nav_ai_chat"), icon: NAV_ICONS.chat },
    { key: "search", to: "/search", label: t("nav_search"), icon: NAV_ICONS.search },
    { key: "quiz", to: "/quiz", label: t("nav_quiz"), icon: NAV_ICONS.quiz },
    { key: "watchlist", to: "/watchlist", label: t("nav_profile"), icon: NAV_ICONS.profile },
  ];

  return (
    <aside
      className={`hidden sm:flex ${SIDEBAR_WIDTH_CLASS} fixed left-0 top-0 bottom-0 z-40 flex-col glass-panel pt-[env(safe-area-inset-top)]`}
    >
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#c8963c]/40 to-transparent" />

      <Link
        to="/search"
        className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 border-b border-[#c8963c]/20 hover:opacity-90 transition-opacity shrink-0"
      >
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-black text-[#c8963c] tracking-widest uppercase leading-none drop-shadow-[0_0_10px_rgba(244,189,95,0.5)]">
            LUMEN
          </h1>
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-[#c8963c]/30 blur-xl rounded-full" />
            <img
              src={LogoImg}
              alt="LUMEN Logo"
              className="relative h-9 w-auto object-contain drop-shadow-[0_0_10px_rgba(244,189,95,0.5)]"
            />
          </div>
        </div>
        <span className="text-[8px] text-[#f0e6cc]/70 font-medium uppercase leading-none whitespace-nowrap tracking-[0.4em] block">
          {t("app_tagline")}
        </span>
      </Link>

      <nav className="flex-1 flex flex-col gap-1 pt-4 overflow-y-auto scrollbar-hide">
        {tabs.map((tab) => (
          <SidebarLink
            key={tab.key}
            to={tab.to}
            isActive={location.pathname.startsWith(tab.to)}
            icon={tab.icon}
            label={tab.label}
          />
        ))}

        <NotificationBell variant="row" />
      </nav>

      <div className="pb-4 shrink-0">
        <SidebarLink
          to="/settings"
          isActive={location.pathname.startsWith("/settings")}
          icon={NAV_ICONS.settings}
          label={t("nav_settings")}
        />
      </div>
    </aside>
  );
}
