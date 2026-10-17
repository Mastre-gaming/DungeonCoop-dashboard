// Le réglage du thème : clair, sombre, ou auto (comme l'ordinateur). Le choix est gardé dans ce navigateur.
// Les couleurs elles-mêmes sont dans style.css : :root[data-theme="light"] et :root[data-theme="dark"].

const CLE = 'dungeoncoop:theme';

export function choixActuel() {
  return document.documentElement.dataset.theme ?? 'auto';
}

export function appliquer(choix) {
  const racine = document.documentElement;
  if (choix === 'light' || choix === 'dark') racine.dataset.theme = choix;
  else delete racine.dataset.theme;
  try {
    if (choix === 'light' || choix === 'dark') localStorage.setItem(CLE, choix);
    else localStorage.removeItem(CLE);
  } catch {}
  for (const bouton of document.querySelectorAll('[data-theme-choix]')) {
    bouton.setAttribute('aria-pressed', String(bouton.dataset.themeChoix === choixActuel()));
  }
}

export function installerTheme() {
  for (const bouton of document.querySelectorAll('[data-theme-choix]')) {
    bouton.addEventListener('click', () => appliquer(bouton.dataset.themeChoix));
  }
  appliquer(choixActuel());
}
