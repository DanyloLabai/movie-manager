import { useLang } from "../../context/LanguageContext";

interface WrappedStats {
  totalMinutes?: number;
  topGenre?: string;
  favoriteDecade?: string;
  moviesCount?: number;
  tvCount?: number;
  longestMovie?: { title: string; runtime?: number };
  topActor?: { name: string; count: number; profileUrl: string | null } | null;
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
  const hasMarathon = (stats.longestMovie?.runtime ?? 0) > 0;

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

      {(hasMarathon || stats.topActor) && (
        <div className="flex flex-col gap-3 md:flex-row md:gap-[60px] md:pt-1.5">
          {hasMarathon && (
            <div className="flex flex-col gap-0.5 md:flex-row md:items-center md:gap-3">
              <span className="hidden md:inline text-[#d9ac54] text-base">
                ◷
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
                  {t("stats_marathon")}
                </span>
                <span className="text-[13px] md:text-[13.5px] font-semibold text-[#f2ead9]">
                  {stats.longestMovie?.title} ·{" "}
                  <span className="text-[#d9ac54]">
                    {stats.longestMovie?.runtime} {t("stats_min")}
                  </span>
                </span>
              </div>
            </div>
          )}
          {stats.topActor && (
            <div className="flex flex-col gap-0.5 md:flex-row md:items-center md:gap-3">
              <div className="hidden md:block w-8 h-8 rounded-full overflow-hidden shrink-0 border border-[#d9ac54]/30">
                {stats.topActor.profileUrl ? (
                  <img
                    src={stats.topActor.profileUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#1c1a14]" />
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono-ui text-[9px] md:text-[10px] font-medium tracking-[1.5px] md:tracking-[2px] text-[#8f8574] uppercase">
                  {t("stats_actor")}
                </span>
                <span className="text-[13px] md:text-[13.5px] font-semibold text-[#f2ead9]">
                  {stats.topActor.name}{" "}
                  <span className="text-[#8f8574] font-normal">
                    ·{" "}
                    {t("stats_actor_count").replace(
                      "[X]",
                      String(stats.topActor.count),
                    )}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
