import { useLang } from "../context/LanguageContext";

export default function LangToggle() {
  const { lang, toggleLang } = useLang();

  return (
    <button
      onClick={toggleLang}
      title={lang === "en" ? "Switch to Ukrainian" : "Перемкнути на англійську"}
      className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] px-1.5 py-1 sm:px-2.5 sm:py-1.5 border border-[#c8963c]/30 text-[#c8963c]/70 rounded-lg hover:border-[#c8963c] hover:text-[#c8963c] transition font-bold uppercase tracking-wide whitespace-nowrap shrink-0"
    >
      <span className="text-xs sm:text-sm leading-none">
        {lang === "en" ? "🇺🇦" : "🇬🇧"}
      </span>
      <span className="pt-[1px]">{lang === "en" ? "UA" : "EN"}</span>
    </button>
  );
}
