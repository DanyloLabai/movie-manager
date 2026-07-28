import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import * as authApi from "../api/auth.api";
import { useLang } from "../context/LanguageContext";
import AuthLayout from "../components/auth/AuthLayout";
import { AuthTextField } from "../components/auth/AuthTextField";
import { AuthPasswordField } from "../components/auth/AuthPasswordField";

export default function Register() {
  const { t } = useLang();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [isSuccess, setIsSuccess] = useState(false);

  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!captchaToken) {
      setError(t("register_captcha_error"));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.register({ username, email, password, captchaToken });

      setIsSuccess(true);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message || t("register_error"));
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout title="LUMEN" subtitle={t("register_check_email")} subtitleMono={false}>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="w-20 h-20 rounded-full border border-[#d9ac54]/30 bg-white/[.03] flex items-center justify-center">
            <svg className="w-9 h-9 text-[#d9ac54]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm leading-relaxed text-[#c9c0ac]">
            {t("register_sent_link")}
            <br />
            <strong className="block mt-1 text-base text-[#d9ac54]">{email}</strong>
            <br />
            {t("register_verify_msg")}
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-2 w-full py-3.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] active:scale-[0.98] transition text-[12.5px] font-bold tracking-[2.5px] text-[#14110c] uppercase"
          >
            {t("register_go_login")}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="JOIN US"
      subtitle={t("register_subtitle")}
      footer={
        <>
          {t("register_have_account")}{" "}
          <Link
            to="/login"
            className="font-bold tracking-[1.5px] text-[#d9ac54] uppercase hover:text-[#e8c377] transition-colors"
          >
            {t("register_login")}
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-5 p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-wider text-red-500 bg-red-900/10 border border-red-500/20">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <AuthTextField
          label={t("register_username")}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Cinephile99"
          minLength={3}
          maxLength={20}
          required
          pattern="^[a-zA-Z0-9_]+$"
          title="Username can only contain English letters, numbers and underscores."
        />

        <AuthTextField
          label={t("register_email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          maxLength={50}
          required
          pattern="^[a-zA-Z0-9._%\+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
          title="Please enter a valid email."
        />

        <AuthPasswordField
          label={t("register_password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          minLength={8}
          maxLength={32}
          required
          title="Password must be at least 8 characters."
        />

        <div className="flex justify-center py-1 overflow-hidden">
          <div className="scale-[0.85] sm:scale-100 origin-center rounded-xl overflow-hidden border border-white/[.12] bg-white/[.02]">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
              theme="dark"
              onChange={(token) => setCaptchaToken(token)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !captchaToken}
          className="mt-1 w-full py-3.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] active:scale-[0.98] disabled:opacity-50 transition text-[12.5px] font-bold tracking-[2.5px] text-[#14110c] uppercase"
        >
          {isLoading ? t("register_creating") : t("register_create")}
        </button>
      </form>
    </AuthLayout>
  );
}
