import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useLang } from "../../context/LanguageContext";
import ProfileRatingBars from "./ProfileRatingBars";
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
  onMovieLinkClick?: () => void;
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
  const total = genreDistribution.reduce((sum, g) => sum + g.value, 0);
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
            >
              {genreDistribution.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<GenreTooltip />} cursor={{ fill: "transparent" }} wrapperStyle={{ zIndex: 9999 }} />
          </PieChart>
        </ResponsiveContainer>
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none font-bold text-[#f2ead9]"
          style={{ fontSize: innerLabelSize }}
        >
          {genreDistribution.length}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 md:gap-2 min-w-0">
        {genreDistribution.length === 0 && (
          <span className="text-[12px] text-[#8f8574] italic">{t("common_na")}</span>
        )}
        {genreDistribution.map((g, index) => (
          <div key={g.name} className="flex items-center gap-2 text-[11.5px] md:text-[12.5px] text-[#c9c0ac] min-w-0">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="truncate">{g.name}</span>
            <span className="text-[#8f8574] shrink-0">
              · {total > 0 ? Math.round((g.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopMasterpieces({
  topRated,
  onMovieLinkClick,
}: {
  topRated: WatchlistItem[];
  onMovieLinkClick?: () => void;
}) {
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
          onClick={onMovieLinkClick}
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
  onMovieLinkClick,
}: ProfileChartsPanelProps) {
  const { t } = useLang();

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
          <ProfileRatingBars data={ratingDistribution} maxHeightPx={120} />
          <TopMasterpieces topRated={topRated} onMovieLinkClick={onMovieLinkClick} />
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
          <ProfileRatingBars data={ratingDistribution} maxHeightPx={80} />
        </div>
        <TopMasterpieces topRated={topRated} onMovieLinkClick={onMovieLinkClick} />
      </div>
    </div>
  );
}
