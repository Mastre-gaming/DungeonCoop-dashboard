# DungeonCoop · Dashboard de dev

Une seule page web pour toute l'équipe de [DungeonCoop](https://github.com/Mastre-gaming/DungeonCoop) : en 30 secondes, chacun sait ce qui a bougé, ce qui l'attend et où en est le projet.

## Ce que la page montre

| Partie | Ce qu'on y voit |
|---|---|
| Derniers push et commits | qui a poussé quoi, sur quelle branche, il y a combien de temps |
| PR et conflits en attente | une carte par PR : tests verts ou rouges, conflit à régler, relecture demandée, depuis combien de jours |
| Idées | les issues « Idée » classées par jalon, par priorité et par votes 👍, avec un bouton « Nouvelle idée » |
| Répartition des tâches | une colonne par personne, plus ce qui n'est pris par personne |
| Avancée globale | une barre par jalon, de D1 à M4 |
| Liens utiles | le repo du jeu, les docs, le jeu en ligne, l'éditeur de personnages, Discord |

## Comment ça marche

- **Les données restent dans GitHub.** La page les lit et les rassemble, elle n'en garde aucune.
- **Pour agir** (poster une idée, s'assigner une tâche, fusionner une PR), les boutons ouvrent la bonne page de GitHub.
- **Technique :** HTML, CSS et JavaScript simples, sans framework ni build. La page appelle l'API de GitHub depuis le navigateur ; le repo du jeu est public, donc pas de token.
- **Un widget = un fichier** dans `src/widgets/`, pour que plusieurs personnes travaillent en même temps sans conflit.

## Où on en est

Rien n'est construit. Ordre prévu, une PR par étape :

1. Le squelette de la page et les liens utiles
2. PR et conflits
3. Répartition des tâches
4. Idées
5. Avancée globale
6. Derniers commits

## Règles

- On suit le [guide d'équipe du jeu](https://github.com/Mastre-gaming/DungeonCoop/blob/main/docs/GUIDE_EQUIPE.md) : une branche par changement, une PR, une seule chose par PR.
- Pas de ligne « Co-authored-by » dans les commits.
- Jamais de secret dans le repo (token, URL de webhook).
