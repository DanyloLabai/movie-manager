import { Fragment } from "react";
import { useLang } from "../../context/LanguageContext";

export interface ProfileStatTile {
  value: string | number;
  label: string;
}

interface ProfileStatsStripProps {
  stats: ProfileStatTile[];
  watchedCount: number;
  completionRate: number;
  totalCount: number;
}

const Divider = () => (
  <div className="w-px bg-[rgba(217,172,84,.16)] mx-8 shrink-0" />
);

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
      <span className="text-[34px] leading-none font-bold text-[#f2ead9] truncate">
        {value}
      </span>
      <span className="font-mono-ui text-[10px] font-medium tracking-[2px] text-[#8f8574] uppercase truncate">
        {label}
      </span>
    </div>
  );
}

function CompletionBar({
  completionLabel,
  completionRate,
  watchedCount,
  totalCount,
}: {
  completionLabel: string;
  completionRate: number;
  watchedCount: number;
  totalCount: number;
}) {
  return (
    <>
      <div className="flex justify-between items-baseline">
        <span className="font-mono-ui text-[10px] font-medium tracking-[2px] text-[#8f8574] uppercase">
          {completionLabel}
        </span>
        <span className="font-bold text-[15px] text-[#d9ac54]">
          {completionRate}% · {watchedCount}/{totalCount}
        </span>
      </div>
      <div className="h-[3px] bg-white/[.08] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, completionRate))}%`,
            background: "linear-gradient(90deg, #a87c2e, #d9ac54)",
          }}
        />
      </div>
    </>
  );
}

export default function ProfileStatsStrip({
  stats,
  watchedCount,
  completionRate,
  totalCount,
}: ProfileStatsStripProps) {
  const { t } = useLang();
  const mobileStats = stats.slice(0, 3);

  return (
    <div className="font-ui">
      <div className="hidden md:flex items-stretch">
        {stats.map((s, i) => (
          <Fragment key={s.label}>
            <Stat value={s.value} label={s.label} />
            {i < stats.length - 1 && <Divider />}
          </Fragment>
        ))}
        <Divider />
        <div className="flex-[2] flex flex-col gap-2 justify-center min-w-0">
          <CompletionBar
            completionLabel={t("profile_completion")}
            completionRate={completionRate}
            watchedCount={watchedCount}
            totalCount={totalCount}
          />
        </div>
      </div>

      <div className="md:hidden">
        <div className="grid grid-cols-3">
          {mobileStats.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col gap-0.5 items-center ${
                i > 0 && i < mobileStats.length - 1
                  ? "border-l border-r border-[rgba(217,172,84,.16)]"
                  : ""
              }`}
            >
              <span className="text-[26px] leading-none font-bold text-[#f2ead9]">
                {s.value}
              </span>
              <span className="font-mono-ui text-[9px] font-medium tracking-[1.5px] text-[#8f8574] uppercase">
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <CompletionBar
            completionLabel={t("profile_completion")}
            completionRate={completionRate}
            watchedCount={watchedCount}
            totalCount={totalCount}
          />
        </div>
      </div>
    </div>
  );
}
