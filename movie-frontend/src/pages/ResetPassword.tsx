import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import * as authApi from "../api/auth.api";
import { useLang } from "../context/LanguageContext";
import AuthLayout from "../components/auth/AuthLayout";
import { AuthPasswordField } from "../components/auth/AuthPasswordField";

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

export default function ResetPassword() {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      const response = await authApi.resetPassword({ token, newPassword });
      setStatus({
        type: "success",
        message: response.message || response.data?.message || "",
      });
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setStatus({
        type: "error",
        message:
          apiError.response?.data?.message || "Error resetting password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0f0d0a] px-6 text-center font-ui">
        <p className="text-red-500 font-bold uppercase tracking-widest text-sm">
          {t("password_new_invalid")}
        </p>
      </div>
    );
  }

  return (
    <AuthLayout
      title={t("password_new")}
      subtitle={t("password_new_subtitle")}
      subtitleMono={false}
      icon={<LockIcon />}
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
        <AuthPasswordField
          label={t("password_new")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t("password_min")}
          required
          minLength={8}
        />

        <AuthPasswordField
          label={t("password_confirm")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t("password_min")}
          required
        />

        <button
          type="submit"
          disabled={isLoading || status.type === "success"}
          className="mt-1 w-full py-3.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] active:scale-[0.98] disabled:opacity-50 transition text-[12.5px] font-bold tracking-[2.5px] text-[#14110c] uppercase"
        >
          {isLoading ? t("password_new_saving") : t("password_new_save")}
        </button>
      </form>
    </AuthLayout>
  );
}
