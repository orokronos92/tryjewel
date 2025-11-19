# Bijoux AI - AR Virtual Try-On

Application web en réalité augmentée permettant d'essayer virtuellement des bijoux (bagues, bracelets, boucles d'oreilles, colliers) via la webcam.

## Stack Technique

- **Frontend** : Next.js 16 + React 18 + TypeScript
- **UI** : Tailwind CSS 4 + shadcn/ui
- **3D** : React Three Fiber + Three.js
- **Backend** : Python Flask + MediaPipe 0.10.9
- **Communication** : WebSocket (Socket.IO)
- **Base de données** : IndexedDB (galerie locale)

## Structure du Projet

```
C:\AR_jewel\
├── tryjewel/                 # Frontend Next.js
│   ├── app/                 # App Router
│   ├── components/          # Composants React
│   ├── public/              # Assets statiques
│   └── package.json
├── python-api/              # Backend Python
│   ├── src/
│   │   ├── api/            # Routes Flask
│   │   ├── trackers/       # Traqueurs MediaPipe
│   │   └── ...
│   └── requirements.txt
└── docs/                    # Documentation
    ├── bijoux-ai-prd-v2-optimized.md
    ├── PHASE-0-PLAN.md
    └── commands-cheatsheet.md
```

## Commandes de Développement

### Frontend (Next.js)

```bash
cd tryjewel

# Développement
npm run dev                    # Lance le serveur (http://localhost:3000)
npm run build                  # Build pour production
npm run lint                   # Lance ESLint
```

### Backend (Python)

```bash
# Activer le virtual environment
# Linux/Mac: source venv/bin/activate
# Windows: venv\Scripts\activate

# Installer les dépendances (quand on aura besoin)
cd python-api
pip install -r requirements.txt

# Lancer le serveur Flask
python src/api/server.py
```

## Installation

### Prérequis

- Node.js 20+
- Python 3.11+
- npm ou yarn

### Frontend

1. Installer les dépendances :
```bash
cd tryjewel
npm install
```

2. Lancer le serveur de développement :
```bash
npm run dev
```

### Backend (optionnel pour Phase 0)

Le backend Python utilisera MediaPipe pour le tracking. Les dépendances sont définies dans `python-api/requirements.txt`.

## Configuration

### Tailwind CSS

Thème personnalisé avec couleurs gold dans `app/globals.css` :

```css
@theme inline {
  --color-gold-500: 0.835 0.18 66.1;  /* Couleur principale */
}
```

Utilisation : `className="bg-gold-500 text-gold-foreground"`

### ES Lint & Prettier

- ESLint configuré avec règles strictes (no-console: warn, no-unused-vars: error)
- Prettier avec single quotes, no semicolons, 88 chars max

## Points d'Attention

- **React 18** utilisé pour compatibilité avec React Three Fiber (pas encore compatible React 19)
- **Tailwind CSS 4** avec syntaxe moderne (pas de fichier de config séparé)
- **Git non utilisé** pour l'instant (développement local)
- **ngrok** peut être utilisé pour tester sur mobile (voir docs/commands-cheatsheet.md)

## Développement

Le projet suit le PRD (Product Requirements Document) complet dans `docs/bijoux-ai-prd-v2-optimized.md`. La Phase 0 est actuellement en cours (setup complet).

## Test sur Mobile (ngrok)

Voir `docs/commands-cheatsheet.md` pour la configuration ngrok afin de tester l'AR sur un téléphone mobile.

## Prochaines Étapes

- Phase 1: Backend Python Core (MediaPipe tracking)
- Phase 2: Frontend UI Landing Page
- Phase 3: Webcam & AR Core
- Phase 4: Three.js 3D Integration

## Documentation

Vous trouverez toutes les spécifications détaillées dans le PDF complet :
- **PRD complet**: `docs/bijoux-ai-prd-v2-optimized.md`
- **Phase 0 Plan**: `docs/PHASE-0-PLAN.md`
- **Commandes** : `docs/commands-cheatsheet.md`

---

**Développement en cours avec Claude Code**

