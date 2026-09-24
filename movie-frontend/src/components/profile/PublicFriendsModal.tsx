import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../context/useLang";
import * as usersApi from "../../api/users.api";
import type { Friend } from "../../types/friend.types";

interface PublicFriendsModalProps {
  userId: number;
  username: string;
  onClose: () => void;
}

export default function PublicFriendsModal({
  userId,
  username,
  onClose,
}: PublicFriendsModalProps) {
  const { t } = useLang();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    usersApi
      .getPublicFriends(userId)
      .then((data) => setFriends(data || []))
      .catch(() => setFriends([]))
      .finally(() => setIsLoading(false));
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#14110d] border border-[#d9ac54]/25 rounded-[14px] shadow-2xl relative animate-modal-in font-ui overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(217,172,84,.16)]">
          <span className="font-bold text-[15px] tracking-[3px] text-[#f2ead9]">
            {t("profile_someones_friends").replace("{name}", username)}{" "}
            <span className="text-[#d9ac54]">· {friends.length}</span>
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#8f8574] hover:text-[#f2ead9] hover:bg-white/[.05] transition"
          >
            ✕
          </button>
        </div>

        <div className="px-6 pt-3.5 pb-6">
          {isLoading ? (
            <div className="text-center text-[#d9ac54] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
              {t("profile_loading")}
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center text-[#f2ead9]/50 text-sm py-6 italic border border-[#d9ac54]/20 rounded-xl border-dashed">
              {t("profile_no_friends")}
            </div>
          ) : (
            <div className="flex flex-col max-h-[50vh] overflow-y-auto pr-1">
              {friends.map((friend) => (
                <Link
                  key={friend.id}
                  to={`/user/${friend.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3.5 py-3.5 border-b border-[rgba(217,172,84,.12)] last:border-b-0 hover:opacity-80 transition"
                >
                  <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-sm font-bold text-[#14110c] overflow-hidden shrink-0">
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        className="w-full h-full object-cover"
                        alt={friend.username}
                      />
                    ) : (
                      friend.username[0].toUpperCase()
                    )}
                  </div>
                  <span className="font-semibold text-[13.5px] text-[#f2ead9] truncate">
                    {friend.username}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
