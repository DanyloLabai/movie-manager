import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import type { RecommendationReason } from "../api/ai.api";
import * as moviesApi from "../api/movies.api";
import * as aiChatStore from "../store/aiChatStore";
import type { AiChatCopy } from "../store/aiChatStore";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";
import NotificationBell from "../components/NotificationBell";
import LogoIcon from "../components/LogoIcon";
import AddMovieModal from "../components/movie/AddMovieModal";

type ProfileResponse = {
  favorites?: Array<{ tmdbId: number }>;
  watchedIds?: number[];
  inPlansIds?: number[];
};

import type { MovieResult } from "../types/movie.types";

const MOBILE_BREAKPOINT_PX = 640;
const BOTTOM_NAV_CONTENT_PX = 60;

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

const getBottomReserve = (isInputFocused: boolean) =>
  window.innerWidth < MOBILE_BREAKPOINT_PX && !isInputFocused
    ? BOTTOM_NAV_CONTENT_PX + getSafeAreaInsetBottomPx()
    : 0;

const formatTokenCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);

function WhyThisHint({ reasoning }: { reasoning: RecommendationReason[] }) {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2 px-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 font-mono-ui text-[9px] font-semibold uppercase tracking-wider text-[#d9ac54]/70 hover:text-[#d9ac54] transition"
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>
          ▸
        </span>
        {t("chat_why_this")}
      </button>
      {isOpen && (
        <ul className="mt-1.5 flex flex-col gap-1 border-l border-[#d9ac54]/20 pl-2.5">
          {reasoning.map((reason, idx) => (
            <li
              key={idx}
              className="font-ui text-[10px] leading-snug text-[#8f8574]"
            >
              {reason.preferenceText}{" "}
              <span className="text-[#d9ac54]/70 font-semibold">
                ({Math.round(reason.similarityScore * 100)}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const FAVORITES_CACHE_KEY = "movie_tracker_favorites_cache";
const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024; // keep in sync with the backend
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function AiChat() {
  const { t, lang } = useLang();
  const [input, setInput] = useState("");

  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [addModalMovie, setAddModalMovie] = useState<MovieResult | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);

  const { messages, isLoading, isHistoryLoading, cooldownUntil, usage } =
    useSyncExternalStore(aiChatStore.subscribe, aiChatStore.getState);

  const [now, setNow] = useState(() => Date.now());
  const cooldownTime = Math.min(
    aiChatStore.COOLDOWN_SECONDS,
    Math.max(0, Math.ceil((cooldownUntil - now) / 1000)),
  );

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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isProgrammaticBlurRef = useRef(false);
  const caretNudgeDoneRef = useRef(false);

  const navigate = useNavigate();

  const copy = useMemo<AiChatCopy>(
    () => ({
      welcome: t("chat_welcome"),
      cleared: t("chat_cleared"),
      defaultFound: t("chat_default_found"),
      dailyLimit: t("chat_daily_limit"),
      error: t("chat_error"),
      photoSent: t("chat_photo_sent"),
      photoDailyLimit: t("chat_photo_daily_limit"),
      photoError: t("chat_photo_error"),
    }),
    [t],
  );
  const copyRef = useRef(copy);
  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);

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
    if (cooldownUntil <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (cooldownUntil <= current) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    aiChatStore.initAiChat(copyRef.current);
  }, []);

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

  useEffect(() => {
    void aiChatStore.refreshUsage();
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
    aiChatStore.clearChat(copy);
    showToast(t("chat_history_cleared"));
  };

  const sendMessageToAi = (userText: string) => {
    if (isLoading || cooldownTime > 0) return;
    inputRef.current?.blur();
    void aiChatStore.sendMessage(userText, copy);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || cooldownTime > 0) return;

    if (pendingPhoto) {
      const { file, previewUrl } = pendingPhoto;
      const note = input.trim();
      setInput("");
      setPendingPhoto(null);
      inputRef.current?.blur();
      void aiChatStore.sendPhoto(file, previewUrl, note, copy, lang);
      return;
    }

    if (!input.trim()) return;
    const text = input;
    setInput("");
    sendMessageToAi(text);
  };

  const handleSuggestionClick = (text: string) => {
    sendMessageToAi(text);
  };

  const handlePhotoButtonClick = () => {
    if (isLoading || cooldownTime > 0) return;
    photoInputRef.current?.click();
  };

  const attachPhoto = (file: File) => {
    if (isLoading || cooldownTime > 0) return;

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      showToast(t("chat_photo_invalid_type"));
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      showToast(t("chat_photo_too_large"));
      return;
    }

    setPendingPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
    inputRef.current?.focus();
  };

  const removePendingPhoto = () => {
    setPendingPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) attachPhoto(file);
  };

  const attachPhotoRef = useRef(attachPhoto);
  useEffect(() => {
    attachPhotoRef.current = attachPhoto;
  });

  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            attachPhotoRef.current(file);
          }
          return;
        }
      }
    };
    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, []);

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

  const handleMarkWatchedFromChat = async (
    movie: MovieResult,
    rating: number | null,
  ) => {
    try {
      await moviesApi.addToWatchlist({
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        mediaType: movie.mediaType,
        releaseDate: movie.releaseDate,
      });
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status !== 400) {
        showToast(t("chat_add_error"));
        return;
      }
    }
    try {
      await moviesApi.markWatched(movie.id);
      if (rating) await moviesApi.rateMovie(movie.id, rating);
      setAddedIds((prev) => [...prev, movie.id]);
      showToast(rating ? t("movie_added_rated") : t("movie_marked_watched"));
    } catch {
      showToast(t("chat_add_error"));
    }
  };

  const suggestionChips = [
    t("chat_suggestion_1"),
    t("chat_suggestion_2"),
    t("chat_suggestion_3"),
    t("chat_suggestion_4"),
  ];

  return (
    <div
      className="fixed left-0 sm:left-60 right-0 flex flex-col bg-[#0f0d0a] text-[#f2ead9] font-ui overflow-hidden transition-[top,height] duration-200 ease-out"
      style={{
        top: viewportTop,
        height: viewportHeight,
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="sm:hidden shrink-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)]">
        <header className="flex flex-row items-center justify-between gap-3 py-4 px-4 w-full">
          <Link
            to="/search"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="font-ui font-bold text-[15px] tracking-[4px] text-[#d9ac54]">
              LUMEN AI
            </span>
            <LogoIcon />
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            {usage && (
              <button
                onClick={() => setIsUsageOpen(true)}
                title={t("chat_usage_title")}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-white/[.12] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] transition"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 19V10M10 19V4M16 19v-7"
                  />
                </svg>
              </button>
            )}
            <NotificationBell />
          </div>
        </header>
      </div>

      {isUsageOpen && usage && (
        <div
          className="sm:hidden fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsUsageOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-[#14110d] border border-[#d9ac54]/25 rounded-2xl p-5 shadow-2xl relative animate-modal-in font-ui"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsUsageOpen(false)}
              className="absolute top-4 right-4 text-[#8f8574] hover:text-[#d9ac54] transition p-1"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h3 className="font-bold text-[13px] tracking-[2px] text-[#f2ead9] uppercase mb-5">
              {t("chat_usage_title")}
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono-ui text-[9.5px] tracking-[2px] text-[#8f8574] uppercase">
                    {t("chat_usage_requests_label")}
                  </span>
                  <span className="font-semibold text-[12px] text-[#f2ead9]">
                    {usage.requestCount}/{usage.requestLimit}
                  </span>
                </div>
                <div className="h-[5px] bg-white/[.08] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (usage.requestCount / usage.requestLimit) * 100)}%`,
                      background: "linear-gradient(90deg, #a87c2e, #d9ac54)",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono-ui text-[9.5px] tracking-[2px] text-[#8f8574] uppercase">
                    {t("chat_usage_tokens_label")}
                  </span>
                  <span className="font-semibold text-[12px] text-[#f2ead9]">
                    {formatTokenCount(usage.totalTokens)}/
                    {formatTokenCount(usage.tokenLimit)}
                  </span>
                </div>
                <div className="h-[5px] bg-white/[.08] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (usage.totalTokens / usage.tokenLimit) * 100)}%`,
                      background: "linear-gradient(90deg, #a87c2e, #d9ac54)",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono-ui text-[9.5px] tracking-[2px] text-[#8f8574] uppercase">
                    {t("chat_usage_photo_label")}
                  </span>
                  <span className="font-semibold text-[12px] text-[#f2ead9]">
                    {usage.photoRequestCount}/{usage.photoRequestLimit}
                  </span>
                </div>
                <div className="h-[5px] bg-white/[.08] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (usage.photoRequestCount / usage.photoRequestLimit) * 100)}%`,
                      background: "linear-gradient(90deg, #a87c2e, #d9ac54)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden sm:flex shrink-0 z-40 bg-[#0f0d0a] border-b border-[rgba(217,172,84,.16)] px-10 py-[18px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="font-ui font-bold text-[15px] tracking-[4px] text-[#d9ac54]">
            LUMEN AI
          </span>
        </div>
        <div className="flex items-center gap-4">
          {usage && (
            <span className="font-mono-ui text-[10.5px] text-[#8f8574] whitespace-nowrap">
              {t("chat_usage_today")
                .replace("[USED]", String(usage.requestCount))
                .replace("[LIMIT]", String(usage.requestLimit))}
              {" · "}
              {t("chat_usage_tokens")
                .replace("[USED]", formatTokenCount(usage.totalTokens))
                .replace("[LIMIT]", formatTokenCount(usage.tokenLimit))}
              {" · "}
              {t("chat_usage_photo")
                .replace("[USED]", String(usage.photoRequestCount))
                .replace("[LIMIT]", String(usage.photoRequestLimit))}
            </span>
          )}
          <button
            onClick={handleClearChat}
            disabled={isLoading || messages.length <= 1}
            className="flex items-center gap-2 font-mono-ui text-[10.5px] font-semibold tracking-[1.5px] uppercase text-[#8f8574] border border-white/[.12] rounded-full px-3.5 py-1.5 transition hover:text-[#d9ac54] hover:border-[#d9ac54]/45 disabled:opacity-30 disabled:hover:text-[#8f8574] disabled:hover:border-white/[.12]"
          >
            ✕ {t("chat_clear_history")}
          </button>
        </div>
      </div>

      <div className="absolute inset-0 -z-10 bg-[#0f0d0a] pointer-events-none overflow-hidden">
        <div
          className="absolute -top-36 left-1/2 -translate-x-1/2 w-[520px] h-[340px]"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(217,172,84,.1), transparent 70%)",
          }}
        />
      </div>

      <div className="relative flex-1 flex flex-col overflow-hidden">
        <div
          aria-hidden="true"
          className={`hidden sm:block shrink-0 transition-[flex-grow] duration-500 ease-in-out ${
            isEmpty ? "sm:grow" : "sm:grow-0"
          }`}
        />

        <div
          ref={chatContainerRef}
          className={`relative p-3 space-y-6 scrollbar-hide transition-[flex-grow] duration-500 ease-in-out ${
            isEmpty
              ? `flex-1 sm:flex-none overflow-y-auto sm:overflow-visible ${
                  // Skip the extra vertical-centering reflow on mobile while
                  // the keyboard is up: it compounds with the visualViewport
                  // resize already happening on focus, which is when iOS's
                  // caret-position bug tends to show up.
                  isInputFocused ? "" : "flex flex-col justify-center"
                }`
              : "flex-1 overflow-y-auto"
          }`}
        >
          <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto space-y-6 pb-2">
            {isHistoryLoading ? (
              <div className="flex items-center justify-center pt-20">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-[#d9ac54] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#d9ac54] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-[#d9ac54] rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            ) : isEmpty ? (
              <div className="flex flex-col items-center text-center gap-5 px-4 py-2">
                <div className="w-16 h-16 rounded-full border border-[#d9ac54]/45 flex items-center justify-center">
                  <img
                    src={LogoImg}
                    alt=""
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div className="flex flex-col gap-2 items-center">
                  <span className="font-ui font-bold text-[26px] tracking-[5px] text-[#f2ead9]">
                    LUMEN AI
                  </span>
                  <p className="max-w-sm text-sm leading-relaxed text-[#8f8574]">
                    {messages[0]?.text}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5 justify-center max-w-xl">
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSuggestionClick(chip)}
                      className="px-[18px] py-2.5 border border-[#d9ac54]/30 rounded-full text-[12.5px] text-[#c9c0ac] transition hover:bg-[#d9ac54]/10 hover:text-[#f2ead9]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {msg.role === "ai" && (
                    <div className="w-[30px] h-[30px] rounded-full border border-[#d9ac54]/45 flex items-center justify-center shrink-0 mt-0.5">
                      <img
                        src={LogoImg}
                        alt=""
                        className="w-3.5 h-3.5 object-contain"
                      />
                    </div>
                  )}
                  <div
                    className={`flex flex-col gap-3.5 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {msg.role === "user" ? (
                      <div className="max-w-full px-[18px] py-3 bg-[rgba(217,172,84,.13)] border border-[rgba(217,172,84,.25)] rounded-2xl rounded-tr-sm text-[14px] leading-relaxed text-[#f2ead9]">
                        {msg.imageUrl && (
                          <img
                            src={msg.imageUrl}
                            alt=""
                            className="w-[160px] h-[160px] object-cover rounded-xl mb-2"
                          />
                        )}
                        <p className="whitespace-pre-wrap select-text cursor-text">
                          {msg.text}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[14px] leading-relaxed text-[#c9c0ac] whitespace-pre-wrap select-text cursor-text">
                        {msg.text}
                      </p>
                    )}

                    {msg.movies && msg.movies.length > 0 && (
                      <div className="flex flex-col gap-3 w-full">
                        {msg.movies.map((movie) => {
                          const released = isReleased(movie);
                          const added = addedIds.includes(movie.id);
                          return (
                            <div
                              key={movie.id}
                              className="flex gap-4 p-3.5 border border-[#d9ac54]/20 rounded-[10px] bg-[rgba(217,172,84,.04)] max-w-[520px] w-full"
                            >
                              <div
                                className="w-[86px] h-[128px] rounded-[5px] bg-[#1c1a14] shrink-0 overflow-hidden cursor-pointer"
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
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[8px] text-[#f2ead9]/30">
                                    {t("common_na")}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                <div className="flex items-baseline gap-2.5 min-w-0">
                                  <h4
                                    className="font-bold text-[16px] text-[#f2ead9] truncate cursor-pointer"
                                    onClick={() =>
                                      navigate(
                                        `/movie/${movie.id}?type=${movie.mediaType}`,
                                      )
                                    }
                                  >
                                    {movie.title}
                                  </h4>
                                  <span className="text-[12px] text-[#8f8574] shrink-0">
                                    {movie.releaseYear}
                                  </span>
                                </div>
                                {released && (
                                  <div className="font-mono-ui text-[12px] font-semibold text-[#d9ac54]">
                                    ★ {Number(movie.rating || 0).toFixed(1)}
                                  </div>
                                )}
                                {movie.description && (
                                  <p className="text-[12px] leading-snug text-[#8f8574] line-clamp-2">
                                    {movie.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-auto pt-1.5">
                                  {added ? (
                                    <div className="flex items-center gap-1.5 px-[18px] py-2 border border-[#d9ac54]/45 rounded-full font-bold text-[10.5px] tracking-[1.5px] text-[#d9ac54] uppercase shrink-0 whitespace-nowrap">
                                      ✓ {t("search_added_btn")}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setAddModalMovie(movie)}
                                      className="px-[18px] py-2 bg-[#d9ac54] hover:bg-[#e8c377] rounded-full font-bold text-[10.5px] tracking-[1.5px] text-[#14110c] uppercase transition active:scale-95 shrink-0 whitespace-nowrap"
                                    >
                                      {t("chat_add_btn")}
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      navigate(
                                        `/movie/${movie.id}?type=${movie.mediaType}`,
                                      )
                                    }
                                    className="px-[18px] py-2 border border-white/[.15] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] rounded-full font-semibold text-[10.5px] tracking-[1.5px] text-[#c9c0ac] uppercase transition shrink-0 whitespace-nowrap"
                                  >
                                    {t("details")}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {msg.reasoning && msg.reasoning.length > 0 && (
                      <WhyThisHint reasoning={msg.reasoning} />
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-start gap-3.5">
                <div className="w-[30px] h-[30px] rounded-full border border-[#d9ac54]/45 flex items-center justify-center shrink-0">
                  <img
                    src={LogoImg}
                    alt=""
                    className="w-3.5 h-3.5 object-contain"
                  />
                </div>
                <div className="flex gap-1.5 pt-2.5">
                  <div className="w-1.5 h-1.5 bg-[#d9ac54] rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-[#d9ac54] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-[#d9ac54] rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-3 pt-3 pb-2.5 z-40 border-t border-[rgba(217,172,84,.16)] sm:border-t-0">
          {pendingPhoto && (
            <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full mx-auto flex items-center gap-2.5 mb-2 px-1">
              <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-[#d9ac54]/40">
                <img
                  src={pendingPhoto.previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removePendingPhoto}
                  title={t("chat_photo_remove_title")}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center text-[9px] leading-none"
                >
                  ✕
                </button>
              </div>
              <span className="text-[11px] text-[#8f8574] truncate">
                {t("chat_photo_attached_hint")}
              </span>
            </div>
          )}
          <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full mx-auto flex items-center gap-2">
            <button
              onClick={handleClearChat}
              disabled={isLoading || messages.length <= 1}
              title={t("chat_clear_title")}
              className="sm:hidden shrink-0 w-10 h-10 text-[#8f8574] border border-white/[.12] rounded-full hover:text-red-400 hover:border-red-500/40 transition disabled:opacity-30 flex items-center justify-center"
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

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handlePhotoButtonClick}
              disabled={isLoading || cooldownTime > 0}
              title={t("chat_photo_button_title")}
              className="shrink-0 w-10 h-10 text-[#8f8574] border border-white/[.12] rounded-full hover:text-[#d9ac54] hover:border-[#d9ac54]/40 transition disabled:opacity-30 flex items-center justify-center"
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <circle
                  cx="12"
                  cy="13"
                  r="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>

            <form
              onSubmit={handleSend}
              className="relative flex-grow flex items-center gap-2 bg-white/[.03] border border-[#d9ac54]/30 rounded-full pl-5 pr-1.5 py-1.5 focus-within:border-[#d9ac54] transition-shadow"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                disabled={isLoading || cooldownTime > 0}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => {
                  setIsInputFocused(true);

                  if (caretNudgeDoneRef.current) return;
                  caretNudgeDoneRef.current = true;
                  setTimeout(() => {
                    scrollToBottom("smooth");

                    const el = inputRef.current;
                    if (el && document.activeElement === el) {
                      isProgrammaticBlurRef.current = true;
                      el.blur();
                      requestAnimationFrame(() => {
                        el.focus({ preventScroll: true });
                        const pos = el.value.length;
                        el.setSelectionRange(pos, pos);
                      });
                    }
                  }, 300);
                }}
                onBlur={() => {
                  if (isProgrammaticBlurRef.current) {
                    isProgrammaticBlurRef.current = false;
                    return;
                  }
                  caretNudgeDoneRef.current = false;
                  setIsInputFocused(false);
                }}
                placeholder={
                  isLoading
                    ? t("chat_thinking")
                    : cooldownTime > 0
                      ? t("chat_wait_cooldown").replace(
                          "[X]",
                          String(cooldownTime),
                        )
                      : pendingPhoto
                        ? t("chat_photo_placeholder")
                        : t("chat_placeholder")
                }
                className="w-full bg-transparent border-none text-[#f2ead9] placeholder-[#8f8574] focus:outline-none focus:ring-0 transition disabled:opacity-50 text-sm"
              />
              <button
                type="submit"
                disabled={
                  isLoading ||
                  (!input.trim() && !pendingPhoto) ||
                  cooldownTime > 0
                }
                className="shrink-0 w-10 h-10 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] flex items-center justify-center font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
          <p className="text-center text-[10px] text-[#645c4d] mt-2">
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
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#0f0d0a] border border-[#d9ac54]/50 text-[#d9ac54] px-4 py-3 rounded-xl shadow-2xl z-50 uppercase tracking-widest font-bold text-[10px] whitespace-nowrap animate-fade-in">
          {toastMessage}
        </div>
      )}

      {addModalMovie && (
        <AddMovieModal
          title={addModalMovie.title}
          onClose={() => setAddModalMovie(null)}
          onAddToWatchlist={() => {
            handleAddFromChat(addModalMovie);
            setAddModalMovie(null);
          }}
          onMarkWatched={(rating) => {
            handleMarkWatchedFromChat(addModalMovie, rating);
            setAddModalMovie(null);
          }}
        />
      )}
    </div>
  );
}
