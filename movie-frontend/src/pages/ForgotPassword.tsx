import { useState } from "react";
import { Link } from "react-router-dom";
import * as authApi from "../api/auth.api";
import { useLang } from "../context/LanguageContext";
import AuthLayout from "../components/auth/AuthLayout";
import { AuthTextField } from "../components/auth/AuthTextField";

const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

export default function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await authApi.forgotPassword(email);
      setStatus({
        type: "success",
        message: response.message || response.data?.message || "",
      });
    } catch {
      setStatus({ type: "error", message: t("password_reset_error") });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("password_reset_title")}
      subtitle={t("password_reset_subtitle")}
      subtitleMono={false}
      icon={<MailIcon />}
    >
      {status.message && (
        <div
          className={`mb-5 p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-wider ${
            status.type === "success"
              ? "text-[#d9ac54] bg-[#d9ac54]/10 border border-[#d9ac54]/30"
              : "text-red-500 bg-red-900/10 border border-red-500/20"
          }`}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthTextField
          label={t("login_email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
        />

        <button
          type="submit"
          disabled={isLoading || status.type === "success"}
          className="mt-1 w-full py-3.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] active:scale-[0.98] disabled:opacity-50 transition text-[12.5px] font-bold tracking-[2.5px] text-[#14110c] uppercase"
        >
          {isLoading ? t("password_reset_sending") : t("password_reset_send")}
        </button>

        <Link
          to="/login"
          className="text-center font-mono-ui text-[10.5px] font-semibold tracking-[1.5px] text-[#8f8574] uppercase hover:text-[#d9ac54] transition-colors"
        >
          ‹ {t("password_reset_back")}
        </Link>
      </form>
    </AuthLayout>
  );
}
