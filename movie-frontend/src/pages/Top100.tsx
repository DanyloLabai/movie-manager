import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { MovieCard } from "./Search";

export default function Top100() {
  const { type } = useParams<{ type: "movie" | "tv" }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isMovie = type === "movie";
  const title = isMovie ? "Top 100 Movies" : "Top 100 TV Shows";

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [topRes, profileRes] = await Promise.all([
          api.get(`/movies/top100/${type}`),
          api.get("/movies/profile").catch(() => ({ data: null })),
        ]);

        setItems(topRes.data);

        if (profileRes.data) {
          const favs =
            profileRes.data.favorites?.map((f: any) => f.tmdbId) || [];
          const recent =
            profileRes.data.recent?.map((r: any) => r.tmdbId) || [];
          setFavoriteIds(favs);
          setAddedIds(Array.from(new Set([...favs, ...recent])));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [type]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAdd = async (item: any) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      await api.post("/movies/watchlist", {
        tmdbId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        mediaType: item.mediaType,
        releaseDate: item.releaseDate,
      });
      setAddedIds((prev) => Array.from(new Set([...prev, item.id])));
      showToast("Added to list");
    } catch {
      showToast("Error adding item");
    }
  };

  const handleRemove = async (item: any) => {
    try {
      await api.delete(`/movies/watchlist/${item.id}`);
      setAddedIds((prev) => prev.filter((id) => id !== item.id));
      setFavoriteIds((prev) => prev.filter((id) => id !== item.id));
      showToast("Removed from list");
    } catch {
      showToast("Error removing item");
    }
  };

  const handleToggleFavorite = async (item: any) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    const isFav = favoriteIds.includes(item.id);
    try {
      await api.patch(`/movies/watchlist/${item.id}/favorite`);
      setFavoriteIds((prev) =>
        isFav ? prev.filter((id) => id !== item.id) : [...prev, item.id],
      );
      if (!isFav)
        setAddedIds((prev) => Array.from(new Set([...prev, item.id])));
      showToast("Favorite status updated");
    } catch (error: any) {
      if (error.response?.status === 404 && !isFav) {
        try {
          await api.post("/movies/watchlist", {
            tmdbId: item.id,
            title: item.title,
            posterUrl: item.posterUrl,
            mediaType: item.mediaType,
          });
          await api.patch(`/movies/watchlist/${item.id}/favorite`);
          setFavoriteIds((prev) => [...prev, item.id]);
          setAddedIds((prev) => Array.from(new Set([...prev, item.id])));
          showToast("Added to list and favorites");
        } catch {
          showToast("Failed to favorite");
        }
      }
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between py-4 px-6 sm:px-12 w-full">
          <Link to="/search" className="hover:opacity-80 transition-opacity">
            <h1 className="text-lg sm:text-xl font-black text-[#c8963c] tracking-tight uppercase">
              MOVIE TRACKER
            </h1>
          </Link>

          <button
            onClick={() => navigate(-1)}
            className="text-[10px] sm:text-xs font-bold text-[#f0e6cc]/60 hover:text-[#c8963c] transition uppercase tracking-wider"
          >
            &lt; BACK
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
              <div key={item.id} className="relative">
                <div className="absolute -top-2 -left-2 w-8 h-8 bg-[#c8963c] text-[#12100e] rounded-full flex items-center justify-center font-black text-[10px] z-20 border-2 border-[#12100e] shadow-lg">
                  #{index + 1}
                </div>
                <MovieCard
                  movie={item}
                  favoriteIds={favoriteIds}
                  addedIds={addedIds}
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
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] uppercase tracking-widest px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center z-50">
          <span className="font-bold text-[10px] sm:text-xs text-center">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}
