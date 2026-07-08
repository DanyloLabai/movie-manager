import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import * as authApi from "../api/auth.api";
import { useLang } from "../context/LanguageContext";

export default function Register() {
  const { t } = useLang();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#12100e] px-4 py-8 sm:px-6 animate-fade-in selection:bg-[#c8963c] selection:text-[#12100e]">
        <div className="w-full max-w-md p-8 sm:p-10 space-y-6 bg-[#1a1714] rounded-3xl shadow-2xl border border-[#c8963c]/30 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

          <div className="w-20 h-20 bg-[#12100e] border border-[#c8963c]/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg
              className="w-10 h-10 text-[#c8963c]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#c8963c] uppercase tracking-widest">
            {t("register_check_email")}
          </h2>
          <p className="text-[#f0e6cc]/80 text-sm leading-relaxed font-medium">
            {t("register_sent_link")} <br />
            <strong className="text-[#c8963c] block mt-1 text-base">
              {email}
            </strong>{" "}
            <br />
            {t("register_verify_msg")}
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full py-4 mt-6 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] shadow-lg shadow-[#c8963c]/10"
          >
            {t("register_go_login")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#12100e] px-4 py-8 sm:px-6 selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-[#1a1714] rounded-3xl shadow-2xl border border-[#c8963c]/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            {t("register_welcome")}
          </h2>
          <p className="mt-3 text-sm text-[#f0e6cc]/60 font-medium tracking-wide">
            {t("register_subtitle")}
          </p>
        </div>

        {error && (
          <div className="p-4 text-xs font-bold text-red-500 bg-red-900/10 border border-red-500/20 rounded-xl text-center uppercase tracking-wider">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              {t("register_username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3.5 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 transition-all placeholder-[#f0e6cc]/20 shadow-inner"
              placeholder="Cinephile99"
              minLength={3}
              maxLength={20}
              required
              pattern="^[a-zA-Z0-9_]+$"
              title="Username can only contain English letters, numbers and underscores."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              {t("register_email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 transition-all placeholder-[#f0e6cc]/20 shadow-inner"
              placeholder="name@example.com"
              maxLength={50}
              required
              pattern="^[a-zA-Z0-9._%\+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
              title="Please enter a valid email."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              {t("register_password")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 transition-all placeholder-[#f0e6cc]/20 shadow-inner"
                placeholder="••••••••"
                minLength={8}
                maxLength={32}
                required
                title="Password must be at least 8 characters."
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

          <div className="flex justify-center py-2 overflow-hidden">
            <div className="scale-[0.85] sm:scale-100 origin-center rounded-xl overflow-hidden border border-[#c8963c]/20">
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
            className="w-full py-4 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 shadow-lg shadow-[#c8963c]/10"
          >
            {isLoading ? t("register_creating") : t("register_create")}
          </button>
        </form>

        <p className="text-sm text-center text-[#f0e6cc]/60 pt-4 border-t border-[#c8963c]/20 font-medium">
          {t("register_have_account")}{" "}
          <Link
            to="/login"
            className="text-[#c8963c] font-black uppercase tracking-wider hover:text-[#e8c070] transition-colors ml-1"
          >
            {t("register_login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
