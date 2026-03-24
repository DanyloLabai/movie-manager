import { useState, useEffect } from "react";
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
  const [trending, setTrending] = useState<MovieResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await api.get("/movies/trending");
        setTrending(response.data);
      } catch (error) {
        console.error("Failed to fetch trending movies", error);
      }
    };
    fetchTrending();
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
        posterUrl: movie.posterUrl,
      });
      showToast(`"${movie.title}" successfully added!`);
    } catch (error: any) {
      if (error.response?.status === 400) {
        showToast("This movie is already in your list.");
      } else {
        showToast("Error adding movie.");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const renderMovieGrid = (movies: MovieResult[]) => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {movies.map((movie) => (
        <div
          key={movie.id}
          className="group overflow-hidden transition bg-gray-800 border border-gray-700 shadow-lg rounded-2xl flex flex-col hover:shadow-2xl hover:border-blue-500/30 hover:-translate-y-1"
        >
          <Link
            to={`/movie/${movie.id}`}
            className="relative w-full h-80 bg-gray-900 block"
          >
            {movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-gray-600">
                No poster
              </div>
            )}
          </Link>

          <div className="p-5 flex flex-col flex-grow">
            <Link to={`/movie/${movie.id}`}>
              <h4
                className="text-xl font-bold mb-1 truncate text-white hover:text-blue-400 transition-colors"
                title={movie.title}
              >
                {movie.title}
              </h4>
            </Link>
            <p className="text-xs text-gray-500 mb-3 italic">
              {movie.releaseYear} • IMDB: {movie.rating}
            </p>
            <p className="text-sm text-gray-400 line-clamp-3 mb-6 flex-grow">
              {movie.description}
            </p>
            <button
              onClick={() => handleAdd(movie)}
              className="w-full py-2.5 bg-gray-700 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors active:scale-95"
            >
              + Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen p-8 bg-gray-900 font-sans text-gray-100 relative">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between pb-6 mb-10 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Movie Tracker
          </h1>
          <nav className="flex gap-6 items-center">
            <Link
              to="/ai-chat"
              className="text-purple-400 font-bold hover:text-purple-300 transition"
            >
              AI Chat
            </Link>
            <Link
              to="/search"
              className="text-blue-400 font-bold border-b-2 border-blue-400"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-gray-400 hover:text-white transition"
            >
              My List
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm px-4 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition"
            >
              Logout
            </button>
          </nav>
        </header>

        <form
          onSubmit={handleSearch}
          className="mb-10 relative max-w-2xl mx-auto"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value === "") setResults([]);
            }}
            placeholder="Enter movie title..."
            className="w-full pl-6 pr-32 py-4 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 shadow-xl transition-all"
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-500 transition-all active:scale-95 disabled:bg-gray-700 disabled:text-gray-500"
          >
            {isSearching ? "..." : "Find"}
          </button>
        </form>

        {results.length > 0 ? (
          <>
            <h2 className="text-xl font-bold text-gray-300 mb-6 border-b border-gray-800 pb-2">
              Search Results
            </h2>
            {renderMovieGrid(results)}
          </>
        ) : searchQuery.trim() !== "" ? (
          !isSearching && (
            <p className="text-center text-gray-500 mt-12 text-lg">
              No movies found.
            </p>
          )
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-300 mb-6 flex items-center gap-2 border-b border-gray-800 pb-2">
              Trending This Week
            </h2>
            {trending.length > 0 ? (
              renderMovieGrid(trending)
            ) : (
              <p className="text-gray-500">Loading trends...</p>
            )}
          </>
        )}
      </div>

      {toastMessage && (
        <div className="fixed bottom-10 right-10 bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
