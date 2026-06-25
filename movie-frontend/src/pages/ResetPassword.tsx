import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useLang } from "../context/LanguageContext";

export default function ResetPassword() {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [status, setStatus] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: t("password_new_mismatch") });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.patch("/auth/reset-password", {
        token,
        newPassword,
      });
      setStatus({ type: "success", message: response.data.message });
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.response?.data?.message || "Error resetting password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const EyeIcon = ({ isOpen }: { isOpen: boolean }) => {
    return isOpen ? (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ) : (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    );
  };

  if (!token) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#12100e] text-red-500 font-bold uppercase tracking-widest">
        {t("password_new_invalid")}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[100dvh] overscroll-none bg-[#12100e] px-4 sm:px-6 selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-[#1a1714] rounded-3xl shadow-2xl border border-[#c8963c]/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            {t("password_new_title")}
          </h2>
        </div>

        {status.message && (
          <div
            className={`p-4 text-xs font-bold rounded-xl text-center uppercase tracking-wider ${
              status.type === "success"
                ? "text-green-500 bg-green-900/10 border border-green-500/20"
                : "text-red-500 bg-red-900/10 border border-red-500/20"
            }`}
          >
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              {t("password_new")}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 transition-all placeholder-[#f0e6cc]/20 shadow-inner"
                placeholder={t("password_min")}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-[#f0e6cc]/50 hover:text-[#c8963c] transition-colors focus:outline-none"
                tabIndex={-1}
              >
                <EyeIcon isOpen={showNewPassword} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              {t("password_confirm")}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 transition-all placeholder-[#f0e6cc]/20 shadow-inner"
                placeholder="Re-enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-[#f0e6cc]/50 hover:text-[#c8963c] transition-colors focus:outline-none"
                tabIndex={-1}
              >
                <EyeIcon isOpen={showConfirmPassword} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || status.type === "success"}
            className="w-full py-4 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-[#c8963c]/10"
          >
            {isLoading ? t("password_new_saving") : t("password_new_save")}
          </button>
        </form>
      </div>
    </div>
  );
}
