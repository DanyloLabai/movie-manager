import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import * as swipeApi from "../api/swipe.api";
import type { SwipeActionType, SwipeCard } from "../api/swipe.api";
import { useLang } from "../context/LanguageContext";
import StarRating from "../components/StarRating";
import LogoIcon from "../components/LogoIcon";

const DRAG_THRESHOLD_PX = 100;
const EXIT_ANIMATION_MS = 260;

type ExitState = { dir: "left" | "right" | "fade" } | null;

function formatCountdown(resetAt: string | null): string {
  if (!resetAt) return "";
  const ms = Math.max(0, new Date(resetAt).getTime() - Date.now());
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function Discover() {
  const { t } = useLang();
  const navigate = useNavigate();

  const [feed, setFeed] = useState<SwipeCard[] | null>(null);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [remainingToday, setRemainingToday] = useState(0);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [countdown, setCountdown] = useState("");

  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [exiting, setExiting] = useState<ExitState>(null);

  const [ratingCard, setRatingCard] = useState<SwipeCard | null>(null);
  const [ratingValue, setRatingValue] = useState(0);

  const loadFeed = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await swipeApi.getSwipeFeed();
      if (res.movies.length === 0 && res.remainingToday > 0) {
        setLoadError(true);
        return;
      }
      setDailyLimit(res.dailyLimit);
      setRemainingToday(res.remainingToday);
      setResetAt(res.resetAt);
      setFeed(res.movies);
      setIsDone(res.movies.length === 0);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!isDone || !resetAt) return;
    setCountdown(formatCountdown(resetAt));
    const id = setInterval(() => setCountdown(formatCountdown(resetAt)), 1000);
    return () => clearInterval(id);
  }, [isDone, resetAt]);

  const currentCard = feed?.[0] ?? null;
  const nextCard = feed?.[1] ?? null;
  const afterNextCard = feed?.[2] ?? null;
  const completedToday = Math.max(0, dailyLimit - remainingToday);

  function commitAction(
    card: SwipeCard,
    action: SwipeActionType,
    rating?: number,
  ) {
    swipeApi
      .submitSwipeAction({
        tmdbId: card.id,
        title: card.title,
        posterUrl: card.posterUrl,
        releaseDate: card.releaseDate,
        action,
        rating,
      })
      .catch(() => {});
  }

  function advance() {
    setDragX(0);
    setDragging(false);
    setExiting(null);
    setRemainingToday((r) => Math.max(0, r - 1));
    setFeed((prev) => {
      const rest = prev ? prev.slice(1) : prev;
      if (rest && rest.length === 0) {
        loadFeed();
      }
      return rest;
    });
  }

  function triggerExit(
    dir: "left" | "right" | "fade",
    action: SwipeActionType,
    rating?: number,
  ) {
    if (!currentCard || exiting) return;
    setExiting({ dir });
    commitAction(currentCard, action, rating);
    setTimeout(advance, EXIT_ANIMATION_MS);
  }

  function onPointerDown(e: PointerEvent) {
    if (exiting) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !dragStart.current) return;
    setDragX(e.clientX - dragStart.current.x);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragStart.current = null;
    setDragging(false);
    if (dragX > DRAG_THRESHOLD_PX) {
      triggerExit("right", "watchlist");
    } else if (dragX < -DRAG_THRESHOLD_PX) {
      triggerExit("left", "skip");
    } else {
      setDragX(0);
    }
  }

  function openRatingSheet() {
    if (!currentCard || exiting) return;
    setRatingCard(currentCard);
    setRatingValue(0);
  }

  function cancelRating() {
    setRatingCard(null);
    setRatingValue(0);
  }

  function confirmRating() {
    if (!ratingCard || ratingValue <= 0) return;
    setRatingCard(null);
    triggerExit("fade", "watched", ratingValue);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!currentCard || exiting || ratingCard) return;
      if (e.key === "ArrowLeft") triggerExit("left", "skip");
      else if (e.key === "ArrowRight") triggerExit("right", "watchlist");
      else if (e.key.toLowerCase() === "w") openRatingSheet();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard, exiting, ratingCard]);

  const cardTransform = exiting
    ? exiting.dir === "left"
      ? "translateX(-120vw) rotate(-18deg)"
      : exiting.dir === "right"
        ? "translateX(120vw) rotate(18deg)"
        : "scale(0.9)"
    : `translateX(${dragX}px) rotate(${dragX / 18}deg)`;
  const cardOpacity = exiting?.dir === "fade" ? 0 : 1;

  return (
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] overscroll-none">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-[calc(env(safe-area-inset-top)+18px)] pb-10 flex flex-col min-h-[100dvh]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="self-start mb-3 font-mono-ui text-[10px] sm:text-[10.5px] font-semibold tracking-[1.5px] sm:tracking-[2px] text-[#8f8574] hover:text-[#d9ac54] transition uppercase shrink-0"
        >
          ‹ {t("common_back")}
        </button>
        <header className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-[17px] sm:text-2xl tracking-[3.5px] sm:tracking-[4px] text-[#f2ead9]">
              {t("discover_title")}
            </span>
            <span className="font-mono-ui text-[8.5px] sm:text-[12.5px] tracking-[2px] text-[#645c4d] sm:text-[#8f8574] sm:tracking-normal sm:normal-case sm:font-sans">
              {t("discover_subtitle")}
            </span>
          </div>
          <span className="font-mono-ui text-[10px] sm:text-[10.5px] tracking-[1.5px] text-[#8f8574] shrink-0">
            {dailyLimit > 0
              ? `${Math.min(completedToday, dailyLimit)} / ${dailyLimit} ${t("discover_today")}`
              : "…"}
          </span>
        </header>

        {loadError && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <p className="text-sm text-[#8f8574]">{t("discover_load_error")}</p>
            <button
              onClick={loadFeed}
              className="px-6 py-2.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] font-bold text-xs uppercase tracking-[2px] transition"
            >
              {t("discover_retry")}
            </button>
          </div>
        )}

        {!loadError && feed === null && (
          <div className="flex-1 relative px-1">
            <div className="relative h-full rounded-2xl overflow-hidden bg-[#1c1813]">
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.04)_45%,transparent_60%)] animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono-ui text-[9.5px] tracking-[2px] text-[#645c4d] uppercase">
                  {t("discover_loading")}
                </span>
              </div>
            </div>
          </div>
        )}

        {!loadError && feed !== null && isDone && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-full border border-[#d9ac54]/45 flex items-center justify-center">
              <LogoIcon className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#f2ead9]">
              {t("discover_done_title")}
            </h2>
            <p className="text-sm text-[#8f8574] max-w-xs leading-relaxed">
              {t("discover_done_subtitle")}
            </p>
            <div className="flex flex-col gap-2.5 w-full max-w-xs mt-2">
              <Link
                to="/watchlist"
                className="py-3.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] font-bold text-xs uppercase tracking-[2px] text-center transition"
              >
                {t("discover_done_watchlist")}
              </Link>
              <Link
                to="/quiz"
                className="py-3.5 rounded-full border border-white/[.18] hover:border-[#d9ac54]/45 text-[#c9c0ac] hover:text-[#d9ac54] font-semibold text-xs uppercase tracking-[2px] text-center transition"
              >
                {t("discover_done_quiz")}
              </Link>
            </div>
            {countdown && (
              <span className="font-mono-ui text-[9.5px] tracking-[1.5px] text-[#645c4d] mt-1.5">
                {t("discover_next_batch")} {countdown}
              </span>
            )}
          </div>
        )}

        {!loadError && feed !== null && !isDone && currentCard && (
          <>
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 min-h-0">
              <button
                type="button"
                onClick={() => triggerExit("left", "skip")}
                disabled={!!exiting}
                title={t("discover_skip")}
                className="hidden sm:flex flex-col items-center gap-2.5 shrink-0 group disabled:opacity-40"
              >
                <span className="w-[72px] h-[72px] rounded-full border border-white/[.18] flex items-center justify-center text-[#8f8574] text-2xl transition group-hover:border-[#e0554d]/60 group-hover:text-[#e0554d]">
                  ✕
                </span>
                <span className="font-mono-ui text-[9.5px] tracking-[1.5px] text-[#645c4d]">
                  {t("discover_skip_key")}
                </span>
              </button>

              <div className="relative w-full max-w-[420px] aspect-[390/560] sm:h-[560px] sm:w-[400px]">
                {afterNextCard && (
                  <div className="absolute inset-x-9 top-[18px] bottom-[26px] rounded-2xl bg-[#1a1712] opacity-45 scale-[.94]" />
                )}
                {nextCard && (
                  <div className="absolute inset-x-7 top-3 bottom-5 rounded-2xl bg-[#211d16] opacity-70 scale-[.97]" />
                )}

                <div
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    transform: cardTransform,
                    opacity: cardOpacity,
                    transition: dragging
                      ? "none"
                      : `transform ${EXIT_ANIMATION_MS}ms cubic-bezier(0.16,1,0.3,1), opacity ${EXIT_ANIMATION_MS}ms ease`,
                    touchAction: "pan-y",
                  }}
                  className="relative h-full rounded-2xl overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,.6)] cursor-grab active:cursor-grabbing select-none"
                >
                  {currentCard.posterUrl ? (
                    <img
                      src={currentCard.posterUrl}
                      alt={currentCard.title}
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#15263a]" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,13,10,.25)_0%,transparent_25%,transparent_50%,rgba(15,13,10,.92)_100%)]" />

                  <span
                    className={`absolute top-3.5 left-3.5 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[9px] font-semibold tracking-[1.5px] uppercase ${
                      currentCard.matchType === "personalized"
                        ? "border border-[#d9ac54]/55 bg-[rgba(15,13,10,.65)] text-[#d9ac54]"
                        : "border border-white/25 bg-[rgba(15,13,10,.65)] text-[#c9c0ac]"
                    }`}
                  >
                    {currentCard.matchType === "personalized"
                      ? `✦ ${t("discover_badge_for_you")}`
                      : `⟡ ${t("discover_badge_different")}`}
                  </span>

                  {dragX > 30 && (
                    <span className="absolute top-6 left-5 -rotate-12 border-2 border-[#d9ac54] rounded-lg px-4 py-2 font-bold text-[15px] tracking-[3px] text-[#d9ac54] bg-[rgba(15,13,10,.55)]">
                      + {t("discover_watchlist")}
                    </span>
                  )}
                  {dragX < -30 && (
                    <span className="absolute top-6 right-5 rotate-12 border-2 border-[#e0554d] rounded-lg px-4 py-2 font-bold text-[15px] tracking-[3px] text-[#e0554d] bg-[rgba(15,13,10,.55)]">
                      {t("discover_skip")}
                    </span>
                  )}

                  <div className="absolute left-0 right-0 bottom-0 px-5 pb-5 flex flex-col gap-1.5">
                    <span className="font-bold text-2xl sm:text-[28px] leading-tight text-[#f2ead9]">
                      {currentCard.title}
                    </span>
                    <span className="font-mono-ui text-[10px] sm:text-[10.5px] tracking-[1.5px] text-[#d9ac54] uppercase">
                      {[
                        currentCard.releaseYear,
                        ...currentCard.genres,
                        currentCard.runtime
                          ? `${currentCard.runtime} ${t("discover_min")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {currentCard.hook && (
                      <span className="text-[13px] leading-relaxed text-[#c9c0ac] line-clamp-2">
                        {currentCard.hook}
                      </span>
                    )}
                    <Link
                      to={`/movie/${currentCard.id}?type=movie`}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="relative z-10 font-mono-ui font-semibold text-[10px] tracking-[1.5px] text-[#8f8574] hover:text-[#d9ac54] transition mt-0.5 uppercase w-fit"
                    >
                      {t("discover_details")} →
                    </Link>
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-center gap-6 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerExit("right", "watchlist")}
                  disabled={!!exiting}
                  className="flex flex-col items-center gap-2.5 group disabled:opacity-40"
                >
                  <span className="w-[72px] h-[72px] rounded-full bg-[#d9ac54] flex items-center justify-center text-[#14110c] text-2xl shadow-[0_8px_28px_rgba(217,172,84,.3)] transition group-hover:bg-[#e8c377]">
                    ＋
                  </span>
                  <span className="font-mono-ui text-[9.5px] tracking-[1.5px] text-[#645c4d]">
                    {t("discover_watchlist_key")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={openRatingSheet}
                  disabled={!!exiting}
                  className="flex flex-col items-center gap-2.5 group disabled:opacity-40"
                >
                  <span className="w-[58px] h-[58px] rounded-full border border-[#d9ac54]/55 flex items-center justify-center text-[#d9ac54] text-xl transition group-hover:bg-[#d9ac54]/10">
                    ✓
                  </span>
                  <span className="font-mono-ui text-[9.5px] tracking-[1.5px] text-[#645c4d]">
                    {t("discover_watched_key")}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex sm:hidden items-start justify-center gap-7 pt-4 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => triggerExit("left", "skip")}
                disabled={!!exiting}
                className="flex flex-col items-center gap-1.5 disabled:opacity-40"
              >
                <span className="w-[54px] h-[54px] rounded-full border border-white/[.18] flex items-center justify-center text-[#8f8574] text-lg">
                  ✕
                </span>
                <span className="font-mono-ui text-[8.5px] tracking-[1.5px] text-[#645c4d]">
                  {t("discover_skip")}
                </span>
              </button>
              <button
                type="button"
                onClick={openRatingSheet}
                disabled={!!exiting}
                className="flex flex-col items-center gap-1.5 disabled:opacity-40"
              >
                <span className="w-[62px] h-[62px] rounded-full border border-[#d9ac54]/55 flex items-center justify-center text-[#d9ac54] text-[22px]">
                  ✓
                </span>
                <span className="font-mono-ui text-[8.5px] tracking-[1.5px] text-[#d9ac54]">
                  {t("discover_watched")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => triggerExit("right", "watchlist")}
                disabled={!!exiting}
                className="flex flex-col items-center gap-1.5 disabled:opacity-40"
              >
                <span className="w-[54px] h-[54px] rounded-full bg-[#d9ac54] flex items-center justify-center text-[#14110c] text-lg shadow-[0_6px_22px_rgba(217,172,84,.3)]">
                  ＋
                </span>
                <span className="font-mono-ui text-[8.5px] tracking-[1.5px] text-[#645c4d]">
                  {t("discover_watchlist")}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {ratingCard && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[rgba(10,8,6,.65)]"
          onClick={cancelRating}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-[#14110d] border-t sm:border border-[#d9ac54]/25 rounded-t-[18px] sm:rounded-2xl px-6 pt-3.5 pb-7 sm:py-6 flex flex-col gap-4 animate-sheet-in sm:animate-modal-in shadow-2xl"
          >
            <div className="w-9 h-1 rounded-full bg-white/[.15] mx-auto sm:hidden" />
            <div className="flex flex-col gap-1">
              <span className="font-mono-ui text-[9.5px] tracking-[2px] text-[#d9ac54] uppercase">
                ✓ {t("discover_rate_label")}
              </span>
              <span className="font-bold text-xl text-[#f2ead9]">
                {ratingCard.title}
              </span>
              <span className="font-mono-ui text-[10px] tracking-[1.5px] text-[#8f8574] uppercase">
                {[ratingCard.releaseYear, ...ratingCard.genres]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <StarRating
                size="lg"
                value={ratingValue}
                onRate={setRatingValue}
              />
              <span className="font-bold text-[15px] text-[#f2ead9] shrink-0">
                {ratingValue}/10
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={confirmRating}
                disabled={ratingValue <= 0}
                className="py-3.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] font-bold text-xs uppercase tracking-[2px] transition disabled:opacity-40 disabled:pointer-events-none"
              >
                {t("discover_rate_confirm")} · ★ {ratingValue || 0}
              </button>
              <button
                onClick={cancelRating}
                className="text-center font-mono-ui text-[10.5px] tracking-[1.5px] text-[#8f8574] hover:text-[#d9ac54] transition uppercase"
              >
                {t("discover_rate_cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
