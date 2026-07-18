import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import * as quizApi from "../api/quiz.api";
import * as moviesApi from "../api/movies.api";
import { useLang } from "../context/LanguageContext";
import { useToast } from "../hooks/useToast";
import NotificationBell from "../components/NotificationBell";
import LogoImg from "../assets/logo.png";
import type { MovieResult } from "../types/movie.types";
import type { QuizState, QuizLeaderboardEntry } from "../api/quiz.api";

const TOTAL_HINTS = 5;
const MAX_BLUR_PX = 12;
const MIN_BLUR_PX = 4;

const ICONS = {
  fire: (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
      />
    </>
  ),
  star: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 21.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
    />
  ),
  trophy: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35"
    />
  ),
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
  const [openHintIndex, setOpenHintIndex] = useState<number | null>(null);
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
    const count = quiz?.hints?.length ?? 0;
    setOpenHintIndex(count > 0 ? count - 1 : null);
  }, [quiz?.hints?.length]);

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
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-row items-center justify-between gap-3 py-4 sm:py-5 px-4 sm:px-8 w-full">
          <Link
            to="/search"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src={LogoImg}
              alt="LUMEN Logo"
              className="h-10 sm:h-12 w-auto object-contain"
            />
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl sm:text-3xl font-black text-[#c8963c] tracking-widest uppercase leading-none">
                LUMEN
              </h1>
              <span className="text-[7px] sm:text-[8px] text-[#f0e6cc]/70 font-medium uppercase leading-none whitespace-nowrap tracking-[0.5em] sm:tracking-[0.6em] mt-1 block text-justify w-full">
                {t("app_tagline")}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>
      </div>

      <main className="max-w-xl lg:max-w-5xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12 sm:pt-10">
        <div className="text-center mb-6 pb-4 border-b border-[#c8963c]/20">
          <h2 className="text-xl sm:text-2xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            {t("nav_quiz")}
          </h2>
          <p className="text-[11px] sm:text-xs text-[#f0e6cc]/50 font-medium mt-1.5">
            {t("quiz_subtitle")}
          </p>
        </div>

        {quiz && (quiz.streak.current > 0 || quiz.streak.best > 0) && (
          <div className="flex justify-center gap-2 mb-6">
            <div className="px-4 py-1.5 rounded-full glass-panel border border-[#c8963c]/30 text-xs font-bold text-[#f0e6cc]/80 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#c8963c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {ICONS.fire}
              </svg>
              {quiz.streak.current} {t("quiz_streak_current")}
            </div>
            <div className="px-4 py-1.5 rounded-full glass-panel border border-[#c8963c]/50 glow-gold-sm text-xs font-bold text-[#c8963c] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#c8963c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {ICONS.trophy}
              </svg>
              {quiz.streak.best} {t("quiz_streak_best")}
            </div>
          </div>
        )}

        {isLoading || !quiz ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1a1714] border-t-[#c8963c] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-12 lg:gap-10">
            {/* Left column: poster + guess input */}
            <div className="lg:col-span-5">
              <div className="flex justify-center items-end gap-1.5 mb-4">
                <span className="text-4xl font-black text-[#c8963c] leading-none">
                  {quiz.score}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#f0e6cc]/40 mb-1">
                  {t("quiz_score_label")}
                </span>
              </div>

              <div className="relative w-40 sm:w-48 lg:w-full aspect-[2/3] mx-auto mb-4 rounded-2xl overflow-hidden border border-[#c8963c]/30 shadow-xl bg-[#1a1714]">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt=""
                    className="w-full h-full object-cover transition-[filter] duration-500"
                    style={{ filter: `blur(${blurPx}px)` }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-[#c8963c]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {ICONS.film}
                    </svg>
                  </div>
                )}
                {!isDone && quiz.nextHintCost !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#12100e]/30">
                    <span className="px-3 py-1.5 rounded-lg glass-panel border border-[#c8963c]/30 text-[10px] font-black uppercase tracking-widest text-[#f0e6cc] text-center drop-shadow-lg">
                      {quiz.nextHintCost} {t("quiz_points_remaining")}
                    </span>
                  </div>
                )}
              </div>

              {!isDone && (
                <div className="flex justify-center mb-6">
                  <button
                    type="button"
                    onClick={handleBuyHint}
                    disabled={quiz.nextHintCost === null || isBuyingHint}
                    className="px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest btn-glass btn-glass-dark text-[#c8963c] transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {quiz.nextHintCost !== null
                      ? `${t("quiz_buy_hint")} (−${quiz.nextHintCost})`
                      : t("quiz_all_hints_revealed")}
                  </button>
                </div>
              )}

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
                            : "border-[#c8963c]/30"
                      }`}
                    />
                  );
                })}
                <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-[#f0e6cc]/40">
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
                <div className="text-center glass-panel border border-[#c8963c]/30 rounded-2xl p-6">
                  <p className="text-lg font-black text-[#c8963c] uppercase tracking-widest mb-1">
                    {quiz.isSolved ? t("quiz_correct") : t("quiz_failed")}
                  </p>
                  {quiz.isSolved && (
                    <p className="text-sm text-[#f0e6cc]/60 mb-2">
                      {t("quiz_final_score")}: {quiz.score}
                    </p>
                  )}
                  {quiz.answer && (
                    <>
                      <p className="text-[#f0e6cc] font-bold mb-1">
                        {quiz.answer.title}{" "}
                        {quiz.answer.releaseYear
                          ? `(${quiz.answer.releaseYear})`
                          : ""}
                      </p>
                      <Link
                        to={`/movie/${quiz.answer.tmdbId}?type=movie`}
                        className="inline-block mt-3 px-5 py-2 btn-glass btn-glass-gold text-[#12100e] rounded-full font-black uppercase tracking-widest text-xs transition"
                      >
                        {t("quiz_view_movie")}
                      </Link>
                    </>
                  )}
                  <p className="text-[10px] text-[#f0e6cc]/40 uppercase tracking-widest mt-4">
                    {t("quiz_come_back_tomorrow")}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={guessQuery}
                    onChange={(e) => setGuessQuery(e.target.value)}
                    disabled={isSubmitting}
                    placeholder={t("quiz_guess_placeholder")}
                    className="w-full px-5 py-3.5 glass-panel border border-[#c8963c]/30 rounded-full text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] shadow-inner transition text-sm font-medium tracking-wide disabled:opacity-50"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-2 bg-[#1a1714] border border-[#c8963c]/30 rounded-2xl shadow-xl overflow-hidden z-10">
                      {suggestions.map((movie) => (
                        <button
                          key={movie.id}
                          type="button"
                          onMouseDown={() => handleGuess(movie)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#c8963c]/10 transition text-left"
                        >
                          {movie.posterUrl ? (
                            <img
                              src={movie.posterUrl}
                              alt=""
                              className="w-8 h-11 object-cover rounded"
                            />
                          ) : (
                            <div className="w-8 h-11 rounded bg-[#12100e]" />
                          )}
                          <span className="text-sm text-[#f0e6cc] font-medium">
                            {movie.title}{" "}
                            {movie.releaseYear && movie.releaseYear !== "N/A" && (
                              <span className="text-[#f0e6cc]/40">
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

            {/* Right column: hints + leaderboard */}
            <div className="lg:col-span-7 mt-8 lg:mt-0">
              <div className="grid sm:grid-cols-2 gap-2 mb-6">
                {revealedHints.map((hint, i) => {
                  const isOpen = openHintIndex === i;
                  return (
                    <div
                      key={i}
                      className="rounded-xl glass-panel border border-[#c8963c]/20 overflow-hidden sm:col-span-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenHintIndex(isOpen ? null : i)
                        }
                        className="w-full flex items-center gap-2 px-4 py-3 text-left"
                      >
                        <span className="text-[#c8963c] font-black">
                          #{i + 1}
                        </span>
                        {!isOpen && (
                          <span className="flex-1 truncate text-sm text-[#f0e6cc]/50">
                            {hint}
                          </span>
                        )}
                        <svg
                          className={`w-4 h-4 text-[#c8963c]/60 ml-auto shrink-0 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 text-sm text-[#f0e6cc]/90">
                          {hint}
                        </div>
                      )}
                    </div>
                  );
                })}
                {Array.from({ length: lockedHintCount }).map((_, i) => (
                  <div
                    key={`locked-${i}`}
                    className="px-4 py-3 rounded-xl bg-[#1a1714]/40 border border-[#c8963c]/10 text-sm text-[#f0e6cc]/25 flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {ICONS.lock}
                    </svg>
                    {t("quiz_hint_locked")}
                  </div>
                ))}
              </div>

              {leaderboard.length > 0 && (
                <div>
                  <h2 className="text-xs font-black text-[#c8963c] uppercase tracking-widest mb-3 text-center lg:text-left">
                    {t("quiz_leaderboard_title")}
                  </h2>
                  <div className="space-y-2">
                    {leaderboard.map((entry) => {
                      const isFirst = entry.rank === 1;
                      const rowContent = (
                        <>
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                              isFirst
                                ? "bg-[#c8963c]/20 text-[#c8963c] border border-[#c8963c]/50"
                                : entry.rank === 2
                                  ? "text-[#e8c070]"
                                  : entry.rank === 3
                                    ? "text-[#9a732a]"
                                    : "text-[#f0e6cc]/40"
                            }`}
                          >
                            #{entry.rank}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-xs font-black text-[#12100e] shrink-0 overflow-hidden">
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
                            <p className="text-sm font-semibold text-[#f0e6cc] truncate">
                              {entry.isMe ? t("quiz_you_label") : entry.username}
                            </p>
                            <p className="text-[10px] text-[#f0e6cc]/40 truncate">
                              {entry.todayStatus === "solved"
                                ? `${t("quiz_friend_solved")} ${entry.todayScore}`
                                : entry.todayStatus === "failed"
                                  ? t("quiz_friend_failed")
                                  : entry.todayStatus === "in_progress"
                                    ? t("quiz_in_progress")
                                    : t("quiz_friend_not_played")}
                            </p>
                          </div>
                          <span className="text-sm font-black text-[#c8963c] shrink-0">
                            {entry.totalScore}
                          </span>
                        </>
                      );
                      const rowClass = `flex items-center gap-3 px-4 py-2.5 rounded-xl border transition ${
                        isFirst
                          ? "glass-panel border-l-4 border-l-[#c8963c] border-[#c8963c]/40 glow-gold-sm"
                          : entry.isMe
                            ? "bg-[#1a1714] border-[#c8963c]/60"
                            : "bg-[#1a1714] border-[#c8963c]/20"
                      }`;
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
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 sm:left-[calc(50%+7.5rem)] -translate-x-1/2 z-50 px-5 py-2.5 bg-[#1a1714] border border-[#c8963c]/40 rounded-full text-sm text-[#f0e6cc] shadow-xl">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
