import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface MovieResult {
  id: number;
  title: string;
  description: string;
  releaseYear: string;
  rating: number;
  posterUrl: string | null;
}

interface Message {
  role: "user" | "ai";
  text: string;
  movie?: MovieResult;
}

export default function AiChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Привіт! Я твій кіно-експерт. Опиши фільм, який шукаєш, або просто розкажи про свій настрій.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Автопрокрутка до останнього повідомлення
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);

    setIsLoading(true);

    try {
      const response = await api.post("/ai/search", { prompt: userText });

      if (response.data && response.data.title) {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `Я гадаю, це фільм "${response.data.title}". Ось що я знайшов:`,
            movie: response.data,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text:
              response.data.message ||
              "На жаль, я не зміг впізнати цей фільм. Спробуй описати інакше!",
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Упс, сталася помилка з моїми мізками... Спробуй ще раз пізніше.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFromChat = async (movie: MovieResult) => {
    try {
      await api.post("movies/watchlist", {
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
      });
      alert(`✅ "${movie.title}" додано у список!`);
    } catch (error) {
      alert("Помилка додавання.");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      {/* МІНІ-ХЕДЕР */}
      <header className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
        <Link
          to="/search"
          className="text-gray-400 hover:text-white transition-colors"
        >
          ← Назад
        </Link>
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
          AI Assistant
        </h1>
        <div className="w-10"></div>
      </header>

      {/* ЧАТ-ЗОНА */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-lg ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-gray-800 border border-gray-700 rounded-tl-none"
                }`}
              >
                <p className="leading-relaxed text-sm md:text-base">
                  {msg.text}
                </p>

                {/* КАРТКА ФІЛЬМУ */}
                {msg.movie && (
                  <div className="mt-4 p-3 bg-gray-900/40 rounded-xl border border-purple-500/30 flex gap-4 animate-in zoom-in duration-500">
                    <img
                      src={msg.movie.posterUrl || ""}
                      className="w-20 h-28 object-cover rounded-lg shadow-md border border-gray-700"
                      alt="poster"
                    />
                    <div className="flex flex-col justify-between py-1">
                      <div>
                        <h4 className="font-bold text-white leading-tight">
                          {msg.movie.title}
                        </h4>
                        <p className="text-xs text-gray-400 mt-1">
                          {msg.movie.releaseYear} • ⭐{" "}
                          {msg.movie.rating.toFixed(1)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddFromChat(msg.movie!)}
                        className="text-xs bg-purple-600 px-4 py-2 rounded-lg font-bold hover:bg-purple-500 transition-colors active:scale-95 shadow-lg"
                      >
                        + ДОДАТИ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* ІНДИКАТОР ЗАВАНТАЖЕННЯ */}
          {isLoading && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl rounded-tl-none">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ПОЛЕ ВВОДУ */}
      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative">
          <input
            type="text"
            value={input}
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isLoading ? "ШІ аналізує запит..." : "Опишіть фільм..."
            }
            className="w-full pl-6 pr-16 py-4 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 shadow-2xl transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 bottom-2 px-6 bg-purple-600 text-white rounded-full font-bold hover:bg-purple-500 transition-all active:scale-95 disabled:bg-gray-700 disabled:text-gray-500"
          >
            {isLoading ? "..." : "→"}
          </button>
        </form>
        <p className="text-center text-[10px] text-gray-500 mt-2 italic">
          AI може помилятися, але він дуже старається.
        </p>
      </div>
    </div>
  );
}
