// Les vérifications de ?test. Elles tournent sur les données de démo (demo/donnees.js), sans réseau.
// Le résultat va dans <html data-test="réussies/total"> : outils/test.mjs le lit et sort en erreur s'il en manque.
// Une nouvelle fonction dans un widget = une vérification ici.

const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

export async function lancerTests({ simuler, etat }) {
  const resultats = [];
  const verifier = (nom, ok, detail = '') => resultats.push({ nom, ok: Boolean(ok), detail: ok ? '' : String(detail) });
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const texte = (s) => $(s)?.textContent ?? '';
  const numeros = (s) => $$(s).map((n) => Number(n.dataset.numero));
  const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Le bouton « Aller au camp » de l'en-tête
  const jouer = $('#jouer');
  verifier('Camp : le bouton mène au jeu en ligne, dans un nouvel onglet', jouer?.href.startsWith('https://dungeoncoop.0xbaba-eth.workers.dev') && jouer.target === '_blank' && jouer.textContent.includes('Aller au camp'), jouer?.outerHTML);
  const icone = jouer?.querySelector('.icone-feu');
  verifier('Camp : l’icône du feu s’affiche (32 x 32, pixels nets)', icone && icone.offsetWidth === 32 && icone.offsetHeight === 32 && getComputedStyle(icone).backgroundImage.includes('bouton_camp.png'), icone?.outerHTML);

  // Le profil, en haut à droite (moi = demo-brams, pas encore connecté à GitHub, pas de porte).
  const boutonProfil = $('#bouton-profil');
  verifier('Profil : en haut à droite, mon icône et mon nom', boutonProfil?.querySelector('.avatar')?.textContent === 'BR' && boutonProfil.querySelector('.nom')?.textContent === 'Brams', boutonProfil?.textContent);
  boutonProfil?.click();
  verifier('Profil : le bouton ouvre le menu', !$('#menu-profil').hidden && boutonProfil.getAttribute('aria-expanded') === 'true');
  verifier('Profil : sans GitHub, le pseudo ne se change pas, et le menu dit pourquoi', $('#champ-pseudo')?.disabled && texte('#menu-profil .aide').includes('Connecte-toi avec GitHub') && $('#menu-profil [data-action="connexion-github"]'), texte('#menu-profil'));
  verifier('Profil : sans porte ni GitHub, « Je suis » est dans le menu', $('#menu-profil select#moi')?.value === 'demo-brams');
  document.body.click();
  verifier('Profil : un clic ailleurs ferme le menu', $('#menu-profil').hidden && boutonProfil.getAttribute('aria-expanded') === 'false');

  const enErreur = $$('.carte[data-etat="erreur"]').map((c) => `${c.id} : ${c.textContent}`);
  verifier('aucun widget en erreur', !enErreur.length, enErreur.join(' | '));

  // PR et conflits
  const ordrePr = numeros('#pull-requests article.pr');
  verifier('PR : les 4 PR des deux repos', ordrePr.length === 4, ordrePr);
  verifier('PR : celles qui me concernent d’abord, puis la plus ancienne', egal(ordrePr, [12, 14, 3, 15]), ordrePr);
  const pastilles = (n) => $$(`#pull-requests article[data-numero="${n}"] .pastille`).map((p) => `${p.dataset.niveau}:${p.textContent.slice(1)}`);
  verifier('PR #12 : conflit à régler', pastilles(12).includes('grave:conflit à régler'), pastilles(12));
  verifier('PR #14 : tests rouges', pastilles(14).includes('grave:tests rouges'), pastilles(14));
  verifier('PR #14 : relecture encore attendue malgré une approbation', pastilles(14).includes('attention:relecture attendue : Brams'), pastilles(14));
  verifier('PR #15 : tests en cours, conflit en calcul', pastilles(15).includes('encours:tests en cours') && pastilles(15).includes('neutre:conflit : GitHub vérifie…'), pastilles(15));
  verifier('PR #3 : le dernier avis compte (changements demandés)', pastilles(3).includes('attention:changements demandés par Brams'), pastilles(3));

  // Pour toi (moi = demo-brams)
  const pourToi = texte('#pour-toi');
  verifier('Pour toi : la relecture qui m’attend', pourToi.includes('PR #14 (jeu) attend ta relecture'), pourToi);
  verifier('Pour toi : le conflit sur ma PR', pourToi.includes('Conflit à régler sur ta PR #12 (jeu)'), pourToi);
  verifier('Pour toi : mes tâches', pourToi.includes('2 tâches à toi'), pourToi);
  const niveaux = $$('#pour-toi .item').map((i) => i.classList[1]);
  verifier('Pour toi : le plus grave d’abord', egal(niveaux, ['grave', 'attention', 'neutre']), niveaux);

  // Qui fait quoi
  const personnes = $$('#taches .colonne').map((c) => c.dataset.personne);
  verifier('Tâches : moi d’abord, puis l’équipe, puis « Personne »', egal(personnes, ['demo-brams', 'demo-ayla', 'demo-cerise', 'demo-dorn', '']), personnes);
  verifier('Tâches : 2 à prendre', numeros('#taches .colonne[data-personne=""] li').length === 2, numeros('#taches .colonne[data-personne=""] li'));
  verifier('Tâches : une tâche à deux est dans les deux colonnes',
    numeros('#taches .colonne[data-personne="demo-brams"] li').includes(32) && numeros('#taches .colonne[data-personne="demo-dorn"] li').includes(32));
  verifier('Tâches : une idée prise devient une tâche', numeros('#taches .colonne[data-personne="demo-brams"] li').includes(20));
  verifier('Tâches : une PR n’est pas une tâche', !numeros('#taches li').includes(12));

  // Idées
  const colonnes = $$('#idees .colonne').map((c) => c.dataset.jalon);
  verifier('Idées : les colonnes dans l’ordre du temps', egal(colonnes, ['À trier', 'M2', 'M3', 'M4', 'Parking']), colonnes);
  verifier('Idées : la priorité décide, les votes départagent', egal(numeros('#idees .colonne[data-jalon="M2"] li'), [23, 26]), numeros('#idees .colonne[data-jalon="M2"] li'));
  verifier('Idées : « Priorité : Moyenne » est lu comme « moyenne »', $('#idees li[data-numero="22"]')?.dataset.priorite === 'moyenne');
  verifier('Idées : un titre avec du HTML reste du texte', !$('#idees b') && texte('#idees').includes('<b>HTML</b>'));
  verifier('Idées : le « [Idée] » du modèle n’est pas répété', $('#idees li[data-numero="25"] .titre')?.textContent === 'Une musique de taverne', $('#idees li[data-numero="25"] .titre')?.textContent);

  // Avancée
  const jalon = (id) => $(`#avancee .jalon[data-jalon="${id}"]`);
  const pourcent = (id) => Number(jalon(id)?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'));
  verifier('Avancée : les 8 jalons de GAME_SPEC.md', $$('#avancee .jalon').length === 8, $$('#avancee .jalon').length);
  verifier('Avancée : D1 fait, à 100 %', jalon('D1')?.dataset.etat === 'fait' && pourcent('D1') === 100, pourcent('D1'));
  verifier('Avancée : D2 est le jalon courant, à 33 %', jalon('D2')?.classList.contains('courant') && pourcent('D2') === 33, pourcent('D2'));
  verifier('Avancée : « M2 : Roll for it » compte pour M2', jalon('M2')?.querySelector('.chiffres')?.textContent.includes('0/2 fermées'), jalon('M2')?.textContent);
  verifier('Avancée : 1 / 8 jalons faits', texte('#avancee .chiffre').replace(/\s/g, '') === '1/8jalonsfaits', texte('#avancee .chiffre'));
  verifier('Avancée : l’étape actuelle vient de GAME_SPEC.md', texte('#avancee .resume').includes('D, the design stage'));

  // Derniers push
  const lignes = $$('#commits .evenement');
  const dates = lignes.map((l) => new Date(l.querySelector('time').getAttribute('datetime')).getTime());
  verifier('Push : 9 lignes, la plus récente d’abord', lignes.length === 9 && dates.every((d, i) => !i || dates[i - 1] >= d), lignes.length);
  verifier('Push : le message d’un commit de branche', lignes[0]?.querySelector('.message')?.textContent === 'Couronne : les 4 directions', lignes[0]?.textContent);
  verifier('Push : les deux repos mélangés', texte('#commits').includes('dashboard') && texte('#commits').includes('jeu'));

  // Liens
  try {
    const liens = await (await fetch('liens.json', { cache: 'no-store' })).json();
    verifier('Liens : un bouton par ligne de liens.json', $$('#liens .grille-liens li').length === liens.length, $$('#liens .grille-liens li').length);
    verifier('Liens : les liens vides invitent à les remplir', $$('#liens .lien.a-remplir').length === liens.filter((l) => !l.url).length);
  } catch (erreur) {
    verifier('Liens : liens.json se lit', false, erreur.message);
  }

  // Le thème : clair, sombre, auto.
  const fond = () => getComputedStyle(document.body).backgroundColor;
  const theme = (choix) => $(`[data-theme-choix="${choix}"]`);
  const stocke = () => { try { return localStorage.getItem('dungeoncoop:theme'); } catch { return 'stockage interdit'; } };
  theme('dark').click();
  verifier('Thème : « Sombre » passe la page en sombre', document.documentElement.dataset.theme === 'dark' && fond() === 'rgb(13, 13, 13)', fond());
  theme('light').click();
  verifier('Thème : « Clair » passe la page en clair', document.documentElement.dataset.theme === 'light' && fond() === 'rgb(244, 243, 239)', fond());
  verifier('Thème : le choix est gardé dans le navigateur', stocke() === 'light', stocke());
  verifier('Thème : le bouton choisi est marqué', theme('light').getAttribute('aria-pressed') === 'true' && theme('auto').getAttribute('aria-pressed') === 'false');
  theme('auto').click();
  verifier('Thème : « Auto » revient au réglage de l’ordinateur', !('theme' in document.documentElement.dataset) && stocke() === null, stocke());

  // La messagerie (moi = Brams ; en démo, les messages restent dans la page).
  const bulle = $('#bulle-messages');
  const panneau = $('#messagerie');
  verifier('Messagerie : la bulle est là, le panneau fermé', bulle && panneau?.hidden);
  verifier('Messagerie : les 3 messages des autres sont non lus', texte('#bulle-messages .non-lus') === '3', texte('#bulle-messages .non-lus'));
  verifier('Onglet : le titre compte les non-lus, même onglet affiché', /^\(3\) DungeonCoop/.test(document.title), document.title);
  bulle.click();
  verifier('Messagerie : la bulle ouvre le panneau', !panneau.hidden && bulle.getAttribute('aria-expanded') === 'true');
  verifier('Messagerie : l’historique', $$('#messagerie .msg').length === 3, $$('#messagerie .msg').length);
  verifier('Messagerie : ouvrir, c’est lire', $('#bulle-messages .non-lus').hidden);
  verifier('Messagerie : #12 mène à l’issue ou la PR du jeu', $('#messagerie a.ref')?.href.endsWith('/Mastre-gaming/DungeonCoop/issues/12'), $('#messagerie a.ref')?.href);
  verifier('Messagerie : une adresse devient un lien', $$('#messagerie .msg a').some((a) => a.href === 'https://example.org/chevalier.png'));
  verifier('Messagerie : @Brams me mentionne', $('#messagerie .mention.moi')?.textContent === '@Brams' && $('#messagerie .msg[data-id="3"]')?.classList.contains('me-mentionne'));
  verifier('Messagerie : le HTML reste du texte, les retours à la ligne restent', !$('#messagerie .msg b') && texte('#messagerie').includes('<b>pas du HTML</b>') && $('#messagerie .msg[data-id="3"] br'));
  const zone = $('#messagerie textarea');
  zone.value = 'Je prends la #33';
  zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await pause(30);
  const dernier = $$('#messagerie .msg').at(-1);
  verifier('Messagerie : Entrée envoie, signé de mon nom', dernier?.classList.contains('mien') && dernier.querySelector('.qui strong')?.textContent === 'Brams' && dernier.textContent.includes('Je prends la #33'), dernier?.textContent);
  verifier('Messagerie : la zone se vide après l’envoi', zone.value === '');
  $('#messagerie .fermer').click();
  window.__messagerie.recevoir({ type: 'message', message: { id: 99, auteur: 'Ayla', texte: '@brams tu relis ?', t: Date.now() } });
  await pause(30);
  verifier('Messagerie : un message reçu panneau fermé compte comme non lu', texte('#bulle-messages .non-lus') === '1', texte('#bulle-messages .non-lus'));
  verifier('Messagerie : une mention fait une notification', texte('#notifs').includes('Ayla te mentionne'), texte('#notifs'));
  window.__messagerie.recevoir({ type: 'message', message: { id: 99, auteur: 'Ayla', texte: '@brams tu relis ?', t: Date.now() } });
  verifier('Messagerie : un même message reçu deux fois ne compte qu’une fois', texte('#bulle-messages .non-lus') === '1' && $$('#messagerie .msg').length === 5);

  // Le son des messages (en test, il est compté sans être joué) et le titre de l'onglet.
  const sons = () => window.__messagerie.sons();
  const recevoir = (id, auteur, texteMessage) => window.__messagerie.recevoir({ type: 'message', message: { id, auteur, texte: texteMessage, t: Date.now() } });
  verifier('Son : un message des autres, panneau fermé, sonne une fois (ni l’historique, ni mon message, ni le doublon)', sons() === 1, sons());
  verifier('Onglet : un nouveau message passe le titre à (1)', /^\(1\) DungeonCoop/.test(document.title), document.title);
  recevoir(100, 'Brams', 'Je regarde');
  verifier('Son : mon propre message, venu du Worker, ne sonne pas (et écrire, c’est avoir lu)', sons() === 1 && $('#bulle-messages .non-lus').hidden && document.title.startsWith('DungeonCoop'), `${sons()} · ${document.title}`);
  const boutonSon = $('#messagerie .son');
  verifier('Son : le bouton 🔔 est dans le panneau, son actif au départ', boutonSon?.textContent === '🔔' && boutonSon.getAttribute('aria-pressed') === 'true', boutonSon?.outerHTML);
  boutonSon?.click();
  verifier('Son : 🔔 le coupe', boutonSon?.textContent === '🔕' && boutonSon.getAttribute('aria-pressed') === 'false', boutonSon?.outerHTML);
  recevoir(101, 'Cerise', 'Le boss est prêt');
  verifier('Son : coupé, un message ne sonne pas mais compte', sons() === 1 && /^\(1\) DungeonCoop/.test(document.title), `${sons()} · ${document.title}`);
  boutonSon?.click();
  verifier('Son : le remettre le fait entendre une fois', boutonSon?.textContent === '🔔' && sons() === 2, sons());
  bulle.click();
  verifier('Onglet : tout lu, le titre redevient normal', document.title.startsWith('DungeonCoop'), document.title);
  recevoir(102, 'Dorn', 'Vu, merci');
  verifier('Son : pendant qu’on lit la messagerie, rien ne sonne et tout est lu', sons() === 2 && $('#bulle-messages .non-lus').hidden && document.title.startsWith('DungeonCoop'), `${sons()} · ${document.title}`);
  $('#messagerie .fermer').click();
  try {
    // Le son lui-même, mesuré hors ligne : audible sans être fort, et court.
    const { programmerDing } = await import('./son.js');
    const frequence = 44100;
    const horsLigne = new OfflineAudioContext(1, frequence * 0.6, frequence);
    programmerDing(horsLigne, 0);
    const echantillons = (await horsLigne.startRendering()).getChannelData(0);
    let crete = 0;
    let fin = 0;
    echantillons.forEach((v, i) => {
      crete = Math.max(crete, Math.abs(v));
      if (Math.abs(v) > 0.001) fin = i;
    });
    verifier('Son : un ding doux (crête entre 0,05 et 0,4) et court (fini avant 0,45 s)', crete > 0.05 && crete < 0.4 && fin / frequence < 0.45, `crête ${crete.toFixed(3)}, fin à ${(fin / frequence).toFixed(2)} s`);
  } catch (erreur) {
    verifier('Son : le ding se fabrique hors ligne', false, erreur.message);
  }

  // Le direct : un message du Worker ne redessine que les widgets concernés, et s'affiche en notification.
  const rendus = (id) => Number($(`#${id}`).dataset.rendus);
  const avant = { prs: rendus('pull-requests'), commits: rendus('commits'), idees: rendus('idees') };
  simuler({ type: 'maj', sujets: ['prs'], messages: [{ texte: 'Brams a poussé 1 commit sur brams/evenement-taverne', depot: 'DungeonCoop' }] });
  await pause(900);
  verifier('Direct : le widget des PR est redessiné', rendus('pull-requests') === avant.prs + 1, `${avant.prs} → ${rendus('pull-requests')}`);
  verifier('Direct : les autres widgets ne bougent pas', rendus('commits') === avant.commits && rendus('idees') === avant.idees);
  verifier('Direct : la notification s’affiche', texte('#notifs').includes('Brams a poussé 1 commit'), texte('#notifs'));

  // Tableau de travail (après le direct : ses écritures redessinent les widgets des issues)
  const attendre = async (condition, ms = 3000) => {
    const debut = Date.now();
    while (Date.now() - debut < ms) {
      if (condition()) return true;
      await pause(50);
    }
    return false;
  };
  const vueTravail = async (vue) => {
    $(`#travail .onglet[data-vue="${vue}"]`)?.click();
    return attendre(() => $('#travail .travail')?.dataset.vue === vue);
  };
  const cartes = (colonne) => numeros(`#travail .colonne[data-colonne="${colonne}"] .carte-travail`);
  const surCarte = (numero, action) => $(`#travail .carte-travail[data-numero="${numero}"] [data-action="${action}"]`);
  const { config } = await import('./config.js');

  await vueTravail('axe');
  const axes = $$('#travail .colonne').map((c) => c.dataset.colonne);
  verifier('Travail : une colonne par axe, puis « Sans axe »', egal(axes, [...config.axes.map((a) => a.label), '']), axes);
  verifier('Travail : rangé par son label, casse comprise (« Axe: Histoire »)', cartes('axe: histoire').includes(38) && cartes('axe: histoire').includes(34), cartes('axe: histoire'));
  const tout = numeros('#travail .carte-travail');
  verifier('Travail : une idée prise est une carte ; une idée libre et une PR non', cartes('').includes(20) && !tout.includes(21) && !tout.includes(12), tout);
  verifier('Travail : la priorité haute d’abord', egal(cartes('axe: combats'), [32, 30]), cartes('axe: combats'));
  const combats = $('#travail .colonne[data-colonne="axe: combats"]');
  verifier('Travail : l’avancée d’un axe compte ses tâches fermées', combats?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === '33' && combats.textContent.includes('1/3 faites'), combats?.querySelector('.progression-axe')?.textContent);
  verifier('Travail : sans connexion, rien à modifier', !$('#travail [data-action="prendre"]') && $('#travail [data-action="connexion"]'));

  await vueTravail('etat');
  verifier('Travail : par état, à faire / en cours / fait', egal($$('#travail .colonne').map((c) => c.dataset.colonne), ['afaire', 'encours', 'fait']));
  verifier('Travail : personne dessus = à faire ; quelqu’un dessus = en cours', egal(cartes('afaire'), [33, 34]) && [20, 30, 32, 38].every((n) => cartes('encours').includes(n)), `${cartes('afaire')} | ${cartes('encours')}`);
  verifier('Travail : « Fait » montre les 14 derniers jours, sans les idées refusées', egal(cartes('fait'), [35]) && texte('#travail .colonne[data-colonne="fait"]').includes('+ 1 fermée'), cartes('fait'));

  $('#travail [data-action="connexion"]')?.click();
  await attendre(() => $('#travail .travail')?.dataset.connecte === 'oui');
  verifier('Travail : connecté, les cartes ont leurs boutons', Boolean(surCarte(34, 'prendre')) && texte('#travail .compte-github').includes('Brams'));

  surCarte(34, 'prendre')?.click();
  verifier('Travail : « Je prends » passe la carte en cours', await attendre(() => cartes('encours').includes(34)), cartes('encours'));
  verifier('Travail : …et « Qui fait quoi » suit', await attendre(() => numeros('#taches .colonne[data-personne="demo-brams"] li').includes(34)));
  verifier('Travail : le résultat s’affiche', texte('#travail .message-travail').includes('#34 prise'), texte('#travail .message-travail'));

  surCarte(34, 'fait')?.click();
  verifier('Travail : « Fait » ferme la carte, en tête de « Fait »', await attendre(() => cartes('fait')[0] === 34), cartes('fait'));

  const transfert = new DataTransfer();
  transfert.setData('text/plain', '33');
  $('#travail .colonne[data-colonne="encours"]')?.dispatchEvent(new DragEvent('drop', { dataTransfer: transfert, bubbles: true, cancelable: true }));
  verifier('Travail : glisser une carte libre dans « En cours » me la donne', await attendre(() => cartes('encours').includes(33)) && $('#travail .carte-travail[data-numero="33"] .qui')?.textContent.includes('BR'), cartes('encours'));

  await vueTravail('axe');
  const choix = $('#travail .carte-travail[data-numero="33"] select.choix-axe');
  if (choix) {
    choix.value = 'axe: menus';
    choix.dispatchEvent(new Event('change', { bubbles: true }));
  }
  verifier('Travail : changer d’axe range la carte ailleurs', await attendre(() => cartes('axe: menus').includes(33) && !cartes('').includes(33)), cartes('axe: menus'));

  const colonneHistoire = $('#travail .colonne[data-colonne="axe: histoire"]');
  colonneHistoire?.querySelector('[data-action="ajouter"]')?.click();
  const champ = colonneHistoire?.querySelector('.champ-carte');
  if (champ) {
    champ.value = 'Écrire la scène du <i>camp</i>';
    champ.form.requestSubmit();
  }
  verifier('Travail : « + Carte » crée une issue dans l’axe de la colonne', await attendre(() => cartes('axe: histoire').includes(39)), cartes('axe: histoire'));
  verifier('Travail : un titre tapé reste du texte', !$('#travail i') && texte('#travail').includes('<i>camp</i>'));

  // L'urgence (les labels « priorité: … ») et « Abandonner » (le supprimer du tableau : fermée non prévue, hors du tableau)
  const urgence = $('#travail .carte-travail[data-numero="39"] select.choix-urgence');
  if (urgence) {
    urgence.value = 'haute';
    urgence.dispatchEvent(new Event('change', { bubbles: true }));
  }
  verifier('Travail : choisir l’urgence d’une carte (« urgence élevée » : le label « priorité: haute »)',
    await attendre(() => texte('#travail .carte-travail[data-numero="39"] .prio') === 'urgence élevée'), texte('#travail .carte-travail[data-numero="39"] .meta'));
  const confirmer = window.confirm;
  window.confirm = () => true;
  surCarte(39, 'abandonner')?.click();
  window.confirm = confirmer;
  verifier('Travail : « Abandonner » sort la carte du tableau (fermée non prévue, label « abandonnée »)',
    await attendre(() => !numeros('#travail .carte-travail').includes(39)) && texte('#travail .message-travail').includes('#39 abandonnée'), texte('#travail .message-travail'));
  await vueTravail('etat');
  verifier('Travail : une carte abandonnée ne compte pas comme faite', !cartes('fait').includes(39), cartes('fait'));
  await vueTravail('axe');

  // Le pseudo (connecté à GitHub par le tableau de travail, plus haut).
  const ouvrirProfil = () => $('#menu-profil').hidden && $('#bouton-profil').click();
  const changerPseudo = (nom) => {
    ouvrirProfil();
    const champPseudo = $('#champ-pseudo');
    champPseudo.value = nom;
    champPseudo.form.requestSubmit();
  };
  ouvrirProfil();
  verifier('Profil : connecté à GitHub par le tableau, le menu le sait', texte('#menu-profil .profil-github').includes('@demo-brams') && !$('#champ-pseudo').disabled && $('#champ-pseudo').value === 'Brams', texte('#menu-profil'));
  verifier('Profil : connecté, « Je suis » disparaît (GitHub dit qui je suis)', !$('#menu-profil select#moi') && !texte('#menu-profil').includes('null'), texte('#menu-profil'));
  changerPseudo('áyla');
  verifier('Profil : le nom d’un autre membre est refusé (accents et majuscules compris)', await attendre(() => texte('#menu-profil .resultat.erreur').includes('déjà le nom')), texte('#menu-profil'));
  verifier('Profil : après un refus, ce que j’ai tapé reste dans le champ', $('#champ-pseudo')?.value === 'áyla' && texte('#bouton-profil .nom') === 'Brams', $('#champ-pseudo')?.value);
  changerPseudo('Brammo le Grand');
  verifier('Profil : le nouveau pseudo s’affiche en haut', await attendre(() => texte('#bouton-profil .nom') === 'Brammo le Grand'), texte('#bouton-profil'));
  verifier('Profil : le menu dit que c’est fait', await attendre(() => texte('#menu-profil .resultat.ok').includes('C’est fait')) && !$('#menu-profil').hidden, texte('#menu-profil'));
  verifier('Profil : …dans « Pour toi »', texte('#pour-toi h2') === 'Pour toi, Brammo le Grand', texte('#pour-toi h2'));
  verifier('Profil : …dans les widgets', await attendre(() => texte('#taches .colonne[data-personne="demo-brams"]').includes('Brammo le Grand')), texte('#taches .colonne[data-personne="demo-brams"]'));
  const miens = () => $$('#messagerie .msg.mien .qui strong').map((s) => s.textContent);
  verifier('Profil : …et sur mes anciens messages, signés « Brams »', miens().length > 0 && miens().every((n) => n === 'Brammo le Grand'), miens());
  window.__messagerie.recevoir({ type: 'message', message: { id: 110, auteur: 'Ayla', texte: '@Brams tu relis ?', t: Date.now() } });
  verifier('Profil : mon ancien nom me mentionne toujours', $('#messagerie .msg[data-id="110"] .mention.moi'));
  window.__appliquerProfils([...etat.profils, { github: 'demo-ayla', nom: 'Aylou', t: 1 }]);
  const auteurs = () => $$('#messagerie .msg .qui strong').map((s) => s.textContent);
  verifier('Profil : le pseudo d’un autre, prévenu par le Worker, change le nom de ses messages', auteurs().includes('Aylou') && !auteurs().includes('Ayla'), auteurs());
  changerPseudo('');
  verifier('Profil : un pseudo vide rend le nom d’equipe.json', await attendre(() => texte('#bouton-profil .nom') === 'Brams'), texte('#bouton-profil'));
  ouvrirProfil();
  $('#menu-profil [data-action="deconnexion-github"]')?.click();
  verifier('Profil : se déconnecter de GitHub depuis le menu ; le menu reste ouvert, le tableau suit', await attendre(() => $('#travail [data-action="connexion"]')) && !$('#menu-profil').hidden && $('#champ-pseudo')?.disabled && $('#menu-profil select#moi'));
  $('#menu-profil [data-action="connexion-github"]')?.click();
  verifier('Profil : se connecter depuis le menu (démo) ; le menu reste ouvert, le pseudo se change', !$('#menu-profil').hidden && !$('#champ-pseudo')?.disabled && texte('#menu-profil .profil-github').includes('@demo-brams'), texte('#menu-profil'));
  $('#menu-profil').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  verifier('Profil : Échap ferme le menu', $('#menu-profil').hidden);
  // Un Worker pas encore redéployé (GET /profils en 404) : le menu le dit, au lieu de laisser taper pour rien.
  const { pseudos } = await import('./github.js');
  Object.assign(pseudos, { disponibles: false, raison: 'Le Worker en ligne ne connaît pas encore les pseudos : il faut le redéployer (npm run deploy dans worker/).' });
  ouvrirProfil();
  verifier('Profil : un Worker sans pseudos, le champ est fermé et le menu dit pourquoi', $('#champ-pseudo')?.disabled && texte('#menu-profil .aide').includes('redéployer'), texte('#menu-profil .aide'));
  Object.assign(pseudos, { disponibles: true, raison: null });
  $('#menu-profil').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  window.__appliquerProfils([]);

  const reussies = resultats.filter((r) => r.ok).length;
  window.__resultats = resultats;
  document.documentElement.dataset.test = `${reussies}/${resultats.length}`;
  for (const r of resultats) console.log(`${r.ok ? '✓' : '✗'} ${r.nom}${r.ok ? '' : ` (${r.detail})`}`);
}
