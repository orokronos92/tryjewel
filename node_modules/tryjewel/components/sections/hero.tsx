"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gold-100 via-white to-gold-50" />
      <div className="container mx-auto px-4 py-24 lg:py-32 relative">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="animate-fade-in space-y-6">
            <Badge className="mb-2 bg-gold-500 text-white hover:bg-gold-600">
              ✨ Nouveau
            </Badge>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Essayez des bijoux{" "}
              <span className="text-gold-500">en réalité augmentée</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-lg">
              Visualisez instantanément comment les bijoux vous vont avant de les acheter.
              Bagues, bracelets, boucles d'oreilles et colliers en temps réel.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" className="bg-gold-500 hover:bg-gold-600 text-white font-semibold">
                Essayer maintenant
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" className="border-gray-300 hover:border-gold-500 hover:text-gold-600">
                Voir la démo
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-gold-200 to-gold-300 p-8 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="text-6xl mb-4">💍</div>
                <p className="text-xl font-semibold">Preview à venir</p>
                <p className="text-sm opacity-90">Capture d'écran de l'app</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
