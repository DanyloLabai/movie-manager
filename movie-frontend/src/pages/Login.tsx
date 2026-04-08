import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await api.post("/auth/signin", { email, password });
      localStorage.removeItem(
        import.meta.env.VITE_PROFILE_CACHE_KEY || "movie_tracker_profile_cache",
      );
      localStorage.removeItem("custom_username");
      localStorage.removeItem("custom_avatarUrl");
      localStorage.removeItem("movie_tracker_favorites_cache");
      localStorage.removeItem("movie_tracker_chat_history");
      localStorage.removeItem("trending_cache");
      localStorage.removeItem("recommendations_cache");

      localStorage.setItem("token", response.data.accessToken);
      navigate("/watchlist");
    } catch (err) {
      setError("Invalid email or password. Please try again!");
    } finally {
      setIsLoading(false);
    }
  };

  const EyeIcon = ({ isOpen }: { isOpen: boolean }) => {
    return isOpen ? (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ) : (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4 sm:px-6">
      <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-gray-800 rounded-3xl shadow-2xl border border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Log in to your Movie Tracker account
          </p>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-200 bg-red-900/40 border border-red-500/50 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="name@example.com"
              required
              pattern="^[a-zA-Z0-9._%\+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
              title="Please enter your email using only English characters."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 text-white bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
                required
                title="Please enter your password."
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-white transition-colors focus:outline-none"
                tabIndex={-1}
              >
                <EyeIcon isOpen={showPassword} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 font-bold text-white transition bg-blue-600 rounded-xl hover:bg-blue-500 active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 shadow-lg shadow-blue-900/20"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center">
          <Link
            to="/change-password"
            className="text-sm text-gray-400 hover:text-blue-400 transition-colors underline underline-offset-4"
          >
            Forgot or want to change password?
          </Link>
        </div>

        <p className="text-sm text-center text-gray-400 pt-2 border-t border-gray-700/50">
          New here?{" "}
          <Link
            to="/register"
            className="text-blue-400 font-bold hover:text-blue-300 transition-colors"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
