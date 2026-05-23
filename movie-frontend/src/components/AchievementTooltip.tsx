import { useState, useRef, useEffect } from "react";
import { useLang } from "../context/LanguageContext";

interface Achievement {
  id: string;
  text: string;
  isUnlocked: boolean;
  requirement: string;
  current: number;
  needed: number;
}

interface AchievementTooltipProps {
  achievement: Achievement;
}

export default function AchievementTooltip({
  achievement,
}: AchievementTooltipProps) {
  const { t } = useLang();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Tooltip position state (fixed px values)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowLeft, setArrowLeft] = useState<string>("50%");
  const [showAbove, setShowAbove] = useState(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsTooltipVisible(false);
      }
    };
    if (isTooltipVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTooltipVisible]);

  useEffect(() => {
    if (!isTooltipVisible || !containerRef.current) return;

    requestAnimationFrame(() => {
      if (!containerRef.current || !tooltipRef.current) return;

      const PADDING = 8;
      const TOOLTIP_WIDTH = 220;
      const TOOLTIP_HEIGHT = tooltipRef.current.offsetHeight || 160;

      const anchor = containerRef.current.getBoundingClientRect();
      const anchorCenterX = anchor.left + anchor.width / 2;
      const anchorCenterY = anchor.top + anchor.height / 2;

      const spaceAbove = anchor.top;
      const above = spaceAbove >= TOOLTIP_HEIGHT + 8;
      setShowAbove(above);

      let left = anchorCenterX - TOOLTIP_WIDTH / 2;
      left = Math.max(
        PADDING,
        Math.min(left, window.innerWidth - TOOLTIP_WIDTH - PADDING),
      );

      // Arrow offset relative to tooltip box
      const arrowAbsolute = anchorCenterX - left;
      const arrowClamped = Math.max(
        12,
        Math.min(arrowAbsolute, TOOLTIP_WIDTH - 12),
      );
      setArrowLeft(`${arrowClamped}px`);

      setTooltipStyle({
        position: "fixed",
        left,
        width: TOOLTIP_WIDTH,
        ...(above
          ? { top: anchor.top - TOOLTIP_HEIGHT - 8 }
          : { top: anchor.bottom + 8 }),
        zIndex: 9999,
      });
    });
  }, [isTooltipVisible]);

  const progressPercentage =
    achievement.needed > 0
      ? Math.min((achievement.current / achievement.needed) * 100, 100)
      : 100;

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
      onClick={() => setIsTooltipVisible((v) => !v)}
    >
      {/* Badge */}
      <div
        className={`px-2 py-1 rounded-md text-[8px] sm:text-[9px] font-bold border uppercase tracking-wider cursor-pointer transition-all ${
          achievement.isUnlocked
            ? "bg-[#c8963c]/10 border-[#c8963c]/40 text-[#c8963c] hover:bg-[#c8963c]/20"
            : "bg-[#12100e]/50 border-[#c8963c]/5 text-[#f0e6cc]/15 grayscale hover:bg-[#12100e]/70"
        }`}
      >
        {achievement.text}
      </div>

      {/* Tooltip — rendered in place but positioned with fixed coords */}
      {isTooltipVisible && (
        <div ref={tooltipRef} style={tooltipStyle}>
          <div className="bg-[#1a1714] border border-[#c8963c]/30 rounded-xl shadow-2xl p-3 relative">
            {/* Arrow above tooltip (pointing down toward anchor) */}
            {showAbove && (
              <div
                className="absolute bottom-[-6px] w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#c8963c]/30"
                style={{ left: arrowLeft, transform: "translateX(-50%)" }}
              />
            )}
            {/* Arrow below tooltip (pointing up toward anchor) */}
            {!showAbove && (
              <div
                className="absolute top-[-6px] w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-[#c8963c]/30"
                style={{ left: arrowLeft, transform: "translateX(-50%)" }}
              />
            )}

            <div className="text-[10px] font-bold text-[#c8963c] mb-1.5 flex items-center gap-1">
              {achievement.text}
              {achievement.isUnlocked && <span className="text-xs">✓</span>}
            </div>

            <div className="text-[9px] text-[#f0e6cc]/70 mb-2 leading-snug">
              {achievement.requirement}
            </div>

            {!achievement.isUnlocked && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] text-[#f0e6cc]/50">
                    {t("watchlist_progress") || "Progress"}
                  </span>
                  <span className="text-[9px] font-bold text-[#c8963c]">
                    {achievement.current}/{achievement.needed}
                  </span>
                </div>
                <div className="w-full bg-[#12100e] rounded-full h-1.5 overflow-hidden border border-[#c8963c]/20">
                  <div
                    className="h-full bg-gradient-to-r from-[#c8963c] to-[#9a732a] rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
