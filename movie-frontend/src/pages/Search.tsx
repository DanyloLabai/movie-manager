import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface MovieResult {
  id: number;
  title: string;
  description: string;
  releaseYear: string;
  rating: number;
  posterUrl: string | null;
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<MovieResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await api.get("/movies/search", {
        params: { title: searchQuery },
      });
      setResults(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (movie: MovieResult) => {
    try {
      await api.post("/movies/watchlist", {
        tmdbId: movie.id,
        title: movie.title,
      });
      alert(`✅ "${movie.title}" додано!`);
    } catch (error) {
      alert("Помилка додавання.");
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10 pb-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold">Movie Tracker 🎬</h1>
          <nav className="flex gap-6 items-center">
            <Link
              to="/ai-chat"
              className="text-purple-400 font-bold hover:text-purple-300 transition"
            >
              ✨ AI Chat
            </Link>
            <Link
              to="/search"
              className="text-blue-400 font-bold border-b-2 border-blue-400"
            >
              Пошук
            </Link>
            <Link
              to="/watchlist"
              className="text-gray-400 hover:text-white transition"
            >
              Мій список
            </Link>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                navigate("/login");
              }}
              className="text-red-400 text-sm"
            >
              Вийти
            </button>
          </nav>
        </header>

        <form
          onSubmit={handleSearch}
          className="flex gap-4 mb-12 max-w-2xl mx-auto"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Введіть назву фільму..."
            className="flex-grow px-6 py-3 bg-gray-800 border border-gray-700 rounded-2xl focus:border-blue-500 outline-none"
          />
          <button
            type="submit"
            className="px-8 py-3 bg-blue-600 rounded-2xl font-bold hover:bg-blue-700 transition"
          >
            {isSearching ? "..." : "Знайти"}
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {results.map((movie) => (
            <div
              key={movie.id}
              className="bg-gray-800 border border-gray-700 rounded-3xl overflow-hidden flex flex-col"
            >
              <img
                src={movie.posterUrl || ""}
                className="w-full h-64 object-cover"
                alt="poster"
              />
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-xl font-bold mb-1">
                  {movie.title} ({movie.releaseYear})
                </h3>
                <p className="text-gray-400 text-sm line-clamp-3 mb-6">
                  {movie.description}
                </p>
                <button
                  onClick={() => handleAdd(movie)}
                  className="mt-auto w-full py-3 bg-gray-700 rounded-xl font-bold hover:bg-blue-600 transition"
                >
                  + Додати
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
