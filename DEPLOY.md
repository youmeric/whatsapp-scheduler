# Déploiement — site web (Docker via GitHub Container Registry)

Workflow :
1. **Local** → `git push` sur GitHub (branche `main`)
2. **GitHub Actions** build l'image Docker et la pousse vers `ghcr.io`
3. **NAS** pull l'image et redémarre le container

Le NAS n'a **pas besoin** de cloner le repo. Il lui faut juste 2 fichiers :
```
/srv/whatsapp-scheduler/
├── docker-compose.yml
└── .env.production
```

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

Va sur `https://github.com/<TON-USER>/<TON-REPO>/actions`. Un job "Build & push Docker image" doit apparaître et passer ✅ en ~3-5 minutes.

À la fin, tu auras une image dispo à :
```
ghcr.io/<TON-USER>/<TON-REPO>-web:latest
```

### 1.3. Rendre le package public (optionnel mais recommandé)

Par défaut, GHCR rend les nouveaux packages **privés** même si le repo est public. Pour le passer public :

1. `https://github.com/<TON-USER>?tab=packages`
2. Clique sur le package `<TON-REPO>-web`
3. **Package settings** (à droite) → **Change visibility** → Public

Sinon il faudra que le NAS s'authentifie via un PAT (cf. section "repo privé" plus bas).

### 1.4. Setup du NAS (Debian)

```bash
# Crée le dossier de travail
sudo mkdir -p /srv/whatsapp-scheduler
sudo chown $USER:$USER /srv/whatsapp-scheduler
cd /srv/whatsapp-scheduler

# Récupère les 2 fichiers depuis GitHub (raw)
wget https://raw.githubusercontent.com/<TON-USER>/<TON-REPO>/main/docker-compose.yml
wget -O .env.production.example https://raw.githubusercontent.com/<TON-USER>/<TON-REPO>/main/web/.env.production.example

# Édite le compose pour mettre TON image
sed -i 's|<USER>/<REPO>|<TON-USER>/<TON-REPO>|g' docker-compose.yml

# Crée et remplis .env.production
cp .env.production.example .env.production
nano .env.production
# → AUTH_SECRET, N8N_API_KEY, BOOTSTRAP_ADMIN_USERNAME / _PASSWORD au minimum

# Démarre
docker compose up -d
docker compose ps
docker compose logs -f web
```

Le site est accessible sur `http://<ip-du-nas>:4000`.

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
cd /srv/whatsapp-scheduler
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

1. Va sur `https://github.com/<TON-USER>?tab=packages` → ouvre le package
2. Note le tag de la version qui marchait (ex. `sha-9f8e7d6`)
3. Sur le NAS :

```bash
cd /srv/whatsapp-scheduler
sed -i 's|:latest|:sha-9f8e7d6|' docker-compose.yml
docker compose up -d
```

Pour revenir à latest : remets `:latest` à la place du sha.

---

## 4. Backup de la DB

```bash
# Crée un backup ponctuel
docker compose exec web sh -c 'sqlite3 /app/data/app.db ".backup /tmp/backup.db"'
docker compose cp web:/tmp/backup.db ./backup-$(date +%F).db
```

À automatiser via cron sur le NAS :

```cron
0 3 * * * cd /srv/whatsapp-scheduler && docker compose cp web:/app/data/app.db ./backups/app-$(date +\%F).db && find ./backups -name "app-*.db" -mtime +30 -delete
```

(garde 30 jours de backups, supprime les plus anciens)

---

## 5. Repo privé

Si tu gardes le repo et le package GHCR privés, le NAS doit s'authentifier **une fois** :

```bash
# 1. Crée un Personal Access Token sur GitHub
#    https://github.com/settings/tokens/new
#    → cocher uniquement: read:packages
#    → expiration: long ou "no expiration"

# 2. Login GHCR sur le NAS
echo "ghp_xxxxxxxxxxxxxxxx" | docker login ghcr.io -u <TON-USER> --password-stdin
```

Le login persiste dans `~/.docker/config.json`. Plus besoin de le refaire.

---

## 6. Troubleshooting

### Le workflow GitHub Actions échoue
Va dans l'onglet **Actions** et clique sur le job pour voir les logs. Causes habituelles :
- erreur de TypeScript dans le code → corriger localement, re-push
- timeout de build (trop long) → relancer manuellement (bouton "Re-run all jobs")

### `docker compose pull` ne trouve rien
- Le tag `latest` n'existe pas encore → pousse au moins une fois sur `main` et attends que l'Action passe ✅
- Le package est privé → cf. section 5

### "AUTH_SECRET env var is required"
Ton `.env.production` est vide ou mal placé. Doit être à côté du `docker-compose.yml`.

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

## 7. Fichiers du repo qui comptent

| Fichier | Rôle |
|---|---|
| `.github/workflows/docker-build.yml` | Build & push image à chaque commit sur `main` |
| `web/Dockerfile` | Recette de l'image |
| `docker-compose.yml` | Compose pour le NAS (pull-only, pas de build) |
| `web/.env.production.example` | Template du `.env.production` à créer sur le NAS |
| `.gitignore` | **Critique** : empêche `.env.production`, `data/`, `tokens/` d'être commit |

⚠️ Avant chaque push : `git status` et vérifie qu'aucun fichier sensible n'est listé.
