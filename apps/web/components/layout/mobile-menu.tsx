"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#features", label: "Fonctionnalités" },
  { href: "/#how-it-works", label: "Comment ça marche" },
  { href: "/gallery", label: "Galerie" },
  { href: "/faq", label: "FAQ" },
];

interface MobileMenuProps {
  className?: string;
}

export function MobileMenu({ className }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn("md:hidden", className)}
        onClick={toggleMenu}
        aria-label="Ouvrir le menu"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMenu}
        >
          <div
            className="fixed left-0 top-0 h-full w-4/5 max-w-sm bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <span className="font-serif font-bold text-xl">Bijoux AI</span>
              <Button variant="ghost" size="icon" onClick={closeMenu}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="p-6">
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block py-2 text-lg font-medium text-gray-700 hover:text-gold-600 transition-colors"
                      onClick={closeMenu}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-8 space-y-4">
                <Button variant="outline" className="w-full" onClick={closeMenu}>
                  À propos
                </Button>
                <Button
                  className="w-full bg-gold-500 hover:bg-gold-600"
                  onClick={closeMenu}
                >
                  Essayer maintenant
                </Button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
