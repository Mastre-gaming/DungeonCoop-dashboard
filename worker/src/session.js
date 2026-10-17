// Le laissez-passer de la plateforme. Après le bon mot de passe, le navigateur reçoit un jeton signé :
//   v1.<date de fin>.<nom du dev en base64url>.<signature HMAC-SHA256>
// La clé de signature est le mot de passe lui-même (le secret MOT_DE_PASSE). Les deux Workers (la page et
// le direct) le vérifient avec le même secret, et changer le mot de passe déconnecte tout le monde.

const encodeur = new TextEncoder();
export const DUREE_SESSION = 30 * 24 * 3600 * 1000; // 30 jours

function base64url(octets) {
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64url(texte) {
  const base64 = texte.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

async function cle(secret, usage) {
  return crypto.subtle.importKey('raw', encodeur.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function creerJeton(secret, nom, { maintenant = Date.now(), duree = DUREE_SESSION } = {}) {
  const corps = `v1.${maintenant + duree}.${base64url(encodeur.encode(nom))}`;
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await cle(secret, 'sign'), encodeur.encode(corps)));
  return `${corps}.${base64url(signature)}`;
}

// Le nom et la date de fin si le jeton est valide, sinon null.
export async function lireJeton(secret, jeton, { maintenant = Date.now() } = {}) {
  if (!secret || typeof jeton !== 'string' || jeton.length > 400) return null;
  const parties = jeton.split('.');
  if (parties.length !== 4 || parties[0] !== 'v1' || !/^\d{1,15}$/.test(parties[1])) return null;
  const [version, fin, nom64, signature64] = parties;
  try {
    const valide = await crypto.subtle.verify('HMAC', await cle(secret, 'verify'), depuisBase64url(signature64),
      encodeur.encode(`${version}.${fin}.${nom64}`)); // verify compare en temps constant
    if (!valide || Number(fin) <= maintenant) return null;
    const nom = new TextDecoder('utf-8', { fatal: true }).decode(depuisBase64url(nom64));
    return nomValide(nom) ? { nom, fin: Number(fin) } : null;
  } catch {
    return null;
  }
}

// Compare deux mots de passe sans laisser deviner, au temps de réponse, combien de lettres sont justes.
export function motDePasseValide(attendu, donne) {
  if (!attendu || typeof donne !== 'string') return false;
  const a = encodeur.encode(attendu);
  const b = encodeur.encode(donne);
  let difference = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ (b[i] ?? 0);
  return difference === 0;
}

// Un nom de dev : 1 à 40 lettres, chiffres, espaces, points, tirets, apostrophes. Pas de < ni de " : il reste lisible partout.
export function nomValide(nom) {
  return typeof nom === 'string' && nom === nom.trim() && /^[\p{L}\p{N}][\p{L}\p{N} ._'’-]{0,39}$/u.test(nom);
}
