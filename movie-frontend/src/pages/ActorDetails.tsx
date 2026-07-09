import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import * as moviesApi from "../api/movies.api";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";

interface KnownFor {
  id: number;
  title: string;
  posterUrl: string | null;
  mediaType: "movie" | "tv";
  releaseYear: string;
  character: string;
}

interface ActorDetailsData {
  id: number;
  name: string;
  biography: string;
  profileUrl: string | null;
  birthday: string | null;
  placeOfBirth: string | null;
  knownFor: KnownFor[];
}

export default function ActorDetails() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [actor, setActor] = useState<ActorDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    (async () => {
      try {
        setIsLoading(true);
        const res = await moviesApi.getActor(Number(id));
        if (isActorDetailsData(res)) setActor(res);
        else setActor(null);
      } catch (error) {
        console.error("Failed to fetch actor:", error);
        setActor(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  function isActorDetailsData(obj: unknown): obj is ActorDetailsData {
    if (!obj || typeof obj !== "object") return false;
    const maybe = obj as Record<string, unknown>;
    return (
      typeof maybe.id === "number" &&
      typeof maybe.name === "string" &&
      typeof maybe.biography === "string" &&
      (maybe.profileUrl === null || typeof maybe.profileUrl === "string")
    );
  }

  const scrollSlider = (direction: "left" | "right") => {
    if (sliderRef.current) {
      const { scrollLeft, clientWidth } = sliderRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth / 1.5
          : scrollLeft + clientWidth / 1.5;
      sliderRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#12100e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c8963c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!actor) {
    return (
      <div className="min-h-screen bg-[#12100e] text-[#f0e6cc] flex flex-col items-center justify-center gap-4">
        <p className="text-base">{t("actor_not_found")}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-[#c8963c] font-bold hover:underline text-sm"
        >
          {t("common_go_back")}
        </button>
      </div>
    );
  }

  const bioParagraphs = actor.biography
    ? actor.biography.split("\n\n").filter((p) => p.trim() !== "")
    : [];

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] pb-10 selection:bg-[#c8963c] selection:text-[#12100e]">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#c8963c]/20 bg-[#12100e]/90 backdrop-blur-md sticky top-0 z-40 shadow-lg shadow-[#c8963c]/5 pt-[env(safe-area-inset-top,12px)]">
        <Link
          to="/search"
          className="flex items-center gap-3 sm:gap-4 hover:opacity-80 transition-opacity shrink-0"
        >
          <img
            src={LogoImg}
            alt="LUMEN™ Logo"
            className="h-10 sm:h-12 w-auto object-contain"
          />

          <div className="flex flex-col justify-center">
            <h1 className="text-2xl sm:text-3xl font-black text-[#c8963c] tracking-widest uppercase leading-none">
              LUMEN
            </h1>
            <span className="text-[7px] sm:text-[8px] text-[#f0e6cc]/70 font-medium uppercase leading-none whitespace-nowrap tracking-[0.5em] sm:tracking-[0.6em] mt-1 block text-justify w-full">
              {t("app_tagline")}
            </span>
          </div>
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-black uppercase text-[#f0e6cc]/50 hover:text-[#c8963c] transition active:scale-95"
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
              strokeWidth={2.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("common_back")}
        </button>
      </header>

      <div className="px-4 sm:px-6 pt-6 max-w-3xl mx-auto">
        <div className="flex gap-4 sm:gap-6 mb-6">
          {/* Avatar */}
          <div className="w-28 sm:w-36 shrink-0">
            <div className="relative group">
              <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-[#1a1714] border border-[#c8963c]/30 shadow-xl">
                {actor.profileUrl ? (
                  <img
                    src={actor.profileUrl}
                    alt={actor.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#f0e6cc]/20">
                    <svg
                      className="w-10 h-10"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {(actor.birthday || actor.placeOfBirth) && (
              <div className="mt-3 bg-[#1a1714] border border-[#c8963c]/20 p-2.5 rounded-xl space-y-2">
                {actor.birthday && (
                  <div>
                    <p className="text-[8px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-0.5">
                      {t("actor_born")}
                    </p>
                    <p className="text-[10px] font-medium text-[#f0e6cc]">
                      {actor.birthday}
                    </p>
                  </div>
                )}
                {actor.placeOfBirth && (
                  <div>
                    <p className="text-[8px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-0.5">
                      {t("actor_from")}
                    </p>
                    <p className="text-[10px] font-medium text-[#f0e6cc]">
                      {actor.placeOfBirth}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black text-[#f0e6cc] tracking-tighter mb-4">
              {actor.name}
            </h1>

            {bioParagraphs.length > 0 ? (
              <div className="text-[#f0e6cc]/75 text-xs sm:text-sm leading-relaxed font-medium space-y-3">
                <p>{bioParagraphs[0]}</p>
                {isBioExpanded &&
                  bioParagraphs.slice(1).map((p, i) => <p key={i}>{p}</p>)}
                {bioParagraphs.length > 1 && (
                  <button
                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                    className="text-[#c8963c] text-[10px] sm:text-xs font-black uppercase tracking-widest hover:underline mt-2 block"
                  >
                    {isBioExpanded ? t("actor_read_less") : t("actor_read_more")}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[#f0e6cc]/40 italic text-xs sm:text-sm">
                {t("actor_no_bio")}
              </p>
            )}
          </div>
        </div>

        {actor.knownFor && actor.knownFor.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 flex-grow">
                <h3 className="text-sm sm:text-base font-black text-[#f0e6cc] uppercase tracking-widest italic">
                  {t("actor_known_for")}
                </h3>
                <div className="h-[1px] flex-grow bg-gradient-to-r from-[#c8963c]/30 to-transparent" />
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => scrollSlider("left")}
                  className="w-8 h-8 rounded-full bg-[#1a1714] border border-[#c8963c]/30 text-[#c8963c] flex items-center justify-center hover:bg-[#c8963c]/10 active:scale-95 transition-all"
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
                      strokeWidth={2.5}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => scrollSlider("right")}
                  className="w-8 h-8 rounded-full bg-[#1a1714] border border-[#c8963c]/30 text-[#c8963c] flex items-center justify-center hover:bg-[#c8963c]/10 active:scale-95 transition-all"
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
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div
              ref={sliderRef}
              className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x pb-6"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {actor.knownFor.map((m) => (
                <Link
                  key={m.id}
                  to={`/movie/${m.id}?type=${m.mediaType}`}
                  className="group flex-shrink-0 w-32 sm:w-36 snap-start block"
                >
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-[#1a1714] border border-[#c8963c]/20 mb-2 group-hover:border-[#c8963c]/70 group-hover:-translate-y-1 shadow transition-all duration-300">
                    {m.posterUrl ? (
                      <img
                        src={m.posterUrl}
                        alt={m.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-[#f0e6cc]/30 font-bold uppercase px-2 text-center">
                        {m.title}
                      </div>
                    )}
                  </div>
                  <div className="px-1">
                    <h4 className="text-[11px] sm:text-xs font-bold text-[#f0e6cc] truncate group-hover:text-[#c8963c] transition uppercase tracking-tight">
                      {m.title}
                    </h4>
                    <div className="flex justify-between items-center mt-1">
                      <p
                        className="text-[9px] sm:text-[10px] text-[#c8963c]/70 truncate max-w-[70%]"
                        title={m.character}
                      >
                        {m.character || t("common_na")}
                      </p>
                      <p className="text-[8px] text-[#f0e6cc]/40 font-black uppercase tracking-widest">
                        {m.releaseYear}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
