import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import LogoImg from "../../assets/logo.png";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { getUserRank } from "../../utils/achievements";
import * as moviesApi from "../../api/movies.api";
import NotificationBell from "../NotificationBell";
import { NAV_ICONS } from "../navIcons";

export const SIDEBAR_WIDTH_CLASS = "sm:w-60";
export const SIDEBAR_PADDING_CLASS = "sm:pl-60";

const navItemClass = (isActive: boolean) =>
  `flex items-center gap-3.5 px-6 py-3 font-ui text-[12px] font-semibold tracking-[2px] uppercase transition-all border-l-2 ${
    isActive
      ? "text-[#f2ead9] border-[#d9ac54] bg-[linear-gradient(90deg,rgba(217,172,84,.12),transparent)]"
      : "text-[#8f8574] border-transparent hover:text-[#c9c0ac] hover:bg-white/[.02]"
  }`;

const SidebarLink = ({
  to,
  isActive,
  icon,
  label,
  badge,
  onClick,
}: {
  to: string;
  isActive: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) => (
  <Link to={to} className={navItemClass(isActive)} onClick={onClick}>
    <svg
      className={`w-4 h-4 shrink-0 ${isActive ? "text-[#d9ac54]" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {icon}
    </svg>
    <span className="flex-1">{label}</span>
    {badge}
  </Link>
);

interface SidebarProfile {
  username: string;
  avatarUrl: string | null;
  watchedCount: number;
  totalCount: number;
}

export default function Sidebar() {
  const { t } = useLang();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { open } = useAuthPrompt();
  const [profile, setProfile] = useState<SidebarProfile | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    moviesApi
      .getProfile()
      .then((data) =>
        setProfile({
          username: data.username || "",
          avatarUrl: data.avatarUrl ?? null,
          watchedCount: data.watchedCount || 0,
          totalCount: data.totalCount || 0,
        }),
      )
      .catch(() => {});
  }, [isAuthenticated]);

  const guardClick = (requiresAuth: boolean) => (e: React.MouseEvent) => {
    if (requiresAuth && !isAuthenticated) {
      e.preventDefault();
      open();
    }
  };

  const tabs = [
    {
      key: "ai-chat",
      to: "/ai-chat",
      label: t("nav_ai_chat"),
      icon: NAV_ICONS.chat,
      requiresAuth: true,
    },
    {
      key: "search",
      to: "/search",
      label: t("nav_search"),
      icon: NAV_ICONS.search,
      requiresAuth: false,
    },
    {
      key: "quiz",
      to: "/quiz",
      label: t("nav_quiz"),
      icon: NAV_ICONS.quiz,
      requiresAuth: true,
      badge: (
        <span className="font-mono-ui text-[8.5px] font-semibold tracking-[1px] text-[#d9ac54] border border-[#d9ac54]/40 rounded-full px-[7px] py-[2px]">
          {t("nav_badge_new")}
        </span>
      ),
    },
    {
      key: "watchlist",
      to: "/watchlist",
      label: t("nav_profile"),
      icon: NAV_ICONS.profile,
      requiresAuth: true,
    },
  ];

  const goalYear = new Date().getFullYear();
  const goalPct =
    profile && profile.totalCount > 0
      ? Math.min(100, Math.round((profile.watchedCount / profile.totalCount) * 100))
      : 0;

  return (
    <aside
      className={`hidden sm:flex ${SIDEBAR_WIDTH_CLASS} fixed left-0 top-0 bottom-0 z-40 flex-col bg-[#0f0d0a] border-r border-[rgba(217,172,84,.16)] pt-[env(safe-area-inset-top)]`}
    >
      <Link
        to="/search"
        className="flex flex-col gap-1 px-6 pt-7 pb-6 border-b border-[rgba(217,172,84,.16)] hover:opacity-90 transition-opacity shrink-0"
      >
        <div className="flex items-center gap-2">
          <span className="font-ui font-bold text-[21px] tracking-[5px] text-[#d9ac54]">
            LUMEN
          </span>
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-[#d9ac54]/25 blur-md rounded-full" />
            <img
              src={LogoImg}
              alt=""
              className="relative w-7 h-7 object-contain"
            />
          </div>
        </div>
        <span className="font-mono-ui text-[8.5px] tracking-[3.5px] text-[#645c4d]">
          {t("app_tagline").toUpperCase()}
        </span>
      </Link>

      <nav className="flex-1 flex flex-col gap-0.5 pt-4 overflow-y-auto scrollbar-hide">
        {tabs.map((tab) => (
          <SidebarLink
            key={tab.key}
            to={tab.to}
            isActive={location.pathname.startsWith(tab.to)}
            icon={tab.icon}
            label={tab.label}
            badge={tab.badge}
            onClick={guardClick(tab.requiresAuth)}
          />
        ))}

        <NotificationBell variant="row" />
      </nav>

      <div className="px-6 py-4 border-t border-[rgba(217,172,84,.16)] flex flex-col gap-3.5 shrink-0">
        {profile && profile.totalCount > 0 && (
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between">
              <span className="font-mono-ui text-[8.5px] tracking-[2px] text-[#645c4d] uppercase">
                {t("sidebar_goal_label")} {goalYear}
              </span>
              <span className="font-ui font-semibold text-[10.5px] text-[#d9ac54]">
                {profile.watchedCount}/{profile.totalCount}
              </span>
            </div>
            <div className="h-[3px] bg-white/[.08] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${goalPct}%`,
                  background: "linear-gradient(90deg, #a87c2e, #d9ac54)",
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg transition hover:bg-white/[.03]">
          <Link
            to="/watchlist"
            className="flex items-center gap-2.5 min-w-0 flex-1"
            onClick={guardClick(true)}
          >
            <div
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-ui font-bold text-[13px] text-[#14110c] overflow-hidden shrink-0"
              style={{
                background: "radial-gradient(circle at 35% 30%, #e8c377, #a87c2e)",
              }}
            >
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                (profile?.username || "?").charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-ui font-semibold text-[12.5px] text-[#f2ead9] truncate">
                {isAuthenticated ? profile?.username || "" : t("sidebar_guest_name")}
              </span>
              <span className="font-mono-ui text-[9.5px] tracking-[1px] text-[#8f8574] uppercase truncate">
                {isAuthenticated
                  ? getUserRank(profile?.watchedCount || 0, t)
                  : t("auth_required_login")}
              </span>
            </div>
          </Link>
          <Link
            to="/settings"
            className="shrink-0 text-[#645c4d] hover:text-[#c9c0ac] transition"
            title={t("nav_settings")}
            onClick={guardClick(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {NAV_ICONS.settings}
            </svg>
          </Link>
        </div>
      </div>
    </aside>
  );
}
