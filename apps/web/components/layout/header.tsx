import { Logo } from "@/components/layout/logo";
import { Navigation } from "@/components/layout/navigation";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <Navigation className="hidden md:block" />
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="hidden md:inline-flex">
            À propos
          </Button>
          <Button className="hidden md:inline-flex bg-gold-500 hover:bg-gold-600">
            Essayer maintenant
          </Button>
          <MobileMenu className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
