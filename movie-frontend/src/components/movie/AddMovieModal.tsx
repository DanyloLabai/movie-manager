import { useState } from "react";
import { useLang } from "../../context/LanguageContext";
import StarRating from "../StarRating";

interface AddMovieModalProps {
  title: string;
  onClose: () => void;
  onAddToWatchlist: () => void;
  onMarkWatched: (rating: number | null) => void;
  initialStep?: "choose" | "rating";
}

export default function AddMovieModal({
  title,
  onClose,
  onAddToWatchlist,
  onMarkWatched,
  initialStep = "choose",
}: AddMovieModalProps) {
  const { t } = useLang();
  const [step, setStep] = useState<"choose" | "rating">(initialStep);
  const [rating, setRating] = useState(0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#14110d] border border-[#d9ac54]/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-modal-in font-ui"
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

        {step === "choose" ? (
          <div className="text-center">
            <h3 className="text-lg font-bold text-[#f2ead9] mb-1 truncate">
              {title}
            </h3>
            <p className="text-sm text-[#8f8574] mb-6">
              {t("search_add_choice_desc")}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onAddToWatchlist}
                className="py-3 font-bold text-[#14110c] uppercase tracking-widest transition bg-[#d9ac54] hover:bg-[#e8c377] rounded-full active:scale-[0.98] text-xs"
              >
                + {t("search_add_menu_watchlist")}
              </button>
              <button
                onClick={() => setStep("rating")}
                className="py-3 font-bold text-[#f2ead9] uppercase tracking-widest transition border border-white/[.15] hover:border-[#d9ac54]/45 rounded-full active:scale-[0.98] text-xs"
              >
                ✓ {t("watchlist_watched")}
              </button>
            </div>
            <button
              onClick={onClose}
              className="mt-4 font-semibold text-[10.5px] tracking-[1.5px] text-[#8f8574] hover:text-[#d9ac54] transition uppercase"
            >
              {t("movie_rating_cancel")}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <h3 className="text-lg font-bold text-[#f2ead9] mb-1">
              {t("movie_how_was_it")}
            </h3>
            <p className="text-sm text-[#8f8574] mb-6">
              {t("movie_rate_desc")} "{title}"
            </p>
            <div className="mb-6">
              <StarRating size="lg" value={rating} onRate={setRating} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 font-bold text-[#f2ead9] uppercase tracking-widest transition border border-white/[.15] hover:border-[#d9ac54]/45 rounded-full active:scale-[0.98] text-xs"
              >
                {t("movie_rating_cancel")}
              </button>
              <button
                onClick={() => onMarkWatched(rating > 0 ? rating : null)}
                className="flex-1 py-3 font-bold text-[#14110c] uppercase tracking-widest transition bg-[#d9ac54] hover:bg-[#e8c377] rounded-full active:scale-[0.98] text-xs"
              >
                {t("movie_rating_ok")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
