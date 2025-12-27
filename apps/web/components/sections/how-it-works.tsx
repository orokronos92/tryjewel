"use client";

import { ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Choisissez votre bijou",
    description: "Parcourez notre collection et sélectionnez le bijou qui vous plaît",
  },
  {
    number: "02",
    title: "Activez votre caméra",
    description: "Autorisez l'accès à votre webcam pour l'essayage virtuel",
  },
  {
    number: "03",
    title: "Essayez en temps réel",
    description: "Voyez le bijou sur vous instantanément et prenez des photos",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-24 bg-gradient-to-b from-gray-50 to-white"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-xl text-gray-600">
            Trois étapes simples pour essayer vos bijoux
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative text-center group animate-slide-up"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="mb-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-gold-100 flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-gold-600">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-semibold text-2xl mb-3 text-gray-900">
                  {step.title}
                </h3>
                <p className="text-gray-600 max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-full transform -translate-y-1/2">
                  <ArrowRight className="w-8 h-8 text-gold-300 transition-transform group-hover:translate-x-2" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
