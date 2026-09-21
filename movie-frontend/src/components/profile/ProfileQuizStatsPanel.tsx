import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../context/LanguageContext";
import * as quizApi from "../../api/quiz.api";
import type { QuizMonthlyStatsEntry } from "../../api/quiz.api";

interface ProfileQuizStatsPanelProps {
  username: string;
  /** Omit to fetch the signed-in user's own history. */
  userId?: number;
  /** Reports whether there's any monthly history to show, once known- lets
   * the parent skip rendering an empty bordered section around this panel. */
  onAvailabilityChange?: (hasData: boolean) => void;
}

const Divider = () => (
  <div className="hidden md:block w-px bg-[rgba(217,172,84,.16)] mx-7 shrink-0" />
);

function monthLabel(month: string, locale: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNum - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function ProfileQuizStatsPanel({
  username,
  userId,
  onAvailabilityChange,
}: ProfileQuizStatsPanelProps) {
  const { t, lang } = useLang();
  const [entries, setEntries] = useState<QuizMonthlyStatsEntry[] | null>(
    null,
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    quizApi
      .getMonthlyStats(userId)
      .then((data) => {
        if (!cancelled) {
          setEntries(data);
          setIndex(0);
          onAvailabilityChange?.(data.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          onAvailabilityChange?.(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const locale = lang === "uk" ? "uk-UA" : "en-US";
  const current = entries?.[index] ?? null;
  const label = useMemo(
    () => (current ? monthLabel(current.month, locale) : ""),
    [current, locale],
  );

  if (entries === null) return null;
  if (entries.length === 0) return null;

  return (
    <div className="font-ui flex flex-col gap-4 md:gap-[22px]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono-ui text-[11px] md:text-[12px] font-semibold tracking-[2.5px] md:tracking-[3px] text-[#d9ac54] uppercase">
          {t("quiz_stats_title").replace("[username]", username)}
        </span>
        {entries.length > 1 && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(i + 1, entries.length - 1))}
              disabled={index >= entries.length - 1}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-[#d9ac54]/30 text-[#8f8574] hover:text-[#d9ac54] hover:border-[#d9ac54]/60 transition disabled:opacity-30 disabled:pointer-events-none"
            >
              ‹
            </button>
            <span className="font-mono-ui text-[10px] tracking-[1.5px] text-[#c9c0ac] uppercase whitespace-nowrap">
              {label}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index <= 0}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-[#d9ac54]/30 text-[#8f8574] hover:text-[#d9ac54] hover:border-[#d9ac54]/60 transition disabled:opacity-30 disabled:pointer-events-none"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {current && (
        <div className="grid grid-cols-2 gap-4 md:flex md:gap-0">
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[22px] md:text-[30px] leading-none font-bold text-[#f2ead9]">
              {current.avgScore}
            </span>
            <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
              {t("quiz_stats_avg_score")}
            </span>
          </div>
          <Divider />
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[22px] md:text-[30px] leading-none font-bold text-[#f2ead9]">
              {current.solvedCount}
            </span>
            <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
              {t("quiz_stats_solved")}
            </span>
          </div>
          <Divider />
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[22px] md:text-[30px] leading-none font-bold text-[#f2ead9]">
              {current.perfectSolves}
            </span>
            <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
              {t("quiz_stats_perfect")}
            </span>
          </div>
          <Divider />
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[22px] md:text-[30px] leading-none font-bold text-[#f2ead9]">
              {current.totalScore}
            </span>
            <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
              {t("quiz_stats_total_score")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
