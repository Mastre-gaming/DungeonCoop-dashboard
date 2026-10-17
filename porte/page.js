// L'écran d'entrée : le mot de passe et le nom du dev. Une page autonome (son style est dedans), servie par
// la porte tant qu'on n'est pas connecté. Tout ce qui vient de l'extérieur passe par echapper().

const echapper = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function pageEntree({ noms = [], nom = '', suite = '/', erreur = '', panne = '' } = {}) {
  const options = noms.map((n) => `<option value="${echapper(n)}"></option>`).join('');
  const formulaire = panne
    ? `<p class="message" role="alert">${echapper(panne)}</p>`
    : `<form method="post" action="/connexion">
        ${erreur ? `<p class="message" role="alert">${echapper(erreur)}</p>` : ''}
        <label>Mot de passe
          <input type="password" name="mot_de_passe" autocomplete="current-password" required autofocus>
        </label>
        <label>Ton nom de dev
          <input type="text" name="nom" list="noms" value="${echapper(nom)}" maxlength="40" autocomplete="nickname" required>
          <datalist id="noms">${options}</datalist>
        </label>
        <input type="hidden" name="suite" value="${echapper(suite)}">
        <button type="submit">Entrer</button>
        <p class="note">Tu restes connecté 30 jours sur ce navigateur. Ton nom signe tes messages et te montre ce qui t’attend.</p>
      </form>`;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>DungeonCoop · Entrée</title>
  <script>try { const t = localStorage.getItem('dungeoncoop:theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch {}</script>
  <style>
    :root { color-scheme: light; --page: #f4f3ef; --surface: #fcfcfb; --texte: #0b0b0b; --texte-2: #52514e; --bord: rgba(11,11,11,.12); --accent: #2a78d6; --grave: #d03b3b; }
    @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; --page: #0d0d0d; --surface: #1a1a19; --texte: #f0efec; --texte-2: #c3c2b7; --bord: rgba(255,255,255,.12); --accent: #3987e5; } }
    :root[data-theme="dark"] { color-scheme: dark; --page: #0d0d0d; --surface: #1a1a19; --texte: #f0efec; --texte-2: #c3c2b7; --bord: rgba(255,255,255,.12); --accent: #3987e5; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--page); color: var(--texte); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    main { width: min(380px, 100%); background: var(--surface); border: 1px solid var(--bord); border-radius: 12px; padding: 28px 24px; }
    .marque { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
    .marque svg { width: 42px; height: 42px; flex: none; }
    h1 { margin: 0; font-size: 1.4rem; }
    .marque p { margin: 2px 0 0; color: var(--texte-2); font-size: .9rem; }
    form { display: grid; gap: 14px; }
    label { display: grid; gap: 6px; font-weight: 600; font-size: .9rem; }
    input { font: inherit; font-weight: 400; color: var(--texte); background: var(--page); border: 1px solid var(--bord); border-radius: 8px; padding: 9px 11px; }
    input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    button { font: inherit; font-weight: 700; color: #fff; background: var(--accent); border: 0; border-radius: 8px; padding: 10px; cursor: pointer; }
    button:hover { filter: brightness(1.08); }
    .message { margin: 0; padding: 9px 12px; border-radius: 8px; border-left: 3px solid var(--grave); background: var(--page); }
    .note { margin: 0; color: var(--texte-2); font-size: .82rem; }
  </style>
</head>
<body>
  <main>
    <div class="marque">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 29 9.5v13L16 30 3 22.5v-13Z" fill="var(--accent)"/><path d="M16 8 24 21H8ZM16 2v6M3 9.5 8 21M29 9.5 24 21M8 21l-5 1.5M24 21l5 1.5M8 21l8 9 8-9" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" opacity=".9"/></svg>
      <div><h1>DungeonCoop</h1><p>Le tableau de bord de l’équipe</p></div>
    </div>
    ${formulaire}
  </main>
</body>
</html>`;
}
