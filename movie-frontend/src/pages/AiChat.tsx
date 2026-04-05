import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface MovieResult {
  id: number;
  title: string;
  description: string;
  releaseYear: string;
  rating: number;
  posterUrl: string | null;
  mediaType: "movie" | "tv";
}

interface Message {
  role: "user" | "ai";
  text: string;
  movies?: MovieResult[];
}

const CHAT_STORAGE_KEY = "movie_tracker_chat_history";
const FAVORITES_CACHE_KEY = "movie_tracker_favorites_cache";
const CHAT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

export default function AiChat() {
  const [input, setInput] = useState("");

  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => {
    try {
      const cached = localStorage.getItem(FAVORITES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadSavedMessages = (): Message[] => {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      try {
        const { messages, timestamp } = JSON.parse(saved);
        if (Date.now() - timestamp < CHAT_EXPIRATION_MS) {
          return messages;
        } else {
          localStorage.removeItem(CHAT_STORAGE_KEY);
        }
      } catch (e) {
        console.error("Error parsing chat history", e);
      }
    }
    return [
      {
        role: "ai",
        text: "Hi! I'm your movie expert. Describe the movie or TV show you're looking for.",
      },
    ];
  };

  const [messages, setMessages] = useState<Message[]>(loadSavedMessages);

  useEffect(() => {
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ messages, timestamp: Date.now() }),
    );
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const fetchFavoriteIds = async () => {
      try {
        const response = await api.get("/movies/profile");
        if (response.data?.favorites) {
          const ids = response.data.favorites.map((f: any) => f.tmdbId);
          setFavoriteIds(ids);
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(ids));
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchFavoriteIds();
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClearChat = () => {
    const initialMessage: Message[] = [
      {
        role: "ai",
        text: "Chat cleared! Let's start fresh. What are you looking for?",
      },
    ];
    setMessages(initialMessage);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    showToast("Chat history cleared");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput("");

    const newMessages: Message[] = [
      ...messages,
      { role: "user", text: userText },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const chatHistory = newMessages.map((msg) => ({
        role: msg.role === "ai" ? "assistant" : "user",
        content: msg.text,
      }));

      const response = await api.post("/ai/search", { messages: chatHistory });

      if (
        response.data &&
        response.data.movies &&
        response.data.movies.length > 0
      ) {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: response.data.message || "Here is what I found:",
            movies: response.data.movies,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text:
              response.data.message ||
              "Unfortunately, I couldn't recognize this media.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Oops, something went wrong. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFromChat = async (movie: MovieResult) => {
    try {
      await api.post("/movies/watchlist", {
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        mediaType: movie.mediaType, // <-- Передаємо тип на бекенд
      });
      showToast(`Added!`);
    } catch (error: any) {
      showToast(
        error.response?.status === 400
          ? "Already in list."
          : "Error adding movie.",
      );
    }
  };

  const handleToggleFavorite = async (movie: MovieResult) => {
    const isFav = favoriteIds.includes(movie.id);
    try {
      await api.patch(`/movies/watchlist/${movie.id}/favorite`);

      const newIds = isFav
        ? favoriteIds.filter((id) => id !== movie.id)
        : [...favoriteIds, movie.id];
      setFavoriteIds(newIds);
      localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newIds));

      showToast("Favorite status updated");
    } catch (error: any) {
      if (error.response?.status === 404 && !isFav) {
        try {
          await api.post("/movies/watchlist", {
            tmdbId: movie.id,
            title: movie.title,
            posterUrl: movie.posterUrl,
            mediaType: movie.mediaType,
          });
          await api.patch(`/movies/watchlist/${movie.id}/favorite`);

          const newIds = [...favoriteIds, movie.id];
          setFavoriteIds(newIds);
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newIds));

          showToast("Added to list and favorites");
        } catch (innerError) {
          showToast("Failed to favorite movie");
        }
      } else {
        showToast("Failed to update favorite status");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="flex flex-col fixed inset-0 h-[100dvh] w-full bg-gray-900 text-gray-100 font-sans overflow-hidden">
      <header className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link to="/search" className="hover:opacity-80 transition-opacity">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent text-center md:text-left">
              Movie Tracker
            </h1>
          </Link>
          <button
            onClick={handleClearChat}
            className="text-[10px] sm:text-xs text-gray-500 hover:text-gray-300 transition uppercase tracking-wider font-semibold border border-gray-700 px-2 py-1 rounded-md hover:bg-gray-800"
            title="Clear chat history"
          >
            Clear Chat
          </button>
        </div>
        <nav className="flex flex-wrap justify-center gap-3 sm:gap-6 items-center">
          <Link
            to="/ai-chat"
            className="text-purple-400 font-bold border-b-2 border-purple-400 transition-all text-sm sm:text-base px-1"
          >
            AI Chat
          </Link>
          <Link
            to="/search"
            className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base px-1"
          >
            Search
          </Link>
          <Link
            to="/watchlist"
            className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base px-1"
          >
            My Profile
          </Link>
          <button
            onClick={handleLogout}
            className="text-[10px] sm:text-xs px-3 py-1.5 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold"
          >
            Logout
          </button>
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 scrollbar-hide overscroll-none">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[95%] sm:max-w-[85%] p-4 rounded-2xl shadow-lg ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none shadow-blue-900/20"
                    : "bg-gray-800 border border-gray-700 rounded-tl-none shadow-black/40"
                }`}
              >
                <p className="leading-relaxed text-sm sm:text-base mb-2 whitespace-pre-wrap">
                  {msg.text}
                </p>

                {msg.movies && msg.movies.length > 0 && (
                  <div className="flex gap-4 overflow-x-auto pb-2 pt-2 scrollbar-hide">
                    {msg.movies.map((movie) => (
                      <div
                        key={movie.id}
                        className="flex-shrink-0 w-64 bg-gray-900/50 rounded-xl border border-gray-700/50 overflow-hidden relative group"
                      >
                        <button
                          className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-gray-900/60 rounded-full backdrop-blur-sm border border-gray-600/50 hover:bg-gray-800 transition group/heart"
                          onClick={() => handleToggleFavorite(movie)}
                        >
                          <svg
                            className={`w-4 h-4 transition ${
                              favoriteIds.includes(movie.id)
                                ? "text-red-500"
                                : "text-gray-400 group-hover/heart:text-red-500"
                            }`}
                            fill={
                              favoriteIds.includes(movie.id)
                                ? "currentColor"
                                : "none"
                            }
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            ></path>
                          </svg>
                        </button>

                        <div className="flex p-3 gap-3">
                          <Link
                            to={`/movie/${movie.id}?type=${movie.mediaType}`}
                            className="flex-shrink-0"
                          >
                            <img
                              src={movie.posterUrl || ""}
                              className="w-20 h-28 object-cover rounded-lg shadow-md border border-gray-700 hover:scale-105 transition-transform"
                              alt="poster"
                            />
                          </Link>

                          <div className="flex flex-col justify-between min-w-0">
                            <div>
                              <Link
                                to={`/movie/${movie.id}?type=${movie.mediaType}`}
                              >
                                <h4 className="font-bold text-white text-sm truncate hover:text-blue-400 transition-colors">
                                  {movie.title}
                                </h4>
                              </Link>
                              <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold flex items-center gap-1">
                                <span>{movie.releaseYear}</span>
                                <span>•</span>
                                <span className="text-yellow-500 font-bold">
                                  IMDB {Number(movie.rating || 0).toFixed(1)}
                                </span>
                                <span className="ml-1 inline-block bg-gray-700 px-1 py-0.5 rounded text-[8px] text-gray-300">
                                  {movie.mediaType === "tv" ? "TV" : "MOVIE"}
                                </span>
                              </p>
                            </div>
                            <button
                              onClick={() => handleAddFromChat(movie)}
                              className="text-[10px] bg-gray-700 px-3 py-2 rounded-lg font-bold hover:bg-blue-600 text-white transition-all active:scale-95 uppercase tracking-wider mt-2"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl rounded-tl-none">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-3 sm:p-4 bg-gray-900 border-t border-gray-800 shrink-0 pb-[max(env(safe-area-inset-bottom),12px)]">
        <form
          onSubmit={handleSend}
          className="max-w-3xl w-full mx-auto relative block"
        >
          <input
            type="text"
            value={input}
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isLoading ? "Thinking..." : "Describe a movie or TV show..."
            }
            className="w-full pl-5 pr-14 py-3 sm:py-4 bg-gray-800 border border-gray-700 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 shadow-2xl transition-all disabled:opacity-50 text-base"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-1.5 sm:right-2 top-1.5 bottom-1.5 px-4 sm:px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 text-lg"
          >
            {isLoading ? "..." : "→"}
          </button>
        </form>
      </div>

      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-10 sm:bottom-10 bg-gray-800 border border-gray-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center justify-center sm:justify-start gap-3 animate-in slide-in-from-bottom-5 z-50">
          <span className="font-bold text-xs sm:text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
