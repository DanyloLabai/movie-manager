import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";

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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [actor, setActor] = useState<ActorDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      fetchActorData(Number(id));
    }
  }, [id]);

  const fetchActorData = async (personId: number) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/movies/actor/${personId}`);
      setActor(res.data);
    } catch (error) {
      console.error("Failed to fetch actor:", error);
      setActor(null);
    } finally {
      setIsLoading(false);
    }
  };

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

  if (isLoading)
    return (
      <div className="min-h-screen bg-[#12100e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c8963c] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  if (!actor)
    return (
      <div className="min-h-screen bg-[#12100e] text-[#f0e6cc] flex flex-col items-center justify-center gap-4">
        <p>Actor not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="text-[#c8963c] font-bold hover:underline"
        >
          &larr; Go Back
        </button>
      </div>
    );

  const bioParagraphs = actor.biography
    ? actor.biography.split("\n\n").filter((p) => p.trim() !== "")
    : [];

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative pb-24 selection:bg-[#c8963c] selection:text-[#12100e]">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-[#c8963c]/20 bg-[#12100e]/90 backdrop-blur-md sticky top-0 z-40 shadow-lg shadow-[#c8963c]/5">
        <Link
          to="/search"
          className="text-lg sm:text-xl font-black text-[#c8963c] uppercase tracking-tighter drop-shadow-md"
        >
          Movie Tracker
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
          Back
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-6">
            <div className="relative group w-2/3 md:w-full mx-auto md:mx-0">
              <div className="absolute -inset-1 bg-gradient-to-b from-[#c8963c]/20 to-[#9a732a]/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
              <div className="relative aspect-[2/3] rounded-[2rem] overflow-hidden bg-[#1a1714] border border-[#c8963c]/30 shadow-2xl">
                {actor.profileUrl ? (
                  <img
                    src={actor.profileUrl}
                    alt={actor.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#f0e6cc]/20">
                    <svg
                      className="w-16 h-16 mb-2"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#1a1714] border border-[#c8963c]/20 p-6 rounded-[2rem] shadow-xl backdrop-blur-md">
              <h3 className="text-xs font-black text-[#c8963c] uppercase tracking-widest mb-4">
                Personal Info
              </h3>
              <div className="space-y-4">
                {actor.birthday && (
                  <div>
                    <p className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-1">
                      Born
                    </p>
                    <p className="text-sm font-medium text-[#f0e6cc]">
                      {actor.birthday}
                    </p>
                  </div>
                )}
                {actor.placeOfBirth && (
                  <div>
                    <p className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-1">
                      Place of Birth
                    </p>
                    <p className="text-sm font-medium text-[#f0e6cc]">
                      {actor.placeOfBirth}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-8 lg:col-span-9 flex flex-col">
            <h1 className="text-4xl sm:text-5xl font-black text-[#f0e6cc] mb-6 tracking-tighter text-center md:text-left">
              {actor.name}
            </h1>

            {bioParagraphs.length > 0 ? (
              <div className="mb-10 text-[#f0e6cc]/80 text-sm sm:text-base leading-relaxed font-medium space-y-4">
                <p>{bioParagraphs[0]}</p>

                {isBioExpanded &&
                  bioParagraphs.slice(1).map((p, i) => (
                    <p key={i} className="animate-fade-in">
                      {p}
                    </p>
                  ))}

                {bioParagraphs.length > 1 && (
                  <button
                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                    className="text-[#c8963c] text-xs font-black uppercase tracking-widest mt-2 hover:underline"
                  >
                    {isBioExpanded ? "Read Less" : "Read More..."}
                  </button>
                )}
              </div>
            ) : (
              <p className="mb-10 text-[#f0e6cc]/50 italic">
                We don't have a biography for {actor.name}.
              </p>
            )}

            {actor.knownFor && actor.knownFor.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4 flex-grow">
                    <h3 className="text-lg sm:text-xl font-black text-[#f0e6cc] uppercase tracking-widest italic">
                      Known For
                    </h3>
                    <div className="h-[1px] flex-grow bg-gradient-to-r from-[#c8963c]/30 to-transparent" />
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => scrollSlider("left")}
                      className="w-8 h-8 rounded-full bg-[#1a1714] border border-[#c8963c]/30 text-[#c8963c] flex items-center justify-center hover:bg-[#c8963c]/10 active:scale-95 transition-all"
                    >
                      &larr;
                    </button>
                    <button
                      onClick={() => scrollSlider("right")}
                      className="w-8 h-8 rounded-full bg-[#1a1714] border border-[#c8963c]/30 text-[#c8963c] flex items-center justify-center hover:bg-[#c8963c]/10 active:scale-95 transition-all"
                    >
                      &rarr;
                    </button>
                  </div>
                </div>

                <div
                  ref={sliderRef}
                  className="flex gap-4 overflow-x-auto scrollbar-hide snap-x pb-8"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {actor.knownFor.map((m) => (
                    <Link
                      key={m.id}
                      to={`/movie/${m.id}?type=${m.mediaType}`}
                      className="group flex-shrink-0 w-36 sm:w-44 snap-start block"
                    >
                      <div className="aspect-[2/3] rounded-2xl sm:rounded-[2rem] overflow-hidden bg-[#1a1714] border border-[#c8963c]/20 mb-3 group-hover:border-[#c8963c]/70 group-hover:-translate-y-1 shadow-lg transition-all duration-300">
                        {m.posterUrl ? (
                          <img
                            src={m.posterUrl}
                            alt={m.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] text-[#f0e6cc]/30 font-bold uppercase tracking-widest text-center px-2">
                            {m.title}
                          </div>
                        )}
                      </div>
                      <div className="px-1">
                        <h4 className="text-[11px] sm:text-xs font-bold text-[#f0e6cc] truncate group-hover:text-[#c8963c] transition-colors uppercase tracking-tight">
                          {m.title}
                        </h4>
                        <div className="flex justify-between items-center mt-1">
                          <p
                            className="text-[9px] text-[#c8963c]/70 truncate max-w-[70%]"
                            title={m.character}
                          >
                            {m.character || "N/A"}
                          </p>
                          <p className="text-[8px] sm:text-[9px] text-[#f0e6cc]/40 font-black uppercase tracking-widest">
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
      </div>
    </div>
  );
}
