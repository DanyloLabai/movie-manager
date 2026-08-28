import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useAuthPrompt } from "../context/AuthPromptContext";

export default function AuthRequiredModal() {
  const { isOpen, close } = useAuthPrompt();
  const { t } = useLang();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const goTo = (path: string) => {
    close();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={close}
    >
      <div
        className="w-full max-w-sm p-6 bg-[#0f0d0a] border border-[#d9ac54]/30 rounded-3xl shadow-2xl relative animate-modal-in font-ui text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 text-[#8f8574] hover:text-[#d9ac54] transition p-1"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-sm font-bold text-[#f2ead9] uppercase tracking-widest mb-2 pr-6">
          {t("auth_required_title")}
        </h2>
        <p className="text-[13px] text-[#8f8574] mb-6">
          {t("auth_required_message")}
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => goTo("/login")}
            className="w-full py-2.5 rounded-xl font-ui font-semibold text-[12px] uppercase tracking-widest text-[#14110c] transition hover:opacity-90"
            style={{ background: "linear-gradient(90deg, #a87c2e, #d9ac54)" }}
          >
            {t("auth_required_login")}
          </button>
          <button
            onClick={() => goTo("/register")}
            className="w-full py-2.5 rounded-xl font-ui font-semibold text-[12px] uppercase tracking-widest text-[#d9ac54] border border-[#d9ac54]/40 hover:bg-white/[.03] transition"
          >
            {t("auth_required_register")}
          </button>
        </div>
      </div>
    </div>
  );
}
