# WhatsApp Scheduler

Site web pour programmer l'envoi de messages WhatsApp (texte + pièces jointes), connecté à un bot wppconnect via n8n et un Google Sheet.

> 🇫🇷 Interface en français — pensé pour un usage perso / petite équipe.

## ✨ Fonctionnalités

- 📅 **Programmation de messages** à date + heure choisies, avec récurrence (hebdo / mensuel)
- 📎 **Pièces jointes** : images, PDF, audio, vidéo, documents Office (jusqu'à 16 Mo)
- ✏️ **Éditeur WhatsApp** : `*gras*`, `_italique_`, `~barré~`, `` ```code``` ``, `> citation` + emoji picker
- 👀 **Aperçu en direct** (rendu façon bulle WhatsApp)
- 📋 **Modèles de messages** réutilisables (CRUD)
- 👥 **Multi-utilisateurs** avec 3 rôles : `super_admin` > `admin` > `user`
- 🔍 **Recherche, filtres, pagination, export CSV**
- 🗂️ **Actions groupées** sur les messages
- 🔔 **Notifications temps réel** (Server-Sent Events) quand n8n confirme l'envoi
- 📊 **Dashboard** avec stats (en attente, envoyés cette semaine, prochain envoi…)
- 📜 **Journal d'audit** (admin)
- 🌙 **Mode sombre**
- 📱 **Responsive** : tables → cartes sur mobile, cibles tactiles agrandies

## 🏗️ Architecture

```
┌────────────────┐         ┌─────┐        ┌──────────────┐
│  Site Next.js  │ ──HTTP──▶ n8n  ├──────▶ │ Google Sheet │
│  (ce repo)     │         │     │        │  (feuilles)  │
│  Docker, NAS   │ ◀──HTTP─┤     │◀───────┤              │
└────────┬───────┘         └──┬──┘        └──────────────┘
         │                    │
         │                    │ POST /send
         │                    ▼
         │            ┌──────────────┐         ┌─────────┐
         │            │  Bot Node.js │ ──────▶ │WhatsApp │
         │            │ (wppconnect) │         │ Business│
         │            └──────────────┘         └─────────┘
         │
         ▼
   ┌──────────┐
   │  SQLite  │   users, templates, audit_log, pièces jointes
   └──────────┘
```

- **Site web** (`web/`) — Next.js 16 + React 19 + Tailwind 4, sur Docker
- **n8n** — orchestrateur HTTP (5 workflows : GET/POST/PUT/DELETE messages + recipients)
- **Google Sheet** — base de données des messages programmés et destinataires
- **Bot** (`index.js`) — wppconnect + Express, tourne en pm2 sur le serveur

## 🚀 Stack

- [Next.js 16](https://nextjs.org/) (App Router, Turbopack, standalone output)
- [React 19](https://react.dev/) + [shadcn/ui Nova](https://ui.shadcn.com/) (base-ui primitives)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — DB locale (users, templates, audit)
- [next-themes](https://github.com/pacocoursey/next-themes) — mode sombre
- [emoji-picker-react](https://github.com/ealush/emoji-picker-react)
- [wppconnect](https://github.com/wppconnect-team/wppconnect) — couche WhatsApp
- [n8n](https://n8n.io/) — orchestrateur

## 📦 Déploiement

CI/CD via **GitHub Actions** + **GHCR** :

```
git push → Actions build l'image → ghcr.io/youmeric/whatsapp-scheduler-web:latest
NAS : docker compose pull && docker compose up -d  (30 sec)
```

Toutes les étapes détaillées dans [`DEPLOY.md`](./DEPLOY.md).

## 📂 Structure du repo

```
.
├── .github/workflows/docker-build.yml   ← CI/CD vers ghcr.io
├── docker-compose.yml                   ← À copier sur le NAS
├── DEPLOY.md                            ← Guide complet de déploiement
├── index.js                             ← Bot WhatsApp (pm2)
└── web/                                 ← Site Next.js
    ├── Dockerfile
    ├── src/
    │   ├── app/                         ← Routes (App Router)
    │   ├── components/                  ← UI components
    │   └── lib/                         ← DB, auth, helpers, types
    ├── N8N_WEBHOOKS.md                  ← Spec des 5 webhooks n8n
    └── .env.production.example          ← Template à remplir sur le NAS
```

## 💾 Données persistantes

Tout ce qui est créé sur le site vit dans `/volume2/docker/whatsapp-scheduler/data/` sur le NAS (bind mount Docker). Tu peux supprimer/recréer le container sans rien perdre tant que ce dossier existe. Détails et backups dans [`DEPLOY.md § 4`](./DEPLOY.md).

```
/volume2/docker/whatsapp-scheduler/
├── docker-compose.yml
├── .env.production
└── data/
    ├── app.db        ← SQLite (users, modèles, journal d'audit)
    └── uploads/      ← pièces jointes (UUID.ext)
```

| Donnée | Où c'est stocké | Survit à `docker rm` ? |
|---|---|---|
| Messages programmés | Google Sheet (feuille 1) | ✅ |
| Destinataires | Google Sheet (feuille 2) | ✅ |
| Utilisateurs (login) | `data/app.db` sur le NAS | ✅ |
| Modèles de messages | `data/app.db` sur le NAS | ✅ |
| Journal d'audit | `data/app.db` sur le NAS | ✅ |
| Pièces jointes | `data/uploads/` sur le NAS | ✅ |
| Session WhatsApp (bot) | `tokens/` sur le serveur du bot | ✅ |

## 🔧 Développement local

```bash
cd web
cp .env.production.example .env.local
# édite .env.local : N8N_WEBHOOK_BASE peut être laissé vide → mocks automatiques
npm install
npm run dev
# → http://localhost:3000
```

Sans `N8N_WEBHOOK_BASE` configuré, le site utilise des mocks en mémoire — tu peux développer sans n8n ni Google Sheet.

## 📜 Licence

Privée / usage perso. Adapte si tu fork.
