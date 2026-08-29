import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { submitFeedback, getMyFeedbackStatus } from "../api/feedback.api";
import { STORAGE_KEYS } from "../constants/storage";

const SHOW_AFTER_MS = 90_000;
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

interface FeedbackPromptState {
  submitted?: boolean;
  lastDismissedAt?: number;
}

function readState(): FeedbackPromptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FEEDBACK_PROMPT);
    return raw ? (JSON.parse(raw) as FeedbackPromptState) : {};
  } catch {
    return {};
  }
}

function writeState(state: FeedbackPromptState) {
  try {
    localStorage.setItem(STORAGE_KEYS.FEEDBACK_PROMPT, JSON.stringify(state));
  } catch {
    // localStorage unavailable- nothing we can do
  }
}

export default function FeedbackPrompt() {
  const { isAuthenticated } = useAuth();
  const { t } = useLang();
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const state = readState();
    if (state.submitted) return;
    if (
      state.lastDismissedAt &&
      Date.now() - state.lastDismissedAt < SNOOZE_MS
    ) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    // Local storage alone isn't reliable across devices/browsers or after
    // clearing site data, so confirm with the server before arming the
    // timer- a user who already submitted from anywhere should never see
    // this again.
    getMyFeedbackStatus()
      .then(({ hasSubmitted }) => {
        if (cancelled) return;
        if (hasSubmitted) {
          writeState({ ...readState(), submitted: true });
          return;
        }
        timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      })
      .catch(() => {
        if (!cancelled) {
          timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
        }
      });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [isAuthenticated]);

  const dismiss = () => {
    writeState({ ...readState(), lastDismissedAt: Date.now() });
    setVisible(false);
  };

  const submit = async () => {
    if (rating === 0 || status === "sending") return;
    setStatus("sending");
    try {
      await submitFeedback({ rating, message: message.trim() || undefined });
      writeState({ submitted: true });
      setStatus("sent");
      window.setTimeout(() => setVisible(false), 2500);
    } catch {
      setStatus("error");
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in sm:inset-auto sm:bottom-4 sm:right-4 sm:block sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm p-5 bg-[#0f0d0a] border border-[#d9ac54]/30 rounded-3xl shadow-2xl relative font-ui"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-[#8f8574] hover:text-[#d9ac54] transition p-1"
          aria-label="close"
        >
          <svg
            className="w-4 h-4"
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

        {status === "sent" ? (
          <p className="text-[13px] text-[#d9ac54] font-semibold pr-6">
            {t("feedback_thanks")}
          </p>
        ) : (
          <>
            <h2 className="text-sm font-bold text-[#f2ead9] uppercase tracking-widest mb-1 pr-6">
              {t("feedback_title")}
            </h2>
            <p className="text-[12px] text-[#8f8574] mb-3">
              {t("feedback_subtitle")}
            </p>

            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-2xl leading-none transition"
                  style={{
                    color:
                      star <= (hoverRating || rating) ? "#d9ac54" : "#3a352c",
                  }}
                  aria-label={`${star} star`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("feedback_placeholder")}
              maxLength={1000}
              rows={2}
              className="w-full mb-3 px-3 py-2 bg-black/30 border border-[#d9ac54]/20 rounded-xl text-[13px] text-[#f0e6cc] placeholder-[#6b6455] focus:outline-none focus:border-[#d9ac54]/50 resize-none"
            />

            {status === "error" && (
              <p className="text-[12px] text-red-400 mb-2">
                {t("feedback_error")}
              </p>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={submit}
                disabled={rating === 0 || status === "sending"}
                className="flex-1 py-2.5 rounded-xl font-ui font-semibold text-[12px] uppercase tracking-widest text-[#14110c] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(90deg, #a87c2e, #d9ac54)" }}
              >
                {status === "sending"
                  ? t("feedback_sending")
                  : t("feedback_submit")}
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2.5 rounded-xl font-ui font-semibold text-[12px] uppercase tracking-widest text-[#8f8574] hover:text-[#d9ac54] transition"
              >
                {t("feedback_skip")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
