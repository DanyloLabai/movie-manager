import { Link } from "react-router-dom";
import LogoImg from "../../assets/logo.png";
import { useLang } from "../../context/LanguageContext";
import type { FC } from "react";

type Props = {
  activePage: "search" | "watchlist" | "ai-chat" | "top100" | "other";
  showBack?: boolean;
  onBack?: () => void;
};

const Navbar: FC<Props> = ({ activePage, showBack = false, onBack }) => {
  const { t } = useLang();

  return (
    <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between py-4 px-6 sm:px-12 w-full">
        <Link
          to="/search"
          className="flex items-center gap-3 sm:gap-4 hover:opacity-80 transition-opacity shrink-0"
        >
          <img
            src={LogoImg}
            alt="LUMEN™ Logo"
            className="h-10 sm:h-12 w-auto object-contain"
          />

          <div className="flex flex-col justify-center">
            <h1 className="text-2xl sm:text-3xl font-black text-[#c8963c] tracking-widest uppercase leading-none">
              LUMEN
            </h1>
            <span className="text-[7px] sm:text-[8px] text-[#f0e6cc]/70 font-medium uppercase leading-none whitespace-nowrap tracking-[0.5em] sm:tracking-[0.6em] mt-1 block text-justify w-full">
              {t("app_tagline")}
            </span>
          </div>
        </Link>

        {showBack ? (
          <button
            onClick={onBack}
            className="text-[10px] sm:text-xs font-bold text-[#f0e6cc]/60 hover:text-[#c8963c] transition uppercase tracking-wider"
          >
            &lt; {t("common_back").toUpperCase()}
          </button>
        ) : (
          <nav className="flex items-center gap-2 sm:gap-6 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide justify-center sm:justify-end">
            <Link
              to="/ai-chat"
              className={
                activePage === "ai-chat"
                  ? "text-[#c8963c] font-bold border-b-2 border-[#c8963c] text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap"
                  : "text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap"
              }
            >
              {t("nav_ai_chat")}
            </Link>
            <Link
              to="/search"
              className={
                activePage === "search"
                  ? "text-[#c8963c] font-bold border-b-2 border-[#c8963c] text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap"
                  : "text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap"
              }
            >
              {t("nav_search")}
            </Link>
            <Link
              to="/watchlist"
              className={
                activePage === "watchlist"
                  ? "text-[#c8963c] font-bold border-b-2 border-[#c8963c] text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap"
                  : "text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap"
              }
            >
              {t("nav_profile")}
            </Link>
            <button className="text-[9px] sm:text-xs px-2 py-1.5 sm:px-3 border border-red-900/50 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold whitespace-nowrap">
              {t("nav_logout")}
            </button>
          </nav>
        )}
      </header>
    </div>
  );
};

export default Navbar;
