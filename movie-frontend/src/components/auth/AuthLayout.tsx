import type { ReactNode } from "react";
import AuthBackdrop from "./AuthBackdrop";
import LogoIcon from "../LogoIcon";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  subtitleMono?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthLayout({
  title,
  subtitle,
  subtitleMono = true,
  icon,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-[100dvh] overscroll-none font-ui selection:bg-[#d9ac54] selection:text-[#14110c]">
      <AuthBackdrop />
      <div className="relative flex min-h-[100dvh] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[368px]">
          <div className="flex flex-col items-center gap-2 pb-9 text-center">
            <div className="w-[52px] h-[52px] rounded-full border border-[#d9ac54]/45 flex items-center justify-center mb-1">
              {icon ?? <LogoIcon className="w-6 h-6" />}
            </div>
            <span className="text-[26px] font-bold tracking-[6px] text-[#f2ead9]">
              {title}
            </span>
            {subtitleMono ? (
              <span className="font-mono-ui text-[9.5px] font-medium tracking-[3px] text-[#8f8574] uppercase">
                {subtitle}
              </span>
            ) : (
              <span className="text-[12px] text-[#8f8574]">{subtitle}</span>
            )}
          </div>

          {children}

          {footer && (
            <div className="mt-9 pt-[22px] border-t border-[#d9ac54]/[.16] text-center text-[12.5px] text-[#8f8574]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
