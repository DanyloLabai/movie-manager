import { useLang } from "../context/LanguageContext";

export default function LangToggle() {
  const { lang, toggleLang } = useLang();

  return (
    <button
      onClick={toggleLang}
      title={lang === "en" ? "Switch to Ukrainian" : "Перемкнути на англійську"}
      className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 border border-[#c8963c]/30 
                 text-[#c8963c]/70 rounded-lg hover:border-[#c8963c] hover:text-[#c8963c] 
                 transition font-bold uppercase tracking-wide whitespace-nowrap flex-shrink-0"
    >
      <span className="text-sm leading-none">{lang === "en" ? "🇺🇦" : "🇬🇧"}</span>
      {lang === "en" ? "UA" : "EN"}
    </button>
  );
}
