import type { FC } from "react";

const Toast: FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] uppercase tracking-widest px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center z-50">
      <span className="font-bold text-[10px] sm:text-xs text-center">
        {message}
      </span>
    </div>
  );
};

export default Toast;
