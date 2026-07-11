import { useState, type MouseEvent } from "react";

export const RATING_STAR_COUNT = 10;

interface StarRatingProps {
  value: number;
  onRate: (rating: number) => void;
  size?: "sm" | "lg";
  disabled?: boolean;
}

const SIZE_CLASSES: Record<"sm" | "lg", string> = {
  sm: "text-lg p-0.5",
  lg: "text-2xl sm:text-3xl p-0.5",
};

function resolveValueFromPointer(
  e: MouseEvent<HTMLButtonElement>,
  star: number,
): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const isLeftHalf = e.clientX - rect.left < rect.width / 2;
  return isLeftHalf ? star - 0.5 : star;
}

export default function StarRating({
  value,
  onRate,
  size = "lg",
  disabled = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue ?? value;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      className="flex justify-center items-center gap-0"
      onMouseLeave={() => setHoverValue(null)}
    >
      {Array.from({ length: RATING_STAR_COUNT }, (_, i) => i + 1).map(
        (star) => {
          const fillRatio = Math.min(1, Math.max(0, displayValue - (star - 1)));
          const fillPercent =
            fillRatio >= 1 ? 100 : fillRatio >= 0.5 ? 50 : 0;

          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onMouseMove={(e) => setHoverValue(resolveValueFromPointer(e, star))}
              onClick={(e) => onRate(resolveValueFromPointer(e, star))}
              className={`relative transition-all active:scale-125 disabled:opacity-50 disabled:pointer-events-none ${sizeClass}`}
            >
              <span className="text-[#f0e6cc]/20">★</span>
              <span
                className="absolute inset-0 overflow-hidden text-[#c8963c] whitespace-nowrap"
                style={{ width: `${fillPercent}%` }}
              >
                ★
              </span>
            </button>
          );
        },
      )}
    </div>
  );
}
