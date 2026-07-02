import type { FC, ReactNode } from "react";

const PageWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      {children}
    </div>
  );
};

export default PageWrapper;
