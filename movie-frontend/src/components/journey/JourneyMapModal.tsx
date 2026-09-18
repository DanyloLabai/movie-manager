import { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useLang } from "../../context/LanguageContext";
import JourneyMap from "./JourneyMap";
const MAP_W = 1400;
const MAP_H = Math.round((MAP_W * 740) / 960);

interface JourneyMapModalProps {
  totalCount: number;
  onClose: () => void;
  youLabel?: string;
}

export default function JourneyMapModal({
  totalCount,
  onClose,
  youLabel,
}: JourneyMapModalProps) {
  const { t } = useLang();
  const [openStopId, setOpenStopId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState<number | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [prevFitScale, setPrevFitScale] = useState<number | null>(null);
  if (fitScale !== prevFitScale) {
    setPrevFitScale(fitScale);
    setScale(fitScale);
  }
  const zoomedIn =
    fitScale !== null && scale !== null && scale > fitScale * 1.35;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const fit = Math.min(width / MAP_W, height / MAP_H) * 0.92;
      const clamped = Math.min(Math.max(fit, 0.15), 1);
      setFitScale(Math.round(clamped * 1000) / 1000);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        className="relative w-full max-w-[1400px] max-h-full sm:max-h-[90vh] bg-[#0f0d0a] border border-[#d9ac54]/30 rounded-2xl shadow-2xl overflow-hidden animate-modal-in"
        style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 p-2 rounded-full bg-[#14110c]/80 border border-[#d9ac54]/30 text-[#8f8574] hover:text-[#d9ac54] transition"
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

        {fitScale !== null && (
          <TransformWrapper
            key={fitScale}
            initialScale={fitScale}
            minScale={Math.min(fitScale, 0.4)}
            maxScale={Math.max(3.5, fitScale * 6)}
            centerOnInit
            wheel={{ step: 0.15 }}
            doubleClick={{ step: 0.7 }}
            onTransform={(_ref, state) => setScale(state.scale)}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-1.5">
                  <button
                    onClick={() => zoomIn()}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-[#14110c]/80 border border-[#d9ac54]/30 text-[#d9ac54] hover:bg-[#1c1712] transition text-lg font-bold"
                  >
                    +
                  </button>
                  <button
                    onClick={() => zoomOut()}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-[#14110c]/80 border border-[#d9ac54]/30 text-[#d9ac54] hover:bg-[#1c1712] transition text-lg font-bold"
                  >
                    −
                  </button>
                  <button
                    onClick={() => resetTransform()}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-[#14110c]/80 border border-[#d9ac54]/30 text-[#d9ac54] hover:bg-[#1c1712] transition text-[8.5px] font-bold uppercase"
                  >
                    {t("journey_zoom_reset")}
                  </button>
                </div>

                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{ width: MAP_W, height: MAP_H }}
                >
                  <div style={{ width: MAP_W, height: MAP_H }}>
                    <JourneyMap
                      totalCount={totalCount}
                      variant="expanded"
                      openStopId={openStopId}
                      zoomedIn={zoomedIn}
                      youLabel={youLabel}
                      onStopClick={(id) =>
                        setOpenStopId((prev) => (prev === id ? null : id))
                      }
                    />
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        )}
      </div>
    </div>
  );
}
