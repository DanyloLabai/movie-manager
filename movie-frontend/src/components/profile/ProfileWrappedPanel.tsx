import { useLang } from "../../context/LanguageContext";

interface WrappedStats {
  totalMinutes?: number;
  topGenre?: string;
  favoriteDecade?: string;
  moviesCount?: number;
  tvCount?: number;
}

interface ProfileWrappedPanelProps {
  username: string;
  stats: WrappedStats;
}

const Divider = () => (
  <div className="hidden md:block w-px bg-[rgba(217,172,84,.16)] mx-7 shrink-0" />
);

export default function ProfileWrappedPanel({
  username,
  stats,
}: ProfileWrappedPanelProps) {
  const { t } = useLang();
  const hours = Math.floor((stats.totalMinutes || 0) / 60);
  const minutes = (stats.totalMinutes || 0) % 60;

  return (
    <div className="font-ui flex flex-col gap-4 md:gap-[22px]">
      <span className="font-mono-ui text-[11px] md:text-[12px] font-semibold tracking-[2.5px] md:tracking-[3px] text-[#d9ac54] uppercase">
        {t("stats_wrapped").replace("[username]", username)}
      </span>

      <div className="grid grid-cols-2 gap-4 md:flex md:gap-0">
        <div className="flex-1 flex flex-col gap-1 md:gap-1">
          <span className="text-[22px] md:text-[30px] leading-none font-bold text-[#f2ead9]">
            {hours}h {minutes}m
          </span>
          <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
            {t("stats_time_spent")}
          </span>
        </div>
        <Divider />
        <div className="flex-1 flex flex-col gap-1">
          <span
            className="text-[22px] md:text-[30px] leading-none font-bold text-[#f2ead9] truncate"
            title={stats.topGenre || t("common_na")}
          >
            {stats.topGenre || t("common_na")}
          </span>
          <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
            {t("stats_top_genre")}
          </span>
        </div>
        <Divider />
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[22px] md:text-[30px] leading-none font-bold text-[#f2ead9]">
            {stats.favoriteDecade || t("common_na")}
          </span>
          <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
            {t("stats_fav_decade")}
          </span>
        </div>
        <Divider />
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[22px] md:text-[30px] leading-none font-bold text-[#f2ead9]">
            {stats.moviesCount || 0}{" "}
            <span className="text-[13px] md:text-[18px] font-normal text-[#8f8574]">
              / {stats.tvCount || 0}
            </span>
          </span>
          <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
            {t("stats_movies")} / {t("stats_tv")}
          </span>
        </div>
      </div>
    </div>
  );
}
