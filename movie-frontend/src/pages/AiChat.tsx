import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface MovieResult {
  id: number;
  title: string;
  description: string;
  releaseYear: string;
  releaseDate?: string;
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
      const c = localStorage.getItem(FAVORITES_CACHE_KEY);
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });

  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const loadSavedMessages = (): Message[] => {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      try {
        const { messages, timestamp } = JSON.parse(saved);
        if (Date.now() - timestamp < CHAT_EXPIRATION_MS) return messages;
        else localStorage.removeItem(CHAT_STORAGE_KEY);
      } catch (e) {
        console.error("Error parsing chat history", e);
      }
    }
    return [
      {
        role: "ai",
        text: "Hi! I'm your movie expert. Ask me about any movie, or describe a plot you can't remember.",
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
    const fetchProfileData = async () => {
      try {
        const response = await api.get("/movies/profile");
        if (response.data) {
          const favIds =
            response.data.favorites?.map((f: any) => f.tmdbId) || [];
          setFavoriteIds(favIds);
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(favIds));
          const recentIds =
            response.data.recent?.map((r: any) => r.tmdbId) || [];
          setAddedIds(Array.from(new Set([...favIds, ...recentIds])));
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchProfileData();
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isReleased = (movie: MovieResult) => {
    if (movie.releaseDate) return new Date(movie.releaseDate) <= new Date();
    if (movie.releaseYear && movie.releaseYear !== "N/A")
      return parseInt(movie.releaseYear) <= new Date().getFullYear();
    return true;
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: "ai",
        text: "Chat cleared! Let's start fresh. What are you looking for?",
      },
    ]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    showToast("Chat history cleared");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userText = input;
    setInput("");

    // Блокуємо фокус на інпуті після відправки, щоб клавіатура ховалась, якщо треба
    inputRef.current?.blur();

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
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: response.data.message || "Here is what I found:",
          movies: response.data.movies,
        },
      ]);
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
        mediaType: movie.mediaType,
        releaseDate: movie.releaseDate,
      });
      setAddedIds((prev) => [...prev, movie.id]);
      showToast("Added!");
    } catch (error: any) {
      if (error.response?.status === 400) {
        setAddedIds((prev) => [...prev, movie.id]);
        showToast("Already in list.");
      } else showToast("Error adding movie.");
    }
  };

  const handleToggleFavorite = async (movie: MovieResult) => {
    if (!isReleased(movie)) {
      showToast("You can't favorite an unreleased movie!");
      return;
    }
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
          setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
          showToast("Added to favorites");
        } catch {
          showToast("Failed to add to favorites");
        }
      } else {
        showToast("Server error");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    // ОНОВЛЕНО: Прибрано `fixed inset-0`. Тепер контейнер просто займає `100dvh`
    <div className="flex flex-col h-[100dvh] w-full bg-[#12100e] text-[#f0e6cc] font-sans overflow-hidden selection:bg-[#c8963c] selection:text-[#12100e]">
      {/* Header */}
      <div className="z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 shrink-0 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 sm:py-5 px-4 sm:px-8 w-full">
          <Link
            to="/search"
            className="hover:opacity-80 transition-opacity shrink-0"
          >
            <h1 className="text-xl sm:text-2xl font-black text-[#c8963c] tracking-tight uppercase drop-shadow-md">
              Movie Tracker
            </h1>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-8 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide justify-center sm:justify-end">
            <Link
              to="/ai-chat"
              className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap flex-shrink-0"
            >
              AI Chat
            </Link>
            <Link
              to="/search"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-[9px] sm:text-xs px-3 py-1.5 border border-red-900/50 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold whitespace-nowrap flex-shrink-0"
            >
              Logout
            </button>
          </nav>
        </header>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-hide overscroll-none bg-[#12100e]">
        <div className="max-w-2xl mx-auto space-y-4 pb-2">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] p-3 rounded-2xl shadow-xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#c8963c] text-[#12100e] rounded-tr-sm font-medium"
                    : "bg-[#1a1714] border border-[#c8963c]/30 text-[#f0e6cc] rounded-tl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {msg.movies && msg.movies.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 bg-[#12100e]/60 p-2 rounded-xl border border-[#c8963c]/20">
                    <h5 className="text-[#c8963c] text-[9px] font-bold uppercase tracking-widest px-1 pt-0.5 pb-1.5">
                      Recommended for you
                    </h5>

                    {msg.movies.map((movie) => {
                      const released = isReleased(movie);
                      return (
                        <div
                          key={movie.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-[#c8963c]/10 transition border border-transparent hover:border-[#c8963c]/20 cursor-pointer group"
                          onClick={() =>
                            navigate(
                              `/movie/${movie.id}?type=${movie.mediaType}`,
                            )
                          }
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-9 h-12 bg-[#12100e] rounded-md overflow-hidden shrink-0 border border-[#c8963c]/20">
                              {movie.posterUrl ? (
                                <img
                                  src={movie.posterUrl}
                                  alt={movie.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[7px] text-[#f0e6cc]/30">
                                  N/A
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <h4 className="font-bold text-[#f0e6cc] text-xs truncate group-hover:text-[#c8963c] transition">
                                {movie.title}{" "}
                                <span className="font-normal text-[#f0e6cc]/50">
                                  (
                                  {movie.releaseDate
                                    ? new Date(movie.releaseDate).getFullYear()
                                    : movie.releaseYear}
                                  )
                                </span>
                              </h4>
                              <p className="text-[8px] text-[#f0e6cc]/50 mt-0.5 uppercase font-semibold tracking-wider">
                                {movie.mediaType === "tv" ? "TV Show" : "Movie"}
                                {released &&
                                  ` • ${Number(movie.rating || 0).toFixed(1)}`}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            {released ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavorite(movie);
                                }}
                                className="p-1.5 rounded-md hover:bg-[#c8963c]/20 transition"
                              >
                                <svg
                                  className={`w-4 h-4 transition ${favoriteIds.includes(movie.id) ? "text-red-500" : "text-[#f0e6cc]/30 hover:text-red-500"}`}
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
                                  />
                                </svg>
                              </button>
                            ) : (
                              <div className="p-1.5 text-[#c8963c] text-xs">
                                ⏳
                              </div>
                            )}

                            {addedIds.includes(movie.id) ? (
                              <div className="text-[9px] text-[#c8963c] px-2 py-1 font-bold flex items-center gap-0.5 opacity-70">
                                <span>✓</span>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddFromChat(movie);
                                }}
                                className="text-[9px] border border-[#c8963c]/50 text-[#c8963c] px-2.5 py-1 rounded-lg font-bold hover:bg-[#c8963c] hover:text-[#12100e] transition active:scale-95 whitespace-nowrap"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#1a1714] border border-[#c8963c]/30 p-4 rounded-2xl rounded-tl-sm shadow">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-[#c8963c] rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-[#c8963c] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-[#c8963c] rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar — safe area aware */}
      <div className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] bg-[#12100e] border-t border-[#c8963c]/20 shrink-0">
        <div className="max-w-2xl w-full mx-auto flex items-center gap-2">
          <button
            onClick={handleClearChat}
            disabled={isLoading || messages.length <= 1}
            title="Clear chat"
            className="shrink-0 w-10 h-10 text-[#c8963c]/50 bg-[#1a1714] border border-[#c8963c]/20 rounded-xl hover:text-red-400 hover:bg-red-900/20 hover:border-red-500/30 transition disabled:opacity-30 flex items-center justify-center"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>

          <form onSubmit={handleSend} className="relative flex-grow">
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={isLoading}
              onChange={(e) => setInput(e.target.value)}
              // ОНОВЛЕНО: При кліку скролимо чат вниз, щоб усе підлаштувалось під клавіатуру
              onFocus={() => {
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({
                    behavior: "smooth",
                  });
                }, 300);
              }}
              placeholder={isLoading ? "Thinking..." : "Ask about a movie..."}
              className="w-full pl-4 pr-12 py-3 bg-[#1a1714] border border-[#c8963c]/30 rounded-xl text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] shadow-inner transition disabled:opacity-50 text-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-[#c8963c] text-[#12100e] rounded-lg font-black hover:bg-[#e8c070] transition active:scale-95 disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 text-base"
            >
              {isLoading ? "…" : "→"}
            </button>
          </form>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-4 py-3 rounded-xl shadow-2xl flex items-center justify-center z-50 uppercase tracking-widest font-bold text-[10px]">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
