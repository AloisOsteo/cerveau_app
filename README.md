# Guide de déploiement — AloBrain sur Railway

## Structure du projet

```
alobrain/
├── server.js          ← backend Node.js
├── package.json
└── public/
    └── index.html     ← frontend (servi par le backend)
```

---

## Étape 1 — Préparer le dépôt GitHub

1. Va sur [github.com](https://github.com) et crée un nouveau dépôt **privé** nommé `alobrain`
2. Upload les 3 fichiers dans cette structure :
   - `server.js` à la racine
   - `package.json` à la racine
   - `public/index.html` dans un dossier `public/`

---

## Étape 2 — Créer le projet Railway

1. Va sur [railway.com](https://railway.com) → **Start a New Project**
2. Choisis **Deploy from GitHub repo**
3. Connecte ton compte GitHub si ce n'est pas fait
4. Sélectionne le dépôt `alobrain`
5. Railway détecte automatiquement Node.js et lance le déploiement

---

## Étape 3 — Ajouter PostgreSQL

1. Dans ton projet Railway, clique **+ New** → **Database** → **Add PostgreSQL**
2. Railway crée la base et injecte automatiquement la variable `DATABASE_URL` dans ton service Node.js
3. Rien d'autre à faire — le `server.js` s'en occupe

---

## Étape 4 — Ajouter la clé API Anthropic

1. Dans ton service Node.js Railway, va dans l'onglet **Variables**
2. Clique **+ New Variable**
3. Nom : `ANTHROPIC_API_KEY`
4. Valeur : ta clé Anthropic (celle qui était dans le code)
5. Clique **Add** → Railway redémarre automatiquement

---

## Étape 5 — Obtenir l'URL publique

1. Dans ton service Node.js, va dans l'onglet **Settings**
2. Section **Networking** → clique **Generate Domain**
3. Railway te donne une URL du type `alobrain-production.up.railway.app`
4. C'est l'URL à donner au client — l'app est en ligne !

---

## Résumé des variables d'environnement

| Variable | Valeur | Ajoutée par |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL | Railway (automatique) |
| `ANTHROPIC_API_KEY` | Ta clé Anthropic | Toi (étape 4) |
| `PORT` | Port d'écoute | Railway (automatique) |

---

## En cas de problème

- **Logs en temps réel** : onglet **Deployments** → clique sur le déploiement → **View Logs**
- **Erreur DB** : vérifier que le service PostgreSQL est bien dans le même projet Railway
- **Erreur Claude** : vérifier que `ANTHROPIC_API_KEY` est correctement saisie sans espace

---

## Migration depuis la version localStorage (Netlify)

Si le client a des données dans la version Netlify, il peut les récupérer :
1. Ouvrir la version Netlify dans son navigateur
2. Ouvrir la console (F12 → Console)
3. Taper : `copy(localStorage.getItem('moncerveau_items'))`
4. Coller le résultat et te l'envoyer
5. On peut importer ces données directement en base via Railway
