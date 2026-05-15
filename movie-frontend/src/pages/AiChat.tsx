import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";

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
const CHAT_EXPIRATION_MS =
  Number(import.meta.env.VITE_CHAT_EXPIRATION_MS) || 7 * 24 * 60 * 60 * 1000;
const MAX_HISTORY = Number(import.meta.env.VITE_MAX_HISTORY) || 20;
const COOLDOWN_SECONDS = 3;

export default function AiChat() {
  const { lang, t } = useLang();
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
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cooldownTime, setCooldownTime] = useState(0);

  const [viewportHeight, setViewportHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight,
  );
  const [viewportTop, setViewportTop] = useState(
    () => window.visualViewport?.offsetTop ?? 0,
  );

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  const getWelcomeMessage = (): Message => ({
    role: "ai",
    text: t("chat_welcome"),
  });

  const loadSavedMessages = (): Message[] => {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      try {
        const { messages, timestamp } = JSON.parse(saved);
        if (Date.now() - timestamp < CHAT_EXPIRATION_MS) return messages;
      } catch (e) {
        console.error("Error parsing chat history", e);
      }
    }
    return [getWelcomeMessage()];
  };

  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage()]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setViewportHeight(vv.height);
      setViewportTop(vv.offsetTop);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior,
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setTimeout(() => scrollToBottom("smooth"), 60);
  }, [viewportHeight]);

  // ── Cooldown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cooldownTime > 0) {
      timer = setInterval(() => setCooldownTime((p) => p - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownTime]);

  // ── Load history from Redis ─────────────────────────────────────────────────
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await api.get("/ai/history");
        if (Array.isArray(response.data) && response.data.length > 1) {
          setMessages(response.data);
        } else {
          setMessages([getWelcomeMessage()]);
        }
      } catch {
        setMessages(loadSavedMessages());
      } finally {
        setIsHistoryLoading(false);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setTimeout(async () => {
      try {
        await api.post("/ai/history", { messages });
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify({ messages, timestamp: Date.now() }),
        );
      } catch {
        localStorage.setItem(
          CHAT_STORAGE_KEY,
          JSON.stringify({ messages, timestamp: Date.now() }),
        );
      }
    }, 1000);
    return () => clearTimeout(timer);
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
      } catch {}
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
    setMessages([{ role: "ai", text: t("chat_cleared") }]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    api.post("/ai/history", { messages: [] }).catch(() => {});
    showToast(t("chat_history_cleared"));
  };

  const sendMessageToAi = async (userText: string) => {
    if (isLoading || cooldownTime > 0) return;
    inputRef.current?.blur();

    const newMessages: Message[] = [
      ...messages,
      { role: "user", text: userText },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const trimmedMessages = newMessages.slice(-MAX_HISTORY);
      const chatHistory = trimmedMessages.map((msg) => {
        let content = msg.text;
        if (msg.role === "ai" && msg.movies && msg.movies.length > 0) {
          const shownMovies = msg.movies.map((m) => m.title).join(", ");
          content += `\n[System note: I already showed these movies to the user: ${shownMovies}. Do not repeat them in next suggestions.]`;
        }
        return {
          role: msg.role === "ai" ? "assistant" : "user",
          content,
        };
      });

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
      setMessages((prev) => [...prev, { role: "ai", text: t("chat_error") }]);
    } finally {
      setIsLoading(false);
      setCooldownTime(COOLDOWN_SECONDS);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || cooldownTime > 0) return;
    const text = input;
    setInput("");
    await sendMessageToAi(text);
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
      showToast(t("chat_added"));
    } catch (error: any) {
      if (error.response?.status === 400) {
        setAddedIds((prev) => [...prev, movie.id]);
        showToast(t("chat_added"));
      } else showToast(t("chat_add_error"));
    }
  };

  const handleToggleFavorite = async (movie: MovieResult) => {
    if (!isReleased(movie)) {
      showToast(t("chat_fav_unreleased"));
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
      showToast(t("chat_fav_updated"));
    } catch {
      showToast(t("chat_server_error"));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div
      className="fixed left-0 right-0 flex flex-col bg-[#12100e] text-[#f0e6cc] font-sans overflow-hidden selection:bg-[#c8963c] selection:text-[#12100e]"
      style={{
        top: viewportTop,
        height: viewportHeight,
      }}
    >
      {/* ── Header ── */}
      <div className="shrink-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 py-4 sm:py-5 px-4 sm:px-8 w-full">
          <Link
            to="/search"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src={LogoImg}
              alt="LUMEN Logo"
              className="h-6 sm:h-8 w-auto object-contain"
            />
            <h1 className="text-2xl sm:text-3xl font-black text-[#c8963c] tracking-widest uppercase leading-none">
              LUMEN AI
            </h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-6 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide justify-center sm:justify-end">
            <Link
              to="/ai-chat"
              className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap"
            >
              {t("nav_ai_chat")}
            </Link>
            <Link
              to="/search"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap"
            >
              {t("nav_search")}
            </Link>
            <Link
              to="/watchlist"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap"
            >
              {t("nav_profile")}
            </Link>
            <button
              onClick={handleLogout}
              className="text-[9px] sm:text-xs px-2 py-1.5 sm:px-3 border border-red-900/50 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold whitespace-nowrap"
            >
              {t("nav_logout")}
            </button>
          </nav>
        </header>
      </div>

      {/* ── Messages ── */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-hide bg-[#12100e]"
      >
        <div className="max-w-2xl mx-auto space-y-4 pb-2">
          {isHistoryLoading ? (
            <div className="flex items-center justify-center pt-20">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
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
                        {t("chat_recommended")}
                      </h5>
                      {msg.movies.map((movie) => (
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
                                {movie.mediaType === "tv"
                                  ? t("chat_tv")
                                  : t("chat_movie")}
                                {isReleased(movie) &&
                                  ` • ★ ${Number(movie.rating || 0).toFixed(1)}`}
                              </p>
                            </div>
                          </div>
                          <div
                            className="shrink-0 flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isReleased(movie) && (
                              <button
                                onClick={() => handleToggleFavorite(movie)}
                                className="p-1.5 rounded-md hover:bg-[#c8963c]/20 transition"
                              >
                                <svg
                                  className={`w-4 h-4 transition ${favoriteIds.includes(movie.id) ? "text-red-500 fill-red-500" : "text-[#f0e6cc]/30 hover:text-red-500"}`}
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
                            )}
                            {addedIds.includes(movie.id) ? (
                              <div className="text-[9px] text-[#c8963c] px-2 py-1 font-bold">
                                ✓
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddFromChat(movie)}
                                className="text-[9px] border border-[#c8963c]/50 text-[#c8963c] px-2.5 py-1 rounded-lg font-bold hover:bg-[#c8963c] hover:text-[#12100e] transition active:scale-95"
                              >
                                {t("chat_add_btn")}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

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
        </div>
      </div>

      {/* ── Input bar — flex-none so it always sits at the bottom of the shrunk container ── */}
      <div className="shrink-0 px-3 pt-2 pb-3 bg-[#12100e] border-t border-[#c8963c]/20 z-40">
        <div className="max-w-2xl w-full mx-auto flex items-center gap-2">
          <button
            onClick={handleClearChat}
            disabled={isLoading || messages.length <= 1}
            title={t("chat_clear_title")}
            className="shrink-0 w-10 h-10 text-[#c8963c]/50 bg-[#1a1714] border border-[#c8963c]/20 rounded-xl hover:text-red-400 hover:bg-red-900/20 transition disabled:opacity-30 flex items-center justify-center"
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
              disabled={isLoading || cooldownTime > 0}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setTimeout(() => scrollToBottom("smooth"), 300)}
              placeholder={
                isLoading
                  ? t("chat_thinking")
                  : cooldownTime > 0
                    ? `Wait ${cooldownTime}s...`
                    : t("chat_placeholder")
              }
              className="w-full pl-4 pr-12 py-3 bg-[#1a1714] border border-[#c8963c]/30 rounded-xl text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] shadow-inner transition disabled:opacity-50 text-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || cooldownTime > 0}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-[#c8963c] text-[#12100e] rounded-lg font-black hover:bg-[#e8c070] transition active:scale-95 disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 text-base"
            >
              {isLoading ? "…" : cooldownTime > 0 ? cooldownTime : "→"}
            </button>
          </form>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-4 py-3 rounded-xl shadow-2xl z-50 uppercase tracking-widest font-bold text-[10px] whitespace-nowrap">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
