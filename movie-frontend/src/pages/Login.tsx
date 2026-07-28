import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as authApi from "../api/auth.api";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { STORAGE_KEYS } from "../constants/storage";
import AuthLayout from "../components/auth/AuthLayout";
import { AuthTextField } from "../components/auth/AuthTextField";
import { AuthPasswordField } from "../components/auth/AuthPasswordField";

export default function Login() {
  const { t } = useLang();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const [isResending, setIsResending] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Blur now, before the async request, so the on-screen keyboard has the
    // whole request round-trip to finish closing. Otherwise it's still
    // animating shut when we land on /watchlist, visually covering the
    // bottom nav bar until the user scrolls or waits it out.
    (document.activeElement as HTMLElement | null)?.blur();
    setError("");
    setIsLoading(true);

    try {
      const response = await authApi.login({ email, password });

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

      login(response.access_token, response.user);
      navigate("/watchlist");
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { message?: string | string[] } };
      };
      const serverMessage = apiError.response?.data?.message;

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
      await authApi.resendVerification(email);
      setResendStatus(t("login_resend"));
    } catch {
      setResendStatus(t("login_resend_error"));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="LUMEN"
      subtitle={t("login_subtitle")}
      footer={
        <>
          {t("login_new")}{" "}
          <Link
            to="/register"
            className="font-bold tracking-[1.5px] text-[#d9ac54] uppercase hover:text-[#e8c377] transition-colors"
          >
            {t("login_signup")}
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-5 p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-wider text-red-500 bg-red-900/10 border border-red-500/20">
          {error}
          {showResend && (
            <div className="mt-3 pt-3 border-t border-red-500/20">
              {resendStatus ? (
                <p className="normal-case text-[#d9ac54]">{resendStatus}</p>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="font-black normal-case text-[#d9ac54] hover:text-[#e8c377] transition disabled:opacity-50"
                >
                  {isResending ? t("login_sending") : t("login_resend")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-[18px]">
        <AuthTextField
          label={t("login_email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
          pattern="^[a-zA-Z0-9._%\+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
          title="Please enter your email using only English characters."
        />

        <AuthPasswordField
          label={t("login_password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          title="Please enter your password."
        />

        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 w-full py-3.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] active:scale-[0.98] disabled:opacity-50 transition text-[12.5px] font-bold tracking-[2.5px] text-[#14110c] uppercase"
        >
          {isLoading ? t("login_signing") : t("login_signin")}
        </button>

        <Link
          to="/forgot-password"
          className="text-center font-mono-ui text-[10.5px] font-semibold tracking-[1.5px] text-[#8f8574] uppercase hover:text-[#d9ac54] transition-colors"
        >
          {t("login_forgot")}
        </Link>
      </form>
    </AuthLayout>
  );
}
