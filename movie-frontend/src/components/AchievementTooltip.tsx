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
  const [tooltipPosition, setTooltipPosition] = useState<"top" | "bottom">(
    "top",
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTooltipVisible]);

  useEffect(() => {
    if (isTooltipVisible && tooltipRef.current && containerRef.current) {
      const container = containerRef.current.getBoundingClientRect();
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        setTooltipPosition("bottom");
      } else {
        const spaceAbove = container.top;
        const spaceBelow = window.innerHeight - container.bottom;
        const tooltipHeight = tooltip.height || 150;

        setTooltipPosition(spaceAbove > tooltipHeight + 20 ? "top" : "bottom");
      }
    }
  }, [isTooltipVisible]);

  const progressPercentage =
    achievement.needed > 0
      ? Math.min((achievement.current / achievement.needed) * 100, 100)
      : 100;

  return (
    <div
      ref={containerRef}
      className="relative inline-block group"
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
      onClick={() => setIsTooltipVisible(!isTooltipVisible)}
    >
      <div
        className={`px-2 py-1 rounded-md text-[8px] sm:text-[9px] font-bold border uppercase tracking-wider cursor-pointer transition-all ${
          achievement.isUnlocked
            ? "bg-[#c8963c]/10 border-[#c8963c]/40 text-[#c8963c] hover:bg-[#c8963c]/20"
            : "bg-[#12100e]/50 border-[#c8963c]/5 text-[#f0e6cc]/15 grayscale hover:bg-[#12100e]/70"
        }`}
      >
        {achievement.text}
      </div>

      {isTooltipVisible && (
        <div
          ref={tooltipRef}
          className={`absolute left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto ${
            tooltipPosition === "top"
              ? "bottom-full mb-1 sm:mb-2"
              : "top-full mt-1 sm:mt-2"
          }`}
        >
          <div className="bg-[#1a1714] border border-[#c8963c]/30 rounded-lg shadow-2xl p-2 sm:p-3 mx-2 w-auto max-w-[calc(100vw-1rem)] sm:max-w-none sm:w-max">
            {/* Arrow - Top */}
            {tooltipPosition === "top" && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#c8963c]/30" />
            )}

            {/* Arrow - Bottom */}
            {tooltipPosition === "bottom" && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-[#c8963c]/30" />
            )}

            <div className="text-[9px] sm:text-xs font-bold text-[#c8963c] mb-2 flex items-center gap-1">
              <span className="break-words flex-shrink-0">
                {achievement.text.split(" ")[0]}
              </span>
              {achievement.isUnlocked && (
                <span className="text-[#c8963c] text-xs flex-shrink-0">✓</span>
              )}
            </div>

            <div className="text-[7px] sm:text-[9px] text-[#f0e6cc]/70 mb-2 leading-snug max-w-xs">
              {achievement.requirement}
            </div>

            {!achievement.isUnlocked && (
              <div className="w-full min-w-[8rem]">
                <div className="flex justify-between items-center mb-1.5 gap-1">
                  <span className="text-[7px] sm:text-[9px] text-[#f0e6cc]/50 flex-shrink-0">
                    {t("watchlist_progress") || "Прогрес"}
                  </span>
                  <span className="text-[7px] sm:text-[9px] font-bold text-[#c8963c] flex-shrink-0">
                    {achievement.current}/{achievement.needed}
                  </span>
                </div>

                <div className="w-full bg-[#12100e] rounded-full h-1.5 overflow-hidden border border-[#c8963c]/20">
                  <div
                    className="h-full bg-gradient-to-r from-[#c8963c] to-[#9a732a] transition-all duration-300 rounded-full"
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
