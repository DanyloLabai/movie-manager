import LogoImg from "../assets/logo.png";

export default function LogoIcon({
  className = "w-[18px] h-[18px]",
}: {
  className?: string;
}) {
  return (
    <div className="relative shrink-0">
      <div className="absolute inset-0 bg-[#d9ac54]/25 blur-md rounded-full" />
      <img src={LogoImg} alt="" className={`relative object-contain ${className}`} />
    </div>
  );
}
