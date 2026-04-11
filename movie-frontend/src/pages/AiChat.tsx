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

  const [addedIds, setAddedIds] = useState<number[]>([]);
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
          text: "Oops, something went wrong on the server. Please try again later.",
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
      });
      setAddedIds((prev) => [...prev, movie.id]);
      showToast("Added!");
    } catch (error: any) {
      if (error.response?.status === 400) {
        setAddedIds((prev) => [...prev, movie.id]);
        showToast("Already in list.");
      } else {
        showToast("Error adding movie.");
      }
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
    <div className="flex flex-col fixed inset-0 h-[100dvh] w-full bg-[#12100e] text-[#f0e6cc] font-sans overflow-hidden selection:bg-[#c8963c] selection:text-[#12100e]">
      <header className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4 border-b border-[#c8963c]/20 bg-[#12100e]/80 backdrop-blur-md sticky top-0 z-20 shadow-lg shadow-[#c8963c]/5">
        <div className="flex items-center gap-4">
          <Link to="/search" className="hover:opacity-80 transition-opacity">
            <h1 className="text-2xl sm:text-3xl font-black text-[#c8963c] tracking-tight uppercase text-center md:text-left drop-shadow-md">
              Movie Tracker
            </h1>
          </Link>
        </div>
        <nav className="flex flex-wrap justify-center gap-3 sm:gap-6 items-center">
          <Link
            to="/ai-chat"
            className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-sm sm:text-base px-1 tracking-wide"
          >
            AI Chat
          </Link>
          <Link
            to="/search"
            className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-sm sm:text-base px-1 tracking-wide uppercase font-semibold"
          >
            Search
          </Link>
          <Link
            to="/watchlist"
            className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-sm sm:text-base px-1 tracking-wide uppercase font-semibold"
          >
            My Profile
          </Link>
          <button
            onClick={handleLogout}
            className="text-[10px] sm:text-xs px-3 py-1.5 border border-red-900/50 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold"
          >
            Logout
          </button>
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 scrollbar-hide overscroll-none bg-[#12100e]">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[100%] sm:max-w-[85%] p-4 rounded-2xl shadow-xl ${
                  msg.role === "user"
                    ? "bg-[#c8963c] text-[#12100e] rounded-tr-none font-medium shadow-[#c8963c]/10"
                    : "bg-[#1a1714] border border-[#c8963c]/30 text-[#f0e6cc] rounded-tl-none shadow-black/50"
                }`}
              >
                <p className="leading-relaxed text-sm sm:text-base whitespace-pre-wrap">
                  {msg.text}
                </p>

                {msg.movies && msg.movies.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 sm:gap-3 bg-[#12100e]/60 p-2 sm:p-3 rounded-xl border border-[#c8963c]/20 shadow-inner">
                    <h5 className="text-[#c8963c] text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 pt-1 pb-2">
                      Recommended for you
                    </h5>

                    {msg.movies.map((movie) => (
                      <div
                        key={movie.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-[#c8963c]/10 transition-colors group cursor-pointer border border-transparent hover:border-[#c8963c]/20"
                        onClick={() =>
                          navigate(`/movie/${movie.id}?type=${movie.mediaType}`)
                        }
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          <div className="w-10 h-14 sm:w-12 sm:h-16 bg-[#12100e] rounded-md overflow-hidden shrink-0 border border-[#c8963c]/20 shadow-md">
                            {movie.posterUrl ? (
                              <img
                                src={movie.posterUrl}
                                alt={movie.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] text-[#f0e6cc]/30">
                                No Img
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0 pr-2">
                            <h4 className="font-bold text-[#f0e6cc] text-xs sm:text-sm truncate group-hover:text-[#c8963c] transition-colors">
                              {movie.title}{" "}
                              <span className="font-normal text-[#f0e6cc]/60">
                                ({movie.releaseYear})
                              </span>
                            </h4>
                            <p className="text-[10px] sm:text-xs text-[#f0e6cc]/50 mt-1 uppercase font-semibold tracking-wider">
                              {movie.mediaType === "tv" ? "TV Show" : "Movie"} •{" "}
                              {Number(movie.rating || 0).toFixed(1)} IMDb
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(movie);
                            }}
                            className="p-1.5 sm:p-2 rounded-md hover:bg-[#c8963c]/20 transition-colors"
                            title="Favorite"
                          >
                            <svg
                              className={`w-4 h-4 sm:w-5 sm:h-5 transition ${
                                favoriteIds.includes(movie.id)
                                  ? "text-red-500"
                                  : "text-[#f0e6cc]/30 hover:text-red-500"
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

                          {addedIds.includes(movie.id) ? (
                            <div className="text-[10px] sm:text-xs text-[#c8963c] px-2 sm:px-3 py-1 sm:py-1.5 font-bold flex items-center gap-1 cursor-default opacity-70">
                              <span>✓</span>{" "}
                              <span className="hidden sm:inline">Added</span>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddFromChat(movie);
                              }}
                              className="text-[10px] sm:text-xs border border-[#c8963c]/50 text-[#c8963c] px-3 py-1.5 rounded-lg font-bold hover:bg-[#c8963c] hover:text-[#12100e] transition-all active:scale-95 whitespace-nowrap shadow-sm"
                            >
                              + Add
                            </button>
                          )}
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
              <div className="bg-[#1a1714] border border-[#c8963c]/30 p-5 rounded-2xl rounded-tl-none shadow-lg">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-3 sm:p-5 bg-[#12100e] border-t border-[#c8963c]/20 shrink-0 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-3xl w-full mx-auto flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleClearChat}
            disabled={isLoading || messages.length <= 1}
            title="Clear chat"
            className="flex-shrink-0 p-3 sm:p-4 text-[#c8963c]/50 bg-[#1a1714] border border-[#c8963c]/20 rounded-2xl hover:text-red-400 hover:bg-red-900/20 hover:border-red-500/30 transition-all group disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <svg
              className="w-5 h-5 group-active:scale-90 transition-transform"
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

          <form onSubmit={handleSend} className="relative flex-grow group">
            <input
              type="text"
              value={input}
              disabled={isLoading}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isLoading
                  ? "Thinking..."
                  : "Describe a movie, ask a question..."
              }
              className="w-full pl-5 pr-14 py-3 sm:py-4 bg-[#1a1714] border border-[#c8963c]/30 rounded-2xl text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 shadow-inner transition-all disabled:opacity-50 text-base"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-1.5 sm:right-2 top-1.5 bottom-1.5 px-4 sm:px-6 bg-[#c8963c] text-[#12100e] rounded-xl font-black hover:bg-[#e8c070] transition-all active:scale-95 disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 text-lg shadow-md"
            >
              {isLoading ? "..." : "→"}
            </button>
          </form>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center sm:justify-start gap-3 animate-in slide-in-from-bottom-5 z-50 uppercase tracking-widest font-bold">
          <span className="text-xs sm:text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
