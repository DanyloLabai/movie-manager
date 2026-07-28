import type { ReactNode } from "react";

interface ProfileSectionProps {
  children: ReactNode;
  /** Omit the bottom hairline for the last section in the stack. */
  noBorder?: boolean;
}

export default function ProfileSection({
  children,
  noBorder,
}: ProfileSectionProps) {
  return (
    <div
      className={`-mx-4 sm:-mx-8 px-5 md:px-14 py-5 md:py-[30px] ${
        noBorder ? "" : "border-b border-[rgba(217,172,84,.16)]"
      }`}
    >
      {children}
    </div>
  );
}
