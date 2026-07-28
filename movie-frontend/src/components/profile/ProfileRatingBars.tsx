interface RatingBucket {
  name: string;
  value: number;
}

interface ProfileRatingBarsProps {
  data: RatingBucket[];
  maxHeightPx: number;
}

export default function ProfileRatingBars({
  data,
  maxHeightPx,
}: ProfileRatingBarsProps) {
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <div
      className="flex items-end gap-1.5 md:gap-2.5"
      style={{ height: maxHeightPx }}
    >
      {data.map((bucket) => {
        const heightPx = bucket.value
          ? Math.max(2, (bucket.value / maxValue) * maxHeightPx)
          : 0;
        return (
          <div
            key={bucket.name}
            className="flex-1 flex flex-col items-center justify-end gap-1 md:gap-1.5"
            style={{ height: maxHeightPx }}
          >
            {bucket.value > 0 && (
              <span className="font-mono-ui text-[10px] text-[#8f8574]">
                {bucket.value}
              </span>
            )}
            <div
              className="w-full rounded-t-[3px] md:rounded-t-[3px] rounded-b-none"
              style={{
                height: heightPx,
                minHeight: bucket.value > 0 ? 2 : 0,
                background: "linear-gradient(180deg, #d9ac54, #a87c2e)",
              }}
            />
            <span className="font-mono-ui text-[8.5px] md:text-[10px] text-[#645c4d]">
              {bucket.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
