# Phase 2: Frontend Next.js — Marketing & UI Foundation

## Overview

**Duration:** 8-10 days (local development)

**Stack:**
- Next.js 15.1.3 (App Router)
- React 19.0.0
- TypeScript 5.3+
- Tailwind CSS 4.0
- shadcn/ui 2.x
- Font Optimization + Image Optimization

**Goals:**
- ✅ Landing page responsive & performant
- ✅ Header/Footer avec navigation
- ✅ Design system avec thème gold
- ✅ Lighthouse scores >90 (Performance, Accessibility, Best Practices, SEO)
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Accessibility WCAG AA standards

---

## Table of Contents

1. [Documentation Files](#documentation-files)
2. [Project Structure](#project-structure)
3. [Detailed Implementation Tasks](#detailed-implementation-tasks)
4. [Dependencies](#dependencies)
5. [Configuration Files](#configuration-files)
6. [Validation & Testing](#validation--testing)
7. [Performance Targets](#performance-targets)
8. [Definition of Done](#definition-of-done)

---

## Documentation Files

### Input Files (à consulter)
1. `docs/bijoux-ai-prd-v2-ultra-optimized.md` (Section 2.x)
2. `docs/PHASE-0-PLAN.md` (Phase 0 frontend setup)

### Output Files (à créer)
1. `docs/PHASE-2-PLAN.md` (Ce fichier)
2. `docs/PHASE-2-TODO.md` - Todo list avec checkboxes
3. `docs/PHASE-2-PROGRESS.md` - Progress tracker

---

## Project Structure

```
tryjewel/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx          # Landing page
│   │   ├── layout.tsx        # Marketing layout
│   │   ├── about/
│   │   │   └── page.tsx
│   │   └── faq/
│   │       └── page.tsx
│   ├── ar-tryon/             # AR app (Phase 3+ placeholder)
│   ├── gallery/              # Gallery (Phase 6+ placeholder)
│   └── layout.tsx            # Root layout
│
├── components/
│   ├── layout/
│   │   ├── header.tsx        # Header with navigation
│   │   ├── footer.tsx        # Footer with links
│   │   ├── mobile-menu.tsx   # Mobile hamburger menu
│   │   └── navigation.tsx    # Desktop navigation
│   └── ui/                   # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── select.tsx
│       ├── radio-group.tsx
│       ├── badge.tsx
│       ├── toast.tsx
│       ├── skeleton.tsx
│       └── progress.tsx
│
├── config/
│   └── constants.ts          # Site config, links
│
├── lib/
│   └── utils.ts              # Utility functions
│
└── public/
    ├── images/               # Static images
    └── icons/                # Local icons
```

---

## Detailed Implementation Tasks

### Week 1, Days 1-3: Design System & Layout

#### Day 1: Tailwind Configuration & Fonts
**Objectif:** Configurer le design system Gold avec Tailwind CSS 4.0

- [x] **Configuration Tailwind 4.0**
  - [x] Mettre à jour `tailwind.config.ts` vers v4.0
  - [x] Définir palette couleurs gold (50-900)
  - [x] Ajouter fonts Playfair Display (serif) + Inter (sans)
  - [x] Configurer animations (fade-in, slide-up, shimmer)
  - [x] Ajouter plugin tailwindcss-animate

**Code Tailwind Config:**
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FFF9E6',
          100: '#FFF3CC',
          200: '#FFE799',
          300: '#FFDB66',
          400: '#FFCF33',
          500: '#D4AF37',  // Primary brand color
          600: '#B8941F',
          700: '#9C7A19',
          800: '#805F13',
          900: '#6B5810',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
```

- [ ] **Installation Fonts**
  - [ ] Installer `next/font` pour Optimisation
  - [ ] Configurer Google Fonts:
    ```typescript
    import { Playfair_Display, Inter } from 'next/font/google'

    const playfair = Playfair_Display({ subsets: ['latin'] })
    const inter = Inter({ subsets: ['latin'] })
    ```
  - [ ] Appliquer dans `app/layout.tsx`

- [ ] **Global Styles**
  - [ ] Créer `src/app/globals.css`
  - [ ] Ajouter utilities communes
  - [ ] Configurer box-sizing, resets

#### Day 2: shadcn/ui Setup
**Objectif:** Installer et configurer 8 composants UI

- [ ] **Components Module**
  - [ ] Vérifier `components.json` configuration
  - [ ] Installer composants manquants:
    ```bash
    npx shadcn-ui@latest add button     # ✅ (Phase 0)
    npx shadcn-ui@latest add card       # ✅ (Phase 0)
    npx shadcn-ui@latest add dialog     # ✅ (Phase 0)
    npx shadcn-ui@latest add select     # ✅ (Phase 0)
    npx shadcn-ui@latest add radio-group # ✅ (Phase 0)
    npx shadcn-ui@latest add badge
    npx shadcn-ui@latest add toast
    npx shadcn-ui@latest add skeleton
    npx shadcn-ui@latest add progress
    ```

- [ ] **Custom Components**
  - [ ] Créer composant `Logo.tsx`
  - [ ] Créer composant `MobileMenu.tsx`
  - [ ] Créer composant `Navigation.tsx`
  - [ ] Créer composant `FooterLinks.tsx`
  - [ ] Créer composant `SocialLinks.tsx`

#### Day 3: Layout Foundation
**Objectif:** Créer Header et Footer structurés

- [ ] **Header Component (`src/components/layout/header.tsx`)**
  ```typescript
  export function Header() {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Navigation className="hidden md:flex" />
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden md:inline-flex">
              À propos
            </Button>
            <Button className="bg-gold-500 hover:bg-gold-600">
              Essayer maintenant
            </Button>
            <MobileMenu className="md:hidden" />
          </div>
        </div>
      </header>
    )
  }
  ```

- [ ] **Footer Component (`src/components/layout/footer.tsx`)**
  ```typescript
  export function Footer() {
    return (
      <footer className="border-t bg-gray-50">
        <div className="container py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {/* Logo + Description */}
            {/* Product Links */}
            {/* Company Links */}
            {/* Social Links */}
          </div>
          <Separator className="my-8" />
          <div className="text-center text-sm text-gray-600">
            © 2025 Bijoux AI. Tous droits réservés.
          </div>
        </div>
      </footer>
    )
  }
  ```

- [ ] **Root Layout (`src/app/layout.tsx`)**
  - [ ] Intégrer Header/Footer
  - [ ] Configurer fonts globales
  - [ ] Metadata (title, description)

### Week 2, Days 4-6: Landing Page Implementation

#### Day 4: Hero & Navigation
**Objectif:** Section Hero accrocheuse avec CTA

- [ ] **Hero Section (`src/components/sections/hero.tsx`)**
  ```typescript
  export function HeroSection() {
    return (
      <section className="container py-24 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="animate-fade-in">
            <Badge className="mb-4">✨ Nouveau</Badge>
            <h1 className="font-serif text-5xl font-bold tracking-tight lg:text-6xl">
              Essayez des bijoux{' '}
              <span className="text-gold-500">en réalité augmentée</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600">
              Visualisez instantanément comment les bijoux vous vont avant de les acheter.
            </p>
            <div className="mt-8 flex gap-4">
              <Button size="lg" className="bg-gold-500 hover:bg-gold-600">
                Essayer maintenant
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline">
                Voir la démo
              </Button>
            </div>
          </div>
          <div className="relative">
            <ImagePreview filename="hero-preview.png" />
          </div>
        </div>
      </section>
    )
  }
  ```

- [ ] **Image Preview Component**
  - [ ] Créer composant réutilisable
  - [ ] Optimiser avec Next.js Image
  - [ ] Lazy loading au-dessus du fold

#### Day 5: Features Section
**Objectif:** Présenter 3 types de bijoux supportés

- [ ] **Features Section (`src/components/sections/features.tsx`)**
  ```typescript
  const features = [
    {
      icon: Hand,
      title: 'Mains',
      description: 'Essayez des bagues et bracelets sur vos propres mains',
    },
    {
      icon: Ear,
      title: 'Oreilles',
      description: 'Visualisez des boucles d\'oreilles en temps réel',
    },
    {
      icon: Necklace,
      title: 'Cou',
      description: 'Découvrez comment les colliers vous subliment',
    },
  ]

  export function FeaturesSection() {
    return (
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl font-bold mb-4">
            Essayez tous types de bijoux
          </h2>
          <p className="text-xl text-gray-600">
            Une expérience immersive pour chaque type de bijou
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="p-6 hover:shadow-lg transition-shadow">
              <feature.icon className="h-12 w-12 text-gold-500 mb-4" />
              <h3 className="font-semibold text-xl mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>
    )
  }
  ```

#### Day 6: How It Works & CTA
**Objectif:** Expliquer le processus + call-to-action final

- [ ] **HowItWorks Section (`src/components/sections/how-it-works.tsx`)**
  ```typescript
  const steps = [
    {
      number: '01',
      title: 'Choisissez votre bijou',
      description: 'Parcourez notre collection et sélectionnez le bijou qui vous plaît',
    },
    {
      number: '02',
      title: 'Activez votre caméra',
      description: 'Autorisez l\'accès à votre webcam pour l\'essayage virtuel',
    },
    {
      number: '03',
      title: 'Essayez en temps réel',
      description: 'Voyez le bijou sur vous instantanément et prenez des photos',
    },
  ]

  export function HowItWorksSection() {
    return (
      <section className="container py-24 bg-gray-50">
        <h2 className="font-serif text-4xl font-bold text-center mb-16">
          Comment ça marche ?
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="text-center relative">
              <div className="text-6xl font-bold text-gold-100 mb-4">
                {step.number}
              </div>
              <h3 className="font-semibold text-xl mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute top-8 -right-4 text-gold-300" />
              )}
            </div>
          ))}
        </div>
      </section>
    )
  }
  ```

- [ ] **CTA Section (`src/components/sections/cta.tsx`)**
  - [ ] Section finale avec CTA fort
  - [ ] Bouton prominent vers app (Phase 3)
  - [ ] Social proof (placeholder)

#### Day 7: Landing Page Integration
**Objectif:** Assembler et tester la landing page complète

- [ ] **Landing Page (`src/app/(marketing)/page.tsx`)**
  ```typescript
  import { HeroSection } from '@/components/sections/hero'
  import { FeaturesSection } from '@/components/sections/features'
  import { HowItWorksSection } from '@/components/sections/how-it-works'
  import { CTASection } from '@/components/sections/cta'

  export default function HomePage() {
    return (
      <>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CTASection />
      </>
    )
  }
  ```

- [ ] **Marketing Layout (`src/app/(marketing)/layout.tsx`)**
  - [ ] Inclure Header/Footer
  - [ ] Metadata marketing

### Week 2, Days 7-8: Performance & Testing

- [ ] **Performance Optimization**
  - [ ] Configurer Next.js Image optimization
  - [ ] Preload critical fonts
  - [ ] Code splitting par route
  - [ ] Lazy load below-fold
  - [ ] Optimiser fonts avec next/font

- [ ] **Lighthouse Testing**
  ```bash
  # Target scores:
  # Performance: >90
  # Accessibility: >95
  # Best Practices: >90
  # SEO: >90
  ```

- [ ] **Responsive Testing**
  - [ ] Test mobile (375px, 390px)
  - [ ] Test tablet (768px)
  - [ ] Test desktop (1280px, 1920px)
  - [ ] Vérifier touch targets 44×44px
  - [ ] Vérifier font sizes responsives

- [ ] **Accessibility Testing**
  - [ ] Semantic HTML
  - [ ] ARIA labels
  - [ ] Keyboard navigation
  - [ ] Focus management
  - [ ] Screen reader
  - [ ] WCAG AA color contrast

- [ ] **Cross-Browser Testing**
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)

---

## Dependencies

### Runtime Dependencies
```json
{
  "next": "^15.1.3",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "typescript": "^5.3.3",
  "tailwindcss": "^4.0.0",
  "lucide-react": "^0.428.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.4.0",
  "tailwindcss-animate": "^1.0.7",
  "@radix-ui/react-dialog": "^1.1.1",
  "@radix-ui/react-select": "^2.1.1",
  "@radix-ui/react-radio-group": "^1.2.0",
  "@radix-ui/react-separator": "^1.1.0",
  "@radix-ui/react-slot": "^1.1.0",
  "@radix-ui/react-toast": "^1.2.1"
}
```

### Dev Dependencies
```json
{
  "@types/node": "^22.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "eslint": "^9.0.0",
  "eslint-config-next": "^15.1.3",
  "postcss": "^8.4.40",
  "prettier": "^3.3.3",
  "prettier-plugin-tailwindcss": "^0.6.5",
  "shadcn-ui": "^0.8.0"
}
```

### Font Dependencies
```json
{
  "next/font": "^15.1.3"
}
```

---

## Configuration Files

### `next.config.ts`
```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig
```

### `components.json`
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "gray",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

---

## Performance Targets

### Lighthouse Scores (Target)

| Metric | Target | Minimum |
|--------|--------|---------|
| Performance | >90 | 85 |
| Accessibility | >95 | 90 |
| Best Practices | >90 | 85 |
| SEO | >90 | 85 |

### Performance Budget

- **First Contentful Paint (FCP):** <1.8s
- **Largest Contentful Paint (LCP):** <2.5s
- **Cumulative Layout Shift (CLS):** <0.1
- **Time to Interactive (TTI):** <3.5s
- **Total Blocking Time (TBT):** <200ms

### Bundle Size

- **Initial JS Bundle:** <170KB (gzipped)
- **Images:** WebP/AVIF format
- **Fonts:** Subset + preload

---

## Validation & Testing

### 1. Lighthouse CI

Run tests:
```bash
npm run build
npm run start
# In another terminal:
lighthouse http://localhost:3000 --view
```

### 2. Responsive Testing

**Breakpoints à tester:**
- Mobile: 375px, 390px
- Tablet: 768px
- Desktop: 1280px, 1920px

**Outils:**
- Chrome DevTools Device Mode
- BrowserStack (optionnel)
- Real devices (iPhone, iPad, Android)

### 3. Accessibility Testing

**Testing tools:**
- axe DevTools (Chrome Extension)
- WAVE Web Accessibility Tool
- VoiceOver (macOS) / Narrator (Windows)

**WCAG AA Checklist:**
- [ ] Color contrast ratio ≥4.5:1
- [ ] Keyboard navigation possible
- [ ] Focus indicators visibles
- [ ] ARIA labels corrects
- [ ] Semantic HTML utilisé
- [ ] Images avec alt text

### 4. Manual Testing Checklist

**Visuel:**
- [ ] Design match maquettes (si disponibles)
- [ ] Animations fluides
- [ ] Hover states fonctionnels
- [ ] Loading states appropriés

**Fonctionnel:**
- [ ] Navigation mobile toggle
- [ ] CTA buttons fonctionnels
- [ ] Liens vers bonnes pages
- [ ] Scroll smooth vers sections

---

## Commands

```bash
# Setup (depuis tryjewel/)
npm install

# Dev server
npm run dev        # http://localhost:3000

# Build
npm run build

# Lint
npm run lint

# Format
npm run format

# Prettier
npx prettier --write .

# Lighthouse
npm install -g lighthouse
lighthouse http://localhost:3000 --view
```

---

## Definition of Done

### ✅ Functional Requirements

- [ ] Landing page complète avec toutes sections (Hero, Features, HowItWorks, CTA)
- [ ] Header responsive avec Logo, Navigation, CTA button
- [ ] Footer avec 4 colonnes (Brand, Product, Company, Social)
- [ ] Navigation mobile (hamburger menu)
- [ ] Design system implémenté (gold palette, fonts, animations)
- [ ] 8 composants shadcn/ui fonctionnels (button, card, dialog, select, radio-group, badge, toast, skeleton, progress)
- [ ] Animations fluides (fade-in, slide-up, shimmer)
- [ ] All CTAs fonctionnels et vers bonnes URLs

### ✅ Performance Requirements

- [ ] Lighthouse Performance >90
- [ ] Lighthouse Accessibility >95
- [ ] Lighthouse Best Practices >90
- [ ] Lighthouse SEO >90
- [ ] First Contentful Paint <1.8s
- [ ] Largest Contentful Paint <2.5s
- [ ] Cumulative Layout Shift <0.1

### ✅ Quality Requirements

- [ ] Code TypeScript valid (0 errors)
- [ ] ESLint: 0 errors, 0 warnings
- [ ] Prettier formatting: 100% des fichiers
- [ ] WCAG AA: Tous les critères respectés
- [ ] Responsive: Testé sur mobile/tablet/desktop
- [ ] Cross-browser: Testé sur Chrome, Firefox, Safari, Edge

### ✅ Documentation Requirements

- [ ] PHASE-2-PLAN.md complet
- [ ] PHASE-2-TODO.md mis à jour
- [ ] PHASE-2-PROGRESS.md avec daily logs
- [ ] Code comments pour logique complexe
- [ ] README.md mis à jour si nécessaire

---

## Issues Connus & Solutions

### 1. Hydration Mismatch (Next.js)
**Problème:** Différences entre SSR et client-side rendering
**Solution:** Utiliser `useEffect` pour client-only state et `suppressHydrationWarning`

### 2. Font Loading Flash
**Problème:** Texte apparaît puis change de font
**Solution:** Utiliser `next/font` avec `preload: true` et `display: swap`

### 3. CLS (Cumulative Layout Shift)
**Problème:** Layout shift quand images chargent
**Solution:** Utiliser `width` + `height` props sur Next.js Image, skeleton placeholders

### 4. Mobile Menu A11y
**Problème:** Menu mobile pas accessible au clavier
**Solution:** Ajouter `aria-expanded`, `aria-controls`, focus trap

---

## Dependencies Backend (Phase 1)

La Phase 2 Frontend fonctionne avec Phase 1 Backend :
- **API Base URL:** `http://localhost:5000`
- **Health Endpoint:** `GET /health`
- **Tracking Endpoint:** `POST /api/track`
- **WebSocket:** `ws://localhost:5000/socket.io/`

**Note:** La première page de l'app AR sera une route séparée (`/ar-tryon`) développée dans la Phase 3.

---

**Date début:** À définir (Phase 2 peut démarrer en parallèle avec Phase 1 backend)
**Date fin estimée:** 5-7 jours après début
**Status:** Prêt pour implémentation

---

*Last Updated: 17 November 2025*
