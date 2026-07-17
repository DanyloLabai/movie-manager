import { useMemo, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useLang } from "../context/LanguageContext";
import {
  ACTIVITY_LEVEL_CLASSES,
  getActivityLevel,
  type ActivityDay,
  type HeatmapDay,
} from "../utils/activity";
import ActivityDayTooltip from "./ActivityDayTooltip";
import ActivityDayModal from "./ActivityDayModal";

interface ActivityHeatmapProps {
  days: ActivityDay[];
  year: number;
  isLoading?: boolean;
  onPrevYear?: () => void;
  onNextYear?: () => void;
  canGoNext?: boolean;
}

// Squares grow a bit at wider breakpoints so the grid doesn't look lost
// inside the much wider desktop card.
const SQUARE_W_CLASS = "w-[11px] sm:w-[13px] lg:w-[16px]";
const SQUARE_H_CLASS = "h-[11px] sm:h-[13px] lg:h-[16px]";
const SQUARE_CLASS = `${SQUARE_W_CLASS} ${SQUARE_H_CLASS}`;
const MONTH_ROW_H_CLASS = "h-[14px] lg:h-[16px]";
const GAP_CLASS = "gap-[3px] sm:gap-[3px] lg:gap-[4px]";
const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT_ESTIMATE = 150;

// Reference week starting Sunday 1970-01-04, used purely to derive
// localized weekday abbreviations for the Mon/Wed/Fri row labels.
function getWeekdayLabels(lang: string): string[] {
  const dateLocale = lang === "uk" ? "uk-UA" : "en-US";
  const sunday = new Date(Date.UTC(1970, 0, 4));
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (i === 1 || i === 3 || i === 5) {
      const d = new Date(sunday);
      d.setUTCDate(d.getUTCDate() + i);
      labels.push(
        d.toLocaleDateString(dateLocale, { weekday: "short", timeZone: "UTC" }),
      );
    } else {
      labels.push("");
    }
  }
  return labels;
}

function buildWeeks(
  year: number,
  byDate: Map<string, ActivityDay>,
): HeatmapDay[][] {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));

  // Pad out to full weeks (Sun-Sat) so every column has 7 rows.
  const start = new Date(jan1);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(dec31);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const weeks: HeatmapDay[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: HeatmapDay[] = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const inYear = cursor.getUTCFullYear() === year;
      const entry = byDate.get(dateStr);
      week.push({
        date: dateStr,
        inYear,
        count: entry?.count ?? 0,
        actions: entry?.actions ?? [],
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function getMonthLabels(weeks: HeatmapDay[][], lang: string): string[] {
  const dateLocale = lang === "uk" ? "uk-UA" : "en-US";
  const labels: string[] = [];
  let lastMonth = -1;
  for (const week of weeks) {
    const firstInYear = week.find((d) => d.inYear);
    const month = firstInYear
      ? new Date(`${firstInYear.date}T00:00:00Z`).getUTCMonth()
      : -1;
    if (firstInYear && month !== lastMonth) {
      lastMonth = month;
      labels.push(
        new Date(Date.UTC(2000, month, 1)).toLocaleDateString(dateLocale, {
          month: "short",
          timeZone: "UTC",
        }),
      );
    } else {
      labels.push("");
    }
  }
  return labels;
}

export default function ActivityHeatmap({
  days,
  year,
  isLoading,
  onPrevYear,
  onNextYear,
  canGoNext = true,
}: ActivityHeatmapProps) {
  const { t, lang } = useLang();
  const [hovered, setHovered] = useState<{
    day: HeatmapDay;
    style: CSSProperties;
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, ActivityDay>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const weeks = useMemo(() => buildWeeks(year, byDate), [year, byDate]);
  const monthLabels = useMemo(() => getMonthLabels(weeks, lang), [weeks, lang]);
  const weekdayLabels = useMemo(() => getWeekdayLabels(lang), [lang]);

  const handleMouseEnter = (e: MouseEvent<HTMLDivElement>, day: HeatmapDay) => {
    if (!day.inYear || day.count === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const anchorCenterX = rect.left + rect.width / 2;
    const above = rect.top >= TOOLTIP_HEIGHT_ESTIMATE + 8;
    let left = anchorCenterX - TOOLTIP_WIDTH / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8));
    const top = above
      ? rect.top - TOOLTIP_HEIGHT_ESTIMATE - 8
      : rect.bottom + 8;
    setHovered({
      day,
      style: {
        position: "fixed",
        left,
        top,
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
      },
    });
  };

  return (
    <div className="relative mt-4">
      <div className="p-4 lg:p-5 glass-panel rounded-2xl border border-[#c8963c]/20 shadow-xl">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs lg:text-sm font-black text-[#f0e6cc] uppercase tracking-widest">
              {t("activity_heatmap_title")}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrevYear}
                className="w-5 h-5 flex items-center justify-center rounded-md text-[#f0e6cc]/50 hover:text-[#c8963c] hover:bg-[#c8963c]/10 transition"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-[10px] lg:text-xs font-black text-[#c8963c] tabular-nums w-8 text-center">
                {year}
              </span>
              <button
                type="button"
                onClick={onNextYear}
                disabled={!canGoNext}
                className="w-5 h-5 flex items-center justify-center rounded-md text-[#f0e6cc]/50 hover:text-[#c8963c] hover:bg-[#c8963c]/10 transition disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[8px] lg:text-[9px] text-[#f0e6cc]/40 font-bold uppercase tracking-wide">
            <span>{t("activity_legend_less")}</span>
            {ACTIVITY_LEVEL_CLASSES.map((cls, i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-sm ${cls}`}
              />
            ))}
            <span>{t("activity_legend_more")}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-6 text-[#c8963c] animate-pulse font-bold uppercase tracking-widest text-[10px]">
            {t("profile_loading")}
          </div>
        ) : (
          <div
            className="overflow-x-auto pb-1"
            onMouseLeave={() => setHovered(null)}
          >
            <div className="inline-flex gap-1.5">
              {/* Weekday row labels (Mon/Wed/Fri), so the card isn't just
                empty space to the left of the grid. */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <div className={MONTH_ROW_H_CLASS} />
                <div className={`flex flex-col ${GAP_CLASS}`}>
                  {weekdayLabels.map((label, i) => (
                    <div
                      key={i}
                      className={`${SQUARE_H_CLASS} flex items-center text-[8px] lg:text-[9px] text-[#f0e6cc]/40 font-bold whitespace-nowrap`}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="inline-flex flex-col gap-1.5">
                <div className={`flex ${GAP_CLASS} ${MONTH_ROW_H_CLASS}`}>
                  {weeks.map((_, wi) => (
                    <div
                      key={wi}
                      className={`shrink-0 text-[8px] lg:text-[9px] text-[#f0e6cc]/40 font-bold ${SQUARE_W_CLASS}`}
                    >
                      {monthLabels[wi]}
                    </div>
                  ))}
                </div>
                <div className={`flex ${GAP_CLASS}`}>
                  {weeks.map((week, wi) => (
                    <div key={wi} className={`flex flex-col ${GAP_CLASS}`}>
                      {week.map((day) => (
                        <div
                          key={day.date}
                          title={
                            day.inYear ? `${day.date}: ${day.count}` : undefined
                          }
                          onMouseEnter={(e) => handleMouseEnter(e, day)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => {
                            if (!day.inYear || day.count === 0) return;
                            // Touch devices fire a synthetic mouseenter right
                            // before click, and never get a mouseleave to
                            // clear it — without this the hover tooltip
                            // stays stuck on top of the modal.
                            setHovered(null);
                            setSelectedDay(day);
                          }}
                          className={`rounded-sm transition-colors ${SQUARE_CLASS} ${
                            day.inYear
                              ? `${ACTIVITY_LEVEL_CLASSES[getActivityLevel(day.count)]} ${
                                  day.count > 0
                                    ? "cursor-pointer hover:ring-1 hover:ring-[#e8c070]"
                                    : ""
                                }`
                              : "opacity-0"
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {hovered && (
        <ActivityDayTooltip day={hovered.day} style={hovered.style} />
      )}
      {selectedDay && (
        <ActivityDayModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
