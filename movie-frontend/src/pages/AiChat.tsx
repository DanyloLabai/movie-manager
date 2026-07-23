import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as aiApi from "../api/ai.api";
import type { AIMessage, RecommendationReason } from "../api/ai.api";
import * as moviesApi from "../api/movies.api";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";
import NotificationBell from "../components/NotificationBell";

type ProfileResponse = {
  favorites?: Array<{ tmdbId: number }>;
  watchedIds?: number[];
  inPlansIds?: number[];
};

import type { MovieResult } from "../types/movie.types";

interface Message {
  role: "user" | "ai";
  text: string;
  movies?: MovieResult[];
  reasoning?: RecommendationReason[];
}

const MOBILE_BREAKPOINT_PX = 640;
// Height of the nav bar's own content (icon + label + vertical padding),
// not counting the safe-area inset it adds on top of that via
// `pb-[env(safe-area-inset-bottom)]`.
const BOTTOM_NAV_CONTENT_PX = 60;

// In an installed PWA (standalone display mode) the app draws edge-to-edge,
// so env(safe-area-inset-bottom) resolves to the real home-indicator/gesture
// inset. In a regular mobile browser tab that space is already occupied by
// the browser's own chrome, so the inset is 0 there — which is why this bug
// only showed up in the installed app. Measure it instead of assuming 0, so
// the reserved space always matches what the nav bar actually renders at.
let cachedSafeAreaInsetBottomPx: number | null = null;
const getSafeAreaInsetBottomPx = () => {
  if (cachedSafeAreaInsetBottomPx !== null) return cachedSafeAreaInsetBottomPx;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);
  cachedSafeAreaInsetBottomPx = probe.getBoundingClientRect().height;
  document.body.removeChild(probe);
  return cachedSafeAreaInsetBottomPx;
};
if (typeof window !== "undefined") {
  window.addEventListener("orientationchange", () => {
    cachedSafeAreaInsetBottomPx = null;
  });
}

// No reserve while the input is focused: the bottom nav hides itself so the
// keyboard doesn't fight it for space, and the chat should sit as close to
// the keyboard as the visual viewport already allows.
const getBottomReserve = (isInputFocused: boolean) =>
  window.innerWidth < MOBILE_BREAKPOINT_PX && !isInputFocused
    ? BOTTOM_NAV_CONTENT_PX + getSafeAreaInsetBottomPx()
    : 0;

function WhyThisHint({ reasoning }: { reasoning: RecommendationReason[] }) {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2 px-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#c8963c]/70 hover:text-[#c8963c] transition"
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>
          ▸
        </span>
        {t("chat_why_this")}
      </button>
      {isOpen && (
        <ul className="mt-1.5 flex flex-col gap-1 border-l border-[#c8963c]/20 pl-2.5">
          {reasoning.map((reason, idx) => (
            <li
              key={idx}
              className="text-[10px] leading-snug text-[#f0e6cc]/60"
            >
              {reason.preferenceText}{" "}
              <span className="text-[#c8963c]/60 font-semibold">
                ({Math.round(reason.similarityScore * 100)}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CHAT_STORAGE_KEY = "movie_tracker_chat_history";
const FAVORITES_CACHE_KEY = "movie_tracker_favorites_cache";
const CHAT_EXPIRATION_MS =
  Number(import.meta.env.VITE_CHAT_EXPIRATION_MS) || 7 * 24 * 60 * 60 * 1000;
const MAX_HISTORY = Number(import.meta.env.VITE_MAX_HISTORY) || 20;
const COOLDOWN_SECONDS = 3;

export default function AiChat() {
  const { t } = useLang();
  const [input, setInput] = useState("");

  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [viewportHeight, setViewportHeight] = useState(
    () =>
      (window.visualViewport?.height ?? window.innerHeight) -
      getBottomReserve(false),
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
  // Only the initial welcome message present — no user turn sent yet.
  // Matches the threshold already used elsewhere (clear-chat button) to
  // mean "nothing to a real conversation yet".
  const isEmpty = messages.length <= 1;

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setViewportHeight(vv.height - getBottomReserve(isInputFocused));
      setViewportTop(vv.offsetTop);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isInputFocused]);

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

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cooldownTime > 0) {
      timer = setInterval(() => setCooldownTime((p) => p - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownTime]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await aiApi.getHistory();
        if (Array.isArray(history) && history.length > 0) {
          setMessages(
            history.map((m) => ({
              role: m.role === "assistant" ? "ai" : "user",
              text: m.content,
              movies: m.movies,
            })),
          );
        } else {
          setMessages(loadSavedMessages());
        }
      } catch {
        setMessages(loadSavedMessages());
      } finally {
        setIsHistoryLoading(false);
      }
    };
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setTimeout(async () => {
      try {
        const aiMsgs: AIMessage[] = messages.map((m) => ({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.text,
          ...(m.movies && m.movies.length > 0 && { movies: m.movies }),
        }));
        await aiApi.postHistory(aiMsgs);
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
        const response = await moviesApi.getProfile();
        if (response) {
          const profileData = response as ProfileResponse;
          const favIds = profileData.favorites?.map((f) => f.tmdbId) || [];
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(favIds));
          const watchedIds = profileData.watchedIds || [];
          const inPlansIds = profileData.inPlansIds || [];
          setAddedIds(Array.from(new Set([...watchedIds, ...inPlansIds])));
        }
      } catch (err) {
        console.error("Failed to fetch profile in AiChat:", err);
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
    setMessages([{ role: "ai", text: t("chat_cleared") }]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    aiApi.postHistory([] as AIMessage[]).catch(() => void 0);
    showToast(t("chat_history_cleared"));
  };

  const sendMessageToAi = async (userText: string) => {
    if (isLoading || cooldownTime > 0) return;
    inputRef.current?.blur();

    const userMsg: Message = { role: "user", text: userText };
    const newMessages: Message[] = [...messages, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const trimmedMessages = newMessages.slice(-MAX_HISTORY);

      const shownMovieIds = trimmedMessages
        .filter((m) => m.movies && m.movies.length > 0)
        .flatMap((m) => m.movies!.map((movie) => movie.id));

      const chatHistory: AIMessage[] = trimmedMessages.map((msg) => {
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

      const response = await aiApi.aiSearch({
        messages: chatHistory,
        shownMovieIds,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: response.message || t("chat_default_found"),
          movies: response.movies,
          reasoning: response.reasoning,
        },
      ]);
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      const errorText =
        apiError.response?.status === 429
          ? t("chat_daily_limit")
          : t("chat_error");
      setMessages((prev) => [...prev, { role: "ai", text: errorText }]);
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
      await moviesApi.addToWatchlist({
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        mediaType: movie.mediaType,
        releaseDate: movie.releaseDate,
      });
      setAddedIds((prev) => [...prev, movie.id]);
      showToast(t("chat_added"));
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 400) {
        setAddedIds((prev) => [...prev, movie.id]);
        showToast(t("chat_added"));
      } else showToast(t("chat_add_error"));
    }
  };

  return (
    <div
      className="fixed left-0 sm:left-60 right-0 flex flex-col text-[#f0e6cc] font-sans overflow-hidden"
      style={{
        top: viewportTop,
        height: viewportHeight,
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="sm:hidden shrink-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10">
        <header className="flex flex-row items-center justify-between gap-3 sm:gap-4 py-4 sm:py-5 px-4 sm:px-8 w-full">
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
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>
      </div>

      <div className="hidden sm:flex shrink-0 z-40 glass-panel border-b border-[#c8963c]/10 px-8 py-5 items-center justify-center">
        <h1 className="text-xl font-black text-[#c8963c] tracking-widest uppercase leading-none">
          {t("chat_header_title")}
        </h1>
      </div>

      <div className="absolute inset-0 -z-10 ai-chat-background pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-[#c8963c]/10 rounded-full blur-[130px]" />
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-[#c8963c]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 -right-20 w-96 h-96 bg-[#c8963c]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Desktop-only spacers: grow equally to push the (shrunk-to-fit)
            message block + input down into the vertical center while the
            conversation is empty; collapse back to 0 once it isn't, so the
            block slides down to its normal top/bottom-pinned layout. Kept
            out of mobile entirely — centering there would fight the
            on-screen keyboard when the input is focused. */}
        <div
          aria-hidden="true"
          className={`hidden sm:block shrink-0 transition-[flex-grow] duration-500 ease-in-out ${
            isEmpty ? "sm:grow" : "sm:grow-0"
          }`}
        />

        <div
          ref={chatContainerRef}
          className={`relative p-3 space-y-4 scrollbar-hide transition-[flex-grow] duration-500 ease-in-out ${
            isEmpty
              ? "flex flex-col justify-center flex-1 sm:flex-none overflow-y-auto sm:overflow-visible"
              : "flex-1 overflow-y-auto"
          }`}
        >
          <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto space-y-4 pb-2">
            {isHistoryLoading ? (
              <div className="flex items-center justify-center pt-20">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-[#c8963c] rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            ) : isEmpty ? (
              <div className="flex flex-col items-center text-center gap-3 px-4 py-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl sm:text-4xl font-black text-[#c8963c] tracking-widest uppercase leading-none drop-shadow-[0_0_10px_rgba(244,189,95,0.5)]">
                    LUMEN AI
                  </h1>
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-[#c8963c]/30 blur-xl rounded-full" />
                    <img
                      src={LogoImg}
                      alt=""
                      className="relative h-10 sm:h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(244,189,95,0.5)]"
                    />
                  </div>
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-[#f0e6cc]/60">
                  {messages[0]?.text}
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "ai"
                        ? "bg-[#12100e] border border-[#c8963c]/40 p-1 glow-gold-sm"
                        : "bg-gradient-to-br from-[#c8963c] to-[#9a732a] glow-gold-sm"
                    }`}
                  >
                    {msg.role === "ai" ? (
                      <img
                        src={LogoImg}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <svg
                        className="w-3 h-3 text-[#12100e]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )}
                  </div>
                  <div
                    className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`p-3 rounded-2xl shadow-xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#c8963c] text-[#12100e] rounded-tr-sm font-medium"
                          : "glass-panel border border-[#c8963c]/30 text-[#f0e6cc] rounded-tl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap select-text cursor-text">
                        {msg.text}
                      </p>
                      {msg.movies && msg.movies.length > 0 && (
                        <div className="mt-3">
                          <h5 className="text-[#c8963c] text-[9px] font-bold uppercase tracking-widest px-1 pb-1.5">
                            {t("chat_recommended")}
                          </h5>
                          <div className="grid grid-cols-4 gap-1.5">
                            {msg.movies.map((movie) => (
                              <div
                                key={movie.id}
                                className="group flex flex-col rounded-lg overflow-hidden border border-[#c8963c]/20 hover:border-[#c8963c]/70 transition"
                              >
                                <div
                                  className="relative aspect-[2/3] cursor-pointer"
                                  onClick={() =>
                                    navigate(
                                      `/movie/${movie.id}?type=${movie.mediaType}`,
                                    )
                                  }
                                >
                                  {movie.posterUrl ? (
                                    <img
                                      src={movie.posterUrl}
                                      alt={movie.title}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-[#12100e] flex items-center justify-center text-[7px] text-[#f0e6cc]/30">
                                      N/A
                                    </div>
                                  )}
                                  {isReleased(movie) && (
                                    <div className="absolute top-1 left-1 bg-[#12100e]/90 backdrop-blur-sm px-1 py-0.5 rounded text-[7px] font-black text-[#c8963c] border border-[#c8963c]/30">
                                      ★ {Number(movie.rating || 0).toFixed(1)}
                                    </div>
                                  )}
                                </div>
                                <div className="p-1 bg-[#1a1714] flex flex-col gap-1 flex-1">
                                  <h4
                                    className="font-bold text-[#f0e6cc] text-[9px] leading-tight truncate cursor-pointer"
                                    onClick={() =>
                                      navigate(
                                        `/movie/${movie.id}?type=${movie.mediaType}`,
                                      )
                                    }
                                  >
                                    {movie.title}
                                  </h4>
                                  {addedIds.includes(movie.id) ? (
                                    <div className="w-full py-1 rounded-md btn-glass btn-glass-gold flex items-center justify-center gap-0.5 text-[#12100e] text-[7px] font-black uppercase tracking-wide">
                                      <span>✓</span> {t("search_added_btn")}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleAddFromChat(movie)}
                                      className="w-full py-1 rounded-md btn-glass btn-glass-dark flex items-center justify-center text-[#c8963c] text-[7px] font-black uppercase tracking-wide active:scale-95 transition"
                                    >
                                      + {t("search_add")}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {msg.reasoning && msg.reasoning.length > 0 && (
                        <WhyThisHint reasoning={msg.reasoning} />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#12100e] border border-[#c8963c]/40 p-1 flex items-center justify-center shrink-0 glow-gold-sm">
                  <img
                    src={LogoImg}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="glass-panel border border-[#c8963c]/30 p-4 rounded-2xl rounded-tl-sm shadow">
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

        <div
          className={`shrink-0 px-3 pt-2 pb-2 z-40 bg-[#12100e] border-t border-[#c8963c]/20 transition-colors duration-500 ease-in-out ${
            isEmpty ? "sm:bg-transparent sm:border-transparent" : ""
          }`}
        >
          <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full mx-auto flex items-center gap-2">
            <button
              onClick={handleClearChat}
              disabled={isLoading || messages.length <= 1}
              title={t("chat_clear_title")}
              className="shrink-0 w-10 h-10 text-[#c8963c]/50 btn-glass btn-glass-dark rounded-xl hover:text-red-400 hover:!bg-red-900/20 hover:!border-red-500/40 transition disabled:opacity-30 flex items-center justify-center"
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

            <form
              onSubmit={handleSend}
              className="relative flex-grow flex items-center gap-2 glass-panel border border-[#c8963c]/30 rounded-full pl-4 pr-1.5 py-1.5 focus-within:border-[#c8963c] focus-within:shadow-[0_0_0_3px_rgba(200,150,60,0.15),0_0_24px_-6px_rgba(200,150,60,0.5)] transition-shadow"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                disabled={isLoading || cooldownTime > 0}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => {
                  setIsInputFocused(true);
                  setTimeout(() => scrollToBottom("smooth"), 300);
                }}
                onBlur={() => setIsInputFocused(false)}
                placeholder={
                  isLoading
                    ? t("chat_thinking")
                    : cooldownTime > 0
                      ? t("chat_wait_cooldown").replace(
                          "[X]",
                          String(cooldownTime),
                        )
                      : t("chat_placeholder")
                }
                className="w-full bg-transparent border-none text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:ring-0 transition disabled:opacity-50 text-sm"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || cooldownTime > 0}
                className="shrink-0 w-9 h-9 rounded-full btn-glass btn-glass-gold text-[#12100e] flex items-center justify-center font-black transition active:scale-95 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  "…"
                ) : cooldownTime > 0 ? (
                  <span className="text-xs">{cooldownTime}</span>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M12 19V5m0 0l-6 6m6-6l6 6"
                    />
                  </svg>
                )}
              </button>
            </form>
          </div>
          <p className="text-center text-[9px] text-[#f0e6cc]/30 font-semibold mt-1.5 tracking-wide">
            {t("chat_disclaimer")}
          </p>
        </div>

        <div
          aria-hidden="true"
          className={`hidden sm:block shrink-0 transition-[flex-grow] duration-500 ease-in-out ${
            isEmpty ? "sm:grow" : "sm:grow-0"
          }`}
        />
      </div>

      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-4 py-3 rounded-xl shadow-2xl z-50 uppercase tracking-widest font-bold text-[10px] whitespace-nowrap animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
