---
name: mission-camp
description: Le workflow d'une mission pour DungeonCoop (le camp et le jeu). À utiliser dès que la personne veut construire, coder, dessiner ou écrire quelque chose pour DungeonCoop, prendre ou rendre une mission, ouvrir une PR sur le repo Mastre-gaming/DungeonCoop, ou demande « sur quoi je peux travailler ».
---

# Une mission pour DungeonCoop

Tout ce qu'on ajoute à DungeonCoop passe par une **mission** : une issue du repo [Mastre-gaming/DungeonCoop](https://github.com/Mastre-gaming/DungeonCoop), rangée dans un **axe**, avec une **taille**. Les missions apparaissent dans le camp et dans le tableau de travail. Un ajout sans mission n'existe pour personne : ne commence jamais à coder sans elle.

Parle en français avec la personne. Le jeu appartient à toute l'équipe.

## Avant de commencer
- `gh` (GitHub CLI) est installé et connecté : `gh auth status`. Sinon, la personne lance elle-même `gh auth login`.
- Le repo du jeu est cloné, et `main` est à jour : `git switch main && git pull`.
- Lis `docs/GUIDE_EQUIPE.md` et `CAMP.fr.md` dans le repo du jeu si tu ne les connais pas.

## 1. Définir ce qu'on construit, et son axe
Demande à la personne ce qu'elle veut faire, en une phrase. Puis choisis **un seul axe** avec elle :

| Label | Axe | Exemples |
|---|---|---|
| `axe: camp` | Le camp (prioritaire en phase 1) | un lieu, le feu, la sentinelle, le panneau des missions |
| `axe: combats` | Combat et combos | règles, combat sur papier, aperçu des combos |
| `axe: classes` | Classes et personnages | une fiche de classe, l'apparence d'un héros |
| `axe: histoire` | Histoire et narration | la fiche du monde, un événement, une réplique |
| `axe: pixel art` | Direction artistique | un sprite, des tuiles, un effet visuel |
| `axe: salles` | Structure des runs et level design | une salle, des ennemis, une énigme, les récompenses |
| `axe: menus` | Interface et UX | un écran, le HUD, une maquette |
| `axe: son` | Son et musique | un bruitage, une musique |
| `axe: technique` | Technique et outils | les tests, le réseau, la mise en ligne |

Si la chose touche deux axes, prends celui où on la verra. Si elle est trop grosse pour une taille L, découpe-la en plusieurs missions.

## 2. Chercher si la mission existe déjà
```bash
gh issue list -R Mastre-gaming/DungeonCoop --label "axe: camp" --state open
```
(remplace l'axe). Si une mission ouverte correspond, **reprends-la** au lieu d'en créer une : passe à l'étape 4.

## 3. Créer la mission
Choisis la taille avec la personne :

| Label | Taille | Pour |
|---|---|---|
| `taille: S` | courte | moins d'une heure |
| `taille: M` | moyenne | une soirée |
| `taille: L` | grosse | plusieurs soirées |

Puis crée l'issue. Le titre dit ce qu'on verra. La description a toujours ces deux lignes :
```bash
gh issue create -R Mastre-gaming/DungeonCoop \
  --title "Le feu de camp, taille 1 : pierres et souches" \
  --label "axe: camp" --label "taille: M" \
  --body "**À rendre :** ce qui sera livré, en une ou deux phrases.

**Fini quand :** ce qu'on doit voir pour dire que c'est fini (une capture, un test vert, l'accord du groupe)."
```
Ajoute `--milestone "…"` si la mission appartient à un jalon (D1 à M4 : `gh api repos/Mastre-gaming/DungeonCoop/milestones -q '.[].title'`).

**Une idée qui n'est pas pour maintenant** n'est pas une mission : c'est une issue « Idée » (`--template idee.md`), rangée au parking.

## 4. Prendre la mission en charge
```bash
gh issue edit <n> -R Mastre-gaming/DungeonCoop --add-assignee @me
```
Ne prends qu'une ou deux missions à la fois. Si tu abandonnes : `--remove-assignee @me`, avec un commentaire sur où tu en es.

## 5. Travailler
- **Une branche par mission :** `git switch -c <prenom>/<sujet-court>`.
- Suis `CLAUDE.md` du repo : petits changements, `?test` vert, captures, une seule chose à la fois. Ne commite jamais `dl/` ni un secret.
- **Pas de ligne « Co-authored-by » dans les commits** : les vérifications la refusent.
- Art ou son ajouté : sa source et sa licence vont dans `CREDITS.md`.

## 6. Rendre la mission
**Si la mission contient du code ou des fichiers :** ouvre une PR qui la ferme toute seule à la fusion.
```bash
git push -u origin <prenom>/<sujet-court>
gh pr create -R Mastre-gaming/DungeonCoop --label "axe: camp" \
  --title "Le feu de camp : taille 1" --body "Ferme #<n>

(le reste du modèle de PR : ce que ça change, le chemin dans l'aperçu, la capture)"
```
- **Le label `axe: …` est obligatoire sur la PR** (le même que la mission) : sans lui, la vérification « axe » reste rouge.
- La PR est fusionnée quand ses vérifications sont vertes et qu'elle est relue. La fusion ferme la mission : elle est rendue.
- Ne fusionne pas toi-même sans l'accord de la personne.

**Si la mission n'a pas de code** (une séance, un dessin sur le Miro, une décision) : quand le « Fini quand » est vrai, ferme-la avec la preuve.
```bash
gh issue close <n> -R Mastre-gaming/DungeonCoop --comment "Fait : <lien vers la capture, le Miro ou le fichier>"
```

## Les règles
- **Toujours demander à la personne** avant de créer une issue, de pousser, d'ouvrir ou de fusionner une PR, ou de fermer une mission.
- Une mission = une issue = (au plus) une PR.
- Le « Fini quand » se vérifie pour de vrai (capture, test) avant de rendre.
- Ne touche pas aux missions des autres (assignées à quelqu'un d'autre) sans leur accord.
