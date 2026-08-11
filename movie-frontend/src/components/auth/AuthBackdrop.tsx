import { useEffect, useState } from "react";
import * as moviesApi from "../../api/movies.api";

function pickRandom<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (pool.length && out.length < n) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export default function AuthBackdrop() {
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    moviesApi
      .getUpcoming()
      .then((movies) => {
        if (cancelled) return;
        const posters = movies
          .map((m) => m.posterUrl)
          .filter((url): url is string => !!url);
        setImages(pickRandom(posters, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0f0d0a]">
      <div
        className="absolute inset-0 flex"
        style={{ filter: "blur(3px) saturate(.7)", opacity: 0.3 }}
      >
        {images.length > 0 ? (
          images.map((src, i) => (
            <div
              key={i}
              className="flex-1 bg-cover bg-center scale-110"
              style={{ backgroundImage: `url(${src})` }}
            />
          ))
        ) : (
          <div className="flex-1 bg-[radial-gradient(120%_100%_at_50%_0%,#3a2f1a_0%,#201c15_55%,#0f0d0a_100%)]" />
        )}
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, rgba(15,13,10,.55) 0%, #0f0d0a 78%)",
        }}
      />
    </div>
  );
}
