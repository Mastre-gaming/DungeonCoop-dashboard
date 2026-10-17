// La connexion « en direct » au Worker. Il envoie un message dès que GitHub lui signale un push, une PR,
// une relecture, une issue… La page redessine alors seulement les widgets concernés. La même connexion
// porte la messagerie (src/messagerie.js).
//
// Messages du Worker : { type: 'maj', sujets: ['prs', 'commits', 'issues'], messages: [{ texte, lien, depot }] },
// et ceux de la messagerie (bienvenue, message, refuse, envoye, erreur).

export function brancher(adresse, { surMessage, surEtat, surOuverture = () => {} }) {
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
      surOuverture();
    });
    socket.addEventListener('message', (evenement) => {
      if (evenement.data === 'pong') return;
      let message;
      try {
        message = JSON.parse(evenement.data);
      } catch {
        return;
      }
      surMessage(message);
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

  return {
    // Envoie un objet au Worker ; false si la connexion n'est pas ouverte.
    envoyer(objet) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(objet));
      return true;
    },
  };
}
