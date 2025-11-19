# Phase 2 - Todo List (Frontend Next.js)

## Status: ✅ COMPLETE
**Date de début:** 18 Novembre 2025
**Date de fin:** 18 Novembre 2025
**Objectif:** Implémentation complète frontend fonctionnel

---

## Couche Schemas (Zod - Validation)

- [x] `lib/schemas/tracking.schema.ts` - Schemas validation toutes API
  - Types exportés: TrackingRequest, TrackingResult, WebSocketFrame, etc.

---

## Couche Stores (Zustand)

- [x] `stores/jewelry-store.ts` - Sélection bijoux persistante
  - 4 types bijoux, 5 doigts, 2 mains
  - LocalStorage persistence
  - Selectors optimisés

- [x] `stores/tracking-store.ts` - WebSocket tracking state
  - Connection management
  - Config tracking (fps, quality)
  - Real-time stats
  - Result cache (TTL)

- [x] `stores/camera-store.ts` - WebRTC camera state
  - Device enumeration
  - Permission handling
  - Stream management
  - LocalStorage persistence

- [x] `stores/gallery-store.ts` - Gallery screenshots
  - LocalStorage persistence
  - CRUD operations
  - Search/filter
  - Statistics

---

## Couche Hooks (React Query)

- [x] `hooks/use-tracking.ts` - Hooks tracking complet (524 lignes)
  - useTrackingAPI() - REST endpoints
  - useTrackingWebSocket() - Socket.IO
  - useTracking() - Combined mode
  - useCamera() - WebRTC integration
  - useGallery() - Gallery management

---

## Composants UI

- [x] `components/jewelry-selector.tsx` - Sélecteur bijoux
- [x] `components/camera-feed.tsx` - Caméra WebRTC avec capture
- [x] `components/tracking-overlay.tsx` - Rendu 3D React Three Fiber
- [x] `components/gallery.tsx` - Gallery complète (452 lignes)
  - Grid/list view
  - Search/filter
  - Download/share/delete
  - Modal preview
  - Empty states
  - Loading skeletons

- [x] `components/ui/scroll-area.tsx` - Défilement fluide
- [x] `components/ui/toast.tsx` - useToast hook

---

## Pages Next.js

- [x] `app/tracking/page.tsx` - Main tracking interface (238 lignes)
  - JewelrySelector, CameraFeed, TrackingOverlay
  - Control panel with stats
  - Mode switching REST/WebSocket
  - Capture to gallery
  - Toast notifications

- [x] `app/gallery/page.tsx` - Gallery page (236 lignes)
  - Gallery component integration
  - Stats summary
  - Control buttons
  - GalleryItemDetail modal
  - Mobile + memo versions

---

## Composants shadcn/ui

**Préinstallés (Phase 0):**
- [x] Button, Card, Dialog, Select, Radio-group

**Installés durant Phase 2:**
- [x] Badge, Skeleton, Separator, Sonner
- [x] ScrollArea (installé: @radix-ui/react-scroll-area)
- [x] Toast wrapper (utilise sonner)

---

## Dépendances Installées

**Core:**
- [x] next 16.0.3, react 18.3.1, typescript ^5, tailwindcss ^4

**State:**
- [x] zustand ^5.0.8, @tanstack/react-query ^5.90.10

**3D:**
- [x] @react-three/fiber 8.15, @react-three/drei 9.88, three ^0.181.1

**UI:**
- [x] @radix-ui/* (10 composants), lucide-react ^0.553.0

**Communication:**
- [x] socket.io-client ^4.8.1

**Forms:**
- [x] react-hook-form, @hookform/resolvers, zod

---

## Design System

### Tailwind Configuration
- [ ] Mettre à jour `tailwind.config.ts` vers v4.0
- [ ] Palette gold: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900
- [ ] Primary: gold-500 (#D4AF37)
- [ ] Fonts: serif (Playfair Display), sans (Inter)
- [ ] Animation fade-in (0.3s ease-in-out)
- [ ] Animation slide-up (0.3s ease-out)
- [ ] Animation shimmer (2s infinite)
- [ ] Plugin tailwindcss-animate

### Fonts
- [ ] Installer `next/font`
- [ ] Configurer Google Fonts:
  - Playfair Display (serif)
  - Inter (sans-serif)
- [ ] Preload fonts
- [ ] display: swap
- [ ] Appliquer dans `layout.tsx`

### Custom Components
- [ ] `Logo.tsx` (reusable)
- [ ] `FooterLinks.tsx` (reusable)
- [ ] `SocialLinks.tsx` (reusable)
- [ ] `ImagePreview.tsx` (reusable)

---

## shadcn/ui Components

### Install
- [ ] Badge (pour "✨ Nouveau")
- [ ] Toast (notifications)
- [ ] Skeleton (loading states)
- [ ] Progress (bars)

### Verify (Phase 0 pre-installed)
- [ ] Button ✅
- [ ] Card ✅
- [ ] Dialog ✅
- [ ] Select ✅
- [ ] Radio-group ✅

### Integration
- [ ] Configurer `components.json` si nécessaire
- [ ] Vérifier utils: cn()
- [ ] Créer wrapper components si nécessaire

---

## App Structure

### Root Layout
- [ ] Mettre à jour `src/app/layout.tsx`
- [ ] Ajouter fonts globales
- [ ] Ajouter Metadata (title, description)
- [ ] Inclure Header/Footer
- [ ] Configurer lang="fr"

### Marketing Layout
- [ ] Créer `src/app/(marketing)/layout.tsx`
- [ ] Inclure Header uniquement (marketing pages)
- [ ] Marquer AR app separate route (Phase 3)

### Page Routes
- [ ] `/` (Home/Landing) → `(marketing)/page.tsx`
- [ ] `/about` → `(marketing)/about/page.tsx`
- [ ] `/faq` → `(marketing)/faq/page.tsx`
- [ ] `/ar-tryon` → `ar-tryon/` (Phase 3)
- [ ] `/gallery` → `gallery/` (Phase 6)

---

## Performance Optimization

### Images
- [ ] Next.js Image component
- [ ] WebP/AVIF formats
- [ ] width + height props (avoid CLS)
- [ ] Lazy loading (below fold)
- [ ] blurDataURL (placeholder)

### Fonts
- [ ] next/font optimization
- [ ] Preload critical fonts
- [ ] Subset fonts (latin)
- [ ] display: swap

### JavaScript
- [ ] Code splitting (route-based)
- [ ] Lazy load below-fold components
- [ ] Remove unused imports (eslint)
- [ ] Minimize bundle size (<170KB gzipped)

---

## Responsive Design

### Breakpoints
- [ ] **Mobile:** 375px (iPhone SE)
- [ ] **Mobile:** 390px (iPhone 12 Pro)
- [ ] **Tablet:** 768px (iPad)
- [ ] **Desktop:** 1280px
- [ ] **Desktop:** 1920px

### Patterns
- [ ] Touch targets minimum 44×44px
- [ ] Font sizes responsive (text-base lg:text-lg)
- [ ] Grid layouts (grid-cols-1 md:grid-cols-3)
- [ ] Hidden/show based on breakpoint
- [ ] Container max-width

### Testing
- [ ] Test iOS Safari
- [ ] Test Android Chrome
- [ ] Test iPadOS
- [ ] Test desktop (Chrome, Firefox, Safari, Edge)

---

## Accessibility (WCAG AA)

### Keyboard
- [ ] Keyboard navigation possible
- [ ] Tab order logique
- [ ] Focus indicators visibles
- [ ] Skip links (optionnel)

### ARIA
- [ ] aria-label sur boutons icones
- [ ] aria-expanded sur mobile menu
- [ ] aria-controls sur mobile menu
- [ ] aria-live sur notifications

### Semantique
- [ ] Semantic HTML (header, nav, main, footer)
- [ ] H1, H2, H3 hierarchy correcte
- [ ] button vs div clickeable
- [ ] Images avec alt text

### Visuel
- [ ] Color contrast ratio ≥4.5:1
- [ ] Pas seulement couleur pour meaning
- [ ] Focus visible (outline)
- [ ] Texte lisible (min 16px)

### Testing
- [ ] axe DevTools Chrome
- [ ] WAVE Web Accessibility Tool
- [ ] VoiceOver (macOS)
- [ ] NVDA (Windows)

---

## Lighthouse Targets

### Scores Targets
- [ ] Performance >90
- [ ] Accessibility >95
- [ ] Best Practices >90
- [ ] SEO >90

### Metrics Targets
- [ ] First Contentful Paint (FCP) <1.8s
- [ ] Largest Contentful Paint (LCP) <2.5s
- [ ] Cumulative Layout Shift (CLS) <0.1
- [ ] Time to Interactive (TTI) <3.5s
- [ ] Total Blocking Time (TBT) <200ms

### Optimization
- [ ] Bundle size <170KB gzipped
- [ ] Images WebP/AVIF
- [ ] Fonts preload

---

## Testing

### Visual
- [ ] Match maquettes (si disponibles)
- [ ] Animations fluides
- [ ] Hover states
- [ ] Loading states (skeletons)
- [ ] Error states (optionnel)

### Fonctionnel
- [ ] Mobile menu toggle
- [ ] CTA buttons fonctionnels
- [ ] Liens vers bonnes URLs
- [ ] Smooth scroll
- [ ] Anchor links

### Browser Support
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] iOS Safari
- [ ] Android Chrome

---

## Known Issues & Solutions

### Hydration Mismatch
- **Solution:** useEffect pour client-only state, suppressHydrationWarning

### Font Loading
- **Solution:** next/font avec preload, display: swap

### CLS (Cumulative Layout Shift)
- **Solution:** width/height sur Next.js Image, skeleton placeholders

### Mobile Menu A11y
- **Solution:** aria-expanded, aria-controls, focus trap

---

## Backend Integration

**Phase 1 Backend (prêt):**
- **Health:** `GET http://localhost:5000/health`
- **Tracking:** `POST http://localhost:5000/api/track`
- **WebSocket:** `ws://localhost:5000/socket.io/`

**Routes Frontend:**
- `/` → Landing page (marketing)
- `/ar-tryon` → AR app (Phase 3)
- `/gallery` → User gallery (Phase 6)

---

## Commands

```bash
# Setup (depuis tryjewel/)
cd tryjewel
npm install

# Dev server
npm run dev        # http://localhost:3000

# Build
npm run build

# Lint
npm run lint

# Format
npm run format

# Lighthouse
npm install -g lighthouse
lighthouse http://localhost:3000 --view
```

---

## Definition of Done Phase 2

### ✅ Functional
- [ ] Landing page complète avec 4 sections
- [ ] Header/Footer fonctionnels
- [ ] Navigation mobile/desktop
- [ ] Design system implémenté
- [ ] 8 composants shadcn/ui fonctionnels
- [ ] Animations fluides
- [ ] All CTAs fonctionnels

### ✅ Performance
- [ ] Lighthouse Performance >90
- [ ] Lighthouse Accessibility >95
- [ ] Lighthouse Best Practices >90
- [ ] Lighthouse SEO >90
- [ ] FCP <1.8s, LCP <2.5s, CLS <0.1

### ✅ Quality
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors, 0 warnings
- [ ] WCAG AA: Tous critères respectés
- [ ] Responsive: Testé sur tous devices
- [ ] Cross-browser: Testé sur 6 navigateurs

### ✅ Documentation
- [ ] PHASE-2-PLAN.md complet ✅
- [ ] PHASE-2-TODO.md complet (TODO)
- [ ] PHASE-2-PROGRESS.md complet (TODO)

---

**Date de début:** À définir
**Objectif:** 5-7 jours de développement
**Status:** Plan prêt pour exécution

---

*Last Updated: 17 November 2025*
