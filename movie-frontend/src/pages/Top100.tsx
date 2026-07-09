import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import * as moviesApi from "../api/movies.api";
import { MovieCard } from "../components/movie/MovieCard";
import type { MovieResult } from "../types/movie.types";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";

type ProfileResponse = {
  favorites?: Array<{ tmdbId: number }>;
  recent?: Array<{ tmdbId: number }>;
  watchedIds?: number[];
  inPlansIds?: number[];
};

export default function Top100() {
  const { t, lang } = useLang();
  const { type } = useParams<{ type: "movie" | "tv" }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<MovieResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isMovie = type === "movie";
  const title = isMovie ? t("top100_movies") : t("top100_tv");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [topData, profileData] = await Promise.all([
          moviesApi.getTop100(type || "movie"),
          moviesApi.getProfile().catch(() => null),
        ]);

        setItems(topData);

        if (profileData) {
          const profile = profileData as ProfileResponse;
          const favs = profile.favorites?.map((f) => f.tmdbId) || [];
          const recent = profile.recent?.map((r) => r.tmdbId) || [];
          const watched = profile.watchedIds || [];
          const inPlans = profile.inPlansIds || [];

          setFavoriteIds(favs);
          setAddedIds(
            Array.from(new Set([...favs, ...recent, ...watched, ...inPlans])),
          );
          setWatchedIds(watched);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [type, lang]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAdd = async (item: MovieResult) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      await moviesApi.addToWatchlist({
        tmdbId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        mediaType: item.mediaType,
        releaseDate: item.releaseDate,
      });
      setAddedIds((prev) => Array.from(new Set([...prev, item.id])));
      showToast(t("top100_added"));
    } catch {
      showToast(t("top100_add_error"));
    }
  };

  const handleRemove = async (item: MovieResult) => {
    try {
      await moviesApi.removeFromWatchlist(item.id);
      setAddedIds((prev) => prev.filter((id) => id !== item.id));
      setFavoriteIds((prev) => prev.filter((id) => id !== item.id));
      showToast(t("top100_removed"));
    } catch {
      showToast(t("top100_remove_error"));
    }
  };

  const handleToggleFavorite = async (item: MovieResult) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    const isFav = favoriteIds.includes(item.id);
    try {
      await moviesApi.toggleFavorite(item.id);
      setFavoriteIds((prev) =>
        isFav ? prev.filter((id) => id !== item.id) : [...prev, item.id],
      );
      if (!isFav)
        setAddedIds((prev) => Array.from(new Set([...prev, item.id])));
      showToast(t("search_fav_updated"));
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 404 && !isFav) {
        try {
          await moviesApi.addToWatchlist({
            tmdbId: item.id,
            title: item.title,
            posterUrl: item.posterUrl,
            mediaType: item.mediaType,
          });
          await moviesApi.toggleFavorite(item.id);
          setFavoriteIds((prev) => [...prev, item.id]);
          setAddedIds((prev) => Array.from(new Set([...prev, item.id])));
          showToast(t("search_fav_added"));
        } catch {
          showToast(t("top100_fav_error"));
        }
      }
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative selection:bg-[#c8963c] selection:text-[#12100e]">
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

          <button
            onClick={() => navigate(-1)}
            className="text-[10px] sm:text-xs font-bold text-[#f0e6cc]/60 hover:text-[#c8963c] transition uppercase tracking-wider"
          >
            &lt; {t("common_back").toUpperCase()}
          </button>
        </header>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pb-12">
        <div className="text-center mb-8 pb-4 border-b border-[#c8963c]/20">
          <h2 className="text-xl sm:text-2xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            {title}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-[#1a1714] border-t-[#c8963c] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((item, index) => (
              <div key={`${item.id}-${index}`} className="relative">
                <div className="absolute -top-2 -left-2 w-8 h-8 bg-[#c8963c] text-[#12100e] rounded-full flex items-center justify-center font-black text-[10px] z-20 border-2 border-[#12100e] shadow-lg">
                  #{index + 1}
                </div>
                <MovieCard
                  movie={item}
                  favoriteIds={favoriteIds}
                  addedIds={addedIds}
                  watchedIds={watchedIds}
                  onToggleFavorite={handleToggleFavorite}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] uppercase tracking-widest px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center z-50 animate-fade-in">
          <span className="font-bold text-[10px] sm:text-xs text-center">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}
