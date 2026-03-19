import { Link } from "react-router-dom";

export default function VideoLogo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`shrink-0 flex items-center min-w-0 font-logo text-[20px] md:text-[22px] tracking-tight text-primary hover:opacity-90 transition-opacity ${className}`}
      aria-label="Premiere Services – Home"
    >
      Premiere Services
    </Link>
  );
}
