# La Jardinerie — Site Web

Site vitrine premium pour **La Jardinerie**, restaurant guinguette & bouillon à Toulouges (66).

Bouillon le midi, guinguette le soir : plats à partager, vins de qualité, musique & grandes tablées.

## Stack Technique

- **Framework** : [Astro](https://astro.build/) 4.x
- **Styling** : [Tailwind CSS](https://tailwindcss.com/) 3.x
- **Backend réservation** : [Supabase](https://supabase.com/) (PostgreSQL + Edge Functions)
- **Hébergement** : GitHub Pages (site statique)
- **CI/CD** : GitHub Actions

## Fonctionnalités

- Site vitrine multi-pages (Accueil, Menu, Réserver, Événements, Concept, Contact)
- Système de réservation en ligne avec confirmation immédiate
- Anti-double booking (verrouillage transactionnel)
- Animation particles 3D légère (lazy-load, prefers-reduced-motion)
- SEO local optimisé (JSON-LD, meta, sitemap)
- Design responsive "guinguette premium"
- Performance Lighthouse 90+

## Installation

### Prérequis

- Node.js 18+
- npm ou pnpm
- Compte Supabase (pour la réservation)

### Installation locale

```bash
# Cloner le repo
git clone https://github.com/VOTRE_USER/lajardinerie_website.git
cd lajardinerie_website

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

Le site sera accessible sur `http://localhost:4321`

## Configuration

### 1. Variables d'environnement

Créez un fichier `.env` à la racine :

```env
# Supabase (optionnel pour le mode démo)
PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon

# Pour les Edge Functions
SUPABASE_SERVICE_ROLE_KEY=votre-clé-service-role

# Email (optionnel)
RESEND_API_KEY=votre-clé-resend
```

### 2. Configuration Astro

Dans `astro.config.mjs`, modifiez :

```javascript
const GITHUB_USER = "votre-username";
const REPO_NAME = "lajardinerie_website";
```

### 3. Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans SQL Editor et exécutez le contenu de `supabase/schema.sql`
3. Déployez les Edge Functions :

```bash
# Installer Supabase CLI
npm install -g supabase

# Login
supabase login

# Lier au projet
supabase link --project-ref votre-ref-projet

# Déployer les fonctions
supabase functions deploy availability
supabase functions deploy book

# Configurer les secrets
supabase secrets set RESEND_API_KEY=votre-clé
```

### 4. GitHub Pages

1. Dans votre repo GitHub, allez dans Settings > Pages
2. Source : "GitHub Actions"
3. Le workflow `.github/workflows/deploy.yml` se déclenchera automatiquement

#### Secrets GitHub (optionnel, pour Supabase)

Dans Settings > Secrets > Actions, ajoutez :
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

## Structure du Projet

```
lajardinerie_website/
├── public/
│   ├── assets/           # Images (à ajouter)
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/       # Composants Astro
│   ├── layouts/          # Layout de base
│   ├── lib/              # Utilitaires (Supabase client)
│   ├── pages/            # Pages du site
│   └── styles/           # Styles globaux
├── supabase/
│   ├── functions/        # Edge Functions
│   └── schema.sql        # Schéma DB
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Accueil | `/` | Hero, sections Midi/Soir, galerie, FAQ |
| Menu | `/menu` | Carte complète avec prix |
| Réserver | `/reserver` | Widget de réservation multi-étapes |
| Événements | `/evenements` | Soirées et programmation |
| Concept | `/concept` | Histoire et valeurs |
| Contact | `/contact` | Coordonnées, horaires, carte |
| Mentions légales | `/mentions-legales` | Obligations légales |
| Confidentialité | `/confidentialite` | Politique RGPD |

## Design System

### Couleurs

| Nom | Hex | Usage |
|-----|-----|-------|
| Olive | `#7B7A2A` | Primaire, CTA |
| Crème | `#F6F1E6` | Fond |
| Terracotta | `#8B4A2B` | Accent |
| Charbon | `#161616` | Texte |

### Typographies

- **Titres** : Oswald (Google Fonts)
- **Corps** : Inter (Google Fonts)

## Mode Démo

Sans configuration Supabase, le système de réservation fonctionne en **mode démo** :
- Les créneaux sont générés localement
- Les réservations ne sont pas sauvegardées
- Un code fictif est retourné

## SEO

- Meta tags optimisés pour le SEO local
- JSON-LD Restaurant schema
- Sitemap généré automatiquement
- robots.txt configuré
- Mots-clés ciblés : "restaurant Toulouges", "guinguette Perpignan", etc.

## Performance

Optimisations incluses :
- Images lazy-load
- Polices avec font-display: swap
- CSS minifié
- JavaScript minimal (uniquement pour réservation + particles)
- Animation particles désactivée si prefers-reduced-motion

## Commandes

```bash
npm run dev      # Serveur de développement
npm run build    # Build production
npm run preview  # Preview du build
```

## Personnalisation

### Modifier les informations de contact

Fichiers à modifier :
- `src/components/Footer.astro` (adresse, téléphone, email)
- `src/pages/contact.astro` (coordonnées)
- `src/layouts/BaseLayout.astro` (JSON-LD)

### Modifier le menu

Fichier : `src/pages/menu.astro`

### Modifier les horaires

Fichiers :
- `src/components/Footer.astro`
- `src/pages/contact.astro`
- `supabase/schema.sql` (service_windows)

### Ajouter des images

Placez vos images dans `public/assets/` et référencez-les avec `${base}assets/nom.jpg`

## Déploiement

### GitHub Pages (recommandé)

Push sur `main` → déploiement automatique via GitHub Actions.

### Autre hébergeur

```bash
npm run build
# Uploadez le contenu de dist/ sur votre hébergeur
```

## Support

Site réalisé par [W4S](https://w4s.fr)

---

## Estimation de Prix

### Hypothèses
- Site vitrine 8 pages
- Système de réservation avec backend Supabase
- Design custom "guinguette premium"
- Animation 3D légère
- SEO local optimisé
- Responsive mobile-first

### Offres

| Niveau | Inclus | Prix estimatif |
|--------|--------|----------------|
| **Essentiel** | Site vitrine + réservation basique (formulaire email) | 2 500 - 3 500 € |
| **Pro** | Site + réservation temps réel + email confirmation | 4 500 - 6 000 € |
| **Avancé** | Pro + SMS confirmation + admin dashboard | 7 000 - 10 000 € |

### Options supplémentaires

| Option | Prix estimatif |
|--------|----------------|
| Emails transactionnels (Resend) | +300 - 500 € |
| SMS confirmation (Twilio) | +500 - 800 € |
| Dashboard admin réservations | +1 500 - 2 500 € |
| Multi-langue (FR/EN/ES) | +1 000 - 1 500 € |
| Blog / actualités | +800 - 1 200 € |
| Analytics avancés + cookies RGPD | +400 - 600 € |
| Formation utilisateur | +300 - 500 € |

### Coûts récurrents

| Service | Coût mensuel |
|---------|--------------|
| Hébergement GitHub Pages | Gratuit |
| Supabase (plan gratuit) | 0 € (500MB DB) |
| Supabase (plan Pro) | 25 $/mois |
| Domaine .fr | ~10 €/an |
| Resend (emails) | 0-20 $/mois |

---

**La Jardinerie** — Guinguette & Bouillon
9 bis Boulevard de Clairfont, 66350 Toulouges
