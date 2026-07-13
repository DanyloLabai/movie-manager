import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import * as quizApi from "../api/quiz.api";
import * as moviesApi from "../api/movies.api";
import { useLang } from "../context/LanguageContext";
import type { TranslationKey } from "../context/LanguageContext";
import { useToast } from "../hooks/useToast";
import NotificationBell from "../components/NotificationBell";
import SettingsMenu from "../components/SettingsMenu";
import LogoImg from "../assets/logo.png";
import type { MovieResult } from "../types/movie.types";
import type { QuizDifficulty, QuizState, QuizFriendState } from "../api/quiz.api";

const TOTAL_HINTS = 5;
const MAX_BLUR_PX = 20;
const MIN_BLUR_PX = 4;
const DIFFICULTIES: QuizDifficulty[] = ["easy", "normal", "hard"];
const DIFFICULTY_LABEL_KEY: Record<QuizDifficulty, TranslationKey> = {
  easy: "quiz_difficulty_easy",
  normal: "quiz_difficulty_normal",
  hard: "quiz_difficulty_hard",
};

const getUserId = (): string => {
  const token = localStorage.getItem("token");
  if (!token) return "guest";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload.sub || payload.id || payload.userId || "guest");
  } catch {
    return "guest";
  }
};

const uid = getUserId();
const DIFFICULTY_CACHE_KEY = `quiz_difficulty_${uid}`;

const isDifficulty = (v: string | null): v is QuizDifficulty =>
  v === "easy" || v === "normal" || v === "hard";

export default function DailyQuiz() {
  const { t, lang } = useLang();
  const { toastMessage, showToast } = useToast();

  const [difficulty, setDifficulty] = useState<QuizDifficulty>(() => {
    const cached = localStorage.getItem(DIFFICULTY_CACHE_KEY);
    return isDifficulty(cached) ? cached : "normal";
  });
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [guessQuery, setGuessQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MovieResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [friends, setFriends] = useState<QuizFriendState[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasStarted = (quiz?.guesses.length ?? 0) > 0;
  const isDone = !!quiz && (quiz.isSolved || quiz.isFailed);

  useEffect(() => {
    localStorage.setItem(DIFFICULTY_CACHE_KEY, difficulty);
  }, [difficulty]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    quizApi
      .getTodayQuiz(difficulty, lang)
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
  }, [difficulty, lang]);

  useEffect(() => {
    quizApi
      .getFriendsStatus()
      .then(setFriends)
      .catch(() => setFriends([]));
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
        const results = await moviesApi.searchMovies({ title: q });
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

  const handleDifficultyChange = (next: QuizDifficulty) => {
    if (hasStarted || next === difficulty) return;
    setDifficulty(next);
  };

  const handleGuess = useCallback(
    async (movie: MovieResult) => {
      if (!quiz || isDone || isSubmitting) return;
      setIsSubmitting(true);
      setSuggestions([]);
      setGuessQuery("");
      try {
        const result = await quizApi.submitGuess({
          difficulty: quiz.difficulty,
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
          MAX_BLUR_PX * (1 - quiz.guesses.length / quiz.maxAttempts),
          MIN_BLUR_PX,
        );

  const revealedHints = quiz?.hints ?? [];
  const lockedHintCount = Math.max(TOTAL_HINTS - revealedHints.length, 0);
  const posterUrl = isDone ? quiz?.answer?.posterUrl : quiz?.posterUrl;

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between gap-3 py-4 sm:py-5 px-4 sm:px-8 w-full">
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
            <nav className="hidden sm:flex items-center gap-2 sm:gap-8 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide justify-center sm:justify-end">
              <Link
                to="/ai-chat"
                className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
              >
                {t("nav_ai_chat")}
              </Link>
              <Link
                to="/search"
                className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
              >
                {t("nav_search")}
              </Link>
              <Link
                to="/quiz"
                className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap flex-shrink-0"
              >
                {t("nav_quiz")}
              </Link>
              <Link
                to="/watchlist"
                className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
              >
                {t("nav_profile")}
              </Link>

              <SettingsMenu />
            </nav>
            <NotificationBell />
          </div>
        </header>
      </div>

      <main className="max-w-xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12">
        <p className="text-center text-xs sm:text-sm text-[#f0e6cc]/50 font-medium mb-6">
          {t("quiz_subtitle")}
        </p>

        {quiz && (quiz.streak.current > 0 || quiz.streak.best > 0) && (
          <div className="flex justify-center mb-6">
            <div className="px-4 py-1.5 rounded-full bg-[#1a1714] border border-[#c8963c]/30 text-xs font-bold text-[#f0e6cc]/80 flex items-center gap-3">
              <span>
                🔥 {quiz.streak.current} {t("quiz_streak_current")}
              </span>
              <span className="text-[#f0e6cc]/30">|</span>
              <span>
                🏆 {quiz.streak.best} {t("quiz_streak_best")}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-2 mb-6">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              disabled={hasStarted}
              onClick={() => handleDifficultyChange(d)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition ${
                (quiz?.difficulty ?? difficulty) === d
                  ? "bg-[#c8963c] text-[#12100e] border-[#c8963c]"
                  : "bg-[#1a1714] text-[#f0e6cc]/60 border-[#c8963c]/30 hover:border-[#c8963c]/70"
              } ${hasStarted ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {t(DIFFICULTY_LABEL_KEY[d])}
            </button>
          ))}
        </div>

        {isLoading || !quiz ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1a1714] border-t-[#c8963c] rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="relative w-40 sm:w-48 aspect-[2/3] mx-auto mb-6 rounded-2xl overflow-hidden border border-[#c8963c]/30 shadow-xl bg-[#1a1714]">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt=""
                  className="w-full h-full object-cover transition-[filter] duration-500"
                  style={{ filter: `blur(${blurPx}px)` }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">
                  🎬
                </div>
              )}
            </div>

            <div className="flex justify-center items-center gap-1.5 mb-6">
              {Array.from({ length: quiz.maxAttempts }).map((_, i) => {
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
                {t("quiz_attempts_left")}: {quiz.attemptsLeft}
              </span>
            </div>

            <div className="space-y-2 mb-6">
              {revealedHints.map((hint, i) => (
                <div
                  key={i}
                  className="px-4 py-3 rounded-xl bg-[#1a1714] border border-[#c8963c]/20 text-sm text-[#f0e6cc]/90"
                >
                  <span className="text-[#c8963c] font-black mr-2">
                    #{i + 1}
                  </span>
                  {hint}
                </div>
              ))}
              {Array.from({ length: lockedHintCount }).map((_, i) => (
                <div
                  key={`locked-${i}`}
                  className="px-4 py-3 rounded-xl bg-[#1a1714]/40 border border-[#c8963c]/10 text-sm text-[#f0e6cc]/25 flex items-center gap-2"
                >
                  <span>🔒</span>
                  {t("quiz_hint_locked")}
                </div>
              ))}
            </div>

            {quiz.guesses.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6 justify-center">
                {quiz.guesses.map((g, i) => {
                  const isCorrectGuess =
                    quiz.isSolved && i === quiz.guesses.length - 1;
                  return (
                    <span
                      key={i}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        isCorrectGuess
                          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                          : "bg-red-500/10 border-red-500/40 text-red-400"
                      }`}
                    >
                      {isCorrectGuess ? "✓" : "✗"} {g}
                    </span>
                  );
                })}
              </div>
            )}

            {isDone ? (
              <div className="text-center bg-[#1a1714] border border-[#c8963c]/30 rounded-2xl p-6">
                <p className="text-lg font-black text-[#c8963c] uppercase tracking-widest mb-1">
                  {quiz.isSolved ? t("quiz_correct") : t("quiz_failed")}
                </p>
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
                      className="inline-block mt-3 px-5 py-2 bg-[#c8963c] text-[#12100e] rounded-full font-black uppercase tracking-widest text-xs hover:bg-[#e8c070] transition"
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
                  className="w-full px-5 py-3.5 bg-[#1a1714] border border-[#c8963c]/30 rounded-full text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] shadow-inner transition text-sm font-medium tracking-wide disabled:opacity-50"
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

            {friends.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs font-black text-[#c8963c] uppercase tracking-widest mb-3 text-center">
                  {t("quiz_friends_today")}
                </h2>
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#1a1714] border border-[#c8963c]/20"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-xs font-black text-[#12100e] shrink-0 overflow-hidden">
                        {friend.avatarUrl ? (
                          <img
                            src={friend.avatarUrl}
                            alt={friend.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          friend.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="flex-1 text-sm font-semibold text-[#f0e6cc] truncate">
                        {friend.username}
                      </span>
                      {friend.status === "solved" ? (
                        <span className="text-xs font-bold text-emerald-400">
                          ✅ {t("quiz_friend_solved")} {friend.guessCount}
                        </span>
                      ) : friend.status === "failed" ? (
                        <span className="text-xs font-bold text-red-400">
                          ❌ {t("quiz_friend_failed")}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#f0e6cc]/30">
                          {t("quiz_friend_not_played")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#1a1714] border border-[#c8963c]/40 rounded-full text-sm text-[#f0e6cc] shadow-xl">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
