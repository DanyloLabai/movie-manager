import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const token = searchParams.get("token");
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      api.get(`/auth/verify-email?token=${token}`)
        .then(() => setStatus("success"))
        .catch(() => setStatus("error"));
    } else {
      setStatus("error");
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      {status === "loading" && (
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500 mb-4"></div>
      )}
      
      {status === "success" && (
        <div className="bg-green-500/10 border border-green-500 p-8 rounded-3xl max-w-sm text-center">
          <h2 className="text-2xl font-bold text-green-400 mb-4">Success!</h2>
          <p className="text-gray-300 mb-6">Your email has been verified. You can now log in.</p>
          <button 
            onClick={() => navigate("/login")} 
            className="w-full py-3 bg-green-600 hover:bg-green-700 transition-colors rounded-xl font-bold"
          >
            Log In
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-500/10 border border-red-500 p-8 rounded-3xl max-w-sm text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <p className="text-gray-300">The link is invalid or has expired.</p>
        </div>
      )}
    </div>
  );
}