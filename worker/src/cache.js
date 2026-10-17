// Le cache partagé : une seule copie de chaque réponse GitHub pour toutes les pages ouvertes.
// Une réponse reste valable jusqu'à ce qu'un webhook la rende périmée, ou au plus `duree` (filet de sécurité
// pour ce que les webhooks ne disent pas, comme les votes 👍).

export class Cache {
  constructor({ recuperer, maintenant = () => Date.now(), duree = 120_000, taille = 500 }) {
    this.recuperer = recuperer; // async (chemin) => { status, corps }
    this.maintenant = maintenant;
    this.duree = duree;
    this.taille = taille;
    this.entrees = new Map();
    this.enCours = new Map();
    this.generation = 0;
  }

  lire(chemin, regle) {
    const entree = this.entrees.get(chemin);
    if (entree && this.maintenant() < entree.expire) return Promise.resolve(entree.reponse);
    // Quatre pages qui demandent la même chose en même temps : un seul appel à GitHub.
    if (this.enCours.has(chemin)) return this.enCours.get(chemin);
    const promesse = this.#charger(chemin, regle, entree).finally(() => this.enCours.delete(chemin));
    this.enCours.set(chemin, promesse);
    return promesse;
  }

  async #charger(chemin, regle, ancienne) {
    const generation = this.generation;
    let reponse;
    try {
      reponse = await this.recuperer(chemin);
    } catch (erreur) {
      if (ancienne) return ancienne.reponse;
      return { status: 502, corps: JSON.stringify({ message: `GitHub injoignable : ${erreur.message}` }) };
    }
    if (reponse.status === 200) {
      // Un webhook est arrivé pendant l'appel : la réponse est peut-être déjà vieille, on ne la garde pas.
      if (generation === this.generation) this.#garder(chemin, { reponse, sujet: regle.sujet, expire: this.maintenant() + this.#duree(regle, reponse) });
      return reponse;
    }
    // Limite atteinte ou GitHub en panne : la dernière bonne réponse vaut mieux que rien.
    if (ancienne && (reponse.status === 403 || reponse.status === 429 || reponse.status >= 500)) return ancienne.reponse;
    return reponse;
  }

  #duree(regle, reponse) {
    if (regle.sujet === null) return 24 * 3600_000; // un commit précis ne change jamais
    if (regle.mergeable && /"mergeable"\s*:\s*null/.test(reponse.corps)) return 5_000; // GitHub calcule encore le conflit
    return this.duree;
  }

  #garder(chemin, entree) {
    this.entrees.delete(chemin);
    this.entrees.set(chemin, entree);
    while (this.entrees.size > this.taille) this.entrees.delete(this.entrees.keys().next().value);
  }

  invalider(sujets) {
    if (!sujets.length) return;
    this.generation += 1;
    for (const [chemin, entree] of this.entrees) {
      if (sujets.includes(entree.sujet)) this.entrees.delete(chemin);
    }
  }
}
