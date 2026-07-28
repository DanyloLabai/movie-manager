import { useState, type InputHTMLAttributes } from "react";
import EyeIcon from "./EyeIcon";

interface AuthPasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function AuthPasswordField({
  label,
  className,
  ...rest
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono-ui text-[9.5px] font-semibold tracking-[2px] text-[#d9ac54] uppercase">
        {label}
      </label>
      <div
        className={`flex items-center px-5 py-3.5 rounded-full bg-white/[.03] border transition-colors focus-within:border-[#d9ac54] ${
          rest.value ? "border-[#d9ac54]/30" : "border-white/[.14]"
        } ${className ?? ""}`}
      >
        <input
          type={visible ? "text" : "password"}
          className="flex-1 min-w-0 bg-transparent text-[14px] text-[#f2ead9] placeholder-[#645c4d] focus:outline-none"
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="ml-2 shrink-0 text-[#645c4d] hover:text-[#d9ac54] transition-colors"
        >
          <EyeIcon isOpen={visible} />
        </button>
      </div>
    </div>
  );
}
