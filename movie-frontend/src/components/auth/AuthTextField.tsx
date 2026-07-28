import type { InputHTMLAttributes } from "react";

interface AuthTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function AuthTextField({ label, className, ...rest }: AuthTextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono-ui text-[9.5px] font-semibold tracking-[2px] text-[#d9ac54] uppercase">
        {label}
      </label>
      <input
        className={`w-full px-5 py-3.5 rounded-full bg-white/[.03] border text-[14px] text-[#f2ead9] placeholder-[#645c4d] focus:outline-none focus:border-[#d9ac54] transition-colors ${
          rest.value ? "border-[#d9ac54]/30" : "border-white/[.14]"
        } ${className ?? ""}`}
        {...rest}
      />
    </div>
  );
}
