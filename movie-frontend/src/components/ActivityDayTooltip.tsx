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
  const visible = day.actions.slice(-MAX_VISIBLE).reverse();
  const remaining = day.actions.length - visible.length;

  return (
    <div style={style} className="pointer-events-none animate-fade-in">
      <div className="bg-[#0f0d0a] border border-[#d9ac54]/50 rounded-xl shadow-2xl p-2.5">
        <p className="font-mono-ui text-[9px] font-semibold text-[#d9ac54] uppercase tracking-widest mb-1.5">
          {formatted} · {day.count}
        </p>
        <div className="flex flex-col gap-1">
          {visible.map((action, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 font-ui text-[10px] text-[#f2ead9]"
            >
              <span className="shrink-0">
                {ACTIVITY_ACTION_ICONS[action.actionType]}
              </span>
              <span className="truncate">{action.title}</span>
            </div>
          ))}
        </div>
        {remaining > 0 && (
          <p className="font-ui text-[9px] text-[#8f8574] mt-1 italic">
            {t("activity_and_more").replace("[X]", String(remaining))}
          </p>
        )}
      </div>
    </div>
  );
}
