#!/usr/bin/env node
// Un petit serveur pour ouvrir la page sur ton ordi, sans rien installer :
//   node outils/serveur.mjs        →  http://localhost:8000   (et http://localhost:8000/?demo)
// Il en faut un : les modules JavaScript ne marchent pas en ouvrant index.html par un double-clic.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

export function demarrer(port = 8000) {
  const serveur = createServer(async (requete, reponse) => {
    const chemin = decodeURIComponent(new URL(requete.url, 'http://local').pathname);
    let fichier = resolve(join(RACINE, chemin));
    const dedans = fichier === RACINE || fichier.startsWith(RACINE + sep);
    const cache = chemin.split('/').some((morceau) => morceau.startsWith('.')); // .git, .dev.vars…
    if (!dedans || cache) {
      reponse.writeHead(404).end();
      return;
    }
    try {
      if ((await stat(fichier)).isDirectory()) fichier = join(fichier, 'index.html');
      const corps = await readFile(fichier);
      reponse.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(corps);
    } catch {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
    }
  });
  return new Promise((ok) => serveur.listen(port, '127.0.0.1', () => ok(serveur)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const serveur = await demarrer(Number(process.argv[2] ?? 8000));
  const { port } = serveur.address();
  console.log(`Dashboard sur http://localhost:${port}   ·   démo : http://localhost:${port}/?demo   ·   Ctrl+C pour arrêter`);
}
