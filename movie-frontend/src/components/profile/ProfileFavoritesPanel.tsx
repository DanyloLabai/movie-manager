import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import type { Achievement } from "../../utils/achievements";
import type { WatchlistItem } from "../../types/movie.types";
import type { Friend } from "../../types/friend.types";

interface ProfileFavoritesPanelProps {
  favorites: WatchlistItem[];
  achievements: Achievement[];
  friends: Friend[];
  friendsCount: number;
  isReleased: (item: WatchlistItem) => boolean;
  onToggleFavorite: (tmdbId: number) => void;
  onOpenFriends: () => void;
  showFriends?: boolean;
  readOnly?: boolean;
  onViewAllFavorites?: () => void;
  onMovieLinkClick?: () => void;
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

function AchievementsList({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="flex flex-col gap-3.5 max-h-[340px] overflow-y-auto scrollbar-hide pr-1">
      {achievements.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3.5"
          style={{ opacity: a.isUnlocked ? 1 : 0.45 }}
        >
          <div className="w-[38px] h-[38px] rounded-full border border-[#d9ac54]/40 flex items-center justify-center shrink-0 text-[#d9ac54]">
            {a.isUnlocked ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-[#f2ead9] truncate">
              {a.text}
            </div>
            <div className="text-[11.5px] text-[#8f8574] truncate">
              {a.requirement}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FriendsRow({
  friends,
  friendsCount,
  remainingFriends,
  onOpenFriends,
  friendsLabel,
  viewAllLabel,
}: {
  friends: Friend[];
  friendsCount: number;
  remainingFriends: number;
  onOpenFriends: () => void;
  friendsLabel: string;
  viewAllLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-mono-ui text-[12px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
        {friendsLabel} · {friendsCount}
      </span>
      <div className="flex items-center">
        {friends.map((fr) => (
          <div
            key={fr.id}
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-bold text-[13px] text-[#14110c] overflow-hidden shrink-0 -mr-2"
            style={{
              background: "radial-gradient(circle at 35% 30%, #e8c377, #a87c2e)",
              boxShadow: "0 0 0 2px #0f0d0a",
            }}
          >
            {fr.avatarUrl ? (
              <img
                src={fr.avatarUrl}
                alt={fr.username}
                className="w-full h-full object-cover"
              />
            ) : (
              fr.username.charAt(0).toUpperCase()
            )}
          </div>
        ))}
        {remainingFriends > 0 && (
          <div
            className="w-[34px] h-[34px] rounded-full bg-[#26221a] flex items-center justify-center font-semibold text-[10.5px] text-[#d9ac54] shrink-0"
            style={{ boxShadow: "0 0 0 2px #0f0d0a" }}
          >
            +{remainingFriends}
          </div>
        )}
        <button
          onClick={onOpenFriends}
          className="ml-4 font-semibold text-[11px] tracking-wide text-[#d9ac54] border-b border-[#d9ac54]/50 pb-0.5 hover:text-[#e8c377] transition"
        >
          {viewAllLabel}
        </button>
      </div>
    </div>
  );
}

export default function ProfileFavoritesPanel({
  favorites,
  achievements,
  friends,
  friendsCount,
  isReleased,
  onToggleFavorite,
  onOpenFriends,
  showFriends = true,
  readOnly = false,
  onViewAllFavorites,
  onMovieLinkClick,
}: ProfileFavoritesPanelProps) {
  const { t } = useLang();
  const visibleFriends = friends.slice(0, 5);
  const remainingFriends = Math.max(0, friendsCount - visibleFriends.length);

  return (
    <div className="font-ui">
      <div className="hidden md:flex gap-10">
        <div className="flex-[1.4] flex flex-col gap-4 min-w-0">
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
                posterClass="w-[150px] h-[222px]"
                isReleased={isReleased}
                onToggleFavorite={onToggleFavorite}
                readOnly={readOnly}
                naLabel={t("common_na")}
                onMovieLinkClick={onMovieLinkClick}
              />
            </div>
          )}
        </div>
        <div className="w-px bg-[rgba(217,172,84,.16)] shrink-0" />
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <span className="font-mono-ui text-[12px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
            {t("profile_achievements")}
          </span>
          <AchievementsList achievements={achievements} />
          {showFriends && (
            <div className="mt-1.5">
              <FriendsRow
                friends={visibleFriends}
                friendsCount={friendsCount}
                remainingFriends={remainingFriends}
                onOpenFriends={onOpenFriends}
                friendsLabel={t("profile_friends")}
                viewAllLabel={t("profile_view_all")}
              />
            </div>
          )}
        </div>
      </div>

      <div className="md:hidden flex flex-col">
        <div className="flex flex-col gap-3 pb-5 -mx-5 px-5 border-b border-[rgba(217,172,84,.16)]">
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
        <div className="flex flex-col gap-3.5 pt-5">
          <span className="font-mono-ui text-[11px] font-semibold tracking-[2.5px] text-[#d9ac54] uppercase">
            {t("profile_achievements")}
          </span>
          <AchievementsList achievements={achievements} />
        </div>
      </div>
    </div>
  );
}
