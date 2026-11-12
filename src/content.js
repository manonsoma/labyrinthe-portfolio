// ═════════════════════════════════════════════════════════════
//  TOUT LE TEXTE DU SITE EST ICI.
//  Pour modifier un texte : change ce qui est entre les guillemets,
//  enregistre le fichier, et la page se met à jour toute seule.
//  Attention à garder les guillemets « " » et les virgules en fin de ligne.
// ═════════════════════════════════════════════════════════════

export const content = {
  name: "Manon Soma",

  site: {
    title: "Manon Soma · Le Labyrinthe, portfolio interactif",
    description:
      "Le portfolio interactif de Manon Soma : un labyrinthe de marbre et d'or où six coffrets révèlent qui je suis, puis mon parcours complet.",
  },

  intro: {
    overline: "Portfolio interactif",
    title: "Le Labyrinthe",
    text: "Six coffrets sont cachés au fond des fausses pistes. Chacun renferme une question, et ma réponse. Un seul chemin mène à la grille d'or.",
    button: "Entrer dans le jeu",
    skipLink: "Pas le temps de jouer ? Voir directement mon parcours →",
    controls: "Flèches, ZQSD ou WASD pour avancer · clic sur une case alignée · glisser pour tourner la vue",
  },

  messages: {
    gateLocked: (found, total) =>
      `La grille d'or reste close. Encore ${total - found} coffret${total - found > 1 ? "s" : ""} à ouvrir.`,
    gateOpen: "La grille d'or s'ouvre. Le chemin est libre.",
    deadEnds: [
      "Une impasse… seul un vase de marbre garde ce recoin.",
      "Encore une fausse piste. Les coffrets se cachent plus loin.",
      "Rien ici, sinon le silence du marbre. Rebroussez chemin.",
    ],
    restartConfirm: "Recommencer depuis le début ? Les coffrets ouverts seront refermés.",
    resumed: "Partie reprise là où vous l'aviez laissée.",
  },

  // Les cartes se révèlent dans l'ordre I → VI, quel que soit le coffret ouvert.
  cards: [
    {
      numeral: "I",
      theme: "Passions",
      question: "Sur quoi puis-je passer des heures sans voir le temps passer ?",
      answers: [
        "Parler avec mes proches, analyser les situations et essayer de comprendre les comportements des autres.",
        "Faire du shopping, découvrir des marques, chercher des vêtements et trouver des pièces qui correspondent à mes goûts.",
      ],
      separator: "ou",
    },
    {
      numeral: "II",
      theme: "Ambitions",
      question: "Dans 5 ans, qu'est-ce que je veux avoir : argent, statut, pouvoir, temps, impact ?",
      answers: [
        "Je pense que l'argent vient avec le temps et la réussite, tandis que le statut est étroitement lié au pouvoir : plus on a un statut élevé, plus on acquiert de l'influence, des responsabilités et du pouvoir de décision.",
      ],
    },
    {
      numeral: "III",
      theme: "Expériences",
      tag: "New York",
      question: "Quel cours, job ou projet m'a vraiment plu, et pourquoi ?",
      answers: [
        "Mon expérience à New York m'a appris à être autonome, à m'adapter à un nouvel environnement et à rencontrer de nouvelles personnes.",
      ],
    },
    {
      numeral: "IV",
      theme: "Environnement",
      tag: "Grand groupe",
      question: "Quel cadre me donne de l'énergie : grand groupe, start-up, terrain, bureau ?",
      answers: [
        "J'aime être entourée, échanger avec différentes personnes et découvrir des personnalités et des façons de penser différentes. J'apprécie les environnements où il y a de la vie et où je peux facilement créer des liens.",
      ],
    },
    {
      numeral: "V",
      theme: "Talents",
      question: "Pourquoi les autres viennent-ils me demander de l'aide ?",
      answers: [
        "Pour avoir un avis honnête, même quand la vérité n'est pas forcément agréable à entendre.",
        "Pour les aider à prendre une décision.",
      ],
    },
    {
      numeral: "VI",
      theme: "Limites",
      question: "Qu'est-ce que je refuse, même bien payé ?",
      answers: ["Ne pas être respectée ou considérée.", "Devoir constamment me justifier pour être comprise."],
    },
  ],

  final: {
    overline: "La grille d'or est ouverte",
    title: "Portrait complet",
    summaryTitle: "Ce que révèlent les six coffrets",
    buttons: { notebook: "Revoir le carnet", replay: "Rejouer", play: "Jouer au labyrinthe" },
  },

  cv: {
    formation: {
      title: "Formation",
      items: [
        { what: "Eugenia School", where: "Paris", when: "Aujourd'hui", detail: "IA & data appliquées au business et au management" },
        { what: "École Internationale Bilingue", where: "Paris", when: "2024", detail: "Baccalauréat général" },
        { what: "Lycée français de New York", where: "New York", when: "2022 – 2024", detail: "Brevet" },
      ],
    },
    experiences: {
      title: "Expériences",
      items: [
        { what: "Circet Group", where: "Solliès-Pont", when: "Oct. 2025", detail: "Stage d'observation : RH, comptabilité, informatique, achats" },
        { what: "Caudalie", where: "New York", when: "Mai 2024", detail: "Stage d'observation : marketing, international, service client, communication" },
        { what: "DNA Learning Center", where: "New York", when: "Juin 2024", detail: "Summer camp : profilage médico-légal et analyse ADN" },
      ],
    },
    engagements: {
      title: "Engagements",
      items: [
        { what: "Club du BDE", where: "Eugenia School", when: "Aujourd'hui", detail: "" },
        { what: "Club Solidarité", where: "EIB", when: "2024 – 2026", detail: "Collecte d'objets, concert caritatif" },
        { what: "Mother's Day Run", where: "New York", when: "Mars 2023", detail: "Bénévole" },
      ],
    },
    skills: {
      title: "Compétences",
      list: ["Aisance relationnelle", "Curiosité", "Créativité", "Gestion du stress", "Adaptation", "Autonomie"],
    },
    languages: {
      title: "Langues",
      list: ["Français : langue maternelle", "Anglais : B2 (TOEFL & TOEIC)", "Espagnol : B2"],
    },
    certifications: {
      title: "Certifications",
      list: ["Pix", "Permis B", "Baptême de plongée", "Premiers secours (Croix-Rouge)"],
    },
    contact: {
      title: "Contact",
      email: "manon.soma08@gmail.com",
      phone: "06 46 60 20 80",
      phoneLink: "+33646602080",
      linkedin: "linkedin.com/in/manon-soma",
      city: "Paris",
    },
  },

  ui: {
    coffrets: "Coffrets",
    notebook: "Carnet",
    boardView: "Vue du plateau",
    followView: "Suivre le pion",
    sound: "Son",
    ambience: "Ambiance",
    quality: "Qualité",
    qualityLevels: { auto: "Auto", high: "Haute", medium: "Moyenne", low: "Basse" },
    restart: "Recommencer",
    close: "Fermer",
    continue: "Continuer",
    notebookTitle: "Le carnet",
    notebookSubtitle: "Les cartes révélées, dans l'ordre de leur découverte",
    sealed: "Carte scellée",
    loading: "Préparation du plateau",
  },
};
