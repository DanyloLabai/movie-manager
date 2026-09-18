import type { TranslationKey } from "../../context/LanguageContext";
import { useLang } from "../../context/LanguageContext";
import { LOTR_STOPS, JOURNEY_VIEWBOX } from "../../data/journeyLotr";
import { getCurrentStopIndex, isStopRevealed } from "../../utils/journey";
import lotrMapImg from "../../assets/journey/lotr-map.jpg";

const WAYPOINT_D =
  "M11.48 3.5a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0l-4.725 2.885a.562.562 0 01-.84-.61l1.285-5.385a.563.563 0 00-.182-.557L2.043 10.386a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z";
const LANDMARK_D =
  "M4 21h16M5 21V9l3-3 3 3v12M13 21V6l3-3 3 3v3M8 12h.01M8 16h.01M16 10h.01M16 14h.01";
const LOCK_D =
  "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z";

function smoothPath(points: { x: number; y: number }[]): string {
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

function leftPct(x: number) {
  return `${(x / JOURNEY_VIEWBOX.w) * 100}%`;
}
function topPct(y: number) {
  return `${(y / JOURNEY_VIEWBOX.h) * 100}%`;
}

interface JourneyMapProps {
  totalCount: number;
  variant: "compact" | "expanded";
  openStopId?: string | null;
  onStopClick?: (id: string) => void;
  zoomedIn?: boolean;
  youLabel?: string;
}

export default function JourneyMap({
  totalCount,
  variant,
  openStopId = null,
  onStopClick,
  zoomedIn = true,
  youLabel,
}: JourneyMapProps) {
  const { t } = useLang();
  const isExpanded = variant === "expanded";

  const currentIndex = getCurrentStopIndex(totalCount, LOTR_STOPS);
  const routeD = smoothPath(LOTR_STOPS.map((s) => ({ x: s.x, y: s.y })));

  return (
    <div
      className="relative w-full h-full"
      style={
        isExpanded
          ? undefined
          : { aspectRatio: `${JOURNEY_VIEWBOX.w} / ${JOURNEY_VIEWBOX.h}` }
      }
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${lotrMapImg})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${JOURNEY_VIEWBOX.w} ${JOURNEY_VIEWBOX.h}`}
        preserveAspectRatio="none"
      >
        <path
          d={routeD}
          fill="none"
          stroke="#d9ac54"
          strokeWidth={isExpanded ? 3 : 2.5}
          strokeDasharray="7 6"
          opacity={0.8}
        />
      </svg>

      {LOTR_STOPS.map((stop, i) => {
        const isUnlocked = totalCount >= stop.threshold;
        const revealed = isStopRevealed(i, currentIndex);
        const isCurrent = i === currentIndex;
        const remaining = Math.max(0, stop.threshold - totalCount);
        const size = isExpanded
          ? stop.isFinale
            ? 40
            : 26
          : stop.isFinale
            ? 30
            : 18;
        const iconSize = isExpanded
          ? stop.isFinale
            ? 19
            : 13
          : stop.isFinale
            ? 14
            : 9;
        const isWaypointIcon = revealed && isUnlocked && !stop.isFinale;
        const iconD = !revealed || !isUnlocked
          ? LOCK_D
          : stop.isFinale
            ? LANDMARK_D
            : WAYPOINT_D;
        const isOpen = isExpanded && openStopId === stop.id;
        const iconColor = isUnlocked ? "#14110c" : "rgba(242,234,217,.4)";
        const nameOrHidden: TranslationKey = revealed
          ? stop.nameKey
          : "journey_locked_name";
        const progressText = isUnlocked
          ? stop.threshold === 1
            ? t("journey_unlocked_at_one")
            : t("journey_unlocked_at").replace(
                "{count}",
                String(stop.threshold),
              )
          : `${remaining} ${
              remaining === 1
                ? t("journey_one_movie_to_go")
                : t("journey_movies_to_go")
            }`;
        const hoverTitle = `${t(nameOrHidden)} — ${progressText}`;

        const pin = (
          <div
            className={`relative flex items-center justify-center rounded-full border-2 ${
              isExpanded ? "transition-transform duration-200" : ""
            } ${
              isExpanded
                ? "cursor-pointer hover:scale-[1.4] hover:shadow-[0_0_18px_rgba(217,172,84,.6)]"
                : ""
            }`}
            style={{
              width: size,
              height: size,
              borderColor: isUnlocked ? "#d9ac54" : "rgba(217,172,84,.3)",
              background: isUnlocked
                ? "radial-gradient(circle at 35% 30%, #e8c377, #a87c2e)"
                : "#1c1a14",
              boxShadow: isUnlocked
                ? "0 0 14px rgba(217,172,84,.45), 0 2px 6px rgba(0,0,0,.5)"
                : "0 2px 6px rgba(0,0,0,.5)",
            }}
          >
            {isCurrent && (
              <span className="absolute inset-[-6px] rounded-full border-2 border-[#d9ac54]/70 animate-pulse-ring pointer-events-none" />
            )}
            <svg
              width={iconSize}
              height={iconSize}
              viewBox="0 0 24 24"
              fill={isWaypointIcon ? iconColor : "none"}
              stroke={iconColor}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={iconD} />
            </svg>
            {isCurrent && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[7.5px] font-bold tracking-[.4px] uppercase px-[5px] py-[2px] rounded-full bg-[#d9ac54] text-[#14110c]">
                {youLabel ?? t("journey_you_are_here")}
              </span>
            )}
          </div>
        );

        return (
          <div
            key={stop.id}
            className="absolute flex flex-col items-center"
            style={{
              left: leftPct(stop.x),
              top: topPct(stop.y),
              transform: "translate(-50%, -50%)",
              zIndex: isOpen ? 50 : isCurrent ? 6 : 3,
            }}
          >
            {isExpanded ? (
              <button
                type="button"
                onClick={() => onStopClick?.(stop.id)}
                aria-label={t(nameOrHidden)}
                title={hoverTitle}
              >
                {pin}
              </button>
            ) : (
              pin
            )}

            {isExpanded && (zoomedIn || isCurrent) && (
              <span
                className="mt-1.5 text-[10.5px] max-w-[86px] text-center leading-[1.15] rounded px-[5px] py-[1px] whitespace-nowrap overflow-hidden text-ellipsis"
                style={{
                  color: isUnlocked ? "#f2ead9" : "#8f8574",
                  background: "rgba(15,13,10,.7)",
                }}
              >
                {t(nameOrHidden)}
              </span>
            )}

            {isOpen && (
              <div
                className={`absolute z-10 w-max max-w-[170px] left-1/2 -translate-x-1/2 ${
                  stop.y < 200 ? "top-full mt-2.5" : "bottom-full mb-2.5"
                }`}
              >
                <div className="rounded-[10px] border border-[rgba(217,172,84,.35)] bg-[#1c1712] px-3 py-2 text-center">
                  <div className="text-[13px] font-semibold text-[#f2ead9]">
                    {t(nameOrHidden)}
                  </div>
                  <div className="text-[11px] text-[#8f8574] mt-0.5">
                    {progressText}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
