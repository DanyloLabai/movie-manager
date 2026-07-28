import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import {
  ACTIVITY_ACTION_ICONS,
  activityActionLabel,
  type HeatmapDay,
} from "../utils/activity";

interface ActivityDayModalProps {
  day: HeatmapDay;
  onClose: () => void;
}

export default function ActivityDayModal({
  day,
  onClose,
}: ActivityDayModalProps) {
  const { t, lang } = useLang();
  const dateLocale = lang === "uk" ? "uk-UA" : "en-US";
  const formatted = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
    dateLocale,
    { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
  );

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-5 bg-[#0f0d0a] border border-[#d9ac54]/30 rounded-3xl shadow-2xl relative animate-modal-in font-ui"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8f8574] hover:text-[#d9ac54] transition p-1"
        >
          <svg
            className="w-5 h-5"
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

        <h2 className="text-sm font-bold text-[#f2ead9] uppercase tracking-widest mb-1 pr-8">
          {formatted}
        </h2>
        <p className="font-mono-ui text-[10px] text-[#d9ac54] font-semibold uppercase tracking-widest mb-4">
          {day.count} {t("stats_movies").toLowerCase()}
        </p>

        <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {day.actions.map((action, i) => (
            <Link
              key={`${action.tmdbId}-${action.actionType}-${i}`}
              to={`/movie/${action.tmdbId}?type=${action.mediaType || "movie"}&fromTab=profile`}
              onClick={onClose}
              className="flex items-center gap-2.5 bg-[#161310] p-2 rounded-xl border border-[#d9ac54]/10 hover:border-[#d9ac54]/40 transition group"
            >
              <div className="w-8 h-11 rounded-md bg-[#0f0d0a] overflow-hidden shrink-0 border border-[#d9ac54]/20">
                {action.posterUrl ? (
                  <img
                    src={action.posterUrl}
                    alt={action.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[6px] text-[#f2ead9]/30">
                    {t("common_na")}
                  </div>
                )}
              </div>
              <div className="flex flex-col overflow-hidden min-w-0">
                <h4 className="font-bold text-[#f2ead9] group-hover:text-[#d9ac54] transition truncate text-xs">
                  {action.title}
                </h4>
                <span className="text-[9px] text-[#8f8574] flex items-center gap-1">
                  <span>{ACTIVITY_ACTION_ICONS[action.actionType]}</span>
                  {activityActionLabel(action.actionType, t)}
                  {action.actionType === "rated" && action.rating != null && (
                    <span className="text-[#d9ac54] font-bold">
                      ({action.rating}/10)
                    </span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
