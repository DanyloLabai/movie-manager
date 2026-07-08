import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import * as authApi from "../api/auth.api";
import { useLang } from "../context/LanguageContext";

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

  return (
    <div className="min-h-screen bg-[#12100e] text-[#f0e6cc] flex flex-col items-center justify-center p-4 selection:bg-[#c8963c] selection:text-[#12100e]">
      {status === "loading" && (
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#1a1714] border-t-[#c8963c] mb-4 shadow-[0_0_15px_rgba(200,150,60,0.2)]"></div>
      )}

      {status === "success" && (
        <div className="bg-[#1a1714] border border-[#c8963c]/30 p-8 sm:p-10 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden animate-modal-in">
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
          <h2 className="text-2xl sm:text-3xl font-black text-[#c8963c] mb-4 uppercase tracking-widest drop-shadow-md">
            {t("verify_success")}
          </h2>
          <p className="text-[#f0e6cc]/60 text-sm font-medium tracking-wide mb-8">
            {t("verify_message")}
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full py-4 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] shadow-lg shadow-[#c8963c]/10"
          >
            Log In
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="bg-[#1a1714] border border-red-900/50 p-8 sm:p-10 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden animate-modal-in">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-900" />
          <div className="w-20 h-20 bg-[#12100e] border border-red-900/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-red-500 mb-4 uppercase tracking-widest drop-shadow-md">
            {t("verify_error")}
          </h2>
          <p className="text-[#f0e6cc]/60 text-sm font-medium tracking-wide">
            {t("verify_error_msg")}
          </p>
        </div>
      )}
    </div>
  );
}
