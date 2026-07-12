import { useRef } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import type { FriendLastWatched } from "../../api/users.api";

interface FriendActivityCarouselProps {
  items: FriendLastWatched[];
}

export const FriendActivityCarousel = ({
  items,
}: FriendActivityCarouselProps) => {
  const { t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section>
      <div className="flex justify-between items-center mb-4 border-b border-[#c8963c]/20 pb-3">
        <h2 className="text-xs sm:text-sm font-black text-[#c8963c] uppercase tracking-widest">
          {t("search_friends_activity")}
        </h2>

        <div className="flex gap-1 sm:gap-2">
          <button
            onClick={() => scroll("left")}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-[#c8963c]/30 text-[#f0e6cc]/50 hover:text-[#c8963c] hover:border-[#c8963c] hover:bg-[#c8963c]/10 transition active:scale-95"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-[#c8963c]/30 text-[#f0e6cc]/50 hover:text-[#c8963c] hover:border-[#c8963c] hover:bg-[#c8963c]/10 transition active:scale-95"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {items.map((item) => (
          <Link
            key={`${item.user.id}-${item.tmdbId}`}
            to={`/movie/${item.tmdbId}?type=${item.mediaType}`}
            className="group flex-none w-[140px] sm:w-[160px] lg:w-[180px] snap-start bg-[#1a1714] border border-[#c8963c]/20 rounded-xl overflow-hidden hover:border-[#c8963c]/70 hover:-translate-y-0.5 transition"
          >
            <div className="relative w-full aspect-[2/3] bg-[#12100e]">
              {item.posterUrl ? (
                <img
                  src={item.posterUrl}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-[9px] text-[#f0e6cc]/30">
                  {t("search_no_poster")}
                </div>
              )}

              {(item.rating ?? 0) > 0 && (
                <div className="absolute top-1.5 right-1.5 bg-[#12100e]/90 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-[#c8963c]/30 text-[#c8963c] text-[9px] font-black">
                  ★ {item.rating}
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#12100e] via-[#12100e]/80 to-transparent px-2 pt-4 pb-1.5 flex items-center gap-1.5">
                <div className="w-5 h-5 shrink-0 rounded-full border border-[#c8963c]/50 bg-[#1a1714] flex items-center justify-center text-[9px] font-black text-[#c8963c] overflow-hidden">
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
                <span className="text-[9px] font-bold text-[#f0e6cc]/90 truncate">
                  {item.user.username}
                </span>
              </div>
            </div>

            <div className="p-2">
              <h4
                className="text-[11px] font-bold text-[#f0e6cc] truncate group-hover:text-[#c8963c] transition-colors"
                title={item.title}
              >
                {item.title}
              </h4>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
