# DungeonCoop · Dashboard de dev

Une seule page web pour toute l'équipe de [DungeonCoop](https://github.com/Mastre-gaming/DungeonCoop) : en 30 secondes, chacun sait ce qui a bougé, ce qui l'attend et où en est le projet. **Elle se met à jour toute seule**, une ou deux secondes après un push, une PR ou une issue.

## Ce que la page montre

| Partie | Ce qu'on y voit |
|---|---|
| L'entrée | le mot de passe de l'équipe et ton nom de dev, une fois tous les 30 jours sur chaque navigateur |
| Aller au camp | le bouton du camp, en haut (une icône en pixels LPC, le feu qui crépite) : ouvre le jeu en ligne (le camp) dans un nouvel onglet, pour héberger ou rejoindre. L'adresse est dans `src/config.js` (`jeuEnLigne`) |
| Pour toi | les PR qui attendent ta relecture, les conflits et tests rouges sur tes PR, tes tâches |
| PR et conflits | une carte par PR ouverte (jeu et dashboard) : tests, conflit, relecture, depuis combien de jours elle attend |
| Derniers push | qui a poussé quoi, sur quelle branche, il y a combien de temps |
| Tableau de travail | les tâches en colonnes, par axe (combats, histoire, pixel art…) ou par état (à faire, en cours, fait), avec l'avancée de chaque axe. Connecté avec GitHub : glisser une carte, « Je prends », « Fait », changer d'axe, créer une carte |
| Qui fait quoi | une colonne par personne, plus ce que personne n'a pris |
| Avancée du projet | les jalons de `GAME_SPEC.md`, de D1 à M4, avec la part d'issues fermées |
| Liens utiles | le repo, les docs, Sprite Painter, le lanceur… (`liens.json`) |
| Sprite Painter | l'éditeur de persos de BABA, en ligne sur `/sprite-painter/` (derrière le mot de passe) |
| Messages | la bulle 💬 en bas à gauche : des messages courts à l'équipe, en direct ; `#12` mène à l'issue ou la PR, `@nom` prévient la personne. Un petit son quand un message des autres arrive et qu'on ne lit pas la messagerie (🔔 dans le panneau pour le couper ; le navigateur attend un premier clic sur la page). Le titre de l'onglet compte les non-lus : « (3) DungeonCoop · … » |
| Thème | clair, auto ou sombre, en haut à droite |
| Idées | les issues « Idée » rangées par jalon, puis par priorité et par votes 👍 |

## Comment ça marche

```
GitHub ──webhook──▶ Worker « direct » ──WebSocket──▶ les pages ouvertes
   ▲                 (token, cache partagé)               │
   └──────────── lecture de l'API (5 000/h) ◀──────────────┘
```

- **Une porte devant la page.** Un petit Worker (`porte/`) passe devant chaque fichier : sans le mot de passe de l'équipe, on ne voit que l'écran d'entrée. Le mot de passe n'est jamais dans le repo (il est public) : c'est le secret Cloudflare `MOT_DE_PASSE`. Après l'entrée, le navigateur garde un laissez-passer signé 30 jours ; changer le mot de passe déconnecte tout le monde. Le nom tapé à l'entrée remplace « Je suis » : « Paul » est reconnu comme `PCrrfng` grâce à `equipe.json`.
- **La messagerie** passe par le Worker direct, sur la même connexion que le direct. La page présente le laissez-passer de l'entrée ; le Worker le vérifie avec le même secret `MOT_DE_PASSE` et signe chaque message du nom tapé à l'entrée (une page ne peut pas écrire au nom d'un autre). Les 1 000 derniers messages sont gardés dans la base du Worker ; les 100 derniers s'affichent. Pour les longues discussions, il y a Discord.
- **Les données restent dans GitHub.** La page les lit et les rassemble, elle n'en garde aucune. Pour agir (poster une idée, fusionner), les boutons ouvrent GitHub. Seul le tableau de travail écrit, une fois connecté : dans les issues du jeu, avec le compte GitHub de la personne.
- **En direct :** GitHub prévient le Worker à chaque événement (push, PR, relecture, issue, tests…). Le Worker vide son cache pour ce sujet et prévient les pages ouvertes, qui redessinent seulement les widgets concernés et affichent une notification.
- **Sans le Worker**, la page lit GitHub elle-même : elle est à jour à l'ouverture, mais ne bouge plus toute seule, et GitHub limite à 60 appels par heure (d'où un cache de 5 minutes).
- **Technique :** HTML, CSS et JavaScript simples, sans framework ni étape de build. Le Worker est un Cloudflare Worker avec un Durable Object.

**Sprite Painter** n'est pas copié ici : la porte relit le `demo.html` de BABA sur GitHub (sa branche `tools/lpc-sprite-mods`, puis `main` le jour où elle sera fusionnée ; les adresses sont dans `wrangler.jsonc`, variable `SPRITE_PAINTER`). Quand BABA refait son `demo.html` (`npm run demo` dans l'éditeur), la version en ligne suit en 5 minutes. Tout marche dans le navigateur (peindre, calques, export PNG, crédits ; les mods se gardent dans ton navigateur) **sauf l'import** depuis le générateur LPC, qui demande le serveur de BABA sur un ordi : pour un nouveau perso, ouvre une issue avec le modèle « Nouveau personnage ».

## Les fichiers

```
index.html, style.css      la page et son look (les couleurs sont des jetons en haut de style.css)
liens.json                 les liens utiles : modifiables par tout le monde, sans code
equipe.json                l'équipe : une colonne « Qui fait quoi » par personne, et le nom affiché
src/config.js              les réglages : repos suivis, adresse du Worker, jalons, labels
src/github.js              toutes les lectures de données (démo, Worker, ou GitHub direct)
src/direct.js              la connexion en direct au Worker
src/connexion.js           la connexion GitHub du tableau de travail, et ses écritures dans les issues
src/main.js                dessine les widgets et tient l'en-tête à jour
src/theme.js               le réglage clair / auto / sombre, gardé dans le navigateur
src/messagerie.js          la bulle 💬 et le panneau des messages
src/son.js                 le petit son des nouveaux messages, fabriqué par le navigateur (pas de fichier)
src/widgets/*.js           un widget = un fichier
src/test.js                les vérifications de ?test
demo/donnees.js            des données inventées pour ?demo et ?test
worker/                    le Worker « direct » (son propre package.json)
worker/src/session.js      le laissez-passer, vérifié par la porte et par le Worker direct
worker/src/messagerie.js   la messagerie, sans rien de Cloudflare (testée avec Node)
outils/serveur.mjs         un serveur pour ouvrir la page sur ton ordi
outils/test.mjs            le test sans écran (Chrome ou Edge), avec captures
outils/annonce.mjs         poster un message dans la messagerie depuis un terminal (Claude y signale les conflits)
wrangler.jsonc             la publication de la page par Cloudflare
porte/index.js             la porte : mot de passe, laissez-passer, /session
porte/page.js              l'écran d'entrée
```

## Sur ton ordi

Il faut [Node.js](https://nodejs.org) 22 ou plus. Rien à installer pour la page.

```
node outils/serveur.mjs          puis ouvre http://localhost:8000
                                 ou http://localhost:8000/?demo pour une page remplie de données inventées
node outils/test.mjs             les 73 vérifications, et des captures dans captures/
```

Utile dans l'adresse : `?demo` (données inventées), `?sans-direct` (lire GitHub sans le Worker), `?direct=http://localhost:8787` (un Worker lancé sur ton ordi), `?moi=PCrrfng` (voir la page comme quelqu'un d'autre).

**Le Worker sur ton ordi :** dans `worker/`, `npm install`, puis crée `worker/.dev.vars` avec deux lignes, `WEBHOOK_SECRET=un-secret-de-test` et `MOT_DE_PASSE=un-mot-de-passe-de-test`, et lance `npm run dev`. Ensuite, `node outils/test.mjs --direct http://localhost:8787 --secret un-secret-de-test --mot-de-passe un-mot-de-passe-de-test` envoie un faux webhook signé et vérifie que la page le montre, puis essaie la messagerie (laissez-passer bon et faux, messages dans les deux sens, une page sans mot de passe qui ne reçoit rien). `npm test` dans `worker/` lance ses tests sans Cloudflare.

**La porte sur ton ordi :** `outils/serveur.mjs` sert la page sans porte. Pour l'essayer, crée `.dev.vars` à la racine avec `MOT_DE_PASSE=un-mot-de-passe-de-test`, puis `npx wrangler dev --port 8788 --persist-to ../.wrangler-dashboard` et ouvre http://localhost:8788. Le test de l'entrée : `CAPTURES=../captures-porte node outils/test.mjs --porte http://localhost:8788 --mot-de-passe un-mot-de-passe-de-test` (les captures vont hors du repo, sinon wrangler redémarre à chaque image).

## Changer quelque chose

- **Un lien ou ton nom :** sur GitHub, ouvre `liens.json` ou `equipe.json`, clique sur le crayon, modifie, et propose le changement dans une PR. Pas besoin de code.
- **Un widget :** chaque fichier de `src/widgets/` exporte `sujets` (ce qui le rend périmé : `'prs'`, `'commits'`, `'issues'`) et `afficher(ctx)`, qui renvoie ce qu'il faut dessiner. Construis la page avec `el()` de `src/outils.js`, jamais avec `innerHTML` : n'importe qui peut ouvrir une issue sur un repo public, et un titre doit toujours rester du texte.
- **Un nouveau chemin de l'API GitHub :** ajoute-le aussi dans `demo/donnees.js` (pour ?demo et ?test) et dans `worker/src/chemins.js` (le Worker refuse les chemins qu'il ne connaît pas).
- **Toute nouvelle fonction** reçoit sa vérification dans `src/test.js`. Si un widget plante, seule sa carte affiche l'erreur.

## Mise en ligne (Cloudflare, compte de Paul)

**La page** est un Worker relié à ce repo (Workers Builds). Elle se publie toute seule à chaque fusion sur `main`, avec la commande `npx wrangler deploy`. Le nom dans `wrangler.jsonc` doit être exactement celui du projet dans Cloudflare. Pour un lien d'aperçu sur chaque PR : dans le projet, *Settings* → *Build* → *Branch control* → **Builds for non-production branches**.

**Le mot de passe de la page**, à poser une fois (avant la première fusion qui contient `porte/`, sinon la page reste fermée et le dit) : dans Cloudflare, *Workers & Pages* → `dungeoncoop-dashboard` → *Settings* → *Variables and Secrets* → *Add*, type **Secret**, nom `MOT_DE_PASSE`. Ou, à la racine du repo : `npx wrangler secret put MOT_DE_PASSE`. Pour changer de mot de passe, on remplace ce secret : tout le monde devra rentrer le nouveau.

**Le Worker direct**, depuis `worker/` (une fois, puis à chaque changement de `worker/`) :

1. `npm install`, `npx wrangler login`, puis `npm run deploy`. Il est publié à `https://dungeoncoop-direct.mastredev.workers.dev`, l'adresse déjà mise dans `src/config.js`.
2. **Le token GitHub, en lecture seule :** GitHub → *Settings* → *Developer settings* → *Fine-grained tokens* → *Generate new token*. *Repository access* : **Public repositories**, aucune permission. Puis `npx wrangler secret put GITHUB_TOKEN` et colle-le. Il ne va jamais dans un fichier.
3. **Le secret des webhooks :** `npx wrangler secret put WEBHOOK_SECRET`, avec une longue chaîne aléatoire, la même qu'à l'étape 4. **Et le mot de passe**, pour la messagerie : `npx wrangler secret put MOT_DE_PASSE`, exactement le même que celui de la page.
4. **Les webhooks**, sur le repo du jeu et sur celui-ci : *Settings* → *Webhooks* → *Add webhook*.
   - *Payload URL* : `https://dungeoncoop-direct.mastredev.workers.dev/webhook` · *Content type* : `application/json` · *Secret* : celui de l'étape 3.
   - *Let me select individual events* : Branch or tag creation, Branch or tag deletion, Check runs, Check suites, Issue comments, Issues, Labels, Milestones, Pull requests, Pull request reviews, Pushes, Statuses.
   - GitHub envoie aussitôt un « ping » : les pages ouvertes affichent « Webhook branché sur … ✔ ».
5. **Vérifier :** `https://dungeoncoop-direct.mastredev.workers.dev/` doit dire `"token": true`, `"secret": true` et `"messagerie": true`, et compter les pages connectées.

### Le tableau de travail : brancher la connexion GitHub (une fois)

Sans ça, le tableau s'affiche en lecture seule (« la connexion GitHub n'est pas encore branchée »).

C'est fait depuis le 18 octobre 2026, avec la GitHub App « DungeonCoop Dashboard ». À refaire seulement si on change d'app.

1. **La GitHub App**, par un owner de l'organisation : GitHub → organisation *Mastre-gaming* → *Settings* → *Developer settings* → *GitHub Apps* → *New GitHub App*.
   - *Homepage URL* : `https://dungeoncoop-dashboard.mastredev.workers.dev`
   - *Callback URL* : `https://dungeoncoop-direct.mastredev.workers.dev/auth/retour`
   - **Décocher** « Expire user authorization tokens » (sinon tout le monde se reconnecte toutes les 8 heures) et laisser décoché « Request user authorization (OAuth) during installation ».
   - *Webhook* : décocher « Active » (le dashboard a déjà ses webhooks).
   - *Repository permissions* → **Issues : Read and write**, rien d'autre. *Only on this account*.
   - Puis *Install App* → *Mastre-gaming* → *Only select repositories* → `DungeonCoop`. Sans cette installation, GitHub refuse les écritures.
   - *Generate a new client secret*. Pas besoin de clé privée (*Private keys*) : le tableau ne s'en sert pas.
   - Pourquoi pas une OAuth App : son scope `public_repo` ouvrirait au token tous les repos publics de la personne, code compris. La GitHub App le limite aux issues de DungeonCoop.
2. **Le Client ID** (public, il commence par `Iv23`) va dans `worker/wrangler.jsonc`, à la ligne `GITHUB_CLIENT_ID`.
3. **Le secret**, depuis `worker/`. Tape d'abord la commande sans appuyer sur Entrée, copie ensuite le secret sur GitHub, puis appuie sur Entrée : `Get-Clipboard | npx wrangler secret put GITHUB_CLIENT_SECRET --name dungeoncoop-direct` (PowerShell ; `cat /dev/clipboard` dans Git Bash). Jamais dans un fichier. Pour vérifier la paire sans se connecter : si GitHub répond `incorrect_client_credentials`, le secret n'est pas celui de cette app.
4. `npm run deploy` dans `worker/`. Vérifier : `https://dungeoncoop-direct.mastredev.workers.dev/` dit `"connexion": true`.
5. **Les labels des axes** existent dans le repo du jeu (`axe: combats`, `axe: histoire`…, la liste est dans `src/config.js`).

**Comment ça marche :** « Se connecter avec GitHub » passe par le Worker (`/auth/connexion`, puis `/auth/retour`), qui échange le code contre un token et le rend à la page dans le fragment de l'adresse (`#jeton=…`, qui ne passe par aucun serveur). Le Worker ne garde rien. La page garde le token dans ce navigateur et écrit directement dans `api.github.com`. Le token ne peut toucher qu'aux issues de DungeonCoop (la permission de la GitHub App), et seulement si la personne a l'écriture sur le repo du jeu. `PAGES` (dans `worker/wrangler.jsonc`) liste les pages vers lesquelles un token peut repartir.

**Sur ton ordi :** une deuxième GitHub App avec le callback `http://localhost:8787/auth/retour`, son Client ID dans `worker/.dev.vars` (`GITHUB_CLIENT_ID=…`) avec `GITHUB_CLIENT_SECRET=…`, puis la page sur `http://localhost:8000/?direct=http://localhost:8787`. En `?demo`, « Se connecter (démo) » marche sans rien de tout ça et modifie les données inventées.

Le plan gratuit suffit largement (100 000 requêtes par jour ; une page connectée ne coûte rien tant que rien ne se passe).

## Règles

- On suit le [guide d'équipe du jeu](https://github.com/Mastre-gaming/DungeonCoop/blob/main/docs/GUIDE_EQUIPE.md) : une branche par changement, une PR, une seule chose par PR.
- Les vérifications (tests du Worker, test de la page sans écran) doivent être vertes avant de fusionner.
- Pas de ligne « Co-authored-by » dans les commits.
- Jamais de secret dans le repo (token, secret de webhook, `.dev.vars`).
