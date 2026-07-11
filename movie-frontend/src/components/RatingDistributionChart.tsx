import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useLang } from "../context/LanguageContext";

interface RatingBucket {
  name: string;
  value: number;
}

interface RatingDistributionChartProps {
  data: RatingBucket[];
  averageRating?: string | number;
}

interface TooltipPayloadEntry {
  payload: RatingBucket;
  value: number;
}

const RatingTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) => {
  const { t } = useLang();
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1714] border border-[#c8963c]/50 px-2 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5">
        <span className="text-[#c8963c] font-black text-xs">
          ★ {payload[0].payload.name}
        </span>
        <span className="text-[#f0e6cc]/50 text-xs">|</span>
        <span className="text-[#f0e6cc] font-bold text-[10px]">
          {payload[0].value} {t("stats_movies").toLowerCase()}
        </span>
      </div>
    );
  }
  return null;
};

// Whole-star ticks (1, 2, ... 10) get more weight than half-star ticks
// (0.5, 1.5, ...) so the axis stays legible with 20 categories instead of
// reading as a wall of equally-loud labels.
const RatingAxisTick = ({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) => {
  const isWholeStar = Number(payload?.value) % 1 === 0;
  return (
    <text
      x={x}
      y={(y ?? 0) + 10}
      textAnchor="middle"
      fill="#f0e6cc"
      fillOpacity={isWholeStar ? 0.55 : 0.22}
      fontSize={isWholeStar ? 9 : 8}
      fontWeight={isWholeStar ? 700 : 400}
    >
      {payload?.value}
    </text>
  );
};

// Selective direct labels: only non-zero bars get a value above their tip,
// so the label count scales with how much a user has actually rated instead
// of flooding every one of the 20 buckets.
const RatingValueLabel = (props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
}) => {
  const { x = 0, y = 0, width = 0, value = 0 } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 5}
      textAnchor="middle"
      fill="#f0e6cc"
      fillOpacity={0.75}
      fontSize={9}
      fontWeight={700}
    >
      {value}
    </text>
  );
};

export default function RatingDistributionChart({
  data,
  averageRating,
}: RatingDistributionChartProps) {
  const { t } = useLang();

  return (
    <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-xl p-3 h-[190px] flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold">
          {t("stats_rating")}
        </p>
        <p className="text-[10px] font-black text-[#c8963c]">
          {t("stats_avg")} {averageRating ?? "0.0"}
        </p>
      </div>
      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="name"
              axisLine={{ stroke: "#c8963c", strokeOpacity: 0.15 }}
              tickLine={false}
              interval={0}
              tick={<RatingAxisTick />}
            />
            <Tooltip
              content={<RatingTooltip />}
              cursor={{ fill: "#c8963c", opacity: 0.1 }}
              wrapperStyle={{ zIndex: 9999 }}
            />
            <Bar
              dataKey="value"
              fill="#c8963c"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              label={<RatingValueLabel />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
