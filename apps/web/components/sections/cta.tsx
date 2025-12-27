"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-gradient-to-tr from-gold-500 via-gold-600 to-gold-700" />
      <div className="absolute inset-0 opacity-20" />

      <div className="container mx-auto px-4 relative">
        <div className="text-center text-white max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Prêt à essayer vos bijoux ?
          </h2>
          <p className="text-xl mb-8 text-gold-50">
            Découvrez comment nos bijoux en réalité augmentée transforment votre expérience d'achat
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/ar-tryon">
              <Button
                size="lg"
                className="bg-white text-gold-600 hover:bg-gold-50 font-semibold shadow-lg"
                onClick={() => {
                  // Scroll to top
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              >
                Commencer l'essayage
              </Button>
            </Link>
            <Link href="/gallery">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 font-semibold"
              >
                Voir la galerie
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
