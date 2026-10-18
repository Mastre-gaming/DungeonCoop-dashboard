# Plan de travail : les axes de création

**Pour qui :** toute l'équipe. **Tenu par :** l'organisateur (le propriétaire), qui garde le plan à jour.
**Personne n'est désigné.** Les étapes ne nomment personne : **celui qui est intéressé par une tâche la prend** (« Je prends » dans le tableau de travail). Une décision d'axe revient à son responsable s'il y en a un, sinon au groupe.
**Comment lire :** chaque axe a ses étapes dans l'ordre. Chaque étape dit **ce qu'on rend** et **quand c'est fini**. On ne passe à l'étape suivante que quand la précédente est finie, sauf mention « en parallèle ».
**Les règles du jeu restent dans leurs fichiers**, dans le [repo du jeu](https://github.com/Mastre-gaming/DungeonCoop) (`FIGHT_RULES.md`, `CLASS_TEMPLATE.fr.md`, `STORY_STRUCTURE.fr.md`, `LEVEL_STRUCTURE.md`, `docs/`) : ce plan dit seulement qui fait quoi et dans quel ordre. Tous les fichiers cités ci-dessous sont dans ce repo-là. Le tableau Miro « Dungeon Co-op : axes du projet » en est la vue d'ensemble.

---

## Phase 0 : le camp (jalon M1)

**L'idée (le propriétaire, 18 oct) : construire le jeu, c'est déjà le jeu.** On est des apprentis développeurs, et coder le jeu est une grande partie du fun. Alors la création elle-même devient un jeu :

- **Le camp vivant du jeu vient en premier.** C'est une scène en pixel art LPC où les héros marchent librement, avec **un lieu par axe de création** (les 8 axes ci-dessous) et un feu de camp au centre pour toute l'équipe.
- **Les étapes de ce plan deviennent des missions.** Une mission est une issue du repo du jeu, avec un label d'axe (`axe: …`) et une taille (`taille: S`, `M` ou `L`). On les prend et on les rend dans le **tableau de travail** de ce dashboard.
- **Chaque mission rentrée fait grandir le lieu de son axe**, en direct, chez tout le monde : de l'emplacement vide à la tente, puis la cabane, puis le bâtiment. Le feu de camp grandit avec le total de l'équipe. Il n'y a pas de classement : on voit ce que l'équipe a construit.
- **Le camp s'affiche en haut de ce dashboard**, en vue d'ensemble, et en grand sur le lien du jeu, pour héberger et rejoindre avec un code.
- **Tout le concept est dans [`CAMP.fr.md`](https://github.com/Mastre-gaming/DungeonCoop/blob/main/CAMP.fr.md)**, dans le repo du jeu : les deux repos, les missions, les lieux, la caméra, le prototype et ses critères.

**Qui possède quoi :** le repo du jeu possède le camp (son code, son art, ses règles) et les missions (les issues). Ce repo-ci possède le plan et le tableau de travail, et affiche le camp. Le contrat entre les deux, ce sont les labels des axes (bientôt un seul fichier, `content/axes.json`, lu des deux côtés).

- [ ] **P0.1 Le contrat des missions.** Les labels `axe: …` alignés sur les 8 axes de ce plan, les labels `taille: S/M/L`, et `content/axes.json` dans le repo du jeu, lu par le tableau de travail.
- [ ] **P0.2 Les missions.** Les étapes des phases 1 et 2 de ce plan deviennent des issues ; chaque étape garde ici le numéro de son issue. **On ne coche plus ce plan :** c'est l'issue fermée qui compte.
- [ ] **P0.3 Le lien en ligne du jeu** (Cloudflare Pages), publié à chaque fusion sur `main` du jeu.
- [ ] **P0.4 Le prototype du camp (v0).** Les 8 lieux et le feu, un héros qui marche librement (caméra qui suit avec une zone morte), héberger et rejoindre avec un code, les lieux qui prennent leur niveau d'après les missions.
- [ ] **P0.5 Le camp dans le dashboard.** Une carte « Le camp » en haut de la page, en vue d'ensemble.
- [ ] **P0.6 La connexion GitHub du tableau** (l'OAuth App et le secret du Worker, README), pour prendre et rendre les missions depuis ici.

*Fini quand :* une mission fermée dans le tableau fait grandir son lieu, en moins de 5 secondes, chez deux personnes dans le camp ; et le propriétaire note le camp sur 10. C'est le jalon M1, « le camp ».

---

## 0. L'organisation : cette semaine

- [ ] **0.1 Fixer la soirée D1** (combat sur papier, 1 h 30, 3 joueurs ou plus). C'est la plus longue à caler et elle débloque presque tout le reste.
  *Fini quand :* une date est dans tous les agendas.
- [ ] **0.2 Récupérer les réponses manquantes** au questionnaire (`FRIEND_PROMPT.fr.md`) : il en manque encore pour une partie de l'équipe. Donner une date limite (par exemple la veille de D1).
  *Fini quand :* chaque ami a son fichier dans `friends/`.
- [ ] **0.3 Présenter le tableau de travail** (30 min sur Discord, avec le tableau Miro à l'écran). On montre les missions ouvertes ; chacun prend celles qui l'intéressent. Quelqu'un qui veut le dernier mot sur un axe le dit, et le groupe l'accepte ; sinon l'axe reste sans responsable, et le groupe tranche ses décisions.
  *Fini quand :* chacun a pris au moins une mission.
- [ ] **0.4 Lancer le rituel.** Un point de 30 minutes par semaine, toujours le même jour. Chacun dit : ce qu'il a rendu, ce qu'il a pris, ce qui le bloque. Le Miro est mis à jour juste après.
- [ ] **0.5 Rappeler la règle des idées.** Une idée nouvelle va dans le parking (`GAME_SPEC.md`) ou dit ce qu'elle remplace. Rien n'entre dans le travail en cours sans ça.

---

## L'ordre global

| Phase | Ce qui avance | Pourquoi dans cet ordre |
|---|---|---|
| **Phase 0 : maintenant** | le camp (M1) : le contrat des missions, les missions, le lien en ligne, le prototype du camp | construire le jeu fait partie du jeu ; chaque mission rentrée ensuite fait grandir le camp |
| **Phase 1 : maintenant, en parallèle** | D1 combat sur papier (axe 2) · D3 fiche du monde (axe 1) · moodboard et D4 premier sprite (axe 6) | le monde et l'art ne dépendent pas des chiffres du combat ; tout le reste, si |
| **Phase 2 : après D1** | D2 classes (axe 3) · chiffrage des runs (axe 4) · salles sur papier (axe 5) · maquettes d'écran (axe 7) · chaîne du chapitre 1 (axe 1) | D1 fixe le mode de tour, les PV et la durée d'un combat |
| **Phase 3 : la grille** | le premier code du combat : la grille, le déplacement case par case, le tour à tour (M1 est devenu le camp, en phase 0) | il faut D1 tranché ; KICKOFF est signé (18 oct) |
| **Phase 4 : M2 puis M3** | les dés et les tours, puis les combos jouables et le boss | le focus du jeu : viser 9/10 sur les combos |
| **Phase 5 : M4 et après** | la run complète, puis le camp, le journal, le son | seulement quand le combat tient au moins 5/10 à quatre |

---

## Axe 1. Histoire et narration
**Peut commencer tout de suite.** **L'histoire est celle de l'équipe** : personne ne la fait écrire par Claude.

- [ ] **1.1 Valider le cadre.** [#16](https://github.com/Mastre-gaming/DungeonCoop/issues/16) Relire `STORY_STRUCTURE.fr.md` et dire oui, ou ce qu'il faut changer.
  *Rend :* la réponse dans les questions ouvertes de `GAME_SPEC.md`. *Fini quand :* le cadre est accepté ou corrigé.
- [ ] **1.2 Séance « monde » (1 h, toute l'équipe, en parallèle de D1).** [#17](https://github.com/Mastre-gaming/DungeonCoop/issues/17) Sur le Miro, chacun pose des post-it : le ton, le lieu, la menace (le Boss final), trois lieux de chapitre possibles. On tranche à la fin de la séance.
- [ ] **1.3 Écrire la fiche du monde (D3).** [#18](https://github.com/Mastre-gaming/DungeonCoop/issues/18) Une page : le monde en 5 lignes, le Boss final, les lieux des 3 chapitres, et pour le chapitre 1 : son lieu, ses ennemis, ses 3 boss.
  *Fini quand :* le groupe dit oui à la page (c'est la condition de D3).
- [ ] **1.4 Fixer les archétypes.** [#19](https://github.com/Mastre-gaming/DungeonCoop/issues/19) Garder ou renommer Combattant, Soutien, À distance, Mage. *Fini quand :* la liste est fermée dans `STORY_STRUCTURE.fr.md` §4 (l'axe 3 en a besoin).
- [ ] **1.5 La chaîne du chapitre 1 (phase 2).** [#20](https://github.com/Mastre-gaming/DungeonCoop/issues/20) Une ouverture et 3 ou 4 maillons, chacun au format de `STORY_STRUCTURE.fr.md` §6 (4 lignes au plus, besoins, drapeaux posés, lignes de secours).
- [ ] **1.6 Les événements d'ambiance du chapitre 1.** [#21](https://github.com/Mastre-gaming/DungeonCoop/issues/21) [#22](https://github.com/Mastre-gaming/DungeonCoop/issues/22) [#23](https://github.com/Mastre-gaming/DungeonCoop/issues/23) [#24](https://github.com/Mastre-gaming/DungeonCoop/issues/24) Il en faut 4. **Chaque ami en écrit un**, avec sa référence ou son easter egg, et un autre les relit.
- [ ] **1.7 La salle d'entraînement.** [#14](https://github.com/Mastre-gaming/DungeonCoop/issues/14) Deux défis au tour par tour sur papier (par exemple « faire tomber trois mannequins du rebord en deux rounds »), testés à la fin d'une soirée papier.
- [ ] **Plus tard (M4) :** le camp, le journal, l'épilogue.

## Axe 2. Combat et combos (le focus du jeu)
**Dès maintenant.** Toute l'équipe joue et note.

- [ ] **2.1 Jouer D1** [#25](https://github.com/Mastre-gaming/DungeonCoop/issues/25) avec `PAPER_FIGHT_KIT.fr.md` : un combat en ordre d'initiative, un en tour d'équipe. On remplit la fiche de mesure **pendant** la partie.
- [ ] **2.2 Trancher, le lendemain.** [#26](https://github.com/Mastre-gaming/DungeonCoop/issues/26) Le mode de tour, les PV, la durée d'un combat, d'après la fiche. *Rend :* `FIGHT_RULES.md` et `CORE_LOOP.md` mis à jour. *Fini quand :* « fun à quatre » est noté (5/10 ou plus pour passer) et les trois questions ouvertes de D1 sont fermées dans `GAME_SPEC.md`.
- [ ] **2.3 La grille des combos.** [#27](https://github.com/Mastre-gaming/DungeonCoop/issues/27) Sur le Miro, un tableau classe × classe : pour chaque paire, un combo « l'un prépare, l'autre exploite ». *Fini quand :* chacune des quatre classes choisies (axe 3) a au moins un combo avec une autre.
- [ ] **2.4 Ce que montre l'aperçu d'un combo.** [#28](https://github.com/Mastre-gaming/DungeonCoop/issues/28) En une phrase par cas : avant de valider, le joueur voit quoi (dégâts doublés, case qui prend feu, ennemi poussé) ? *Rend :* une courte liste, transmise à l'axe 7.
- [ ] **2.5 Deuxième combat sur papier** [#29](https://github.com/Mastre-gaming/DungeonCoop/issues/29) avec les quatre classes choisies et une salle de l'axe 5. On vérifie : un combo possible dès le premier round, et personne ne porte les autres.
- [ ] **2.6 M2 et M3 (code).** Claude construit les dés, les tours et les combos ; l'équipe joue sur le lien en ligne et note sur 10. *Fini quand :* les quatre gagnent le boss avec un combo montré avant d'être joué (le 9/10 du focus).

## Axe 3. Classes et personnages
**Commence après D1** : les PV et le rythme des tours changent les chiffres des classes.

- [ ] **3.1 Chaque ami crée une classe** [#30](https://github.com/Mastre-gaming/DungeonCoop/issues/30) [#31](https://github.com/Mastre-gaming/DungeonCoop/issues/31) [#32](https://github.com/Mastre-gaming/DungeonCoop/issues/32) [#33](https://github.com/Mastre-gaming/DungeonCoop/issues/33) avec `CLASS_TEMPLATE.fr.md`, même sans coder. Chaque fiche a un **crochet de combo** vers une autre classe.
- [ ] **3.2 Vérifier le budget de chaque fiche** [#34](https://github.com/Mastre-gaming/DungeonCoop/issues/34) : 27 points de caractéristiques, 10 points de classe, 3 capacités dont une attaque de base, une vraie faiblesse.
- [ ] **3.3 Le groupe choisit les quatre premières** [#35](https://github.com/Mastre-gaming/DungeonCoop/issues/35) (D2) : un rôle chacune (tank, dégâts, soutien, contrôle), et des archétypes variés. *Fini quand :* quatre fiches dans le budget, chacune avec son combo.
- [ ] **3.4 Les tester** [#36](https://github.com/Mastre-gaming/DungeonCoop/issues/36) dans le deuxième combat sur papier (2.5), puis corriger les chiffres.
- [ ] **3.5 L'apparence de chaque héros.** [#37](https://github.com/Mastre-gaming/DungeonCoop/issues/37) [#38](https://github.com/Mastre-gaming/DungeonCoop/issues/38) [#39](https://github.com/Mastre-gaming/DungeonCoop/issues/39) [#40](https://github.com/Mastre-gaming/DungeonCoop/issues/40) Chaque joueur décrit son héros et envoie son lien du générateur LPC à l'axe 6.
- [ ] **Plus tard :** les sous-classes du niveau 3 et la table des niveaux.

## Axe 4. Structure des runs
**Commence après D1.**

- [ ] **4.1 Recompter la run avec la vraie durée d'un combat.** [#41](https://github.com/Mastre-gaming/DungeonCoop/issues/41) Si un combat dure 7 minutes, on garde 9 salles ; s'il dure plus, on descend vers 6. *Rend :* `LEVEL_STRUCTURE.md` mis à jour.
- [ ] **4.2 Trancher la progression** [#42](https://github.com/Mastre-gaming/DungeonCoop/issues/42) : qu'est-ce qui reste d'une run à l'autre, et qu'est-ce qui repart à zéro (la tension 2 de `CORE_LOOP.md`). *Rend :* une proposition, que le groupe tranche.
- [ ] **4.3 La liste des récompenses du chapitre 1.** [#43](https://github.com/Mastre-gaming/DungeonCoop/issues/43) Une quinzaine : nouvelles capacités, améliorations, équipement à looter. Avec les prix de la boutique.
- [ ] **4.4 Une run sur papier, en accéléré.** [#44](https://github.com/Mastre-gaming/DungeonCoop/issues/44) Tirer les salles, résoudre les combats en gros, faire le jet de défaite une fois. *Fini quand :* on sait si la run tient en environ 65 minutes.
- [ ] **4.5 M4 (code).** *Fini quand :* trois runs du même chapitre ne se ressemblent pas.

## Axe 5. Level design
**Commence après D1.**

- [ ] **5.1 Revoir la salle du kit** [#45](https://github.com/Mastre-gaming/DungeonCoop/issues/45) (10 × 8 cases) d'après ce qui a ennuyé ou plu pendant D1.
- [ ] **5.2 Les règles d'une salle de combat.** [#46](https://github.com/Mastre-gaming/DungeonCoop/issues/46) Chaque salle offre au moins une préparation de combo dans le décor (tonneau d'huile, flaque, rebord, glace). *Rend :* une demi-page, ajoutée à `LEVEL_STRUCTURE.md`.
- [ ] **5.3 Dessiner les salles de combat du chapitre 1** [#47](https://github.com/Mastre-gaming/DungeonCoop/issues/47) sur papier quadrillé ou sur le Miro. Commencer par 3, puis aller jusqu'à 8 (la réserve d'un chapitre).
- [ ] **5.4 Les groupes d'ennemis du chapitre 1.** [#48](https://github.com/Mastre-gaming/DungeonCoop/issues/48) Huit groupes, avec les habitudes de `FIGHT_RULES.md` et les ennemis de la fiche du monde (axe 1).
- [ ] **5.5 Trois énigmes ou pièges** [#49](https://github.com/Mastre-gaming/DungeonCoop/issues/49) sur papier.
- [ ] **5.6 Tester deux salles** [#50](https://github.com/Mastre-gaming/DungeonCoop/issues/50) dans le deuxième combat sur papier (2.5).

## Axe 6. Direction artistique
**Peut commencer tout de suite.**

- [ ] **6.1 Un moodboard sur le Miro** [#51](https://github.com/Mastre-gaming/DungeonCoop/issues/51) : une dizaine d'images (couleurs, ambiance, exemples LPC). À recaler sur la fiche du monde quand elle sort.
- [ ] **6.2 Le premier sprite (D4).** [#52](https://github.com/Mastre-gaming/DungeonCoop/issues/52) Un héros fait dans le générateur LPC, retouché dans Sprite Painter. *Fini quand :* le propriétaire lui donne 7/10 ou plus. Le critère : la classe et l'équipement se lisent à la taille du jeu.
- [ ] **6.3 Les quatre héros** [#53](https://github.com/Mastre-gaming/DungeonCoop/issues/53) à partir des liens envoyés en 3.5.
- [ ] **6.4 Le jeu de tuiles.** [#54](https://github.com/Mastre-gaming/DungeonCoop/issues/54) Choisir un pack LPC sur OpenGameArt, vérifier sa licence, l'inscrire dans les crédits.
- [ ] **6.5 La liste des effets visuels des combos** [#55](https://github.com/Mastre-gaming/DungeonCoop/issues/55) : les quatre surfaces (huile, eau, feu, glace) et les icônes d'état (Trempé, Huilé, En feu, Gelé, À terre). Pour M3.
- [ ] **Toujours :** chaque pièce LPC garde sa licence ; les crédits viennent de l'export du générateur.

## Axe 7. Interface et UX
**Commence après D1.**

- [ ] **7.1 La liste des écrans** [#56](https://github.com/Mastre-gaming/DungeonCoop/issues/56) : titre, héberger ou rejoindre, choix du héros, combat, carte de la run, récompense, vote, crédits (et plus tard le camp et le journal).
- [ ] **7.2 La maquette de l'écran de combat** [#57](https://github.com/Mastre-gaming/DungeonCoop/issues/57), sur papier ou sur le Miro : la barre d'initiative, la chance de toucher au survol, l'aperçu du combo (liste de 2.4), à qui c'est le tour. Référence : Baldur's Gate 3.
- [ ] **7.3 La tester pendant le deuxième combat sur papier.** [#58](https://github.com/Mastre-gaming/DungeonCoop/issues/58) On demande aux joueurs ce qu'il leur manquait pour décider.
- [ ] **7.4 Le style** [#59](https://github.com/Mastre-gaming/DungeonCoop/issues/59) : police pixel, couleurs prises du moodboard (axe 6).
- [ ] **7.5 M1 et M2 (code).** *Fini quand :* « lire un combat » est noté 6/10 ou plus.

## Axe 8. Son et musique
**En dernier**, avec un budget fixé à ce moment-là.

- [ ] **8.1 Avant M3 : seulement des références.** [#60](https://github.com/Mastre-gaming/DungeonCoop/issues/60) Une playlist de 5 morceaux qui collent au monde, rangée dans le parking.
- [ ] **8.2 Après M3 : les bruitages d'abord**, en partant des combos (feu, foudre, glace, poussée, coup critique).
- [ ] **8.3 Puis la musique**, une par lieu si l'équipe le veut.

---

## Les trois premières actions, dès aujourd'hui
1. **Envoyer le message de l'équipe** : la date de D1 à choisir, la date limite du questionnaire, l'heure de la présentation du tableau de travail (0.3).
2. **Envoyer le kit** (`PAPER_FIGHT_KIT.fr.md`) et le lien du Miro à chacun.
3. **Lancer en parallèle** la séance « monde » (1.2) et le moodboard (6.1) : ils n'attendent pas D1.
