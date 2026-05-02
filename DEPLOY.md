# Déploiement — site web (Docker via GitHub Container Registry)

Workflow :
1. **Local** → `git push` sur GitHub (branche `main`)
2. **GitHub Actions** build l'image Docker et la pousse vers `ghcr.io`
3. **NAS** pull l'image et redémarre le container

Le NAS n'a **pas besoin** de cloner le repo. Il lui faut juste 2 fichiers + un dossier de données :

```
/volume2/docker/whatsapp-scheduler/
├── docker-compose.yml
├── .env.production
└── data/                          ← créé au premier lancement
    ├── app.db                     ← SQLite (users, modèles, audit)
    └── uploads/                   ← pièces jointes
```

> **Pourquoi bind mount au lieu de volume Docker nommé ?** Tout est accessible directement via le filesystem du NAS (Synology File Station, SMB, backup). Tu peux supprimer entièrement le container Docker et redéployer sans rien perdre — tant que `data/` reste en place, tes utilisateurs / modèles / pièces jointes sont préservés.

---

## 1. Setup initial (à faire UNE seule fois)

### 1.1. Pousser le repo sur GitHub

Sur ta machine locale :

```bash
cd "/c/Users/simon/Desktop/Bot Whatsapp"
git init
git add .
git status                            # vérifie que .env.local et data/ ne sont PAS listés
git commit -m "initial"
git branch -M main
gh repo create whatsapp-scheduler --public --source=. --push
# (ou sur github.com → Create repo, puis git remote add origin … && git push -u origin main)
```

### 1.2. Vérifier que le workflow tourne

Va sur `https://github.com/youmeric/whatsapp-scheduler/actions`. Un job "Build & push Docker image" doit apparaître et passer ✅ en ~3-5 minutes.

À la fin, tu auras une image dispo à :
```
ghcr.io/youmeric/whatsapp-scheduler-web:latest
```

### 1.3. Rendre le package public (optionnel mais recommandé)

Par défaut, GHCR rend les nouveaux packages **privés** même si le repo est public. Pour le passer public :

1. `https://github.com/youmeric?tab=packages`
2. Clique sur le package `whatsapp-scheduler-web`
3. **Package settings** (à droite) → **Change visibility** → Public

Sinon il faudra que le NAS s'authentifie via un PAT (cf. section "repo privé" plus bas).

### 1.4. Setup du NAS

```bash
# Crée le dossier de travail
sudo mkdir -p /volume2/docker/whatsapp-scheduler
sudo chown $USER:$USER /volume2/docker/whatsapp-scheduler
cd /volume2/docker/whatsapp-scheduler

# Récupère les 2 fichiers depuis GitHub (raw)
wget https://raw.githubusercontent.com/youmeric/whatsapp-scheduler/main/docker-compose.yml
wget -O .env.production https://raw.githubusercontent.com/youmeric/whatsapp-scheduler/main/web/.env.production.example

# Édite les secrets
nano .env.production
# → AUTH_SECRET, N8N_API_KEY, BOOTSTRAP_ADMIN_USERNAME / _PASSWORD au minimum

# Crée le dossier data/ avec les bonnes permissions
# (le user `app` dans le container a l'uid 1001, pas le même que ton user host)
mkdir -p data
sudo chown -R 1001:1001 data

# Démarre
docker compose up -d
docker compose ps
docker compose logs -f web
```

Le site est accessible sur `http://<ip-du-nas>:4000`.

> 💡 **Sur Synology DSM** : tu peux aussi créer le dossier via File Station, mais le `chown` reste obligatoire (en SSH). Sans ça, le container redémarre en boucle avec une erreur `permission denied` sur `/app/data/app.db`.

### 1.5. Premier login

- Identifiant : `BOOTSTRAP_ADMIN_USERNAME`
- Mot de passe : `BOOTSTRAP_ADMIN_PASSWORD`

Puis va dans **Mon profil** pour changer ton mot de passe, et **Administration → Utilisateurs** pour créer d'autres comptes.

---

## 2. Mise à jour quotidienne

### 2.1. Côté local

```bash
git add . && git commit -m "feat: …" && git push
```

GitHub Actions builde l'image en ~3 min. Tu peux suivre dans l'onglet "Actions" du repo.

### 2.2. Côté NAS — option manuelle

```bash
cd /volume2/docker/whatsapp-scheduler
docker compose pull && docker compose up -d
```

### 2.3. Côté NAS — option automatique (Watchtower)

Décommente le service `watchtower` dans `docker-compose.yml` puis :

```bash
docker compose up -d
```

Watchtower poll ghcr.io toutes les 5 minutes et redémarre le container quand il voit une nouvelle image. Plus rien à faire après un `git push`.

---

## 3. Rollback

Toutes les images sont taguées avec le SHA du commit (ex. `sha-a1b2c3d`). Pour revenir à une version précédente :

1. Va sur `https://github.com/youmeric?tab=packages` → ouvre le package
2. Note le tag de la version qui marchait (ex. `sha-9f8e7d6`)
3. Sur le NAS :

```bash
cd /volume2/docker/whatsapp-scheduler
sed -i 's|:latest|:sha-9f8e7d6|' docker-compose.yml
docker compose up -d
```

Pour revenir à latest : remets `:latest` à la place du sha.

---

## 4. Backup de la DB

Avec le bind mount, la donnée est déjà sur le filesystem du NAS dans
`/volume2/docker/whatsapp-scheduler/data/`. Le simple fait que ce dossier
soit dans `/volume2/docker/` veut dire qu'il sera couvert par les backups
Hyper Backup / Snapshot Replication de DSM si tu en as.

Pour un backup applicatif "propre" (snapshot SQLite cohérent même pendant
une écriture en cours) :

```bash
cd /volume2/docker/whatsapp-scheduler
mkdir -p backups
# Snapshot SQLite via la commande backup (gère bien la concurrence)
docker compose exec -T web sh -c 'sqlite3 /app/data/app.db ".backup /app/data/_snapshot.db"'
mv data/_snapshot.db backups/app-$(date +%F).db
```

À automatiser via cron sur le NAS (DSM : **Task Scheduler**) :

```bash
# /volume2/docker/whatsapp-scheduler/backup.sh
#!/bin/sh
cd /volume2/docker/whatsapp-scheduler
mkdir -p backups
docker compose exec -T web sh -c 'sqlite3 /app/data/app.db ".backup /app/data/_snapshot.db"' \
  && mv data/_snapshot.db "backups/app-$(date +%F).db"
# Garde 30 jours
find backups -name "app-*.db" -mtime +30 -delete
```

```cron
0 3 * * * /volume2/docker/whatsapp-scheduler/backup.sh
```

> 💡 Pour les pièces jointes, `data/uploads/` est déjà sur le filesystem —
> couvert par tes backups DSM. Pas de manip applicative.

---

## 5. Repo privé

Si tu gardes le repo et le package GHCR privés, le NAS doit s'authentifier **une fois** :

```bash
# 1. Crée un Personal Access Token sur GitHub
#    https://github.com/settings/tokens/new
#    → cocher uniquement: read:packages
#    → expiration: long ou "no expiration"

# 2. Login GHCR sur le NAS
echo "ghp_xxxxxxxxxxxxxxxx" | docker login ghcr.io -u youmeric --password-stdin
```

Le login persiste dans `~/.docker/config.json`. Plus besoin de le refaire.

---

## 6. Migration depuis l'ancienne install

Si tu avais déjà un site qui tournait avec l'ancien setup (`build: ./web` +
volume Docker nommé `whatsapp_scheduler_data`), la nouvelle install utilise
un **bind mount** dans `/volume2/docker/whatsapp-scheduler/data/`. Il faut
copier la DB et les uploads de l'ancien volume vers le nouveau dossier.

```bash
# 1. Arrête l'ancien site
cd <chemin/de/l'ancienne/install>
docker compose down

# 2. Setup le nouveau dossier (cf. § 1.4 — sans démarrer encore)
sudo mkdir -p /volume2/docker/whatsapp-scheduler/data
cd /volume2/docker/whatsapp-scheduler

# 3. Copie le contenu de l'ancien volume vers le nouveau dossier
docker run --rm \
  -v whatsapp_scheduler_data:/source:ro \
  -v /volume2/docker/whatsapp-scheduler/data:/dest \
  alpine sh -c 'cp -av /source/. /dest/ && chown -R 1001:1001 /dest'

# 4. Vérifie que app.db est bien là
ls -la /volume2/docker/whatsapp-scheduler/data/
# → tu dois voir app.db et éventuellement uploads/

# 5. Démarre le nouveau site
docker compose up -d
docker compose logs -f web
```

Une fois que tu as vérifié que tout fonctionne (login OK, modèles
présents, journal d'audit visible), tu peux supprimer l'ancien volume :

```bash
docker volume rm whatsapp_scheduler_data
```

---

## 7. Troubleshooting

### Le workflow GitHub Actions échoue
Va dans l'onglet **Actions** et clique sur le job pour voir les logs. Causes habituelles :
- erreur de TypeScript dans le code → corriger localement, re-push
- timeout de build (trop long) → relancer manuellement (bouton "Re-run all jobs")

### `docker compose pull` ne trouve rien
- Le tag `latest` n'existe pas encore → pousse au moins une fois sur `main` et attends que l'Action passe ✅
- Le package est privé → cf. section 5

### "AUTH_SECRET env var is required"
Ton `.env.production` est vide ou mal placé. Doit être à côté du `docker-compose.yml`.

### Le container redémarre en boucle, logs : `permission denied` sur `/app/data/app.db`
Le dossier `data/` n'a pas les bonnes permissions. Le user `app` du container
est en `uid=1001` :
```bash
cd /volume2/docker/whatsapp-scheduler
sudo chown -R 1001:1001 data
docker compose restart
```

### "n8n GET /messages failed: 401"
`N8N_API_KEY` ne correspond pas à celle vérifiée dans tes nœuds n8n.

### "Module not found: better-sqlite3"
Pas censé arriver avec l'image GHCR (le binding est compilé sur le runner GitHub). Si ça arrive : repull.

```bash
docker compose pull web && docker compose up -d
```

### Logs
```bash
docker compose logs -f web --tail 200
```

---

## 8. Fichiers du repo qui comptent

| Fichier | Rôle |
|---|---|
| `.github/workflows/docker-build.yml` | Build & push image à chaque commit sur `main` |
| `web/Dockerfile` | Recette de l'image |
| `docker-compose.yml` | Compose pour le NAS (pull-only, pas de build) |
| `web/.env.production.example` | Template du `.env.production` à créer sur le NAS |
| `.gitignore` | **Critique** : empêche `.env.production`, `data/`, `tokens/` d'être commit |

⚠️ Avant chaque push : `git status` et vérifie qu'aucun fichier sensible n'est listé.
