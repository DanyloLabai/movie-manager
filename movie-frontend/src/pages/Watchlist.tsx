import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface WatchlistItem {
  id: string;
  tmdbId: number;
  title: string;
  addedAt: string;
}

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const response = await api.get("/movies/watchlist");
      setWatchlist(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (tmdbId: number) => {
    if (!window.confirm("Ви впевнені, що хочете видалити цей фільм зі списку?"))
      return;

    try {
      await api.delete(`/movies/watchlist/${tmdbId}`);

      setWatchlist((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
    } catch (error) {
      alert("Не вдалося видалити фільм. Спробуй пізніше.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen p-8 bg-gray-900 font-sans text-gray-100">
      <div className="max-w-4xl mx-auto">
        {/* НАВІГАЦІЯ (Тепер з AI Chat) */}
        <header className="flex items-center justify-between pb-6 mb-10 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Movie Tracker 🎬
          </h1>
          <nav className="flex gap-6 items-center">
            <Link
              to="/ai-chat"
              className="text-purple-400 font-bold hover:text-purple-300 transition"
            >
              ✨ AI Chat
            </Link>
            <Link
              to="/search"
              className="text-gray-400 hover:text-white transition"
            >
              Пошук
            </Link>
            <Link
              to="/watchlist"
              className="text-blue-400 font-bold border-b-2 border-blue-400"
            >
              Мій список
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm px-4 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition"
            >
              Вийти
            </button>
          </nav>
        </header>

        <h2 className="mb-8 text-3xl font-bold text-white">Моя бібліотека</h2>

        {isLoading ? (
          <p className="text-center text-gray-500 animate-pulse text-lg">
            Завантаження списку...
          </p>
        ) : watchlist.length === 0 ? (
          <div className="text-center p-12 bg-gray-800/50 rounded-3xl border border-gray-700 shadow-2xl">
            <p className="text-gray-400 text-xl">
              Твій список поки що порожній. 🍿
            </p>
            <Link
              to="/search"
              className="inline-block mt-6 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition active:scale-95"
            >
              Знайти перший фільм
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {watchlist.map((item) => (
              <div
                key={item.id}
                className="group p-6 transition bg-gray-800 border border-gray-700 shadow-lg rounded-2xl hover:shadow-2xl hover:border-blue-500/30 hover:-translate-y-1"
              >
                <h3
                  className="text-xl font-bold text-white truncate"
                  title={item.title}
                >
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Додано: {new Date(item.addedAt).toLocaleDateString("uk-UA")}
                </p>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700/50">
                  <button className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition">
                    Деталі
                  </button>
                  <button
                    onClick={() => handleDelete(item.tmdbId)}
                    className="text-sm font-semibold text-red-400/70 hover:text-red-400 transition"
                  >
                    Видалити
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
