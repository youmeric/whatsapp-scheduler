# Webhooks n8n à créer

Le site web parle à n8n via 3 webhooks HTTP. n8n se charge ensuite de lire/écrire dans le Google Sheet.

## 1. Préparation du Google Sheet

Avant de créer les workflows n8n, ajoute ces colonnes à ton Sheet :

### Feuille 1 — Messages programmés

Ordre des colonnes recommandé :

| id | date_envoi | destinataire | message | envoye | cree_par | cree_le |
|----|------------|--------------|---------|--------|----------|---------|

- `id` : identifiant unique (UUID, ex. `a3f4b1c2-...`). Généré par le site web à la création.
- `cree_par` : nom de l'utilisateur qui a créé le message (ex. `simon`).
- `cree_le` : timestamp ISO (ex. `2026-04-30T14:23:00Z`).

### Feuille 2 — Destinataires (déjà en place)

| nom | numero |
|-----|--------|

Aucun changement.

---

## 2. Variable d'environnement côté site

Dans `web/.env.local`, remplis `N8N_WEBHOOK_BASE` avec l'URL de base de tes webhooks n8n :

```
N8N_WEBHOOK_BASE=http://localhost:5678/webhook
```

(Adapte le port et l'host selon ton setup. Pas de slash final.)

Si la variable est vide, le site continue à utiliser les données de démo (mock) — pratique pour le dev frontend.

### Sécurité optionnelle

Si tu veux protéger les webhooks (recommandé en prod) :

```
N8N_API_KEY=une-cle-secrete-aleatoire
```

Le site enverra le header `X-API-Key: <valeur>`. Côté n8n, ajoute un nœud "IF" en début de workflow qui vérifie `{{ $json.headers["x-api-key"] }} === "une-cle-secrete-aleatoire"`.

---

## 3. Webhook 1 — Lister les messages

**But** : afficher la liste sur la page `/messages`.

- **Méthode** : `GET`
- **Path** : `messages` → URL finale `http://localhost:5678/webhook/messages`
- **Réponse attendue** : tableau JSON

```json
[
  {
    "id": "a3f4b1c2-...",
    "date_envoi": "2026-05-02",
    "destinataire": "Marie Dupont",
    "message": "Bonjour Marie, ...",
    "envoye": false,
    "cree_par": "simon",
    "cree_le": "2026-04-29T15:30:00Z"
  }
]
```

### Workflow n8n

1. **Webhook** node
   - HTTP Method : `GET`
   - Path : `messages`
   - Respond : `Using 'Respond to Webhook' Node`
2. **Google Sheets** node (Read rows)
   - Operation : `Read Rows`
   - Sheet : feuille 1
3. **Code** node (optionnel, pour normaliser)
   - Convertit `envoye` en booléen (le Sheet renvoie souvent `"TRUE"` ou `1`)
   ```js
   return $input.all().map(item => ({
     json: {
       id: String(item.json.id ?? ""),
       date_envoi: String(item.json.date_envoi ?? ""),
       destinataire: String(item.json.destinataire ?? ""),
       message: String(item.json.message ?? ""),
       envoye: item.json.envoye === true || item.json.envoye === "TRUE" || item.json.envoye === 1,
       cree_par: String(item.json.cree_par ?? ""),
       cree_le: String(item.json.cree_le ?? ""),
     }
   }))
   ```
4. **Respond to Webhook** node
   - Respond With : `All Incoming Items`

---

## 4. Webhook 2 — Créer un message

**But** : ajouter une ligne dans le Sheet quand l'utilisateur soumet le formulaire.

- **Méthode** : `POST`
- **Path** : `messages`  *(même path que GET, n8n distingue par méthode si tu crées un 2ème workflow ; ou utilise un path différent comme `messages-create`)*
- **Body reçu** :

```json
{
  "id": "a3f4b1c2-...",
  "date_envoi": "2026-05-02",
  "destinataire": "Marie Dupont",
  "message": "Bonjour Marie, ...",
  "envoye": false,
  "cree_par": "simon",
  "cree_le": "2026-04-30T14:23:00Z"
}
```

- **Réponse attendue** : `200 OK` avec `{ "ok": true }` (ou un body vide ; le site ne lit pas le body)

### Workflow n8n

1. **Webhook** node
   - HTTP Method : `POST`
   - Path : `messages-create` (ou `messages` si méthode séparée)
2. **Google Sheets** node (Append row)
   - Operation : `Append Row`
   - Sheet : feuille 1
   - Map les champs du body vers les colonnes
3. **Respond to Webhook** node
   - Respond With : `Text` → `{"ok":true}`
   - Response Headers : `Content-Type: application/json`

---

## 4ter. Webhook 7 — Modifier un message (PUT)

**But** : mettre à jour une ligne existante de la feuille 1 (depuis le bouton crayon de la liste des messages).

- **Méthode** : `PUT`
- **Path** : `messages` (même path que GET / POST / DELETE, méthode différente)
- **Body** :
  ```json
  {
    "id": "a3f4b1c2-...",
    "date_envoi": "2026-05-12",
    "destinataire": "33650601057@c.us",
    "message": "Texte mis à jour"
  }
  ```
- **Réponse** : `200 OK`

> Le site n'appelle ce webhook **que pour les messages non envoyés** (le serveur refuse l'édition d'un `envoye=true`). Pas besoin de gérer ce cas côté n8n, mais tu peux ajouter un check de sécurité si tu veux.

### Workflow n8n

1. **Webhook** node — `PUT /messages` (vérifie que le nœud s'appelle `Webhook`)
2. **If** node — vérifie `X-API-Key`
3. Sortie `true` → **Google Sheets** node (lecture)
   - **Operation** : `Get Row(s) in Sheet`
   - **Sheet** : feuille 1
4. **Code** node — calcule l'index de la ligne :
   ```js
   const target = $('Webhook').first().json.body.id
   const rows = $input.all()
   const idx = rows.findIndex(r => r.json.id === target)
   if (idx < 0) {
     // Pas trouvé : on signale une erreur
     throw new Error(`Message ${target} introuvable`)
   }
   const body = $('Webhook').first().json.body
   return [{
     json: {
       rowIndex: idx + 2, // +2 car ligne 1 = en-tête
       id: body.id,
       date_envoi: body.date_envoi,
       destinataire: body.destinataire,
       message: body.message,
     }
   }]
   ```
5. **Google Sheets** node (mise à jour)
   - **Operation** : `Update Row`
   - **Sheet** : feuille 1
   - **Row Number** : `{{ $json.rowIndex }}` (ou utiliser le mode "Match by column" sur `id` si tu préfères, plus simple : skipper le Code node et matcher par `id`)
   - **Values to Send** :
     | Colonne | Valeur (Expression) |
     |---------|---------------------|
     | `date_envoi`   | `{{ $json.date_envoi }}` |
     | `destinataire` | `{{ $json.destinataire }}` |
     | `message`      | `{{ $json.message }}` |
6. **Respond to Webhook** → `JSON` body `{"ok": true}` code `200`
7. Sortie `false` du If (clé manquante) → 401

> 💡 Variante plus simple si ta version de n8n supporte "Update Row by Matching Column" : remplace les étapes 3-5 par un seul nœud Google Sheets `Update` avec **Match Column = `id`** et la valeur `{{ $json.body.id }}`. Pas de Code node nécessaire.

---

## 4bis. Webhook 6 — Supprimer un message (DELETE)

**But** : retirer une ligne de la feuille 1 quand l'utilisateur clique sur la corbeille à côté d'un message.

- **Méthode** : `DELETE`
- **Path** : `messages` (même path que GET et POST, méthode différente)
- **Query string** : `?id=<uuid>`
- **Réponse** : `200 OK`

### Workflow n8n

1. **Webhook** node — `DELETE /messages`
2. **If** node — vérifie `X-API-Key` (copie depuis un autre workflow)
3. Sortie `true` → **Google Sheets** node (Read) pour récupérer toutes les lignes
   - **Operation** : `Get Row(s) in Sheet`
   - **Sheet** : feuille 1
4. **Code** node — calcule l'index de la ligne à supprimer :
   ```js
   const target = $('Webhook').first().json.query.id
   const rows = $input.all()
   const idx = rows.findIndex(r => r.json.id === target)
   if (idx < 0) {
     // pas trouvé : on répond OK quand même pour rendre la suppression idempotente
     return [{ json: { rowIndex: null } }]
   }
   return [{ json: { rowIndex: idx + 2 } }] // +2 car la ligne 1 = en-tête
   ```
5. **If** node — vérifie que `rowIndex` n'est pas null (sinon, skip la suppression)
6. Si `rowIndex` non null → **Google Sheets** node (Delete)
   - **Operation** : `Delete Rows`
   - **Sheet** : feuille 1
   - **Start Row** : `{{ $json.rowIndex }}`
   - **Number of Rows** : `1`
7. **Respond to Webhook** → `JSON` body `{"ok": true}` code `200`
8. Sortie `false` du premier If (clé manquante) → 401

> Même remarque que pour DELETE recipients : si tu galères avec la suppression physique, tu peux faire un **soft delete** (ajouter une colonne `archived` et juste marquer la ligne).

---

## 5. Webhook 4 — Ajouter un destinataire (POST)

**But** : enregistrer un nouveau contact dans la feuille 2 depuis le formulaire `/recipients`.

- **Méthode** : `POST`
- **Path** : `recipients`
- **Body reçu** :
  ```json
  { "nom": "Marie Dupont", "numero": "33612345678@c.us" }
  ```
- **Réponse** : `200 OK`

### Workflow n8n

1. **Webhook** node — `POST /recipients`
2. **If** node — vérifie `X-API-Key` (copie le nœud d'un autre workflow)
3. Sortie `true` → **Google Sheets** node
   - **Resource** : `Sheet Within Document`
   - **Operation** : `Append Row`
   - **Sheet** : feuille 2 (destinataires)
   - **Values to Send** :
     | Colonne | Valeur (Expression) |
     |---------|---------------------|
     | `nom`    | `{{ $json.body.nom }}` |
     | `numero` | `{{ $json.body.numero }}` |
4. **Respond to Webhook** → `JSON` body `{"ok": true}` code `200`
5. Sortie `false` → 401 (comme les autres)

---

## 6. Webhook 5 — Supprimer un destinataire (DELETE)

**But** : retirer un contact de la feuille 2 (depuis le bouton corbeille de la page `/recipients`).

- **Méthode** : `DELETE`
- **Path** : `recipients`
- **Query string** : `?nom=Marie+Dupont&numero=33612345678@c.us`
- **Réponse** : `200 OK`

> ⚠️ Le matching se fait sur **`nom` + `numero`** (pas seulement `numero`), pour éviter de supprimer la mauvaise ligne quand 2 contacts partagent un numéro.

### Workflow n8n

1. **Webhook** node — `DELETE /recipients` (vérifie qu'il s'appelle bien **`Webhook`** en haut à gauche)
2. **If** node — vérifie `X-API-Key` (copie depuis un autre workflow)
3. Sortie `true` → **Google Sheets** node (lecture)
   - **Operation** : `Get Row(s) in Sheet`
   - **Sheet** : feuille 2 (destinataires)
4. **Code** node (calcul de l'index de la ligne) :
   ```js
   // $input contient les lignes du Google Sheets précédent.
   // Pour la query string, on remonte au nœud "Webhook" par son nom.
   const targetNom = $('Webhook').first().json.query.nom
   const targetNumero = $('Webhook').first().json.query.numero

   const rows = $input.all()
   const idx = rows.findIndex(r =>
     r.json.nom === targetNom && r.json.numero === targetNumero
   )
   if (idx < 0) {
     // Pas trouvé : on répond OK quand même (suppression idempotente)
     return [{ json: { rowIndex: null } }]
   }
   return [{ json: { rowIndex: idx + 2 } }] // +2 car la ligne 1 = en-tête
   ```
5. **If** node — condition `{{ $json.rowIndex }}` — `is not empty` (true = ligne trouvée).
6. Sortie `true` du second If → **Google Sheets** node (suppression)
   - **Operation** : `Delete Rows`
   - **Sheet** : feuille 2
   - **Start Row** : `{{ $json.rowIndex }}`
   - **Number of Rows** : `1`
7. **Respond to Webhook** → `JSON` body `{"ok": true}` code `200`
8. Sortie `false` du premier If (clé manquante) → Respond `Unauthorized` code `401`

> 💡 Si tu galères avec le DELETE, dis-le-moi, je te ferai une variante "soft delete" : on ne supprime pas la ligne, on ajoute juste une colonne `archived = TRUE`. C'est souvent plus simple et plus sûr.

---

## 7. Webhook 3 — Lister les destinataires

**But** : remplir le menu déroulant du formulaire et la page `/recipients`.

- **Méthode** : `GET`
- **Path** : `recipients` → URL finale `http://localhost:5678/webhook/recipients`
- **Réponse attendue** :

```json
[
  { "nom": "Marie Dupont", "numero": "+33612345678" },
  { "nom": "Jean Martin",  "numero": "+33687654321" }
]
```

### Workflow n8n

1. **Webhook** node — `GET /recipients`
2. **Google Sheets** node — `Read Rows` sur la feuille 2
3. **Respond to Webhook** node — `All Incoming Items`

---

## 8. Test rapide depuis ton terminal

Une fois les 3 webhooks créés et activés (clic sur "Active" en haut à droite de chaque workflow n8n) :

```bash
# Lister les messages
curl http://localhost:5678/webhook/messages

# Lister les destinataires
curl http://localhost:5678/webhook/recipients

# Créer un message de test
curl -X POST http://localhost:5678/webhook/messages \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-1",
    "date_envoi": "2026-12-31",
    "destinataire": "Test",
    "message": "Hello",
    "envoye": false,
    "cree_par": "simon",
    "cree_le": "2026-04-30T14:00:00Z"
  }'
```

Si les 3 commandes répondent correctement, le site web pourra s'y brancher en remplissant `N8N_WEBHOOK_BASE` dans `.env.local`.
