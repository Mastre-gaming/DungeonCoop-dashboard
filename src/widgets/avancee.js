// L'avancée globale : le tableau des jalons de GAME_SPEC.md (la source officielle), plus la part
// d'issues fermées de chaque jalon GitHub. Une barre par jalon, de D1 à M4.

import { config, depotJeu, urlGithub } from '../config.js';
import { api, fichier } from '../github.js';
import { el, lienExterne, pastille, vide, nomDeJalon, normaliser } from '../outils.js';

export const sujets = ['issues', 'commits']; // GAME_SPEC.md change avec un push

export async function afficher(ctx) {
  const [texte, jalonsGithub] = await Promise.all([
    fichier('GAME_SPEC.md', { force: ctx.force }),
    api(`/repos/${depotJeu}/milestones?state=all&per_page=100`, { force: ctx.force }).catch(() => []),
  ]);
  const jalons = lireJalons(texte);
  const source = lienExterne(`${urlGithub()}/blob/main/GAME_SPEC.md`, {}, 'GAME_SPEC.md');
  if (!jalons.length) return vide('Le tableau « Milestones » de GAME_SPEC.md est introuvable.', source);

  const comptes = new Map();
  for (const j of jalonsGithub) comptes.set(nomDeJalon(j.title), { ouvertes: j.open_issues, fermees: j.closed_issues, lien: j.html_url });

  const maintenant = lirePuce(texte, 'Now', 'Current stage');
  const enAttente = lirePuce(texte, 'Now', 'Waiting on the owner');
  const faits = jalons.filter((j) => etatDe(j.statut) === 'fait').length;
  const courant = jalons.find((j) => etatDe(j.statut) !== 'fait');

  return el('div', {},
    el('div', { class: 'resume' },
      el('div', { class: 'chiffre' }, el('strong', {}, faits), el('span', {}, ` / ${jalons.length} jalons faits`)),
      maintenant ? el('p', {}, el('span', { class: 'muet' }, 'Étape actuelle : '), maintenant) : null,
      enAttente && !/^nothing|^rien/i.test(enAttente)
        ? pastille('attention', `En attente de la vérification du propriétaire : ${enAttente}`)
        : null),
    el('ol', { class: 'jalons' }, jalons.map((j) => ligne(j, comptes.get(j.id), j === courant))),
    el('p', { class: 'pied' }, 'Source : ', source, ' · ', lienExterne(`${urlGithub()}/milestones`, {}, 'les jalons GitHub')));
}

function ligne(jalon, compte, estCourant) {
  const etat = etatDe(jalon.statut);
  const total = compte ? compte.ouvertes + compte.fermees : 0;
  const part = total ? compte.fermees / total : etat === 'fait' ? 1 : 0;
  const pourcent = Math.round(part * 100);
  const detailIssues = total ? `${compte.fermees}/${total} fermées` : 'aucune issue';
  const statut = {
    fait: pastille('bon', 'fait'),
    'en-cours': pastille('encours', 'en cours'),
    'pas-commence': pastille('neutre', 'pas commencé'),
  }[etat] ?? pastille('neutre', jalon.statut);

  // Une ligne par jalon : id, nom, barre, chiffres, statut (sur deux lignes quand la carte est étroite).
  return el('li', { class: `jalon${estCourant ? ' courant' : ''}`, dataset: { jalon: jalon.id, etat }, tabindex: '0' },
    el('strong', { class: 'id' }, jalon.id),
    el('span', { class: 'nom' }, jalon.titre, estCourant ? el('span', { class: 'tag toi' }, 'maintenant') : null),
    el('div', { class: 'barre', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pourcent), 'aria-label': `${jalon.id} : ${pourcent} %` },
      el('span', { class: 'rempli', style: `width:${pourcent}%` })),
    el('span', { class: 'chiffres' },
      compte?.lien ? lienExterne(compte.lien, { title: 'les issues de ce jalon' }, detailIssues) : detailIssues,
      ' · ', el('span', { class: 'pourcent' }, `${pourcent} %`)),
    statut,
    // Le détail au survol ou au focus : ce qui valide le jalon, tel qu'écrit dans GAME_SPEC.md.
    el('div', { class: 'info-bulle', role: 'tooltip' },
      el('strong', {}, `${jalon.id} · ${jalon.titre}`),
      jalon.detail ? el('p', {}, jalon.detail) : null,
      el('p', {}, el('span', { class: 'muet' }, 'Validé quand : '), jalon.check),
      el('p', {}, el('span', { class: 'muet' }, 'Issues : '), total ? `${compte.fermees} fermées sur ${total}` : 'aucune pour l’instant'),
      el('p', {}, el('span', { class: 'muet' }, 'Statut dans GAME_SPEC.md : '), jalon.statut || '—')));
}

// --- Lire GAME_SPEC.md -----------------------------------------------------------------------

function section(texte, titre) {
  const debut = new RegExp(`^##\\s+${titre}\\b.*$`, 'mi').exec(texte);
  if (!debut) return '';
  const reste = texte.slice(debut.index + debut[0].length);
  const fin = reste.search(/^##\s/m);
  return fin < 0 ? reste : reste.slice(0, fin);
}

const nettoyer = (s) => String(s ?? '').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();

export function lireJalons(texte) {
  const lignes = section(texte, 'Milestones').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  return lignes
    .map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
    .filter((c) => c.length >= 4 && !/^:?-+:?$/.test(c[0]) && nettoyer(c[0]) !== '#')
    .map(([id, resultat, check, statut]) => ({ id: nettoyer(id), ...titreEtDetail(resultat), check: nettoyer(check), statut: nettoyer(statut) }))
    .filter((j) => j.id);
}

// « **The paper fight**, both turn modes… » → titre « The paper fight », détail « both turn modes… ».
// « The table is set: repo and live link… » → titre « The table is set », détail « repo and live link… ».
function titreEtDetail(resultat) {
  const gras = /^\*\*(.+?)\*\*[\s,:;.-]*(.*)$/.exec(resultat.trim());
  if (gras) return { titre: nettoyer(gras[1]), detail: nettoyer(gras[2]) };
  const texte = nettoyer(resultat);
  const deuxPoints = texte.indexOf(':');
  if (deuxPoints > 0 && deuxPoints < 60) return { titre: texte.slice(0, deuxPoints), detail: texte.slice(deuxPoints + 1).trim() };
  return { titre: texte, detail: '' };
}

function lirePuce(texte, titreSection, debut) {
  const echappe = debut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^\\s*-\\s*\\*\\*${echappe}[^*]*\\*\\*\\s*(.+)$`, 'mi').exec(section(texte, titreSection));
  return m ? nettoyer(m[1]) : null;
}

export function etatDe(statut) {
  const n = normaliser(statut);
  if (/^(done|fait|termine|passed|reussi|valide)/.test(n)) return 'fait';
  if (/^(in progress|en cours|started|commence)/.test(n)) return 'en-cours';
  if (!n || /^(not started|pas commence|a faire|todo)/.test(n)) return 'pas-commence';
  return 'autre';
}
