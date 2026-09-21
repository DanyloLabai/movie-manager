import { useState } from "react";
import { useLang } from "../../context/LanguageContext";
import { LOTR_STOPS } from "../../data/journeyLotr";
import { getCurrentStopIndex } from "../../utils/journey";
import JourneyMapGlimpse from "./JourneyMapGlimpse";
import JourneyMapModal from "./JourneyMapModal";

interface JourneyPathProps {
  totalCount: number;
  ownerName?: string;
}

export default function JourneyPath({
  totalCount,
  ownerName,
}: JourneyPathProps) {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);

  const currentIndex = getCurrentStopIndex(totalCount, LOTR_STOPS);
  const revealed = Math.max(0, currentIndex + 1);
  const title = ownerName
    ? t("journey_someone_title").replace("{name}", ownerName)
    : t("journey_section_title");

  return (
    <div className="rounded-2xl border border-[rgba(217,172,84,.18)] bg-[linear-gradient(180deg,#141210_0%,#100e0b_100%)] p-5 shadow-[0_8px_24px_rgba(0,0,0,.35)] font-ui">
      <div className="mb-3.5">
        <span className="font-mono-ui text-[11px] font-bold tracking-[2.5px] text-[#d9ac54] uppercase">
          {title}
        </span>
        <div className="text-[12px] text-[#8f8574] mt-0.5">
          {t("journey_realm_lotr")} &middot; {revealed} / {LOTR_STOPS.length}
        </div>
      </div>

      <p className="text-[11px] text-[#6b6459] mb-2.5">
        {t("journey_how_it_works")}
      </p>

      <JourneyMapGlimpse
        totalCount={totalCount}
        onExpand={() => setIsOpen(true)}
        youLabel={ownerName}
      />

      <p className="mt-2.5 text-[11px] text-[#6b6459]">
        {t("journey_zoom_hint")}
      </p>

      {isOpen && (
        <JourneyMapModal
          totalCount={totalCount}
          onClose={() => setIsOpen(false)}
          youLabel={ownerName}
        />
      )}
    </div>
  );
}
