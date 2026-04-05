import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { api } from "../api";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!captchaToken) {
      setError("Please confirm that you are not a robot.");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/signup", {
        username,
        email,
        password,
        captchaToken,
      });
      navigate("/login");
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Registration error. Please try again!",
      );
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4 py-8 sm:px-6">
      <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-gray-800 rounded-3xl shadow-2xl border border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Join Us
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Create your movie tracking profile
          </p>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-200 bg-red-900/40 border border-red-500/50 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              placeholder="YourName"
              minLength={3}
              maxLength={20}
              required
              pattern="^[a-zA-Z0-9_]+$"
              title="Username can only contain English letters, numbers and underscores."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              placeholder="name@example.com"
              maxLength={50}
              required
              pattern="^[a-zA-Z0-9._%\+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
              title="Please enter a valid email."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              placeholder="••••••••"
              minLength={8}
              maxLength={32}
              required
              title="Password must be at least 8 characters."
            />
          </div>

          <div className="flex justify-center py-2 overflow-hidden">
            <div className="scale-[0.85] sm:scale-100 origin-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                theme="dark"
                onChange={(token) => setCaptchaToken(token)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !captchaToken}
            className="w-full py-4 font-bold text-white transition bg-green-600 rounded-xl hover:bg-green-500 active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 shadow-lg shadow-green-900/20"
          >
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-400 pt-2">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-green-400 font-bold hover:text-green-300 transition-colors"
          >
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
