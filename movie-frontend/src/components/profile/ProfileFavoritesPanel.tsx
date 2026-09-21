import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import JourneyPath from "../journey/JourneyPath";
import type { WatchlistItem } from "../../types/movie.types";

interface ProfileFavoritesPanelProps {
  favorites: WatchlistItem[];
  totalCount: number;
  isReleased: (item: WatchlistItem) => boolean;
  onToggleFavorite: (tmdbId: number) => void;
  readOnly?: boolean;
  onViewAllFavorites?: () => void;
  onMovieLinkClick?: () => void;
  // Set on a public profile so the Journey section reads as that person's
  // progress rather than the viewer's own.
  journeyOwnerName?: string;
}

function HeartBadge({
  released,
  isFavorite,
  onClick,
  readOnly,
}: {
  released: boolean;
  isFavorite?: boolean;
  onClick: () => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0f0d0a]/75 flex items-center justify-center">
        <svg
          className={`w-2.5 h-2.5 ${isFavorite ? "text-[#e0554d] fill-[#e0554d]" : "text-[#f2ead9]/50"}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill={isFavorite ? "currentColor" : "none"}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </div>
    );
  }
  if (!released) {
    return (
      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0f0d0a]/75 flex items-center justify-center text-[#d9ac54]">
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0f0d0a]/75 flex items-center justify-center"
    >
      <svg
        className={`w-2.5 h-2.5 ${isFavorite ? "text-[#e0554d] fill-[#e0554d]" : "text-[#f2ead9]/50"}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill={isFavorite ? "currentColor" : "none"}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}

function FavoritesList({
  favorites,
  posterClass,
  isReleased,
  onToggleFavorite,
  readOnly,
  naLabel,
  onMovieLinkClick,
}: {
  favorites: WatchlistItem[];
  posterClass: string;
  isReleased: (item: WatchlistItem) => boolean;
  onToggleFavorite: (tmdbId: number) => void;
  readOnly: boolean;
  naLabel: string;
  onMovieLinkClick?: () => void;
}) {
  const widthClass = posterClass
    .split(" ")
    .filter((cls) => cls.startsWith("w-"))
    .join(" ");

  return (
    <>
      {favorites.map((fav) => {
        const released = isReleased(fav);
        const year = fav.releaseDate ? fav.releaseDate.slice(0, 4) : null;
        return (
          <Link
            key={fav.id}
            to={`/movie/${fav.tmdbId}?type=${fav.mediaType || "movie"}&fromTab=profile`}
            onClick={onMovieLinkClick}
            className={`flex flex-col gap-2 shrink-0 min-w-0 group ${widthClass}`}
          >
            <div
              className={`relative rounded-[5px] overflow-hidden bg-[#1c1a14] ${posterClass}`}
            >
              {fav.posterUrl ? (
                <img
                  src={fav.posterUrl}
                  alt={fav.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[9px] text-[#f2ead9]/40">
                  {naLabel}
                </div>
              )}
              <HeartBadge
                released={released}
                isFavorite={fav.isFavorite}
                onClick={() => onToggleFavorite(fav.tmdbId)}
                readOnly={readOnly}
              />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#f2ead9] truncate">
                {fav.title}
              </div>
              {year && <div className="text-[11px] text-[#8f8574]">{year}</div>}
            </div>
          </Link>
        );
      })}
    </>
  );
}

export default function ProfileFavoritesPanel({
  favorites,
  totalCount,
  isReleased,
  onToggleFavorite,
  readOnly = false,
  onViewAllFavorites,
  onMovieLinkClick,
  journeyOwnerName,
}: ProfileFavoritesPanelProps) {
  const { t } = useLang();

  return (
    <div className="font-ui flex flex-col gap-8">
      <div className="hidden md:flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono-ui text-[12px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
            {t("watchlist_top_fav")}
          </span>
          {onViewAllFavorites && favorites.length > 0 && (
            <button
              onClick={onViewAllFavorites}
              className="font-semibold text-[11px] tracking-wide text-[#d9ac54] border-b border-[#d9ac54]/50 pb-0.5 hover:text-[#e8c377] transition shrink-0"
            >
              {t("profile_view_all")}
            </button>
          )}
        </div>
        {favorites.length === 0 ? (
          <div className="text-center py-6 text-[#8f8574] text-sm italic">
            {t("watchlist_no_fav")}
          </div>
        ) : (
          <div className="flex gap-[18px] overflow-x-auto pb-1">
            <FavoritesList
              favorites={favorites}
              posterClass="w-[240px] aspect-[2/3]"
              isReleased={isReleased}
              onToggleFavorite={onToggleFavorite}
              readOnly={readOnly}
              naLabel={t("common_na")}
              onMovieLinkClick={onMovieLinkClick}
            />
          </div>
        )}
      </div>

      <div className="md:hidden flex flex-col">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono-ui text-[11px] font-semibold tracking-[2.5px] text-[#d9ac54] uppercase">
              {t("watchlist_top_fav")}
            </span>
            {onViewAllFavorites && favorites.length > 0 && (
              <button
                onClick={onViewAllFavorites}
                className="font-semibold text-[10.5px] tracking-wide text-[#d9ac54] border-b border-[#d9ac54]/50 pb-0.5 hover:text-[#e8c377] transition shrink-0"
              >
                {t("profile_view_all")}
              </button>
            )}
          </div>
          {favorites.length === 0 ? (
            <div className="text-center py-6 text-[#8f8574] text-sm italic">
              {t("watchlist_no_fav")}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              <FavoritesList
                favorites={favorites}
                posterClass="w-[118px] h-[175px]"
                isReleased={isReleased}
                onToggleFavorite={onToggleFavorite}
                readOnly={readOnly}
                naLabel={t("common_na")}
                onMovieLinkClick={onMovieLinkClick}
              />
            </div>
          )}
        </div>
      </div>

      <JourneyPath totalCount={totalCount} ownerName={journeyOwnerName} />
    </div>
  );
}
