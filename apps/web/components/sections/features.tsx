"use client";

import { Card } from "@/components/ui/card";

const features = [
  {
    title: "Mains",
    description:
      "Essayez des bagues et bracelets sur vos propres mains avec précision",
    icon: (
      <svg
        className="w-12 h-12 text-gold-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="10" r="3" />
        <path d="M8 10v-2a2 2 0 012-2h4a2 2 0 012 2v2" />
        <polyline points="8 14,12 18,16 14" />
      </svg>
    ),
  },
  {
    title: "Oreilles",
    description:
      "Visualisez des boucles d'oreilles en temps réel sur votre visage",
    icon: (
      <svg
        className="w-12 h-12 text-gold-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M7 18s-1-1-1-3 1-4 3-5 4-2 4-4" />
        <path d="M12 2a5 5 0 00-5 5v3a5 5 0 002 4" />
        <circle cx="16" cy="6" r="2" />
      </svg>
    ),
  },
  {
    title: "Cou",
    description:
      "Découvrez comment les colliers vous subliment avec réalisme",
    icon: (
      <svg
        className="w-12 h-12 text-gold-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="7" r="3" />
        <path d="M4 12c0 3.313 3.134 6 7 6s7-2.687 7-6" />
        <path d="M12 13v8" />
      </svg>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Essayez tous types de bijoux
          </h2>
          <p className="text-xl text-gray-600">
            Une expérience immersive pour chaque type de bijou
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-2 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-xl mb-3 text-gray-900">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
