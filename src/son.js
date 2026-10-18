// Le petit son des nouveaux messages. Le navigateur le fabrique (Web Audio) : pas de fichier à charger.
// Un navigateur ne joue aucun son tant qu'on n'a pas cliqué ou tapé une touche sur la page : avant ce
// premier geste, le son se tait, sans erreur.

const ECART_MIN_MS = 1500; // plusieurs messages d'un coup ne font qu'un son

// Deux notes courtes qui montent (la puis mi), éteintes en un tiers de seconde. N'importe quel contexte
// audio convient, aussi un OfflineAudioContext : src/test.js mesure le son ainsi, sans le jouer.
export function programmerDing(contexte, debut = contexte.currentTime) {
  for (const [i, frequence] of [880, 1318.5].entries()) {
    const t = debut + i * 0.09;
    const oscillateur = contexte.createOscillator();
    const volume = contexte.createGain();
    oscillateur.type = 'sine';
    oscillateur.frequency.value = frequence;
    volume.gain.setValueAtTime(0.0001, t);
    volume.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    oscillateur.connect(volume).connect(contexte.destination);
    oscillateur.start(t);
    oscillateur.stop(t + 0.32);
  }
}

// Renvoie la fonction qui joue le son. Le contexte audio naît au premier geste sur la page.
export function creerSon() {
  let contexte = null;
  let dernier = -Infinity;
  const debloquer = () => {
    try {
      contexte ??= new AudioContext();
      if (contexte.state === 'suspended') contexte.resume();
    } catch {}
  };
  for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, debloquer, { capture: true, passive: true });

  return function jouer() {
    if (!contexte) return; // pas encore de geste : le navigateur refuserait
    const maintenant = performance.now();
    if (maintenant - dernier < ECART_MIN_MS) return;
    dernier = maintenant;
    const pret = contexte.state === 'running' ? Promise.resolve() : contexte.resume();
    pret.then(() => programmerDing(contexte), () => {});
  };
}
