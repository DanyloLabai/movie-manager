import type { ReactNode } from "react";
import { useLang } from "../../context/LanguageContext";
import { formatTimeAgo } from "../../utils/time";
import type { WatchlistItem } from "../../types/movie.types";

interface ProfileHeroProps {
  username: string;
  avatarUrl: string | null;
  rank: string;
  memberSince?: string;
  recent: WatchlistItem[];
  friendsCount: number;
  userId?: number;
  onOpenFriends: () => void;
  onShowToast: (message: string) => void;
  compact?: boolean;
  rightSlot?: ReactNode;
}

function getLastWatched(recent: WatchlistItem[]) {
  const item = recent.find((r) => r.isWatched && r.updatedAt);
  return item ? { title: item.title, updatedAt: item.updatedAt! } : null;
}

function FriendsPill({
  className = "",
  friendsCount,
  friendsLabel,
  onOpenFriends,
}: {
  className?: string;
  friendsCount: number;
  friendsLabel: string;
  onOpenFriends: () => void;
}) {
  return (
    <button
      onClick={onOpenFriends}
      className={`flex items-center justify-center gap-2 px-5 py-2.5 md:py-2.5 border border-[#d9ac54]/45 rounded-full transition hover:bg-[#d9ac54]/10 ${className}`}
    >
      <span className="font-ui font-bold text-[14px] md:text-[15px] text-[#f2ead9]">
        {friendsCount}
      </span>
      <span className="font-ui font-semibold text-[11px] md:text-[12px] tracking-[1.5px] text-[#d9ac54] uppercase">
        {friendsLabel}
      </span>
    </button>
  );
}

function SharePill({
  className = "",
  shareLabel,
  onShare,
}: {
  className?: string;
  shareLabel: string;
  onShare: () => void;
}) {
  return (
    <button
      onClick={onShare}
      className={`flex items-center justify-center px-5 py-2.5 border border-white/[.18] rounded-full font-ui font-semibold text-[11px] md:text-[12px] tracking-[1.5px] text-[#c9c0ac] uppercase transition hover:border-[#d9ac54]/45 hover:text-[#d9ac54] ${className}`}
    >
      {shareLabel}
    </button>
  );
}

export default function ProfileHero({
  username,
  avatarUrl,
  rank,
  memberSince,
  recent,
  friendsCount,
  userId,
  onOpenFriends,
  onShowToast,
  compact = false,
  rightSlot,
}: ProfileHeroProps) {
  const { t } = useLang();
  const lastWatched = getLastWatched(recent);
  const memberSinceYear = memberSince
    ? new Date(memberSince).getFullYear()
    : null;

  const handleShare = async () => {
    const url = userId
      ? `${window.location.origin}/user/${userId}`
      : window.location.href;
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; url?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: username, url });
      } catch {
        // empty
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      onShowToast(t("profile_link_copied"));
    } catch {
      onShowToast(t("profile_link_copied"));
    }
  };

  if (compact) {
    return (
      <div className="-mx-4 sm:-mx-8 font-ui">
        <div className="relative overflow-hidden h-[180px]">
          {avatarUrl ? (
            <div
              className="absolute inset-0"
              style={{
                filter: "blur(28px) saturate(1.1)",
                opacity: 0.35,
                transform: "scale(1.15)",
              }}
            >
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%, #3a2f1a 0%, #201c15 55%, #0f0d0a 100%)",
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(15,13,10,.4) 0%, #0f0d0a 100%)",
            }}
          />

          <div className="absolute left-0 right-0 bottom-0 px-5 md:px-14 pb-[18px] flex items-end gap-[18px]">
            <div
              className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center font-bold text-[26px] text-[#14110c] overflow-hidden"
              style={{
                background: "radial-gradient(circle at 35% 30%, #e8c377, #a87c2e)",
                boxShadow: "0 0 0 3px #0f0d0a, 0 0 0 4px rgba(217,172,84,.5)",
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
              ) : (
                username.charAt(0).toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
              <div className="text-[28px] font-bold text-[#f2ead9] leading-none tracking-tight truncate">
                {username}
              </div>
              <div className="font-mono-ui text-[10px] font-semibold text-[#d9ac54] tracking-[2.5px] uppercase truncate">
                {rank}
              </div>
            </div>

            {rightSlot ?? (
              <FriendsPill
                className="shrink-0"
                friendsCount={friendsCount}
                friendsLabel={t("profile_friends")}
                onOpenFriends={onOpenFriends}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-8 font-ui">
      <div className="relative overflow-hidden h-[230px] md:h-[330px]">
        {avatarUrl ? (
          <div
            className="absolute inset-0"
            style={{
              filter: "blur(28px) saturate(1.1)",
              opacity: 0.55,
              transform: "scale(1.15)",
            }}
          >
            <img
              src={avatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, #3a2f1a 0%, #201c15 55%, #0f0d0a 100%)",
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,13,10,.28) 0%, rgba(15,13,10,.68) 55%, #0f0d0a 100%)",
          }}
        />

        <div className="absolute left-0 right-0 bottom-0 px-5 md:px-14 pb-4 md:pb-7 flex items-end gap-3.5 md:gap-6">
          <div
            className="w-[68px] h-[68px] md:w-24 md:h-24 rounded-full shrink-0 flex items-center justify-center font-bold text-[28px] md:text-[38px] text-[#14110c] overflow-hidden"
            style={{
              background: "radial-gradient(circle at 35% 30%, #e8c377, #a87c2e)",
              boxShadow: "0 0 0 3px #0f0d0a, 0 0 0 4px rgba(217,172,84,.5)",
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="w-full h-full object-cover"
              />
            ) : (
              username.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1 md:gap-1.5 pb-0.5 md:pb-0">
            <div className="text-[26px] md:text-[40px] font-bold text-[#f2ead9] leading-none tracking-tight truncate">
              {username}
            </div>

            <div className="md:hidden font-mono-ui text-[9.5px] font-semibold text-[#d9ac54] tracking-[2.5px] uppercase truncate">
              {rank}
              {memberSinceYear ? ` · SINCE ${memberSinceYear}` : ""}
            </div>

            <div className="hidden md:flex items-center gap-3 min-w-0">
              <span className="shrink-0 font-mono-ui text-[11px] font-semibold text-[#d9ac54] tracking-[3px] uppercase">
                {rank}
              </span>
              {lastWatched && (
                <>
                  <span className="shrink-0 w-[3px] h-[3px] rounded-full bg-[#8f8574]" />
                  <span className="min-w-0 truncate text-[12px] text-[#c9c0ac]">
                    {t("profile_last_watched")}{" "}
                    <span className="text-[#f2ead9] font-semibold">
                      {lastWatched.title}
                    </span>{" "}
                    · {formatTimeAgo(lastWatched.updatedAt, t)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2.5 shrink-0 pb-0.5">
            {rightSlot ?? (
              <>
                <FriendsPill
                  friendsCount={friendsCount}
                  friendsLabel={t("profile_friends")}
                  onOpenFriends={onOpenFriends}
                />
                <SharePill shareLabel={t("profile_share")} onShare={handleShare} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="md:hidden flex gap-2.5 px-5 pt-3.5">
        {rightSlot ?? (
          <>
            <FriendsPill
              className="flex-1"
              friendsCount={friendsCount}
              friendsLabel={t("profile_friends")}
              onOpenFriends={onOpenFriends}
            />
            <SharePill
              className="flex-1"
              shareLabel={t("profile_share")}
              onShare={handleShare}
            />
          </>
        )}
      </div>
    </div>
  );
}
