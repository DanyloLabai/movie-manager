import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import { formatTimeAgo } from "../../utils/time";
import type { FriendLastWatched } from "../../api/users.api";

interface FriendActivityCarouselProps {
  items: FriendLastWatched[];
}

const MAX_ITEMS = 6;

export const FriendActivityCarousel = ({
  items,
}: FriendActivityCarouselProps) => {
  const { t } = useLang();

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-5 max-h-[640px] overflow-y-auto pr-1">
      {items.slice(0, MAX_ITEMS).map((item) => (
        <Link
          key={`${item.user.id}-${item.tmdbId}`}
          to={`/movie/${item.tmdbId}?type=${item.mediaType}`}
          className="group flex gap-4 items-end"
        >
          <div className="relative w-[110px] shrink-0 aspect-[2/3] rounded-[6px] overflow-hidden bg-[#0f0d0a]">
            {item.posterUrl ? (
              <img
                src={item.posterUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-[9px] text-[#f2ead9]/30">
                {t("search_no_poster")}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 pb-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-[26px] h-[26px] shrink-0 rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-[11px] font-bold text-[#14110c] overflow-hidden">
                {item.user.avatarUrl ? (
                  <img
                    src={item.user.avatarUrl}
                    alt={item.user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  item.user.username.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-xs text-[#c9c0ac] truncate">
                {item.user.username} {t("feed_watched")}
              </span>
            </div>
            <span className="text-[14px] font-semibold text-[#f2ead9] leading-tight truncate">
              {item.title}
            </span>
            <span className="font-mono-ui text-[10.5px] text-[#8f8574]">
              {item.mediaType === "tv" ? t("common_tv") : t("common_movie")}
              {item.watchedAt && <> · {formatTimeAgo(item.watchedAt, t)}</>}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};
