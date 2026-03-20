import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api"; // Підтягуємо наш налаштований axios

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate(); // Хук для перемикання сторінок

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Зупиняємо стандартне перезавантаження сторінки
    setError("");

    try {
      // 1. Відправляємо запит на твій бекенд
      const response = await api.post("/auth/signin", { email, password });

      // 2. Якщо успішно - зберігаємо токен у LocalStorage браузера
      localStorage.setItem("token", response.data.accessToken);

      // 3. Перекидаємо користувача на сторінку Watchlist
      navigate("/watchlist");
    } catch (err) {
      setError("Неправильний email або пароль. Спробуй ще раз!");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-2xl shadow-xl">
        <h2 className="text-3xl font-bold text-center text-white">
          Вхід у Movie Tracker
        </h2>

        {/* Показуємо помилку, якщо вона є */}
        {error && (
          <div className="p-3 text-sm text-red-200 bg-red-900/50 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 font-semibold text-white transition bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95"
          >
            Увійти
          </button>
        </form>
        <p className="text-sm text-center text-gray-400">
          Ще не зареєстровані?{" "}
          <Link to="/register" className="text-blue-400 hover:underline">
            Створити акаунт
          </Link>
        </p>
      </div>
    </div>
  );
}
