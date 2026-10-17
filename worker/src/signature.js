// Vérifie qu'un webhook vient bien de GitHub : GitHub signe le corps avec le secret partagé (HMAC SHA-256)
// et met la signature dans l'en-tête X-Hub-Signature-256. Sans le secret, personne ne peut imiter GitHub.

const encodeur = new TextEncoder();

async function cle(secret, usage) {
  return crypto.subtle.importKey('raw', encodeur.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function signatureValide(secret, corps, entete) {
  if (!secret || typeof entete !== 'string' || !entete.startsWith('sha256=')) return false;
  const hex = entete.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  const signature = Uint8Array.from(hex.match(/../g), (octet) => parseInt(octet, 16));
  // verify compare en temps constant : on ne peut pas deviner la signature octet par octet.
  return crypto.subtle.verify('HMAC', await cle(secret, 'verify'), signature, encodeur.encode(corps));
}

export async function signer(secret, corps) {
  const octets = new Uint8Array(await crypto.subtle.sign('HMAC', await cle(secret, 'sign'), encodeur.encode(corps)));
  return `sha256=${[...octets].map((o) => o.toString(16).padStart(2, '0')).join('')}`;
}
