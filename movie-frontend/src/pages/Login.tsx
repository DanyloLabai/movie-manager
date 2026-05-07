import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { STORAGE_KEYS } from "../constants/storage";

export default function Login() {
  const { t } = useLang();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const [isResending, setIsResending] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await api.post("/auth/signin", { email, password });

      // Clear old caches
      Object.values(STORAGE_KEYS).forEach((key) => {
        if (typeof key === "string") {
          const keysToRemove = Object.keys(localStorage).filter(
            (k) => k.includes(key) || k.startsWith(key),
          );
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        }
      });
      localStorage.removeItem("custom_username");
      localStorage.removeItem("custom_avatarUrl");
      localStorage.removeItem("movie_tracker_chat_history");

      // Use AuthContext to login
      login(response.data.access_token, response.data.user);
      navigate("/watchlist");
    } catch (err: any) {
      const serverMessage = err.response?.data?.message;

      if (typeof serverMessage === "string") {
        setError(serverMessage);
        if (serverMessage.toLowerCase().includes("verify")) {
          setShowResend(true);
        }
      } else if (Array.isArray(serverMessage)) {
        setError(serverMessage[0]);
      } else {
        setError(t("login_error"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendStatus("");
    try {
      await api.post("/auth/resend-verification", { email });
      setResendStatus(t("login_resend"));
    } catch {
      setResendStatus(t("login_resend_error"));
    } finally {
      setIsResending(false);
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

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#12100e] px-4 sm:px-6 selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-[#1a1714] rounded-3xl shadow-2xl border border-[#c8963c]/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            {t("login_welcome")}
          </h2>
          <p className="mt-3 text-sm text-[#f0e6cc]/60 font-medium tracking-wide">
            {t("login_subtitle")}
          </p>
        </div>

        {error && (
          <div className="p-4 text-xs font-bold text-red-500 bg-red-900/10 border border-red-500/20 rounded-xl text-center uppercase tracking-wider">
            {error}
            {showResend && (
              <div className="mt-3 pt-3 border-t border-red-500/20">
                {resendStatus ? (
                  <p className="text-[#c8963c] normal-case">{resendStatus}</p>
                ) : (
                  <button
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="text-[#c8963c] hover:text-[#e8c070] transition font-black normal-case disabled:opacity-50"
                  >
                    {isResending ? t("login_sending") : t("login_resend")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              {t("login_email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 transition-all placeholder-[#f0e6cc]/20 shadow-inner"
              placeholder="name@example.com"
              required
              pattern="^[a-zA-Z0-9._%\+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
              title="Please enter your email using only English characters."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              {t("login_password")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 transition-all placeholder-[#f0e6cc]/20 shadow-inner"
                placeholder="••••••••"
                required
                title="Please enter your password."
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-[#f0e6cc]/50 hover:text-[#c8963c] transition-colors focus:outline-none"
                tabIndex={-1}
              >
                <EyeIcon isOpen={showPassword} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 shadow-lg shadow-[#c8963c]/10"
          >
            {isLoading ? t("login_signing") : t("login_signin")}
          </button>
        </form>

        <div className="text-center">
          <Link
            to="/forgot-password"
            className="text-xs font-bold text-[#f0e6cc]/40 hover:text-[#c8963c] transition-colors uppercase tracking-wider underline underline-offset-4"
          >
            {t("login_forgot")}
          </Link>
        </div>

        <p className="text-sm text-center text-[#f0e6cc]/60 pt-4 border-t border-[#c8963c]/20 font-medium">
          {t("login_new")}{" "}
          <Link
            to="/register"
            className="text-[#c8963c] font-black uppercase tracking-wider hover:text-[#e8c070] transition-colors ml-1"
          >
            {t("login_signup")}
          </Link>
        </p>
      </div>
    </div>
  );
}
