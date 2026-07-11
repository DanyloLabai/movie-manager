import type { CSSProperties } from "react";
import { useLang } from "../context/LanguageContext";
import { ACTIVITY_ACTION_ICONS, type HeatmapDay } from "../utils/activity";

const MAX_VISIBLE = 5;

interface ActivityDayTooltipProps {
  day: HeatmapDay;
  style: CSSProperties;
}

export default function ActivityDayTooltip({
  day,
  style,
}: ActivityDayTooltipProps) {
  const { t, lang } = useLang();
  const dateLocale = lang === "uk" ? "uk-UA" : "en-US";
  const formatted = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
    dateLocale,
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
  const visible = day.actions.slice(0, MAX_VISIBLE);
  const remaining = day.actions.length - visible.length;

  return (
    <div style={style} className="pointer-events-none animate-fade-in">
      <div className="bg-[#1a1714] border border-[#c8963c]/50 rounded-xl shadow-2xl p-2.5">
        <p className="text-[9px] font-black text-[#c8963c] uppercase tracking-widest mb-1.5">
          {formatted} · {day.count}
        </p>
        <div className="flex flex-col gap-1">
          {visible.map((action, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 text-[10px] text-[#f0e6cc]"
            >
              <span className="shrink-0">
                {ACTIVITY_ACTION_ICONS[action.actionType]}
              </span>
              <span className="truncate">{action.title}</span>
            </div>
          ))}
        </div>
        {remaining > 0 && (
          <p className="text-[9px] text-[#f0e6cc]/50 mt-1 italic">
            {t("activity_and_more").replace("[X]", String(remaining))}
          </p>
        )}
      </div>
    </div>
  );
}
