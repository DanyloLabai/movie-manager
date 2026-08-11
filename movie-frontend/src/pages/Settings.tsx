import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import LangToggle from "../components/LangToggle";
import LogoIcon from "../components/LogoIcon";
import * as usersApi from "../api/users.api";
import * as moviesApi from "../api/movies.api";
import {
  isPushSupported,
  isPushSubscribed,
  enablePushNotifications,
  disablePushNotifications,
} from "../utils/push";

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

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    setPushSupported(true);
    isPushSubscribed().then(setPushEnabled);
  }, []);

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

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
      } else {
        const success = await enablePushNotifications();
        setPushEnabled(success);
        if (!success) showToast(t("settings_push_denied"));
      }
    } catch {
      showToast(t("settings_push_error"));
    } finally {
      setPushBusy(false);
    }
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
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] relative selection:bg-[#d9ac54] selection:text-[#14110c]">
      <div className="sticky top-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)] mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between py-4 px-4 sm:px-12 w-full">
          <Link
            to="/search"
            className="sm:hidden flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="font-ui font-bold text-[17px] tracking-[4px] text-[#d9ac54]">
              LUMEN
            </span>
            <LogoIcon />
          </Link>

          <h1 className="hidden sm:block font-mono-ui text-[12px] font-semibold tracking-[3px] text-[#d9ac54] uppercase">
            {t("nav_settings")}
          </h1>

          <button
            onClick={() => navigate(-1)}
            className="text-[10px] sm:text-xs font-bold text-[#8f8574] hover:text-[#d9ac54] transition uppercase tracking-wider shrink-0"
          >
            &lt; {t("common_back").toUpperCase()}
          </button>
        </header>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12">
        <div className="text-center mb-6 pb-4 border-b border-[rgba(217,172,84,.16)]">
          <h2 className="text-xl sm:text-2xl font-bold text-[#f2ead9] tracking-tight">
            {t("nav_settings")}
          </h2>
        </div>

        <form
          onSubmit={handleSaveProfile}
          className="pb-6 mb-6 border-b border-[rgba(217,172,84,.16)]"
        >
          <h3 className="font-mono-ui text-[10.5px] font-semibold uppercase tracking-[2.5px] text-[#d9ac54] mb-4">
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
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#d9ac54]/45 group-hover:border-[#d9ac54] transition"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-2xl font-black text-[#14110c] border-2 border-[#d9ac54]/45 group-hover:border-[#d9ac54] transition">
                  {(username || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-[#0f0d0a]/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <svg
                  className="w-6 h-6 text-[#d9ac54]"
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
            <p className="text-[9px] text-[#8f8574] mt-2 font-semibold uppercase tracking-wider">
              {t("edit_image")}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-bold text-[#d9ac54] uppercase tracking-wider ml-1 mb-1.5">
              {t("register_username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 text-[#f2ead9] bg-white/[.03] border border-[#d9ac54]/30 rounded-xl focus:outline-none focus:border-[#d9ac54] transition text-sm"
              minLength={3}
              maxLength={20}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !username.trim() || !hasChanges}
            className="w-full py-3 rounded-full font-bold text-[#14110c] uppercase tracking-widest transition bg-[#d9ac54] hover:bg-[#e8c377] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 text-sm"
          >
            {isSaving ? t("edit_saving") : t("edit_save")}
          </button>
        </form>

        <h3 className="font-mono-ui text-[10.5px] font-semibold uppercase tracking-[2.5px] text-[#d9ac54] mb-1">
          {t("settings_preferences")}
        </h3>
        <div className="flex items-center justify-between py-4 border-b border-[rgba(217,172,84,.16)]">
          <span className="text-sm font-semibold text-[#f2ead9]">
            {t("settings_language")}
          </span>
          <LangToggle />
        </div>

        {pushSupported && (
          <div className="flex items-center justify-between py-4 border-b border-[rgba(217,172,84,.16)]">
            <div>
              <span className="text-sm font-semibold text-[#f2ead9] block">
                {t("settings_push")}
              </span>
              <span className="text-[10px] text-[#8f8574]">
                {t("settings_push_hint")}
              </span>
            </div>
            <button
              onClick={handleTogglePush}
              disabled={pushBusy}
              type="button"
              className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 shrink-0 appearance-none p-0 border-0 overflow-hidden outline-none ${
                pushEnabled ? "bg-[#d9ac54]" : "bg-white/[.08] ring-1 ring-inset ring-[#d9ac54]/30"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#f2ead9] transition-transform ${
                  pushEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        <h3 className="font-mono-ui text-[10.5px] font-semibold uppercase tracking-[2.5px] text-[#d9ac54] mt-6 mb-1">
          {t("settings_account")}
        </h3>
        <div className="mb-6">
          <Link
            to="/change-password"
            className="flex items-center justify-between py-4 border-b border-[rgba(217,172,84,.16)] hover:pl-1.5 transition-[padding]"
          >
            <span className="text-sm font-semibold text-[#f2ead9]">
              {t("settings_change_password")}
            </span>
            <span className="text-[#645c4d]">&gt;</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between py-4 hover:pl-1.5 transition-[padding] text-left"
          >
            <span className="text-sm font-semibold text-red-400/80">
              {t("nav_logout")}
            </span>
            <span className="text-red-400/40">&gt;</span>
          </button>
        </div>

        <div className="p-4 bg-red-900/5 border border-red-500/30 rounded-2xl">
          <h3 className="font-mono-ui text-[10.5px] font-semibold uppercase tracking-[2.5px] text-red-400/80 mb-2">
            {t("settings_danger_zone")}
          </h3>
          <p className="text-xs text-[#8f8574] mb-3">
            {t("settings_delete_hint")}
          </p>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-full py-3 font-black text-red-500 uppercase tracking-widest transition btn-glass btn-glass-dark !border-red-900/40 hover:!bg-red-900/20 hover:!border-red-500/60 active:scale-[0.98] text-sm"
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
            className="w-full max-w-md p-5 bg-[#14110d] border border-red-900/40 rounded-3xl shadow-2xl relative animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black text-red-500 uppercase tracking-widest text-center mb-3">
              {t("settings_delete_confirm_title")}
            </h2>
            <p className="text-sm text-[#f2ead9]/70 text-center mb-5">
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
                className="flex-1 py-3 font-black text-[#f2ead9] uppercase tracking-widest transition btn-glass btn-glass-dark active:scale-[0.98] disabled:opacity-50 text-xs"
              >
                {t("settings_delete_cancel")}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3 font-black text-white uppercase tracking-widest transition btn-glass btn-glass-red rounded-xl active:scale-[0.98] disabled:opacity-50 text-xs"
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
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 bg-[#14110d] border border-[#d9ac54]/50 text-[#d9ac54] px-4 py-3 rounded-xl shadow-2xl z-50 uppercase tracking-widest font-bold text-[10px] whitespace-nowrap animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
