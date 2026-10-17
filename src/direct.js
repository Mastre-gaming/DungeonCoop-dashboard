// La connexion « en direct » au Worker : il envoie un message dès que GitHub lui signale un push,
// une PR, une relecture, une issue… La page redessine alors seulement les widgets concernés.
//
// Un message du Worker : { type: 'maj', sujets: ['prs', 'commits', 'issues'], messages: [{ texte, lien, depot, acteur }] }

export function brancher(adresse, { surMessage, surEtat }) {
  const url = `${adresse.replace(/^http/, 'ws')}/direct`;
  let socket = null;
  let attente = 1000;
  let minuterie = null;
  let battement = null;
  let dejaConnecte = false;

  function ouvrir() {
    clearTimeout(minuterie);
    surEtat('connexion');
    try {
      socket = new WebSocket(url);
    } catch {
      return plusTard();
    }
    socket.addEventListener('open', () => {
      attente = 1000;
      surEtat('direct', { reconnexion: dejaConnecte });
      dejaConnecte = true;
      // Un « ping » toutes les 30 s garde la connexion ouverte ; le Worker répond « pong » sans se réveiller.
      clearInterval(battement);
      battement = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send('ping'), 30_000);
    });
    socket.addEventListener('message', (evenement) => {
      if (evenement.data === 'pong') return;
      try {
        const message = JSON.parse(evenement.data);
        if (message.type === 'maj') surMessage(message);
      } catch {}
    });
    socket.addEventListener('close', () => {
      clearInterval(battement);
      surEtat('hors-ligne');
      plusTard();
    });
  }

  function plusTard() {
    clearTimeout(minuterie);
    minuterie = setTimeout(ouvrir, attente);
    attente = Math.min(attente * 2, 30_000);
  }

  // Un ordinateur qui sort de veille a pu rater des messages : on se reconnecte tout de suite.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && socket?.readyState !== WebSocket.OPEN) {
      attente = 1000;
      ouvrir();
    }
  });

  ouvrir();
}
