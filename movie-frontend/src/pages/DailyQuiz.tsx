import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import * as quizApi from "../api/quiz.api";
import * as moviesApi from "../api/movies.api";
import { useLang } from "../context/LanguageContext";
import { useToast } from "../hooks/useToast";
import NotificationBell from "../components/NotificationBell";
import LogoIcon from "../components/LogoIcon";
import type { MovieResult } from "../types/movie.types";
import type { QuizState, QuizLeaderboardEntry } from "../api/quiz.api";

const TOTAL_HINTS = 5;
const MAX_BLUR_PX = 12;
const MIN_BLUR_PX = 4;

const ICONS = {
  check: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
  cross: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
  lock: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  ),
  film: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M4 4h16v16H4V4zm4 0v16m8-16v16M4 8h16M4 16h16"
    />
  ),
  clock: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
};

function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return next - now.getTime();
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function DailyQuiz() {
  const { t, lang } = useLang();
  const { toastMessage, showToast } = useToast();

  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [guessQuery, setGuessQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MovieResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuyingHint, setIsBuyingHint] = useState(false);
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [countdownMs, setCountdownMs] = useState(() => msUntilNextUtcMidnight());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDone = !!quiz && (quiz.isSolved || quiz.isFailed);

  useEffect(() => {
    if (!isDone) return;
    const id = setInterval(() => setCountdownMs(msUntilNextUtcMidnight()), 1000);
    return () => clearInterval(id);
  }, [isDone]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    quizApi
      .getTodayQuiz(lang)
      .then((state) => {
        if (!cancelled) {
          setQuiz(state);
          setWatchlistAdded(false);
        }
      })
      .catch(() => {
        if (!cancelled) showToast(t("quiz_load_error"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    quizApi
      .getFriendsLeaderboard()
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]));
  }, [quiz?.isSolved, quiz?.isFailed]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = guessQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await moviesApi.searchMovies({
          title: q,
          skipHistory: true,
        });
        setSuggestions(
          (results || []).filter((r) => r.mediaType === "movie").slice(0, 6),
        );
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [guessQuery]);

  const handleBuyHint = useCallback(async () => {
    if (!quiz || isDone || isBuyingHint || quiz.nextHintCost === null) return;
    setIsBuyingHint(true);
    try {
      const result = await quizApi.buyHint(lang);
      setQuiz(result);
    } catch {
      showToast(t("quiz_hint_error"));
    } finally {
      setIsBuyingHint(false);
    }
  }, [quiz, isDone, isBuyingHint, lang, showToast, t]);

  const handleGuess = useCallback(
    async (movie: MovieResult) => {
      if (!quiz || isDone || isSubmitting) return;
      setIsSubmitting(true);
      setSuggestions([]);
      setGuessQuery("");
      try {
        const result = await quizApi.submitGuess({
          title: movie.title,
          tmdbId: movie.id,
          lang,
        });
        setQuiz(result);
        if (result.correct) {
          showToast(t("quiz_correct"));
        } else if (result.isFailed) {
          showToast(t("quiz_failed"));
        } else {
          showToast(t("quiz_wrong"));
        }
      } catch {
        showToast(t("quiz_guess_error"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [quiz, isDone, isSubmitting, showToast, t, lang],
  );

  const handleAddWatchlist = useCallback(async () => {
    if (!quiz?.answer || watchlistAdded) return;
    try {
      await moviesApi.addToWatchlist({
        tmdbId: quiz.answer.tmdbId,
        title: quiz.answer.title,
        posterUrl: quiz.answer.posterUrl,
        mediaType: "movie",
      });
      setWatchlistAdded(true);
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 400) {
        setWatchlistAdded(true);
      } else {
        showToast(t("quiz_watchlist_error"));
      }
    }
  }, [quiz, watchlistAdded, showToast, t]);

  const handleShareResult = useCallback(async () => {
    if (!quiz) return;
    const title = quiz.answer?.title ?? "";
    const text = quiz.isSolved
      ? `LUMEN Daily Quiz — guessed "${title}" in ${quiz.guesses.length}/${quiz.maxGuesses} · ${quiz.score} pts`
      : `LUMEN Daily Quiz — ${title ? `didn't guess "${title}"` : "didn't guess it"} today`;
    const url = `${window.location.origin}/quiz`;
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: "LUMEN Daily Quiz", text, url });
      } catch {
        // user cancelled the native share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} — ${url}`);
      showToast(t("quiz_share_copied"));
    } catch {
      showToast(t("quiz_share_copied"));
    }
  }, [quiz, showToast, t]);

  const blurPx = !quiz
    ? MAX_BLUR_PX
    : isDone
      ? 0
      : Math.max(
          MAX_BLUR_PX * (1 - quiz.hintsRevealed / TOTAL_HINTS),
          MIN_BLUR_PX,
        );

  const revealedHints = quiz?.hints ?? [];
  const lockedHintCount = Math.max(TOTAL_HINTS - revealedHints.length, 0);
  const posterUrl = isDone ? quiz?.answer?.posterUrl : quiz?.posterUrl;

  return (
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] relative overscroll-none selection:bg-[#d9ac54] selection:text-[#14110c]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)] mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-row items-center justify-between gap-3 py-4 px-4 w-full">
          <Link
            to="/search"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="font-ui font-bold text-[17px] tracking-[4px] text-[#d9ac54]">
              LUMEN
            </span>
            <LogoIcon />
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>
      </div>

      <main className="max-w-xl lg:max-w-5xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12 sm:pt-9">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-5 border-b border-[rgba(217,172,84,.16)]">
          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold text-[#f2ead9] tracking-[3px] sm:tracking-[5px] uppercase">
              {t("nav_quiz")}
            </h2>
            <p className="text-[11px] sm:text-xs text-[#8f8574] font-medium">
              {t("quiz_subtitle")}
            </p>
          </div>

          {quiz && (
            <div className="flex items-center justify-center gap-0">
              <div className="flex flex-col items-center gap-0.5 px-4 sm:px-6">
                <span className="text-xl sm:text-2xl font-bold text-[#f2ead9] leading-none">
                  {quiz.score}
                </span>
                <span className="font-mono-ui text-[8.5px] tracking-[1.5px] text-[#8f8574]">
                  {t("quiz_score_label").toUpperCase()}
                </span>
              </div>
              <div className="w-px h-[34px] bg-[rgba(217,172,84,.16)]" />
              <div className="flex flex-col items-center gap-0.5 px-4 sm:px-6">
                <span className="text-xl sm:text-2xl font-bold text-[#f2ead9] leading-none">
                  {quiz.streak.current}
                </span>
                <span className="font-mono-ui text-[8.5px] tracking-[1.5px] text-[#8f8574]">
                  {t("quiz_streak_current").toUpperCase()}
                </span>
              </div>
              <div className="w-px h-[34px] bg-[rgba(217,172,84,.16)]" />
              <div className="flex flex-col items-center gap-0.5 pl-4 sm:pl-6">
                <span className="text-xl sm:text-2xl font-bold text-[#d9ac54] leading-none">
                  {quiz.streak.best}
                </span>
                <span className="font-mono-ui text-[8.5px] tracking-[1.5px] text-[#8f8574]">
                  {t("quiz_streak_best").toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {isLoading || !quiz ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#14110d] border-t-[#d9ac54] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-12 lg:gap-10">
            {/* Left column: poster + guess input */}
            <div className="lg:col-span-5">
              <div className="relative w-40 sm:w-48 lg:w-full aspect-[2/3] mx-auto mb-4 rounded-[10px] overflow-hidden bg-[#14110d]">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt=""
                    className="w-full h-full object-cover transition-[filter] duration-500"
                    style={{ filter: `blur(${blurPx}px)` }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-[#d9ac54]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {ICONS.film}
                    </svg>
                  </div>
                )}
                {!isDone && quiz.nextHintCost !== null && (
                  <button
                    type="button"
                    onClick={handleBuyHint}
                    disabled={isBuyingHint}
                    className="absolute left-1/2 bottom-[14px] sm:bottom-[18px] -translate-x-1/2 w-[calc(100%-24px)] sm:w-auto px-3 sm:px-4 py-2 bg-[rgba(15,13,10,.85)] border border-[#d9ac54]/30 rounded-full font-mono-ui text-[8.5px] sm:text-[9.5px] tracking-[1px] sm:tracking-[1.5px] text-[#d9ac54] text-center sm:whitespace-nowrap transition hover:bg-[rgba(217,172,84,.12)] disabled:opacity-50"
                  >
                    {quiz.nextHintCost} {t("quiz_points_remaining")}
                  </button>
                )}
                {isDone && quiz.answer && (
                  <div
                    className="absolute inset-x-0 bottom-0 px-4 sm:px-5 pb-3.5 sm:pb-4.5 pt-10 flex flex-col gap-0.5"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent 55%, rgba(15,13,10,.85) 100%)",
                    }}
                  >
                    <span className="font-bold text-[15px] sm:text-[20px] leading-tight text-[#f2ead9] truncate">
                      {quiz.answer.title}
                    </span>
                    {quiz.answer.releaseYear && (
                      <span className="font-mono-ui text-[9.5px] sm:text-[11px] tracking-[1.5px] text-[#c9c0ac]">
                        {quiz.answer.releaseYear}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-center items-center gap-1.5 mb-6">
                {Array.from({ length: quiz.maxGuesses }).map((_, i) => {
                  const isUsed = i < quiz.guesses.length;
                  return (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full border ${
                        isUsed
                          ? "bg-[#d9ac54] border-[#d9ac54]"
                          : "border-[#d9ac54]/50"
                      }`}
                    />
                  );
                })}
                <span className="ml-2 font-mono-ui text-[10px] tracking-[1.5px] text-[#8f8574] uppercase">
                  {isDone
                    ? `${quiz.isSolved ? t("quiz_result_correct") : t("quiz_result_failed")} · ${quiz.guesses.length}/${quiz.maxGuesses} ${t("quiz_tries_label")}`
                    : `${quiz.guessesLeft} ${t("quiz_guesses_left")}`}
                </span>
              </div>

              {!isDone && (
                <div className="relative">
                  <div className="flex items-center gap-2.5 pl-5 pr-1.5 py-1.5 border border-[#d9ac54]/30 rounded-full bg-white/[.03] focus-within:border-[#d9ac54] transition">
                    <input
                      type="text"
                      value={guessQuery}
                      onChange={(e) => setGuessQuery(e.target.value)}
                      disabled={isSubmitting}
                      placeholder={t("quiz_guess_placeholder")}
                      className="flex-1 min-w-0 bg-transparent text-[#f2ead9] placeholder-[#8f8574] focus:outline-none text-sm font-medium tracking-wide disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting || guessQuery.trim().length < 1}
                      onClick={() => {
                        const match = suggestions[0];
                        if (match) handleGuess(match);
                      }}
                      className="shrink-0 px-5 py-2.5 bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] rounded-full font-bold uppercase tracking-[1.5px] text-[11px] transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("quiz_guess_btn")}
                    </button>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-2 bg-[#14110d] border border-[#d9ac54]/30 rounded-2xl shadow-xl overflow-hidden z-10">
                      {suggestions.map((movie) => (
                        <button
                          key={movie.id}
                          type="button"
                          onMouseDown={() => handleGuess(movie)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#d9ac54]/10 transition text-left"
                        >
                          {movie.posterUrl ? (
                            <img
                              src={movie.posterUrl}
                              alt=""
                              className="w-8 h-11 object-cover rounded"
                            />
                          ) : (
                            <div className="w-8 h-11 rounded bg-[#0f0d0a]" />
                          )}
                          <span className="text-sm text-[#f2ead9] font-medium">
                            {movie.title}{" "}
                            {movie.releaseYear && movie.releaseYear !== "N/A" && (
                              <span className="text-[#f2ead9]/40">
                                ({movie.releaseYear})
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right column: result + hints + leaderboard */}
            <div className="lg:col-span-7 mt-8 lg:mt-0 flex flex-col gap-8">
              {isDone && (
                <div className="flex flex-col gap-0">
                  <div className="flex items-center gap-3.5 pb-[18px]">
                    <span className="flex items-center gap-1.5 font-mono-ui text-[11.5px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {quiz.isSolved ? ICONS.check : ICONS.cross}
                      </svg>
                      {quiz.isSolved
                        ? t("quiz_result_correct")
                        : t("quiz_result_failed")}
                    </span>
                    <div className="flex-1 h-px bg-[rgba(217,172,84,.14)]" />
                    <span className="text-[11px] text-[#8f8574]">
                      {t("quiz_next_movie_tomorrow")}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    <span className="font-bold text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.05] tracking-[-.5px] text-[#f2ead9]">
                      {quiz.isSolved ? (
                        <>
                          {t("quiz_guessed_headline")}{" "}
                          <span className="text-[#d9ac54]">+{quiz.score}</span>
                        </>
                      ) : (
                        t("quiz_not_guessed_headline")
                      )}
                    </span>
                    {quiz.answer && (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm text-[#c9c0ac]">
                          {quiz.isSolved
                            ? t("quiz_your_answer_label")
                            : t("quiz_correct_answer_label")}
                        </span>
                        <span className="inline-flex items-center gap-2 px-[18px] py-2 border border-[#d9ac54]/45 rounded-full font-semibold text-[13px] text-[#f2ead9]">
                          <svg className="w-3.5 h-3.5 text-[#d9ac54]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {ICONS.check}
                          </svg>
                          {quiz.answer.title}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-7 gap-y-4 mt-[26px] pt-[22px] border-t border-[rgba(217,172,84,.12)]">
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-2xl sm:text-[26px] font-bold leading-none text-[#d9ac54]">
                        {quiz.score}
                      </span>
                      <span className="font-mono-ui text-[9.5px] tracking-[2px] text-[#8f8574] uppercase">
                        {t("quiz_final_score")}
                      </span>
                    </div>
                    <div className="w-px h-8 bg-[rgba(217,172,84,.16)]" />
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-2xl sm:text-[26px] font-bold leading-none text-[#f2ead9]">
                        {quiz.guesses.length}/{quiz.maxGuesses}
                      </span>
                      <span className="font-mono-ui text-[9.5px] tracking-[2px] text-[#8f8574] uppercase">
                        {t("quiz_attempts_used_label")}
                      </span>
                    </div>
                    <div className="w-px h-8 bg-[rgba(217,172,84,.16)]" />
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-2xl sm:text-[26px] font-bold leading-none text-[#f2ead9]">
                        {quiz.hintsRevealed}/{TOTAL_HINTS}
                      </span>
                      <span className="font-mono-ui text-[9.5px] tracking-[2px] text-[#8f8574] uppercase">
                        {t("quiz_hints_used_label")}
                      </span>
                    </div>
                    {quiz.answer && (
                      <div className="flex items-center gap-2.5 sm:ml-auto">
                        <Link
                          to={`/movie/${quiz.answer.tmdbId}?type=movie`}
                          className="px-6 py-3 bg-[#d9ac54] hover:bg-[#e8c377] rounded-full font-bold text-[11.5px] tracking-[2px] text-[#14110c] uppercase whitespace-nowrap transition active:scale-95"
                        >
                          {t("quiz_view_movie")}
                        </Link>
                        {watchlistAdded ? (
                          <div className="px-6 py-3 border border-[#d9ac54]/45 rounded-full font-semibold text-[11.5px] tracking-[2px] text-[#d9ac54] uppercase whitespace-nowrap">
                            ✓ {t("search_added_btn")}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAddWatchlist}
                            className="px-6 py-3 border border-white/[.18] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] rounded-full font-semibold text-[11.5px] tracking-[2px] text-[#c9c0ac] uppercase whitespace-nowrap transition"
                          >
                            {t("quiz_add_watchlist_btn")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 mt-[22px] pt-[18px] border-t border-[rgba(217,172,84,.12)]">
                    <svg className="w-3.5 h-3.5 text-[#d9ac54] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {ICONS.clock}
                    </svg>
                    <span className="text-[12.5px] text-[#8f8574]">
                      {t("quiz_new_movie_in_label")}
                    </span>
                    <span className="font-mono-ui text-[13px] tracking-[1px] font-semibold text-[#f2ead9]">
                      {formatCountdown(countdownMs)}
                    </span>
                    <button
                      type="button"
                      onClick={handleShareResult}
                      className="ml-auto font-mono-ui text-[10.5px] tracking-[1.5px] text-[#8f8574] hover:text-[#d9ac54] uppercase transition"
                    >
                      {t("quiz_share_result_link")}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-3.5 pb-3.5">
                  <span className="font-mono-ui text-[11.5px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
                    {t("quiz_hints_title")}
                  </span>
                  <div className="flex-1 h-px bg-[rgba(217,172,84,.14)]" />
                  <span className="text-[11px] text-[#8f8574]">
                    {isDone
                      ? t("quiz_hints_opened_after_finish")
                      : `${revealedHints.length} ${t("quiz_hints_of")} ${TOTAL_HINTS} ${t("quiz_hints_opened_suffix")}`}
                  </span>
                </div>
                {revealedHints.map((hint, i) => {
                  const isUnusedAfterFinish = isDone && i >= quiz.hintsRevealed;
                  const isLast = i === revealedHints.length - 1 && lockedHintCount === 0;
                  return (
                    <div
                      key={i}
                      className={`flex gap-3.5 py-4 ${isLast ? "" : "border-b border-[rgba(217,172,84,.12)]"} ${isUnusedAfterFinish ? "opacity-60" : ""}`}
                    >
                      <span className="font-mono-ui text-xs font-bold text-[#d9ac54] shrink-0">
                        #{i + 1}
                      </span>
                      <span className="text-[14.5px] leading-relaxed text-[#f2ead9]">
                        {hint}
                      </span>
                    </div>
                  );
                })}
                {Array.from({ length: lockedHintCount }).map((_, i) => (
                  <div
                    key={`locked-${i}`}
                    className="flex items-center gap-3.5 py-4 border-b border-[rgba(217,172,84,.12)] last:border-b-0 opacity-40"
                  >
                    <span className="font-mono-ui text-xs font-bold text-[#8f8574] shrink-0">
                      #{revealedHints.length + i + 1}
                    </span>
                    <span className="flex items-center gap-1.5 text-[14.5px] text-[#8f8574]">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {ICONS.lock}
                      </svg>
                      {t("quiz_hint_locked")}
                    </span>
                    {i === 0 && !isDone && quiz.nextHintCost !== null && (
                      <button
                        type="button"
                        onClick={handleBuyHint}
                        disabled={isBuyingHint}
                        className="ml-auto shrink-0 font-mono-ui text-[10px] font-semibold tracking-[1px] text-[#d9ac54] border border-[#d9ac54]/40 rounded-full px-3 py-1.5 opacity-100 transition hover:bg-[rgba(217,172,84,.12)] disabled:opacity-50"
                      >
                        −{quiz.nextHintCost} PTS
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {leaderboard.length > 0 && (
                <div>
                  <div className="flex items-center gap-3.5 pb-1.5">
                    <span className="font-mono-ui text-[11.5px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
                      {t("quiz_leaderboard_title")}
                    </span>
                    <div className="flex-1 h-px bg-[rgba(217,172,84,.14)]" />
                    <span className="text-[11px] text-[#8f8574]">
                      {t("quiz_leaderboard_today")}
                    </span>
                  </div>
                  {leaderboard.map((entry) => {
                    const isFirst = entry.rank === 1;
                    const rowContent = (
                      <>
                        <span
                          className={`font-mono-ui text-xs font-bold w-6 shrink-0 ${
                            isFirst
                              ? "text-[#d9ac54]"
                              : entry.rank === 2
                                ? "text-[#e8c377]"
                                : entry.rank === 3
                                  ? "text-[#a87c2e]"
                                  : "text-[#8f8574]"
                          }`}
                        >
                          #{entry.rank}
                        </span>
                        <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-[13px] font-bold text-[#14110c] shrink-0 overflow-hidden">
                          {entry.avatarUrl ? (
                            <img
                              src={entry.avatarUrl}
                              alt={entry.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            entry.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-semibold text-[#f2ead9] truncate">
                            {entry.isMe ? t("quiz_you_label") : entry.username}
                          </p>
                          <p className="text-[11px] text-[#8f8574] truncate">
                            {entry.todayStatus === "solved"
                              ? `${t("quiz_friend_solved")} ${entry.todayScore}`
                              : entry.todayStatus === "failed"
                                ? t("quiz_friend_failed")
                                : entry.todayStatus === "in_progress"
                                  ? t("quiz_in_progress")
                                  : t("quiz_friend_not_played")}
                          </p>
                        </div>
                        <span
                          className={`text-base font-bold shrink-0 ${isFirst ? "text-[#d9ac54]" : "text-[#8f8574]"}`}
                        >
                          {entry.totalScore}
                        </span>
                      </>
                    );
                    const rowClass =
                      "flex items-center gap-4 py-3.5 border-b border-[rgba(217,172,84,.12)] last:border-b-0 transition hover:bg-white/[.02]";
                    return entry.isMe ? (
                      <div key={entry.id} className={rowClass}>
                        {rowContent}
                      </div>
                    ) : (
                      <Link key={entry.id} to={`/user/${entry.id}`} className={rowClass}>
                        {rowContent}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 sm:left-[calc(50%+7.5rem)] -translate-x-1/2 z-50 px-5 py-2.5 bg-[#14110d] border border-[#d9ac54]/40 rounded-full text-sm text-[#f2ead9] shadow-xl">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
