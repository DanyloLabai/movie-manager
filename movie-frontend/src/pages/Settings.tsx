import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import * as usersApi from "../api/users.api";
import * as moviesApi from "../api/movies.api";
import BottomNav from "../components/BottomNav";

export default function Settings() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [username, setUsername] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    moviesApi
      .getProfile()
      .then((data) => {
        setUsername(data.username || "");
        setCurrentUsername(data.username || "");
        setPreviewUrl(data.avatarUrl || null);
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    const trimmedUsername = username.trim();
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setProfileError(
        "Username can only contain letters, numbers, and underscores.",
      );
      return;
    }
    if (!selectedFile && trimmedUsername === currentUsername) return;

    setIsSaving(true);
    const formData = new FormData();
    if (trimmedUsername !== currentUsername)
      formData.append("username", trimmedUsername);
    if (selectedFile) formData.append("avatar", selectedFile);

    try {
      const response = await usersApi.updateProfile(formData);
      setCurrentUsername(response.username);
      setUsername(response.username);
      if (response.avatarUrl) setPreviewUrl(response.avatarUrl);
      setSelectedFile(null);
      showToast(t("edit_profile_updated"));
    } catch (err: unknown) {
      const apiError = err as { response?: { status?: number } };
      setProfileError(
        apiError.response?.status === 409
          ? t("edit_username_taken")
          : t("edit_error"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await usersApi.deleteAccount();
      logout();
      navigate("/login");
    } catch {
      setDeleteError(t("settings_delete_error"));
      setIsDeleting(false);
    }
  };

  const hasChanges =
    selectedFile !== null || username.trim() !== currentUsername;

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between py-4 px-4 sm:px-12 w-full">
          <Link
            to="/search"
            className="flex items-center gap-3 sm:gap-4 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src={LogoImg}
              alt="LUMEN™ Logo"
              className="h-9 sm:h-12 w-auto object-contain"
            />
            <div className="flex flex-col justify-center">
              <h1 className="text-xl sm:text-3xl font-black text-[#c8963c] tracking-widest uppercase leading-none">
                LUMEN
              </h1>
              <span className="text-[7px] sm:text-[8px] text-[#f0e6cc]/70 font-medium uppercase leading-none whitespace-nowrap tracking-[0.5em] sm:tracking-[0.6em] mt-1 block text-justify w-full">
                Movie Tracker
              </span>
            </div>
          </Link>

          <button
            onClick={() => navigate(-1)}
            className="text-[10px] sm:text-xs font-bold text-[#f0e6cc]/60 hover:text-[#c8963c] transition uppercase tracking-wider shrink-0"
          >
            &lt; {t("common_back").toUpperCase()}
          </button>
        </header>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12">
        <div className="text-center mb-6 pb-4 border-b border-[#c8963c]/20">
          <h2 className="text-xl sm:text-2xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            {t("nav_settings")}
          </h2>
        </div>

        {/* Avatar + username */}
        <form
          onSubmit={handleSaveProfile}
          className="p-4 bg-[#1a1714] border border-[#c8963c]/20 rounded-2xl mb-4"
        >
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#c8963c] mb-4">
            {t("edit_profile")}
          </h3>

          {profileError && (
            <div className="mb-4 p-2.5 text-xs text-red-500 bg-red-900/10 border border-red-500/30 rounded-xl text-center font-semibold">
              {profileError}
            </div>
          )}

          <div className="flex flex-col items-center mb-4">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img
                  src={
                    previewUrl.startsWith("blob:")
                      ? previewUrl
                      : `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}t=${new Date().getTime()}`
                  }
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-4 border-[#12100e] group-hover:border-[#c8963c] transition shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-2xl font-black text-[#12100e] border-4 border-[#12100e] group-hover:border-[#c8963c] transition shadow-lg">
                  {(username || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-[#12100e]/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <svg
                  className="w-6 h-6 text-[#c8963c]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <p className="text-[9px] text-[#f0e6cc]/50 mt-2 font-semibold uppercase tracking-wider">
              {t("edit_image")}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-1.5">
              {t("register_username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] transition text-sm"
              minLength={3}
              maxLength={20}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !username.trim() || !hasChanges}
            className="w-full py-3 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 shadow text-sm"
          >
            {isSaving ? t("edit_saving") : t("edit_save")}
          </button>
        </form>

        <div className="space-y-2 mb-6">
          <Link
            to="/change-password"
            className="flex items-center justify-between px-4 py-4 bg-[#1a1714] border border-[#c8963c]/20 rounded-xl hover:border-[#c8963c]/50 transition"
          >
            <span className="text-sm font-bold text-[#f0e6cc]">
              {t("settings_change_password")}
            </span>
            <span className="text-[#f0e6cc]/40">&gt;</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-4 py-4 bg-[#1a1714] border border-red-900/30 rounded-xl hover:border-red-500/50 transition text-left"
          >
            <span className="text-sm font-bold text-red-500/80">
              {t("nav_logout")}
            </span>
            <span className="text-red-500/40">&gt;</span>
          </button>
        </div>

        {/* Danger zone */}
        <div className="p-4 bg-red-900/5 border border-red-900/30 rounded-2xl">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500/80 mb-2">
            {t("settings_danger_zone")}
          </h3>
          <p className="text-xs text-[#f0e6cc]/50 mb-3">
            {t("settings_delete_hint")}
          </p>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-full py-3 font-black text-red-500 uppercase tracking-widest transition bg-red-900/10 border border-red-900/40 rounded-xl hover:bg-red-900/20 active:scale-[0.98] text-sm"
          >
            {t("settings_delete_account")}
          </button>
        </div>
      </main>

      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md p-5 bg-[#1a1714] border border-red-900/40 rounded-3xl shadow-2xl relative animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-red-500 uppercase tracking-widest text-center mb-3">
              {t("settings_delete_confirm_title")}
            </h2>
            <p className="text-sm text-[#f0e6cc]/70 text-center mb-5">
              {t("settings_delete_confirm_text")}
            </p>

            {deleteError && (
              <div className="mb-4 p-2.5 text-xs text-red-500 bg-red-900/10 border border-red-500/30 rounded-xl text-center font-semibold">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="flex-1 py-3 font-black text-[#f0e6cc] uppercase tracking-widest transition bg-[#12100e] border border-[#c8963c]/30 rounded-xl hover:border-[#c8963c]/60 active:scale-[0.98] disabled:opacity-50 text-xs"
              >
                {t("settings_delete_cancel")}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3 font-black text-white uppercase tracking-widest transition bg-red-600 rounded-xl hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 text-xs"
              >
                {isDeleting
                  ? t("settings_delete_deleting")
                  : t("settings_delete_confirm_button")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-4 py-3 rounded-xl shadow-2xl z-50 uppercase tracking-widest font-bold text-[10px] whitespace-nowrap animate-fade-in">
          {toastMessage}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
