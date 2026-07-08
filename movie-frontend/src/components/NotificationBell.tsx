import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as usersApi from "../api/users.api";
import * as moviesApi from "../api/movies.api";
import type { FriendRequest } from "../api/users.api";
import type { AppNotification } from "../api/movies.api";
import { useLang } from "../context/LanguageContext";

const POLL_INTERVAL_MS = 60000;

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function NotificationBell() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    try {
      const [reqs, notifs] = await Promise.all([
        usersApi.getFriendRequests(),
        moviesApi.getNotifications(),
      ]);
      setRequests(reqs || []);
      setNotifications(notifs || []);
    } catch {
      // silent — bell just stays empty
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const totalCount = requests.length + unreadNotifCount;

  const handleAccept = async (id: number) => {
    setProcessingId(id);
    try {
      await usersApi.acceptFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // leave it in the list; user can retry
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (id: number) => {
    setProcessingId(id);
    try {
      await usersApi.declineFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // leave it in the list; user can retry
    } finally {
      setProcessingId(null);
    }
  };

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      moviesApi.markNotificationRead(n.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
      );
    }
    setIsOpen(false);
    navigate(`/movie/${n.tmdbId}?type=${n.mediaType}`);
  };

  const handleMarkAllRead = async () => {
    try {
      await moviesApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#f0e6cc]/70 hover:text-[#c8963c] transition rounded-full hover:bg-[#c8963c]/10"
        title={t("notif_bell_title")}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border border-[#12100e]">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-[#1a1714] border border-[#c8963c]/30 rounded-2xl shadow-2xl z-[120] animate-modal-in">
          {requests.length === 0 && notifications.length === 0 ? (
            <div className="text-center text-[#f0e6cc]/50 text-xs italic py-8 px-4">
              {t("notif_empty")}
            </div>
          ) : (
            <>
              {requests.length > 0 && (
                <div className="p-3 border-b border-[#c8963c]/10">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-[#c8963c] mb-2 px-1">
                    {t("notif_friend_requests")}
                  </h4>
                  <div className="space-y-1.5">
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center gap-2 bg-[#12100e] p-2 rounded-xl border border-[#c8963c]/20"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-xs font-black text-[#12100e] overflow-hidden shrink-0">
                          {req.fromUser.avatarUrl ? (
                            <img
                              src={req.fromUser.avatarUrl}
                              className="w-full h-full object-cover"
                              alt={req.fromUser.username}
                            />
                          ) : (
                            req.fromUser.username[0].toUpperCase()
                          )}
                        </div>
                        <span className="flex-1 min-w-0 text-xs font-bold text-[#f0e6cc] truncate">
                          {req.fromUser.username}
                        </span>
                        <button
                          onClick={() => handleAccept(req.id)}
                          disabled={processingId === req.id}
                          className="shrink-0 text-[9px] font-black text-[#12100e] bg-[#c8963c] hover:bg-[#e8c070] px-2 py-1 rounded-lg transition disabled:opacity-40"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleDecline(req.id)}
                          disabled={processingId === req.id}
                          className="shrink-0 text-[9px] font-black text-red-500/70 hover:text-red-500 px-1.5 transition disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notifications.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-[#c8963c]">
                      {t("notif_releases")}
                    </h4>
                    {unreadNotifCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[8px] font-bold text-[#f0e6cc]/40 hover:text-[#c8963c] uppercase tracking-wide transition"
                      >
                        {t("notif_mark_all_read")}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                          n.isRead
                            ? "bg-[#12100e] border-[#c8963c]/10 opacity-60"
                            : "bg-[#12100e] border-[#c8963c]/30 hover:border-[#c8963c]/60"
                        }`}
                      >
                        <div className="w-8 h-11 rounded-md overflow-hidden shrink-0 border border-[#c8963c]/20 bg-[#1a1714]">
                          {n.posterUrl ? (
                            <img
                              src={n.posterUrl}
                              alt={n.title}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#f0e6cc] truncate">
                            {n.title}
                          </p>
                          <p className="text-[9px] text-[#f0e6cc]/40 uppercase tracking-wide">
                            {t("notif_released_today")}
                          </p>
                        </div>
                        <span className="text-[8px] text-[#f0e6cc]/30 shrink-0">
                          {formatTimeAgo(n.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
