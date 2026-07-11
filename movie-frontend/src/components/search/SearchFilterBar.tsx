import { TMDB_GENRES } from "../../constants/genres";
import { useLang } from "../../context/LanguageContext";
import type { SmartSearchFilters } from "../../api/movies.api";

interface SearchFilterBarProps {
  filters: SmartSearchFilters;
  onChange: (filters: SmartSearchFilters) => void;
}

const RATING_TIERS = [6, 7, 8];

export function SearchFilterBar({ filters, onChange }: SearchFilterBarProps) {
  const { t } = useLang();

  const setFilter = <K extends keyof SmartSearchFilters>(
    key: K,
    value: SmartSearchFilters[K],
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const numberInputClass =
    "w-20 px-3 py-2 bg-[#1a1714] border border-[#c8963c]/30 rounded-lg text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] text-sm";

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-6 p-4 bg-[#1a1714]/60 border border-[#c8963c]/20 rounded-2xl">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-[#f0e6cc]/50 uppercase tracking-widest">
          {t("filter_genre")}
        </span>
        <select
          value={filters.genreId ?? ""}
          onChange={(e) =>
            setFilter(
              "genreId",
              e.target.value ? Number(e.target.value) : undefined,
            )
          }
          className="px-3 py-2 bg-[#1a1714] border border-[#c8963c]/30 rounded-lg text-[#f0e6cc] focus:outline-none focus:border-[#c8963c] text-sm"
        >
          <option value="">{t("filter_any_genre")}</option>
          {TMDB_GENRES.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-[#f0e6cc]/50 uppercase tracking-widest">
          {t("filter_year")}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder={t("filter_from")}
            value={filters.yearFrom ?? ""}
            onChange={(e) =>
              setFilter(
                "yearFrom",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className={numberInputClass}
          />
          <span className="text-[#f0e6cc]/30">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder={t("filter_to")}
            value={filters.yearTo ?? ""}
            onChange={(e) =>
              setFilter(
                "yearTo",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className={numberInputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-[#f0e6cc]/50 uppercase tracking-widest">
          {t("filter_min_rating")}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("minRating", undefined)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition border ${
              filters.minRating === undefined
                ? "bg-[#c8963c] text-[#12100e] border-[#c8963c]"
                : "bg-transparent text-[#f0e6cc]/60 border-[#c8963c]/30 hover:border-[#c8963c]"
            }`}
          >
            {t("filter_any_rating")}
          </button>
          {RATING_TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setFilter("minRating", tier)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition border ${
                filters.minRating === tier
                  ? "bg-[#c8963c] text-[#12100e] border-[#c8963c]"
                  : "bg-transparent text-[#f0e6cc]/60 border-[#c8963c]/30 hover:border-[#c8963c]"
              }`}
            >
              {tier}+
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold text-[#f0e6cc]/50 uppercase tracking-widest">
          {t("filter_runtime")}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder={t("filter_from")}
            value={filters.runtimeFrom ?? ""}
            onChange={(e) =>
              setFilter(
                "runtimeFrom",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className={numberInputClass}
          />
          <span className="text-[#f0e6cc]/30">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder={t("filter_to")}
            value={filters.runtimeTo ?? ""}
            onChange={(e) =>
              setFilter(
                "runtimeTo",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className={numberInputClass}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.excludeWatched ?? false}
          onChange={(e) => setFilter("excludeWatched", e.target.checked)}
          className="w-4 h-4 rounded accent-[#c8963c] cursor-pointer"
        />
        <span className="text-xs font-bold text-[#f0e6cc]/70 uppercase tracking-wider">
          {t("filter_hide_watched")}
        </span>
      </label>
    </div>
  );
}
