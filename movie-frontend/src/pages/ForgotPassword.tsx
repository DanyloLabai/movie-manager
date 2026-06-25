import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLang } from "../context/LanguageContext";

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
      const response = await api.post("/auth/forgot-password", { email });
      setStatus({ type: "success", message: response.data.message });
    } catch (err: any) {
      setStatus({ type: "error", message: t("password_reset_error") });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#12100e] px-4 sm:px-6">
      <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-[#1a1714] rounded-3xl shadow-2xl border border-[#c8963c]/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            {t("password_reset_title")}
          </h2>
          <p className="mt-3 text-sm text-[#f0e6cc]/60 font-medium">
            {t("password_reset_subtitle")}
          </p>
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
              {t("login_email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 shadow-lg"
          >
            {isLoading ? t("password_reset_sending") : t("password_reset_send")}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-[#c8963c]/20">
          <Link
            to="/login"
            className="text-xs font-bold text-[#f0e6cc]/40 hover:text-[#c8963c] transition uppercase underline underline-offset-4"
          >
            {t("password_reset_back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
