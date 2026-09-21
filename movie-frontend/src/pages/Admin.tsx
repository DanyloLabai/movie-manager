import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as adminApi from "../api/admin.api";
import type {
  AiUsageStats,
  AiUsageWindowStats,
  FeedbackEntry,
} from "../api/admin.api";
import { useLang } from "../context/LanguageContext";
import { formatTimeAgo } from "../utils/time";

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

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="text-sm leading-none tracking-tight">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{ color: star <= rating ? "#c8963c" : "#3a352c" }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function FeedbackSection() {
  const { t } = useLang();
  const [feedback, setFeedback] = useState<FeedbackEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminApi
      .getFeedback()
      .then(setFeedback)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section className="mt-8">
      <h2 className="text-xs font-black text-[#c8963c] uppercase tracking-widest mb-4">
        User Feedback
      </h2>

      {isLoading ? (
        <p className="text-center text-[#f0e6cc]/50 animate-pulse text-sm py-6 font-semibold uppercase tracking-widest">
          Loading...
        </p>
      ) : error ? (
        <div className="text-center p-6 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20">
          <p className="text-[#f0e6cc]/60 text-sm font-medium">
            Failed to load feedback.
          </p>
        </div>
      ) : !feedback || feedback.length === 0 ? (
        <div className="text-center p-6 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20">
          <p className="text-[#f0e6cc]/60 text-sm font-medium">
            No feedback yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {feedback.map((entry) => (
            <div
              key={entry.id}
              className="bg-[#1a1714] border border-[#c8963c]/20 rounded-2xl p-4 shadow-xl"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <span className="text-[13px] font-bold text-[#f0e6cc] truncate">
                    {entry.user.username}
                  </span>
                  <span className="text-[11px] text-[#f0e6cc]/40 ml-2">
                    {entry.user.email}
                  </span>
                </div>
                <span className="text-[10px] text-[#f0e6cc]/40 whitespace-nowrap uppercase tracking-widest">
                  {formatTimeAgo(entry.createdAt, t)}
                </span>
              </div>
              <StarRow rating={entry.rating} />
              {entry.message && (
                <p className="text-[13px] text-[#f0e6cc]/80 mt-2 whitespace-pre-wrap">
                  {entry.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
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
          Admin
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
          <>
            <h2 className="text-xs font-black text-[#c8963c] uppercase tracking-widest mb-4 mt-4">
              AI Usage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {WINDOWS.map(({ key, label }) => (
                <WindowCard key={key} label={label} stats={stats[key]} />
              ))}
            </div>
            <FeedbackSection />
          </>
        )}
      </main>
    </div>
  );
}
