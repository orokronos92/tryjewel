import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-gold-500"
      >
        <circle cx="16" cy="16" r="16" fill="currentColor" />
        <path
          d="M16 8L18 12L22 12L19 15L20 19L16 17L12 19L13 15L10 12L14 12L16 8Z"
          fill="white"
        />
      </svg>
      <span className="font-serif font-bold text-xl text-gold-500">
        Bijoux AI
      </span>
    </Link>
  );
}
