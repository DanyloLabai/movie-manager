import { useState, useRef } from "react";
import * as usersApi from "../api/users.api";
import { useLang } from "../context/LanguageContext";

interface EditProfileProps {
  currentUsername: string;
  currentAvatarUrl: string | null;
  onClose: () => void;
  onUpdate: (newUsername: string, newAvatarUrl: string) => void;
}

export default function EditProfile({
  currentUsername,
  currentAvatarUrl,
  onClose,
  onUpdate,
}: EditProfileProps) {
  const { t } = useLang();
  const [username, setUsername] = useState(currentUsername);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData();
    formData.append("username", username.trim());

    if (selectedFile) {
      formData.append("avatar", selectedFile);
    }

    try {
      const response = await usersApi.updateProfile(formData);

      onUpdate(response.username, response.avatarUrl);
      onClose();
    } catch (err: unknown) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status === 409) {
        setError(t("edit_username_taken"));
      } else {
        setError(t("edit_error"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md p-8 bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl relative animate-modal-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-400 hover:text-white transition p-1"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-white text-center mb-6">
          {t("edit_profile")}
        </h2>

        {error && (
          <div className="mb-4 p-3 text-sm text-red-200 bg-red-900/40 border border-red-500/50 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img
                  src={
                    previewUrl.startsWith("blob:")
                      ? previewUrl
                      : `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}t=${new Date().getTime()}`
                  }
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-700 group-hover:border-blue-500 transition-colors"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white border-4 border-gray-700 group-hover:border-blue-500 transition-colors">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>

            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <p className="text-xs text-gray-500 mt-2">{t("edit_image")}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              {t("register_username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              minLength={3}
              maxLength={20}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full py-3.5 font-bold text-white transition bg-blue-600 rounded-xl hover:bg-blue-500 active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 shadow-lg shadow-blue-900/20"
          >
            {isLoading ? t("edit_saving") : t("edit_save")}
          </button>
        </form>
      </div>
    </div>
  );
}
