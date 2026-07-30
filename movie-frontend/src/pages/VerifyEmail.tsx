import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import * as authApi from "../api/auth.api";
import { useLang } from "../context/LanguageContext";
import AuthLayout from "../components/auth/AuthLayout";

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
  </svg>
);

const CrossIcon = () => (
  <svg className="w-5 h-5 text-[#e0554d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SpinnerIcon = () => (
  <div className="w-5 h-5 rounded-full border-2 border-[#d9ac54]/25 border-t-[#d9ac54] animate-spin" />
);

export default function VerifyEmail() {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const navigate = useNavigate();

  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!token) return;

    if (hasAttempted.current) return;
    hasAttempted.current = true;

    authApi
      .verifyEmailGet(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  const icon =
    status === "success" ? <CheckIcon /> : status === "error" ? <CrossIcon /> : <SpinnerIcon />;

  const title =
    status === "success" ? t("verify_success") : status === "error" ? t("verify_error") : "LUMEN";

  const subtitle =
    status === "success"
      ? t("verify_message")
      : status === "error"
        ? t("verify_error_msg")
        : t("verify_loading");

  return (
    <AuthLayout title={title} subtitle={subtitle} subtitleMono={false} icon={icon}>
      {status === "success" && (
        <button
          onClick={() => navigate("/login")}
          className="w-full py-3.5 rounded-full bg-[#d9ac54] hover:bg-[#e8c377] active:scale-[0.98] transition text-[12.5px] font-bold tracking-[2.5px] text-[#14110c] uppercase"
        >
          {t("register_login")}
        </button>
      )}
    </AuthLayout>
  );
}
