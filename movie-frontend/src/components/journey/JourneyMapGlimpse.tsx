import { useMemo } from "react";
import { LOTR_STOPS, JOURNEY_VIEWBOX } from "../../data/journeyLotr";
import { getCurrentStopIndex } from "../../utils/journey";
import { useLang } from "../../context/LanguageContext";
import lotrMapImg from "../../assets/journey/lotr-map.jpg";

interface JourneyMapGlimpseProps {
  totalCount: number;
  onExpand: () => void;
  youLabel?: string;
}
const ZOOM = 1.9;

const GOLD = "#d9ac54";

function buildRoutePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function JourneyMapGlimpse({
  totalCount,
  onExpand,
  youLabel,
}: JourneyMapGlimpseProps) {
  const { t } = useLang();
  const stops = LOTR_STOPS;
  const currentIndex = Math.max(0, getCurrentStopIndex(totalCount, stops));
  const current = stops[currentIndex];
  const fx = (current.x / JOURNEY_VIEWBOX.w) * 100;
  const fy = (current.y / JOURNEY_VIEWBOX.h) * 100;

  const routeD = useMemo(
    () => buildRoutePath(stops.map((s) => ({ x: s.x, y: s.y }))),
    [stops],
  );

  return (
    <button
      type="button"
      onClick={onExpand}
      className="group relative w-full h-[190px] rounded-xl overflow-hidden text-left border border-[rgba(217,172,84,.18)] bg-[#100d08]"
      aria-label={t("journey_expand_hint")}
    >
      <div
        className="absolute"
        style={{
          top: "50%",
          left: "50%",
          width: `${ZOOM * 100}%`,
          aspectRatio: `${JOURNEY_VIEWBOX.w} / ${JOURNEY_VIEWBOX.h}`,
          transform: `translate(-${fx}%, -${fy}%)`,
        }}
      >
        <img
          src={lotrMapImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${JOURNEY_VIEWBOX.w} ${JOURNEY_VIEWBOX.h}`}
        >
          <path
            d={routeD}
            fill="none"
            stroke={GOLD}
            strokeWidth={3}
            strokeDasharray="8 7"
            opacity={0.8}
          />
        </svg>

        {stops.map((stop, i) => {
          const isUnlocked = totalCount >= stop.threshold;
          const isCurrent = i === currentIndex;
          const showLabel = Math.abs(i - currentIndex) <= 1;
          const size = stop.isFinale ? 26 : isCurrent ? 22 : 16;
          const leftPct = (stop.x / JOURNEY_VIEWBOX.w) * 100;
          const topPct = (stop.y / JOURNEY_VIEWBOX.h) * 100;
          const name = t(stop.nameKey);
          const labelAbovePin = !isCurrent && stop.y > current.y;

          return (
            <div
              key={stop.id}
              className="absolute flex flex-col items-center"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: "translate(-50%, -50%)",
                zIndex: isCurrent ? 6 : 3,
              }}
            >
              {isCurrent && (
                <span className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(217,172,84,.55)_0%,transparent_70%)] animate-pulse-ring" />
              )}
              <span
                title={name}
                className="relative block rounded-full border-2"
                style={{
                  width: size,
                  height: size,
                  borderColor: isUnlocked ? GOLD : "rgba(217,172,84,.35)",
                  background: isUnlocked
                    ? "radial-gradient(circle at 35% 30%, #e8c377, #a87c2e)"
                    : "#1c1a14",
                  boxShadow: isUnlocked
                    ? "0 0 12px rgba(217,172,84,.45)"
                    : "none",
                }}
              />
              {isCurrent && (
                <span className="mt-1 rounded-full bg-[#d9ac54] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#14110c]">
                  {youLabel ?? t("journey_you_are_here")}
                </span>
              )}
              {!isCurrent && showLabel && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[rgba(15,13,10,.75)] px-1.5 py-0.5 text-[10px] font-medium text-[#f2ead9]"
                  style={
                    labelAbovePin
                      ? { bottom: "calc(100% + 4px)" }
                      : { top: "calc(100% + 4px)" }
                  }
                >
                  {name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(16,13,8,.85)_100%)]" />

      <div className="absolute right-3 bottom-2.5 flex items-center gap-1 rounded-full border border-[rgba(217,172,84,.3)] bg-[rgba(10,8,5,.6)] px-2.5 py-1 text-[10.5px] tracking-wide text-[#d9ac54]">
        <span aria-hidden="true">&#10530;</span> {t("journey_expand_hint")}
      </div>
    </button>
  );
}
