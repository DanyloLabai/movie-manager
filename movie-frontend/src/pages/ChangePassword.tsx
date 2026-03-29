import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ChangePassword() {
  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await api.patch("/auth/change-password", {
        email,
        oldPassword,
        newPassword,
      });

      setSuccessMsg("Password changed successfully! Redirecting to login...");
      localStorage.removeItem("token");

      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error changing password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-900 px-4 overflow-hidden">
      {successMsg && (
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 bg-green-500/20 border border-green-500/50 rounded-2xl shadow-2xl backdrop-blur-sm transition-all duration-500 ease-out animate-bounce">
          <div className="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <p className="text-sm font-semibold text-green-400">{successMsg}</p>
        </div>
      )}

      <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-gray-800 rounded-3xl shadow-2xl border border-gray-700">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Security Settings
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Update your account password
          </p>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-200 bg-red-900/40 border border-red-500/50 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="border-t border-gray-700 my-2 pt-4">
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              placeholder="Re-enter new password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !!successMsg}
            className="w-full py-4 font-bold text-white transition bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-500 hover:to-purple-500 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <button
          onClick={() => navigate(-1)}
          className="w-full text-sm text-gray-500 hover:text-white transition"
          disabled={!!successMsg}
        >
          Cancel and go back
        </button>
      </div>
    </div>
  );
}
