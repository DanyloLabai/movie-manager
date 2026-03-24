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
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Oops, something went wrong with my AI brain... Please try again later.",
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
      showToast(`✅ "${movie.title}" successfully added!`);
    } catch (error: any) {
      if (error.response?.status === 400) {
        showToast("This movie is already in your list.");
      } else {
        showToast("Error adding movie.");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans relative">
      <header className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent ml-4">
          Movie Tracker 🎬
        </h1>
        <nav className="flex gap-6 items-center mr-4">
          <Link
            to="/ai-chat"
            className="text-purple-400 font-bold border-b-2 border-purple-400 transition-colors"
          >
            AI Chat
          </Link>
          <Link
            to="/search"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Search
          </Link>
          <Link
            to="/watchlist"
            className="text-gray-400 hover:text-white transition-colors"
          >
            My List
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition"
          >
            Logout
          </button>
        </nav>
      </header>

      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-lg ${msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-gray-800 border border-gray-700 rounded-tl-none"}`}
              >
                <p className="leading-relaxed text-sm md:text-base">
                  {msg.text}
                </p>
                {msg.movie && (
                  <div className="mt-4 p-3 bg-gray-900/40 rounded-xl border border-purple-500/30 flex gap-4 animate-in zoom-in duration-500">
                    <Link
                      to={`/movie/${msg.movie.id}`}
                      className="flex-shrink-0"
                    >
                      <img
                        src={msg.movie.posterUrl || ""}
                        className="w-20 h-28 object-cover rounded-lg shadow-md border border-gray-700 hover:opacity-80 transition-opacity"
                        alt="poster"
                      />
                    </Link>

                    <div className="flex flex-col justify-between py-1">
                      <div>
                        <Link to={`/movie/${msg.movie.id}`}>
                          <h4 className="font-bold text-white leading-tight hover:text-purple-400 transition-colors">
                            {msg.movie.title}
                          </h4>
                        </Link>
                        <p className="text-xs text-gray-400 mt-1">
                          {msg.movie.releaseYear} • ⭐{" "}
                          {msg.movie.rating.toFixed(1)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddFromChat(msg.movie!)}
                        className="text-xs bg-purple-600 px-4 py-2 rounded-lg font-bold hover:bg-purple-500 transition-colors active:scale-95 shadow-lg w-fit"
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

      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative">
          <input
            type="text"
            value={input}
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isLoading ? "AI is analyzing..." : "Describe a movie..."
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
      </div>

      {toastMessage && (
        <div className="fixed bottom-10 right-10 bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
