import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Відправляємо запит на реєстрацію з трьома полями
      await api.post("/auth/signup", { username, email, password });

      // Якщо все ок - перекидаємо на сторінку входу
      navigate("/login");
    } catch (err: any) {
      // Якщо бекенд повернув помилку (наприклад, такий email вже є)
      setError(
        err.response?.data?.message || "Помилка реєстрації. Спробуй ще раз!",
      );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-2xl shadow-xl">
        <h2 className="text-3xl font-bold text-center text-white">
          Створити акаунт
        </h2>

        {error && (
          <div className="p-3 text-sm text-red-200 bg-red-900/50 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="ViktorMak17"
              minLength={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="test@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 font-semibold text-white transition bg-green-600 rounded-lg hover:bg-green-700 active:scale-95"
          >
            Зареєструватися
          </button>
        </form>

        {/* Посилання для переходу на логін, якщо акаунт вже є */}
        <p className="text-sm text-center text-gray-400">
          Вже маєте акаунт?{" "}
          <Link to="/login" className="text-green-400 hover:underline">
            Увійти
          </Link>
        </p>
      </div>
    </div>
  );
}
