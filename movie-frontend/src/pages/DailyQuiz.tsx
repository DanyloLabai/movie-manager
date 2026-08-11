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
};

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDone = !!quiz && (quiz.isSolved || quiz.isFailed);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    quizApi
      .getTodayQuiz(lang)
      .then((state) => {
        if (!cancelled) setQuiz(state);
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
              </div>

              <div className="flex justify-center items-center gap-1.5 mb-6">
                {Array.from({ length: quiz.maxGuesses }).map((_, i) => {
                  const isUsed = i < quiz.guesses.length;
                  const isLastAndCorrect =
                    isUsed && quiz.isSolved && i === quiz.guesses.length - 1;
                  return (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full border ${
                        isLastAndCorrect
                          ? "bg-emerald-500 border-emerald-500"
                          : isUsed
                            ? "bg-red-500/70 border-red-500/70"
                            : "border-[#d9ac54]/30"
                      }`}
                    />
                  );
                })}
                <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-[#f2ead9]/40">
                  {t("quiz_guesses_left")}: {quiz.guessesLeft}
                </span>
              </div>

              {quiz.guesses.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6 justify-center">
                  {quiz.guesses.map((g, i) => {
                    const isCorrectGuess =
                      quiz.isSolved && i === quiz.guesses.length - 1;
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                          isCorrectGuess
                            ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                            : "bg-red-500/10 border-red-500/40 text-red-400"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isCorrectGuess ? ICONS.check : ICONS.cross}
                        </svg>
                        {g}
                      </span>
                    );
                  })}
                </div>
              )}

              {isDone ? (
                <div className="text-center glass-panel border border-[#d9ac54]/30 rounded-2xl p-6">
                  <p className="text-lg font-black text-[#d9ac54] uppercase tracking-widest mb-1">
                    {quiz.isSolved ? t("quiz_correct") : t("quiz_failed")}
                  </p>
                  {quiz.isSolved && (
                    <p className="text-sm text-[#f2ead9]/60 mb-2">
                      {t("quiz_final_score")}: {quiz.score}
                    </p>
                  )}
                  {quiz.answer && (
                    <>
                      <p className="text-[#f2ead9] font-bold mb-1">
                        {quiz.answer.title}{" "}
                        {quiz.answer.releaseYear
                          ? `(${quiz.answer.releaseYear})`
                          : ""}
                      </p>
                      <Link
                        to={`/movie/${quiz.answer.tmdbId}?type=movie`}
                        className="inline-block mt-3 px-5 py-2 btn-glass btn-glass-gold text-[#0f0d0a] rounded-full font-black uppercase tracking-widest text-xs transition"
                      >
                        {t("quiz_view_movie")}
                      </Link>
                    </>
                  )}
                  <p className="text-[10px] text-[#f2ead9]/40 uppercase tracking-widest mt-4">
                    {t("quiz_come_back_tomorrow")}
                  </p>
                </div>
              ) : (
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

            <div className="lg:col-span-7 mt-8 lg:mt-0 flex flex-col gap-8">
              <div>
                <div className="flex items-center gap-3.5 pb-3.5">
                  <span className="font-mono-ui text-[11.5px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
                    {t("quiz_hints_title")}
                  </span>
                  <div className="flex-1 h-px bg-[rgba(217,172,84,.14)]" />
                  <span className="text-[11px] text-[#8f8574]">
                    {revealedHints.length} {t("quiz_hints_of")} {TOTAL_HINTS}{" "}
                    {t("quiz_hints_opened_suffix")}
                  </span>
                </div>
                {revealedHints.map((hint, i) => (
                  <div
                    key={i}
                    className="flex gap-3.5 py-4 border-b border-[rgba(217,172,84,.12)]"
                  >
                    <span className="font-mono-ui text-xs font-bold text-[#d9ac54] shrink-0">
                      #{i + 1}
                    </span>
                    <span className="text-[14.5px] leading-relaxed text-[#f2ead9]">
                      {hint}
                    </span>
                  </div>
                ))}
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
