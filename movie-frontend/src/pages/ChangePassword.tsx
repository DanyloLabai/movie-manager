import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as authApi from "../api/auth.api";
import { useLang } from "../context/LanguageContext";
import EyeIcon from "../components/auth/EyeIcon";

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length === 0) return 0;
  if (pw.length < 8) return 1;
  const varietyCount = [/[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(pw),
  ).length;
  if (pw.length >= 12 && varietyCount >= 2) return 3;
  if (varietyCount >= 1) return 2;
  return 1;
}

export default function ChangePassword() {
  const { t } = useLang();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const strength = passwordStrength(newPassword);
  const strengthLabel = [
    "",
    t("password_strength_weak"),
    t("password_strength_normal"),
    t("password_strength_strong"),
  ][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setError(t("password_mismatch"));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword });

      setSuccessMsg(t("password_success"));
      localStorage.removeItem("token");

      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || "Error changing password.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputWrapClass = (filled: string | number) =>
    `flex items-center px-[18px] py-3 rounded-lg bg-white/[.03] border transition-colors focus-within:border-[#d9ac54] ${
      filled ? "border-[#d9ac54]/30" : "border-white/[.14]"
    }`;

  return (
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] relative selection:bg-[#d9ac54] selection:text-[#14110c]">
      <div className="sticky top-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)] pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between py-9 px-4 sm:px-12 w-full">
          <div className="flex flex-col gap-1">
            <span className="text-xl sm:text-2xl font-bold tracking-[4px] text-[#f2ead9] uppercase">
              {t("password_security")}
            </span>
            <span className="text-xs text-[#8f8574]">{t("password_subtitle")}</span>
          </div>
          <Link
            to="/settings"
            className="font-mono-ui text-[10.5px] font-semibold tracking-[2px] text-[#8f8574] uppercase hover:text-[#d9ac54] transition-colors shrink-0"
          >
            ‹ {t("nav_settings")}
          </Link>
        </header>
      </div>

      {successMsg && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 bg-[#14110d] border border-[#d9ac54]/50 rounded-2xl shadow-2xl w-max max-w-[90vw] animate-fade-in">
          <div className="flex items-center justify-center w-8 h-8 bg-[#d9ac54] rounded-full shrink-0">
            <svg className="w-5 h-5 text-[#14110c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#d9ac54] uppercase tracking-wider">
            {successMsg}
          </p>
        </div>
      )}

      <main className="max-w-[440px] mx-auto px-4 sm:px-12 py-7 pb-24">
        {error && (
          <div className="mb-5 p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-wider text-red-500 bg-red-900/10 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="font-mono-ui text-[9.5px] font-semibold tracking-[2px] text-[#d9ac54] uppercase">
              {t("password_current")}
            </label>
            <div className={inputWrapClass(oldPassword)}>
              <input
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-[14px] text-[#f2ead9] placeholder-[#645c4d] focus:outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                tabIndex={-1}
                className="ml-2 shrink-0 text-[#645c4d] hover:text-[#d9ac54] transition-colors"
              >
                <EyeIcon isOpen={showOldPassword} />
              </button>
            </div>
          </div>

          <div className="h-px bg-[rgba(217,172,84,.12)]" />

          <div className="flex flex-col gap-2">
            <label className="font-mono-ui text-[9.5px] font-semibold tracking-[2px] text-[#d9ac54] uppercase">
              {t("password_new")}
            </label>
            <div className={inputWrapClass(newPassword)}>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-[14px] text-[#f2ead9] placeholder-[#645c4d] focus:outline-none"
                placeholder={t("password_min")}
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex={-1}
                className="ml-2 shrink-0 text-[#645c4d] hover:text-[#d9ac54] transition-colors"
              >
                <EyeIcon isOpen={showNewPassword} />
              </button>
            </div>
            {newPassword.length > 0 && (
              <div className="flex items-center gap-[5px] pt-0.5">
                {[1, 2, 3].map((seg) => (
                  <span
                    key={seg}
                    className={`flex-1 h-[3px] rounded-sm ${
                      seg <= strength ? "bg-[#d9ac54]" : "bg-white/[.08]"
                    }`}
                  />
                ))}
                <span className="font-mono-ui text-[10px] text-[#645c4d] pl-2 shrink-0">
                  {strengthLabel}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-mono-ui text-[9.5px] font-semibold tracking-[2px] text-[#d9ac54] uppercase">
              {t("password_confirm")}
            </label>
            <div className={inputWrapClass(confirmPassword)}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-[14px] text-[#f2ead9] placeholder-[#645c4d] focus:outline-none"
                placeholder="Re-enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="ml-2 shrink-0 text-[#645c4d] hover:text-[#d9ac54] transition-colors"
              >
                <EyeIcon isOpen={showConfirmPassword} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-1">
            <button
              type="submit"
              disabled={isLoading || !!successMsg}
              className="py-3 px-7 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] active:scale-[0.98] disabled:opacity-50 transition text-[11.5px] font-bold tracking-[2px] text-[#14110c] uppercase whitespace-nowrap min-h-[44px]"
            >
              {isLoading ? t("password_updating") : t("password_update")}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={!!successMsg}
              className="font-mono-ui text-[10.5px] font-semibold tracking-[1.5px] text-[#8f8574] uppercase hover:text-[#d9ac54] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {t("password_cancel")}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
