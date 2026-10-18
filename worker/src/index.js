// Le Worker « en direct » du dashboard.
//
//   POST /webhook   GitHub y envoie chaque push, PR, relecture, issue… (signé avec WEBHOOK_SECRET)
//   GET  /direct    les pages ouvertes s'y connectent (WebSocket) pour être prévenues tout de suite,
//                   et pour la messagerie (avec le laissez-passer de l'entrée, vérifié avec MOT_DE_PASSE)
//   GET  /api/…     lit l'API GitHub avec le token (5 000 appels/h) et un cache partagé par toutes les pages
//   GET  /auth/…    la connexion GitHub du tableau de travail (connexion.js)
//   GET  /profils   les pseudos des devs ; PUT /profil pour changer le sien (profils.js), lus aussi par le camp
//   GET  /          l'état du Worker : token et secret présents, nombre de pages connectées
//
// Tout l'état vit dans un seul Durable Object (« la salle ») : le cache, et la liste des pages connectées.

import { DurableObject } from 'cloudflare:workers';
import { Cache } from './cache.js';
import { connexion, connexionPrete } from './connexion.js';
import { depotsDe, regle, regles } from './chemins.js';
import { traduire } from './evenements.js';
import { Messagerie } from './messagerie.js';
import { changerProfil } from './profils.js';
import { signatureValide } from './signature.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const EQUIPE_MS = 60_000; // equipe.json relu au plus une fois par minute

const texte = (corps, status = 200) => new Response(corps, { status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    const salle = env.SALLE.get(env.SALLE.idFromName('dungeoncoop'), { locationHint: 'weur' });

    if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/direct') {
      if (requete.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return texte('Ici, il faut une connexion WebSocket.', 426);
      return salle.fetch(requete);
    }

    if (url.pathname === '/webhook') {
      if (requete.method !== 'POST') return texte('GitHub envoie ses webhooks ici, en POST.', 405);
      return recevoirWebhook(requete, env, salle);
    }

    if (url.pathname.startsWith('/api/') && requete.method === 'GET') {
      const reponse = await salle.lire(url.pathname.slice('/api'.length) + url.search);
      return new Response(reponse.corps, {
        status: reponse.status,
        headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (url.pathname.startsWith('/auth/') && requete.method === 'GET') return connexion(requete, env);

    if (url.pathname === '/profils' && requete.method === 'GET') {
      return Response.json(await salle.profils(), { headers: { ...CORS, 'Cache-Control': 'no-store' } });
    }

    if (url.pathname === '/profil' && requete.method === 'PUT') {
      const token = (requete.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      const corps = await requete.text();
      if (corps.length > 1000) return texte('Trop long.', 413);
      let donnees;
      try {
        donnees = JSON.parse(corps || '{}');
      } catch {
        return texte('Le corps n’est pas du JSON.', 400);
      }
      const { status, erreur, profil, profils } = await salle.changerProfil(token, donnees);
      return Response.json(erreur ? { erreur } : { profil, profils }, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });
    }

    if (url.pathname === '/' && requete.method === 'GET') {
      return Response.json(await salle.sante(), { headers: { ...CORS, 'Cache-Control': 'no-store' } });
    }

    return texte('Rien ici.', 404);
  },
};

async function recevoirWebhook(requete, env, salle) {
  if (!env.WEBHOOK_SECRET) return texte('WEBHOOK_SECRET manque : npx wrangler secret put WEBHOOK_SECRET', 503);
  const corps = await requete.text();
  if (!(await signatureValide(env.WEBHOOK_SECRET, corps, requete.headers.get('X-Hub-Signature-256')))) {
    return texte('Signature invalide : le secret du webhook GitHub et WEBHOOK_SECRET doivent être identiques.', 401);
  }
  let payload;
  try {
    payload = JSON.parse(corps);
  } catch {
    return texte('Le corps n’est pas du JSON : choisis « application/json » dans le webhook GitHub.', 400);
  }
  const suivis = depotsDe(env).map((d) => d.toLowerCase());
  if (!suivis.includes(String(payload.repository?.full_name).toLowerCase())) return texte('Ce repo n’est pas suivi (DEPOTS).', 202);

  const { sujets, message } = traduire(requete.headers.get('X-GitHub-Event') ?? '', payload);
  if (sujets.length || message) await salle.evenement({ sujets, message });
  return texte('ok');
}

export class Salle extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.regles = regles(depotsDe(env));
    this.cache = new Cache({ recuperer: (chemin) => this.#github(chemin) });
    this.limite = null;
    this.attente = null;
    // Les pages envoient « ping » toutes les 30 s ; la réponse part sans réveiller la salle.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

    // La messagerie : les messages vivent dans la base SQLite de la salle (les 1 000 derniers).
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, auteur TEXT NOT NULL, texte TEXT NOT NULL, t INTEGER NOT NULL)');
    this.messagerie = new Messagerie({
      secret: env.MOT_DE_PASSE,
      stockage: {
        ajouter: ({ auteur, texte, t }) => {
          const { id } = sql.exec('INSERT INTO messages (auteur, texte, t) VALUES (?, ?, ?) RETURNING id', auteur, texte, t).one();
          sql.exec('DELETE FROM messages WHERE id <= ?', id - 1000);
          return id;
        },
        derniers: (n) => sql.exec('SELECT id, auteur, texte, t FROM messages ORDER BY id DESC LIMIT ?', n).toArray().reverse(),
      },
    });

    // Les pseudos des devs, un par compte GitHub (profils.js).
    sql.exec('CREATE TABLE IF NOT EXISTS profils (github TEXT PRIMARY KEY COLLATE NOCASE, nom TEXT NOT NULL, t INTEGER NOT NULL)');
    this.equipe = null; // { liste, t } : equipe.json, relu au plus une fois par minute
  }

  async fetch() {
    const [client, serveur] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(serveur); // « hibernation » : une page connectée ne coûte rien tant que rien ne se passe
    serveur.serializeAttachment({ equipe: false });
    return new Response(null, { status: 101, webSocket: client });
  }

  async lire(chemin) {
    const r = regle(chemin, this.regles);
    if (!r) return { status: 404, corps: JSON.stringify({ message: `Chemin non autorisé : ${chemin}` }) };
    return this.cache.lire(chemin, r);
  }

  async evenement({ sujets, message }) {
    this.cache.invalider(sujets);
    // Un push déclenche souvent plusieurs webhooks d'affilée (push, check_suite, pull_request…) :
    // on les regroupe pendant 800 ms et on prévient les pages une seule fois.
    if (!this.attente) {
      this.attente = { sujets: new Set(), messages: [] };
      setTimeout(() => this.#diffuser(), 800);
    }
    for (const sujet of sujets) this.attente.sujets.add(sujet);
    if (message) this.attente.messages.push(message);
  }

  #diffuser() {
    const { sujets, messages } = this.attente;
    this.attente = null;
    const envoi = JSON.stringify({ type: 'maj', sujets: [...sujets], messages: messages.slice(-5) });
    for (const page of this.ctx.getWebSockets()) {
      try {
        page.send(envoi);
      } catch {}
    }
  }

  async sante() {
    return {
      ok: true,
      nom: 'dungeoncoop-direct',
      token: Boolean(this.env.GITHUB_TOKEN),
      secret: Boolean(this.env.WEBHOOK_SECRET),
      messagerie: Boolean(this.env.MOT_DE_PASSE),
      messages: this.ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM messages').one().n,
      profils: this.ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM profils').one().n,
      connexion: connexionPrete(this.env),
      pagesConnectees: this.ctx.getWebSockets().length,
      depots: depotsDe(this.env),
      github: this.limite,
    };
  }

  // « ping » est géré par l'auto-réponse ; le reste, c'est la messagerie.
  async webSocketMessage(page, recu) {
    if (typeof recu !== 'string' || recu.length > 4000) return;
    const { attachement, envoyer, diffuser } = await this.messagerie.traiter(recu, page.deserializeAttachment() ?? {});
    page.serializeAttachment(attachement);
    for (const message of envoyer) page.send(JSON.stringify(message));
    if (!diffuser.length) return;
    // Seulement aux pages entrées avec le mot de passe.
    const entrees = this.ctx.getWebSockets().filter((p) => p.deserializeAttachment()?.equipe);
    for (const message of diffuser) {
      const texte = JSON.stringify(message);
      for (const autre of entrees) {
        try {
          autre.send(texte);
        } catch {}
      }
    }
  }

  profils() {
    return this.ctx.storage.sql.exec('SELECT github, nom, t FROM profils ORDER BY github').toArray();
  }

  async changerProfil(token, corps) {
    const sql = this.ctx.storage.sql;
    const resultat = await changerProfil({
      token,
      corps,
      equipe: await this.#equipe(),
      profils: this.profils(),
      quiEst: (t) => this.#quiEst(t),
      enregistrer: ({ github, nom, t }) => sql.exec('INSERT INTO profils (github, nom, t) VALUES (?, ?, ?) ON CONFLICT(github) DO UPDATE SET github = excluded.github, nom = excluded.nom, t = excluded.t', github, nom, t),
      effacer: (github) => sql.exec('DELETE FROM profils WHERE github = ?', github),
    });
    if (resultat.erreur) return resultat;
    // Toutes les pages ouvertes (le dashboard et le camp) l'apprennent tout de suite.
    const profils = this.profils();
    const envoi = JSON.stringify({ type: 'profils', profils });
    for (const page of this.ctx.getWebSockets()) {
      try {
        page.send(envoi);
      } catch {}
    }
    return { ...resultat, profils };
  }

  // Le login GitHub à qui appartient ce token, ou null s'il est refusé.
  async #quiEst(token) {
    const reponse = await fetch('https://api.github.com/user', {
      headers: { 'User-Agent': 'dungeoncoop-direct', Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    });
    if (reponse.status === 401 || reponse.status === 403) return null;
    if (!reponse.ok) throw new Error(`GitHub a répondu ${reponse.status}`);
    return (await reponse.json()).login ?? null;
  }

  // equipe.json (EQUIPE dans wrangler.jsonc) : qui fait partie de l'équipe. null si on n'a jamais pu le lire.
  async #equipe() {
    if (this.equipe && Date.now() - this.equipe.t < EQUIPE_MS) return this.equipe.liste;
    try {
      const reponse = await fetch(this.env.EQUIPE, { headers: { 'User-Agent': 'dungeoncoop-direct' } });
      const liste = reponse.ok ? await reponse.json() : null;
      if (Array.isArray(liste)) this.equipe = { liste, t: Date.now() };
    } catch {}
    return this.equipe?.liste ?? null;
  }

  webSocketClose(page, code, raison) {
    try {
      page.close(code, raison);
    } catch {}
  }

  async #github(chemin) {
    const entetes = { 'User-Agent': 'dungeoncoop-direct', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (this.env.GITHUB_TOKEN) entetes.Authorization = `Bearer ${this.env.GITHUB_TOKEN}`;
    const reponse = await fetch(`https://api.github.com${chemin}`, { headers: entetes });
    const restants = reponse.headers.get('x-ratelimit-remaining');
    if (restants !== null) this.limite = { restants: Number(restants), sur: Number(reponse.headers.get('x-ratelimit-limit')) };
    return { status: reponse.status, corps: await reponse.text() };
  }
}
