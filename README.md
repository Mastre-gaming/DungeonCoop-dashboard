# DungeonCoop · Dashboard de dev

Une seule page web pour toute l'équipe de [DungeonCoop](https://github.com/Mastre-gaming/DungeonCoop) : en 30 secondes, chacun sait ce qui a bougé, ce qui l'attend et où en est le projet. **Elle se met à jour toute seule**, une ou deux secondes après un push, une PR ou une issue.

## Ce que la page montre

| Partie | Ce qu'on y voit |
|---|---|
| Pour toi | choisis qui tu es en haut : les PR qui attendent ta relecture, les conflits et tests rouges sur tes PR, tes tâches |
| PR et conflits | une carte par PR ouverte (jeu et dashboard) : tests, conflit, relecture, depuis combien de jours elle attend |
| Derniers push | qui a poussé quoi, sur quelle branche, il y a combien de temps |
| Qui fait quoi | une colonne par personne, plus ce que personne n'a pris |
| Avancée du projet | les jalons de `GAME_SPEC.md`, de D1 à M4, avec la part d'issues fermées |
| Liens utiles | le repo, les docs, Sprite Painter, le lanceur… (`liens.json`) |
| Idées | les issues « Idée » rangées par jalon, puis par priorité et par votes 👍 |

## Comment ça marche

```
GitHub ──webhook──▶ Worker « direct » ──WebSocket──▶ les pages ouvertes
   ▲                 (token, cache partagé)               │
   └──────────── lecture de l'API (5 000/h) ◀──────────────┘
```

- **Les données restent dans GitHub.** La page les lit et les rassemble, elle n'en garde aucune. Pour agir (poster une idée, s'assigner, fusionner), les boutons ouvrent GitHub.
- **En direct :** GitHub prévient le Worker à chaque événement (push, PR, relecture, issue, tests…). Le Worker vide son cache pour ce sujet et prévient les pages ouvertes, qui redessinent seulement les widgets concernés et affichent une notification.
- **Sans le Worker**, la page lit GitHub elle-même : elle est à jour à l'ouverture, mais ne bouge plus toute seule, et GitHub limite à 60 appels par heure (d'où un cache de 5 minutes).
- **Technique :** HTML, CSS et JavaScript simples, sans framework ni étape de build. Le Worker est un Cloudflare Worker avec un Durable Object.

## Les fichiers

```
index.html, style.css      la page et son look (les couleurs sont des jetons en haut de style.css)
liens.json                 les liens utiles : modifiables par tout le monde, sans code
equipe.json                l'équipe : une colonne « Qui fait quoi » par personne, et le nom affiché
src/config.js              les réglages : repos suivis, adresse du Worker, jalons, labels
src/github.js              toutes les lectures de données (démo, Worker, ou GitHub direct)
src/direct.js              la connexion en direct au Worker
src/main.js                dessine les widgets et tient l'en-tête à jour
src/widgets/*.js           un widget = un fichier
src/test.js                les vérifications de ?test
demo/donnees.js            des données inventées pour ?demo et ?test
worker/                    le Worker « direct » (son propre package.json)
outils/serveur.mjs         un serveur pour ouvrir la page sur ton ordi
outils/test.mjs            le test sans écran (Chrome ou Edge), avec captures
wrangler.jsonc             la publication de la page par Cloudflare
```

## Sur ton ordi

Il faut [Node.js](https://nodejs.org) 22 ou plus. Rien à installer pour la page.

```
node outils/serveur.mjs          puis ouvre http://localhost:8000
                                 ou http://localhost:8000/?demo pour une page remplie de données inventées
node outils/test.mjs             les 35 vérifications, et des captures dans captures/
```

Utile dans l'adresse : `?demo` (données inventées), `?sans-direct` (lire GitHub sans le Worker), `?direct=http://localhost:8787` (un Worker lancé sur ton ordi), `?moi=PCrrfng` (voir la page comme quelqu'un d'autre).

**Le Worker sur ton ordi :** dans `worker/`, `npm install`, puis crée `worker/.dev.vars` avec la ligne `WEBHOOK_SECRET=un-secret-de-test` et lance `npm run dev`. Ensuite, `node outils/test.mjs --direct http://localhost:8787 --secret un-secret-de-test` envoie un faux webhook signé et vérifie que la page le montre. `npm test` dans `worker/` lance ses tests sans Cloudflare.

## Changer quelque chose

- **Un lien ou ton nom :** sur GitHub, ouvre `liens.json` ou `equipe.json`, clique sur le crayon, modifie, et propose le changement dans une PR. Pas besoin de code.
- **Un widget :** chaque fichier de `src/widgets/` exporte `sujets` (ce qui le rend périmé : `'prs'`, `'commits'`, `'issues'`) et `afficher(ctx)`, qui renvoie ce qu'il faut dessiner. Construis la page avec `el()` de `src/outils.js`, jamais avec `innerHTML` : n'importe qui peut ouvrir une issue sur un repo public, et un titre doit toujours rester du texte.
- **Un nouveau chemin de l'API GitHub :** ajoute-le aussi dans `demo/donnees.js` (pour ?demo et ?test) et dans `worker/src/chemins.js` (le Worker refuse les chemins qu'il ne connaît pas).
- **Toute nouvelle fonction** reçoit sa vérification dans `src/test.js`. Si un widget plante, seule sa carte affiche l'erreur.

## Mise en ligne (Cloudflare, compte de Paul)

**La page** est un Worker relié à ce repo (Workers Builds). Elle se publie toute seule à chaque fusion sur `main`, avec la commande `npx wrangler deploy`. Le nom dans `wrangler.jsonc` doit être exactement celui du projet dans Cloudflare. Pour un lien d'aperçu sur chaque PR : dans le projet, *Settings* → *Build* → *Branch control* → **Builds for non-production branches**.

**Le Worker direct**, depuis `worker/` (une fois, puis à chaque changement de `worker/`) :

1. `npm install`, `npx wrangler login`, puis `npm run deploy`. Il est publié à `https://dungeoncoop-direct.mastredev.workers.dev`, l'adresse déjà mise dans `src/config.js`.
2. **Le token GitHub, en lecture seule :** GitHub → *Settings* → *Developer settings* → *Fine-grained tokens* → *Generate new token*. *Repository access* : **Public repositories**, aucune permission. Puis `npx wrangler secret put GITHUB_TOKEN` et colle-le. Il ne va jamais dans un fichier.
3. **Le secret des webhooks :** `npx wrangler secret put WEBHOOK_SECRET`, avec une longue chaîne aléatoire, la même qu'à l'étape 4.
4. **Les webhooks**, sur le repo du jeu et sur celui-ci : *Settings* → *Webhooks* → *Add webhook*.
   - *Payload URL* : `https://dungeoncoop-direct.mastredev.workers.dev/webhook` · *Content type* : `application/json` · *Secret* : celui de l'étape 3.
   - *Let me select individual events* : Branch or tag creation, Branch or tag deletion, Check runs, Check suites, Issue comments, Issues, Labels, Milestones, Pull requests, Pull request reviews, Pushes, Statuses.
   - GitHub envoie aussitôt un « ping » : les pages ouvertes affichent « Webhook branché sur … ✔ ».
5. **Vérifier :** `https://dungeoncoop-direct.mastredev.workers.dev/` doit dire `"token": true` et `"secret": true`, et compter les pages connectées.

Le plan gratuit suffit largement (100 000 requêtes par jour ; une page connectée ne coûte rien tant que rien ne se passe).

## Règles

- On suit le [guide d'équipe du jeu](https://github.com/Mastre-gaming/DungeonCoop/blob/main/docs/GUIDE_EQUIPE.md) : une branche par changement, une PR, une seule chose par PR.
- Les vérifications (tests du Worker, test de la page sans écran) doivent être vertes avant de fusionner.
- Pas de ligne « Co-authored-by » dans les commits.
- Jamais de secret dans le repo (token, secret de webhook, `.dev.vars`).
