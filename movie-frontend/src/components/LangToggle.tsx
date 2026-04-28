import { useLang } from "../context/LanguageContext";

export default function LangToggle() {
  const { lang, toggleLang } = useLang();

  return (
    <button
      onClick={toggleLang}
      title={lang === "en" ? "Switch to Ukrainian" : "Перемкнути на англійську"}
      className="flex items-center gap-1.5 text-[9px] sm:text-[10px] px-2 py-1 sm:px-2.5 sm:py-1.5 border border-[#c8963c]/30 text-[#c8963c]/70 rounded-lg hover:border-[#c8963c] hover:text-[#c8963c] hover:bg-[#c8963c]/10 transition font-black uppercase tracking-widest whitespace-nowrap shrink-0 active:scale-95"
    >
      <svg
        className="w-3 h-3 sm:w-3.5 sm:h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="pt-[1px]">{lang === "en" ? "EN" : "UA"}</span>
    </button>
  );
}
