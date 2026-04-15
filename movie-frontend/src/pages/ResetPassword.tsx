import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.patch("/auth/reset-password", {
        token,
        newPassword,
      });
      setStatus({ type: "success", message: response.data.message });
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.response?.data?.message || "Error resetting password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#12100e] text-red-500 font-bold uppercase">
        Invalid token
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#12100e] px-4 sm:px-6">
      <div className="w-full max-w-md p-6 sm:p-10 space-y-8 bg-[#1a1714] rounded-3xl shadow-2xl border border-[#c8963c]/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            Create New Password
          </h2>
        </div>

        {status.message && (
          <div
            className={`p-4 text-xs font-bold rounded-xl text-center uppercase tracking-wider ${
              status.type === "success"
                ? "text-green-500 bg-green-900/10 border border-green-500/20"
                : "text-red-500 bg-red-900/10 border border-red-500/20"
            }`}
          >
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3.5 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c]"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3.5 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || status.type === "success"}
            className="w-full py-4 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Save New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
