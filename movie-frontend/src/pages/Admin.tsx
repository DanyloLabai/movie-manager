import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as adminApi from "../api/admin.api";
import type { AiUsageStats, AiUsageWindowStats } from "../api/admin.api";

const WINDOWS: Array<{ key: keyof AiUsageStats; label: string }> = [
  { key: "last24h", label: "Last 24h" },
  { key: "last7d", label: "Last 7 days" },
  { key: "last30d", label: "Last 30 days" },
];

function WindowCard({
  label,
  stats,
}: {
  label: string;
  stats: AiUsageWindowStats;
}) {
  return (
    <div className="bg-[#1a1714] border border-[#c8963c]/20 rounded-2xl p-4 shadow-xl">
      <h3 className="text-xs font-black text-[#c8963c] uppercase tracking-widest mb-4">
        {label}
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-[#f0e6cc]">
            {stats.totalRequests}
          </div>
          <div className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mt-0.5">
            Total requests
          </div>
        </div>
        <div className="bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-[#c8963c]">
            {(stats.failoverRate * 100).toFixed(1)}%
          </div>
          <div className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mt-0.5">
            Failover rate
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {stats.byProvider.length === 0 ? (
          <p className="text-[11px] text-[#f0e6cc]/40 italic text-center py-2">
            No requests in this window
          </p>
        ) : (
          stats.byProvider.map((row) => (
            <div
              key={row.provider}
              className="flex items-center justify-between bg-[#12100e] border border-[#c8963c]/10 rounded-lg px-3 py-2"
            >
              <span className="text-[11px] font-bold text-[#f0e6cc] uppercase tracking-wide">
                {row.provider}
              </span>
              <span className="text-[11px] font-black text-[#c8963c]">
                {row.count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const [stats, setStats] = useState<AiUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminApi
      .getAiUsageStats()
      .then(setStats)
      .catch((err: unknown) => {
        const apiError = err as { response?: { status?: number } };
        if (apiError.response?.status === 403) {
          setIsForbidden(true);
        } else {
          setError(true);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] selection:bg-[#c8963c] selection:text-[#12100e]">
      <header className="flex items-center justify-between py-4 px-4 sm:px-12 max-w-4xl mx-auto">
        <Link
          to="/watchlist"
          className="text-[#c8963c] text-xs font-bold uppercase tracking-widest hover:opacity-80 transition"
        >
          &lt; Back
        </Link>
        <h1 className="text-sm font-black text-[#f0e6cc] uppercase tracking-widest">
          AI Usage
        </h1>
        <span className="w-10" />
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12">
        {isLoading ? (
          <p className="text-center text-[#f0e6cc]/50 animate-pulse text-sm mt-10 font-semibold uppercase tracking-widest">
            Loading...
          </p>
        ) : isForbidden ? (
          <div className="text-center p-8 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-2xl mt-8 max-w-sm mx-auto">
            <p className="text-[#f0e6cc]/60 text-base font-medium">
              Admin access required.
            </p>
          </div>
        ) : error || !stats ? (
          <div className="text-center p-8 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-2xl mt-8 max-w-sm mx-auto">
            <p className="text-[#f0e6cc]/60 text-base font-medium">
              Failed to load stats.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {WINDOWS.map(({ key, label }) => (
              <WindowCard key={key} label={label} stats={stats[key]} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
