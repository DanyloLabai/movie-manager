import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import * as moviesApi from "../../api/movies.api";
import type { WatchlistItem } from "../../types/movie.types";

const PAGE_SIZE = 20;

interface RatingMoviesModalProps {
  rating: number | null;
  onClose: () => void;
}

export default function RatingMoviesModal({ rating, onClose }: RatingMoviesModalProps) {
  const { t } = useLang();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (rating == null) return;
    let cancelled = false;
    setIsLoading(true);
    moviesApi
      .getWatchlist("watched", { limit: PAGE_SIZE, offset: 0, rating })
      .then((res) => {
        if (cancelled) return;
        setItems(res || []);
        setHasMore((res?.length || 0) === PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [rating]);

  const loadMore = async () => {
    if (rating == null || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await moviesApi.getWatchlist("watched", {
        limit: PAGE_SIZE,
        offset: items.length,
        rating,
      });
      setItems((prev) => [...prev, ...(res || [])]);
      setHasMore((res?.length || 0) === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (rating == null) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-5 bg-[#0f0d0a] border border-[#d9ac54]/30 rounded-3xl shadow-2xl relative animate-modal-in font-ui max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8f8574] hover:text-[#d9ac54] transition p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-sm font-bold text-[#f2ead9] uppercase tracking-widest mb-1 pr-8">
          ★ {rating}/10
        </h2>
        <p className="font-mono-ui text-[10px] text-[#d9ac54] font-semibold uppercase tracking-widest mb-4">
          {items.length} {t("stats_movies").toLowerCase()}
        </p>

        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="text-[#8f8574] text-sm italic text-center py-6">…</p>
          ) : items.length === 0 ? (
            <p className="text-[#8f8574] text-sm italic text-center py-6">{t("watchlist_empty")}</p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                onClick={onClose}
                className="flex items-center gap-2.5 bg-[#161310] p-2 rounded-xl border border-[#d9ac54]/10 hover:border-[#d9ac54]/40 transition group"
              >
                <div className="w-8 h-11 rounded-md bg-[#0f0d0a] overflow-hidden shrink-0 border border-[#d9ac54]/20">
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[6px] text-[#f2ead9]/30">
                      {t("common_na")}
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-[#f2ead9] group-hover:text-[#d9ac54] transition truncate text-xs">
                  {item.title}
                </h4>
              </Link>
            ))
          )}
        </div>

        {hasMore ? (
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="mt-3 px-4 py-2 rounded-full border border-[#d9ac54]/30 text-[#d9ac54] font-bold text-[10px] uppercase tracking-widest hover:border-[#d9ac54] transition disabled:opacity-50"
          >
            {isLoadingMore ? "…" : t("common_load_more")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
