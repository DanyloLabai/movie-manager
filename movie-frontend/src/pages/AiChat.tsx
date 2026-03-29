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
      text: "Hi! I'm your movie expert. Describe the movie you're looking for, or just tell me about your mood.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
            text: `I think it's "${response.data.title}". Here is what I found:`,
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
              "Unfortunately, I couldn't recognize this movie.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Oops, something went wrong. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFromChat = async (movie: MovieResult) => {
    try {
      await api.post("/movies/watchlist", {
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
      });
      showToast(`✅ "${movie.title}" added!`);
    } catch (error: any) {
      showToast(
        error.response?.status === 400
          ? "Already in list."
          : "Error adding movie.",
      );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans relative">
      <header className="flex flex-col sm:flex-row items-center justify-between p-4 gap-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Movie Tracker 🎬
        </h1>
        <nav className="flex flex-wrap justify-center gap-3 sm:gap-6 items-center">
          <Link
            to="/ai-chat"
            className="text-purple-400 font-bold border-b-2 border-purple-400 transition-all text-sm sm:text-base px-1"
          >
            AI Chat
          </Link>
          <Link
            to="/search"
            className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base px-1"
          >
            Search
          </Link>
          <Link
            to="/watchlist"
            className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base px-1"
          >
            My List
          </Link>
          <button
            onClick={handleLogout}
            className="text-[10px] sm:text-xs px-3 py-1.5 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold"
          >
            Logout
          </button>
        </nav>
      </header>

      <div className="flex-grow overflow-y-auto p-3 sm:p-6 space-y-6 scrollbar-hide">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[80%] p-4 rounded-2xl shadow-lg ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none shadow-blue-900/20"
                    : "bg-gray-800 border border-gray-700 rounded-tl-none shadow-black/40"
                }`}
              >
                <p className="leading-relaxed text-sm sm:text-base">
                  {msg.text}
                </p>
                {msg.movie && (
                  <div className="mt-4 p-2 sm:p-3 bg-gray-900/50 rounded-xl border border-purple-500/30 flex gap-3 sm:gap-4 animate-in zoom-in duration-500 overflow-hidden">
                    <Link
                      to={`/movie/${msg.movie.id}`}
                      className="flex-shrink-0"
                    >
                      <img
                        src={msg.movie.posterUrl || ""}
                        className="w-16 h-24 sm:w-20 sm:h-28 object-cover rounded-lg shadow-md border border-gray-700"
                        alt="poster"
                      />
                    </Link>

                    <div className="flex flex-col justify-between py-0.5 min-w-0">
                      <div className="min-w-0">
                        <Link to={`/movie/${msg.movie.id}`}>
                          <h4 className="font-bold text-white text-sm sm:text-base truncate hover:text-purple-400 transition-colors">
                            {msg.movie.title}
                          </h4>
                        </Link>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1 uppercase font-semibold">
                          {msg.movie.releaseYear} • ⭐{" "}
                          {msg.movie.rating.toFixed(1)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddFromChat(msg.movie!)}
                        className="text-[10px] sm:text-xs bg-purple-600 px-3 py-2 rounded-lg font-bold hover:bg-purple-500 transition-all active:scale-95 shadow-lg w-fit mt-2 uppercase tracking-wider"
                      >
                        + ADD
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl rounded-tl-none">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-3 sm:p-4 bg-gray-900 border-t border-gray-800 sticky bottom-0">
        <form
          onSubmit={handleSend}
          className="max-w-3xl mx-auto relative flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isLoading ? "Thinking..." : "Describe a movie..."}
            className="w-full pl-5 pr-14 py-3 sm:py-4 bg-gray-800 border border-gray-700 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 shadow-2xl transition-all disabled:opacity-50 text-sm sm:text-base"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-1.5 sm:right-2 top-1.5 bottom-1.5 px-4 sm:px-6 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-all active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 text-lg"
          >
            {isLoading ? "..." : "→"}
          </button>
        </form>
      </div>

      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-10 sm:bottom-10 bg-gray-800 border border-gray-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center justify-center sm:justify-start gap-3 animate-in slide-in-from-bottom-5 z-50">
          <span className="font-bold text-xs sm:text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
