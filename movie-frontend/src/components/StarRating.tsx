import { useState, type MouseEvent } from "react";

export const RATING_STAR_COUNT = 10;

interface StarRatingProps {
  value: number;
  onRate: (rating: number) => void;
  size?: "sm" | "lg";
  disabled?: boolean;
}

const SIZE_STYLE: Record<"sm" | "lg", string> = {
  sm: "clamp(0.65rem, 7.5cqw, 1.125rem)",
  lg: "clamp(0.85rem, 8.5cqw, 1.875rem)",
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
  const fontSize = SIZE_STYLE[size];

  return (
    <div
      className="flex w-full items-center"
      style={{ containerType: "inline-size" }}
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
              style={{ fontSize }}
              className="relative flex-1 min-w-0 flex items-center justify-center leading-none transition-all active:scale-125 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="text-[#3d372c]">★</span>
              <span
                className="absolute inset-0 flex items-center justify-center text-[#d9ac54]"
                style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}
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
