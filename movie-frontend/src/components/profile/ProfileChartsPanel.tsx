import { useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useLang } from "../../context/LanguageContext";
import ProfileRatingBars from "./ProfileRatingBars";
import RatingMoviesModal from "./RatingMoviesModal";
import type { WatchlistItem } from "../../types/movie.types";

const CHART_COLORS = ["#d9ac54", "#a5822f", "#8a6a3c", "#5f4b28", "#3a2f1a"];

interface GenreSlice {
  name: string;
  value: number;
}

interface ProfileChartsPanelProps {
  genreDistribution: GenreSlice[];
  ratingDistribution: { name: string; value: number }[];
  averageRating: string | number;
  topRated: WatchlistItem[];
  /** Gates the rating-bars → "movies at this rating" modal. Off by default
   * so viewing someone else's public profile can't be used to page through
   * *your own* watched list (the backend endpoint the modal calls is always
   * scoped to the signed-in user). Only the owner's own profile passes true. */
  interactiveRating?: boolean;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

const GenreTooltip = ({ active, payload }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f0d0a] border border-[#d9ac54]/50 px-2.5 py-1.5 rounded-lg shadow-xl">
        <p className="font-ui text-[11px] font-semibold text-[#f2ead9]">
          {payload[0].name}: <span className="text-[#d9ac54]">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

function GenreDonut({
  genreDistribution,
  size,
  innerLabelSize,
}: {
  genreDistribution: GenreSlice[];
  size: number;
  innerLabelSize: number;
}) {
  const { t } = useLang();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const total = genreDistribution.reduce((sum, g) => sum + g.value, 0);
  const selected = selectedIndex != null ? genreDistribution[selectedIndex] : null;
  const selectedPercent = selected && total > 0 ? Math.round((selected.value / total) * 100) : 0;

  const toggle = (index: number) => setSelectedIndex((prev) => (prev === index ? null : index));

  return (
    <div className="flex items-center gap-5 md:gap-[26px]">
      <div style={{ width: size, height: size }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={genreDistribution}
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              onClick={(_, index) => toggle(index)}
              style={{ cursor: "pointer" }}
            >
              {genreDistribution.map((_, index) => (
                <Cell
                  key={index}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  opacity={selectedIndex == null || selectedIndex === index ? 1 : 0.35}
                />
              ))}
            </Pie>
            <Tooltip content={<GenreTooltip />} cursor={{ fill: "transparent" }} wrapperStyle={{ zIndex: 9999 }} />
          </PieChart>
        </ResponsiveContainer>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none font-bold text-[#f2ead9] text-center px-2"
          style={{ fontSize: selected ? innerLabelSize * 0.4 : innerLabelSize }}
        >
          {selected ? (
            <>
              <span className="truncate max-w-full">{selected.name}</span>
              <span className="text-[#d9ac54]">{selectedPercent}%</span>
            </>
          ) : (
            genreDistribution.length
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 md:gap-2 min-w-0">
        {genreDistribution.length === 0 && (
          <span className="text-[12px] text-[#8f8574] italic">{t("common_na")}</span>
        )}
        {genreDistribution.map((g, index) => (
          <button
            key={g.name}
            type="button"
            onClick={() => toggle(index)}
            className={`flex items-center gap-2 text-[11.5px] md:text-[12.5px] min-w-0 text-left transition ${
              selectedIndex === index ? "text-[#f2ead9]" : "text-[#c9c0ac]"
            } ${selectedIndex != null && selectedIndex !== index ? "opacity-40" : ""}`}
          >
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="truncate">{g.name}</span>
            <span className="text-[#8f8574] shrink-0">
              · {total > 0 ? Math.round((g.value / total) * 100) : 0}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TopMasterpieces({ topRated }: { topRated: WatchlistItem[] }) {
  const { t } = useLang();
  if (topRated.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono-ui text-[11px] md:text-[12px] font-semibold tracking-[2.5px] md:tracking-[3px] text-[#d9ac54] uppercase">
        {t("stats_top3")}
      </span>
      {topRated.map((item, index) => (
        <Link
          key={item.id}
          to={`/movie/${item.tmdbId}?type=${item.mediaType}&fromTab=profile`}
          className="flex items-center gap-2.5 md:gap-3 hover:opacity-80 transition"
        >
          <span className="font-mono-ui font-bold text-[11px] md:text-[12px] text-[#d9ac54] shrink-0">
            #{index + 1}
          </span>
          <span className="font-semibold text-[13px] md:text-[14px] text-[#f2ead9] truncate">
            {item.title}
          </span>
          <span className="ml-auto font-mono-ui font-semibold text-[10.5px] md:text-[11.5px] text-[#d9ac54] shrink-0">
            ★ {item.rating}/10
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function ProfileChartsPanel({
  genreDistribution,
  ratingDistribution,
  averageRating,
  topRated,
  interactiveRating = false,
}: ProfileChartsPanelProps) {
  const { t } = useLang();
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const onBarClick = interactiveRating ? (r: number) => setSelectedRating(r) : undefined;

  return (
    <div className="font-ui">
      <div className="hidden md:flex gap-12">
        <div className="flex-1 flex flex-col gap-[18px] min-w-0">
          <span className="font-mono-ui text-[12px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
            {t("stats_genres")}
          </span>
          <GenreDonut genreDistribution={genreDistribution} size={140} innerLabelSize={26} />
        </div>
        <div className="w-px bg-[rgba(217,172,84,.16)] shrink-0" />
        <div className="flex-[1.3] flex flex-col gap-[18px] min-w-0">
          <div className="flex justify-between items-baseline">
            <span className="font-mono-ui text-[12px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
              {t("stats_rating")}
            </span>
            <span className="font-semibold text-[12px] text-[#d9ac54]">
              {t("stats_avg")} {averageRating}
            </span>
          </div>
          <ProfileRatingBars data={ratingDistribution} maxHeightPx={120} onBarClick={onBarClick} />
          <TopMasterpieces topRated={topRated} />
        </div>
      </div>

      <div className="md:hidden flex flex-col gap-5">
        <div className="flex flex-col gap-3 pb-5 -mx-5 px-5 border-b border-[rgba(217,172,84,.16)]">
          <span className="font-mono-ui text-[11px] font-semibold tracking-[2.5px] text-[#d9ac54] uppercase">
            {t("stats_genres")}
          </span>
          <GenreDonut genreDistribution={genreDistribution} size={104} innerLabelSize={20} />
        </div>
        <div className="flex flex-col gap-3 pb-5 -mx-5 px-5 border-b border-[rgba(217,172,84,.16)]">
          <div className="flex justify-between items-baseline">
            <span className="font-mono-ui text-[11px] font-semibold tracking-[2.5px] text-[#d9ac54] uppercase">
              {t("stats_rating")}
            </span>
            <span className="font-semibold text-[11px] text-[#d9ac54]">
              {t("stats_avg")} {averageRating}
            </span>
          </div>
          <ProfileRatingBars data={ratingDistribution} maxHeightPx={80} onBarClick={onBarClick} />
        </div>
        <TopMasterpieces topRated={topRated} />
      </div>

      {interactiveRating ? (
        <RatingMoviesModal rating={selectedRating} onClose={() => setSelectedRating(null)} />
      ) : null}
    </div>
  );
}
