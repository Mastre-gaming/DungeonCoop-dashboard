// Les vérifications de ?test. Elles tournent sur les données de démo (demo/donnees.js), sans réseau.
// Le résultat va dans <html data-test="réussies/total"> : outils/test.mjs le lit et sort en erreur s'il en manque.
// Une nouvelle fonction dans un widget = une vérification ici.

const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

export async function lancerTests({ simuler }) {
  const resultats = [];
  const verifier = (nom, ok, detail = '') => resultats.push({ nom, ok: Boolean(ok), detail: ok ? '' : String(detail) });
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const texte = (s) => $(s)?.textContent ?? '';
  const numeros = (s) => $$(s).map((n) => Number(n.dataset.numero));
  const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

  // Le direct : un message du Worker ne redessine que les widgets concernés, et s'affiche en notification.
  const rendus = (id) => Number($(`#${id}`).dataset.rendus);
  const avant = { prs: rendus('pull-requests'), commits: rendus('commits'), idees: rendus('idees') };
  simuler({ type: 'maj', sujets: ['prs'], messages: [{ texte: 'Brams a poussé 1 commit sur brams/evenement-taverne', depot: 'DungeonCoop' }] });
  await pause(900);
  verifier('Direct : le widget des PR est redessiné', rendus('pull-requests') === avant.prs + 1, `${avant.prs} → ${rendus('pull-requests')}`);
  verifier('Direct : les autres widgets ne bougent pas', rendus('commits') === avant.commits && rendus('idees') === avant.idees);
  verifier('Direct : la notification s’affiche', texte('#notifs').includes('Brams a poussé 1 commit'), texte('#notifs'));

  const reussies = resultats.filter((r) => r.ok).length;
  window.__resultats = resultats;
  document.documentElement.dataset.test = `${reussies}/${resultats.length}`;
  for (const r of resultats) console.log(`${r.ok ? '✓' : '✗'} ${r.nom}${r.ok ? '' : ` (${r.detail})`}`);
}
