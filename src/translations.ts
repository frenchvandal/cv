/**
 * Portfolio content, fully typed and available in seven languages.
 *
 * The English object `en` is the source of truth: its inferred type is
 * {@link Translation}, so every other translation must expose the exact same
 * shape—a missing or misnamed key is a compile-time error. This guarantees
 * parity across languages without hand-writing a large interface.
 *
 * Each translation is written for its own audience rather than converted from
 * a neighbour, and several are region-locked on purpose:
 *   - `zh` (Simplified) and `zh-hant` (Traditional) are independent, not script
 *     conversions of each other—vocabulary differs (软件/軟體, 业务分析师/
 *     商業分析師, 待办列表/待辦清單…). Both use Philippe's Chinese name, 李北洛.
 *     `zh-hant` follows Taiwan usage (軟體, 專案), matching the Noto Sans TC
 *     glyph forms that page ships; Hong Kong and Macau get `zh-hk`, which is a
 *     five-term projection of it (see HK_LEXICON at the bottom of this file)
 *     rendered in Noto Sans HK. `zh-hk` is built and indexed but deliberately
 *     absent from the switcher—see SWITCHER_LANGS.
 *   - `pt` is European Portuguese in the PRE-1990 orthography (see its own
 *     header), never Brazilian.
 *   - `es` is peninsular Spanish.
 */

export const LANGS = [
  "en",
  "fr",
  "pt",
  "es",
  "zh",
  "zh-hant",
  "zh-hk",
] as const;
export type Lang = (typeof LANGS)[number];

/**
 * The languages the switcher offers. `zh-hk` is built, indexed and reachable by
 * browser negotiation, but it is not a button: it is the same Traditional
 * Chinese page in Hong Kong / Macau vocabulary, and a reader who needs it is
 * already sent there by their own browser. A seventh button would also push a
 * bar that measures 382px at six past the width of a phone (see src/styles.css).
 */
export const SWITCHER_LANGS: readonly Lang[] = LANGS.filter(
  (lang) => lang !== "zh-hk",
);

/** Type guard for language values coming from the DOM or the URL (dataset, path). */
export function isLang(value: string | undefined): value is Lang {
  return value !== undefined && (LANGS as readonly string[]).includes(value);
}

/** BCP-47 tags used for the `<html lang>` attribute and `hreflang` links. */
export const HTML_LANG: Record<Lang, string> = {
  en: "en",
  fr: "fr",
  // Region-tagged: the copy is deliberately European, not Brazilian/American—
  // `pt` follows the pre-1990 orthography and `es` is peninsular Spanish.
  pt: "pt-PT",
  es: "es-ES",
  zh: "zh-Hans",
  "zh-hant": "zh-Hant",
  // Region rather than script: it is the same Traditional script as zh-Hant,
  // and the region is exactly what distinguishes it. Macau browsers (zh-MO)
  // are sent here too, by the negotiation script.
  "zh-hk": "zh-HK",
};

/**
 * Human-readable endonyms for the language switcher. `zh-hk` carries one for
 * completeness, but it is not in `SWITCHER_LANGS`, so it never renders.
 */
export const LANG_LABEL: Record<Lang, string> = {
  en: "EN",
  fr: "FR",
  pt: "PT",
  es: "ES",
  zh: "简",
  "zh-hant": "繁",
  "zh-hk": "繁",
};

/** Full language names (endonyms) for accessible labels on the switcher links. */
export const LANG_NAME: Record<Lang, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
  es: "Español",
  zh: "简体中文",
  "zh-hant": "繁體中文",
  "zh-hk": "繁體中文",
};

/** Language-invariant profile constants (proper nouns, contact, structured data). */
export const PROFILE = {
  fullName: "Philippe Ribeiro",
  chineseName: "李北洛",
  wechat: "frenchvandal",
  github: "frenchvandal",
  linkedin: "philipperibeiro",
  /** JSON-LD PostalAddress fields ([scripts/build.ts](scripts/build.ts)). */
  address: { locality: "Chengdu", country: "CN" },
  /** ISO 639-1 codes for the JSON-LD `knowsLanguage`. */
  knowsLanguage: ["fr", "pt", "en", "es", "zh"],
} as const;

/**
 * Public profiles, in one place because they are used twice: as links in the
 * contact section ([src/render.ts](src/render.ts)) and as the JSON-LD `sameAs`
 * array ([scripts/build.ts](scripts/build.ts)), which is how a search engine
 * ties this page to the same person elsewhere. Keep the two in sync by adding
 * here, never at a call site.
 */
export const PROFILE_URLS = {
  github: `https://github.com/${PROFILE.github}`,
  linkedin: `https://www.linkedin.com/in/${PROFILE.linkedin}/`,
} as const;

/** Every profile URL, for JSON-LD `sameAs`. */
export const SAME_AS: readonly string[] = Object.values(PROFILE_URLS);

const en = {
  name: {
    /** Display name for the page title and headings on this language's page. */
    display: "Philippe Ribeiro",
    /** Hero name, one entry per line. */
    lines: ["Philippe Ribeiro"],
  },
  meta: {
    description:
      "Philippe Ribeiro — Product Owner and Business Analyst with 20 years in financial-services software: insurance core systems, bancassurance, public finance. Based in Chengdu, China.",
  },
  nav: {
    about: "About",
    experience: "Experience",
    education: "Education",
    certifications: "Certifications",
    skills: "Skills",
    hobbies: "Hobbies",
    dialogue: "Questions",
    contact: "Contact",
  },
  hero: {
    greeting: "Hello, I'm",
    title: "Product Owner · Business Analyst — 20 years in financial software",
    location: "Chengdu, China · French national",
    ctaPrimary: "Get in Touch",
    ctaSecondary: "Learn More",
  },
  about: {
    p1:
      "Product Owner and Business Analyst with twenty years in financial-services software — insurance core systems, bancassurance, and public finance. I have worked on both sides of the software business: as an on-site consultant delivering projects for clients across industries, and as a product owner inside a vendor, steering a packaged product.",
    p2:
      "At KAPIA-RGI I own K4U, a customer-facing insurance web portal serving multiple client companies, end to end: product vision, roadmap, and backlog, prioritized across competing stakeholder demands. I led the cross-company rollout of single sign-on (SAML/OIDC), drive decisions from user feedback and advanced SQL analysis, and ship only tested, compliant increments — ISTQB-certified tester, PSPO-trained.",
    p3:
      "Living in Chengdu since 2025 after a year of full-time Mandarin study at Sichuan University — daily life runs in Mandarin (HSK 4, HSK 5 in preparation). Native French and Portuguese, fluent English, working Spanish.",
    stats: {
      years: "Years in software",
      languages: "Languages",
      defects: "% defect backlog cut",
      clients: "New clients signed",
    },
  },
  experience: {
    kapiaRgi: {
      date: "2019 – Present",
      company: "KAPIA-RGI",
      location: "Paris, France",
      sector: "Life-insurance core-systems software",
      title: "Web Product Owner",
    },
    open: {
      date: "2014 – 2019",
      company: "OPEN",
      location: "Paris, France",
      sector: "IT consulting",
      title: "IT Consultant",
    },
    kapiaSolutions: {
      date: "2011 – 2014",
      company: "KAPIA Solutions (now KAPIA-RGI)",
      location: "Paris, France",
      sector: "Life-insurance core-systems software",
      title: "Business Analyst",
    },
    adneom: {
      date: "2008 – 2011",
      company: "Adneom Technologies (now CBTW)",
      location: "Paris, France",
      sector: "IT consulting",
      title: "IT Consultant",
    },
    insurance: {
      date: "2004 – 2008",
      company: "Fidelidade, SwissLife & AXA",
      location: "Paris, France",
      sector: "Insurance",
      title: "Contract Administrator",
    },
  },
  education: {
    sichuan: {
      school: "Sichuan University",
      title: "Chinese Language Program",
      date: "2025 – 2026",
      subtitle: "Wangjiang Campus, Chengdu · Full-time immersion",
      items: [
        "One-year sabbatical from KAPIA-RGI to study Mandarin full-time; program completed in July 2026",
        "Final results: 3.88 / 4.0 GPA over 39 credits — Comprehensive Chinese 92.8/100, Listening & Speaking 93.9, Written Chinese 92.8, Computer & Internet Applications in Chinese 90.3",
        "Coursework, daily life, and interactions in Mandarin — an inside view of Chinese university life",
        "HSK 4 passed (2023); HSK 5 in preparation",
      ],
    },
    master: {
      school: "Université de Cergy-Pontoise",
      title: "Master's, Financial Instruments Management",
      date: "2004 – 2005",
      subtitle: "Now CY Cergy Paris Université",
      desc:
        "Financial engineering and instruments management — the quantitative grounding behind twenty years in financial software.",
    },
    edc: {
      school: "EDC Paris Business School",
      title: "Business Degree — Finance Major",
      date: "2000 – 2004",
      desc: "Business and management, specialising in finance.",
    },
  },
  certifications: {
    date: "2016 – 2024",
    items: [
      "Professional Scrum Product Owner (PSPO) — training 2024, certification in progress",
      "ISTQB Certified Tester — Foundation Level (2016)",
      "Project Management — Fundamentals & Relational Dimension (2018)",
      "HSK 4 (2023) · HSKK Spoken Chinese, Beginner (2022) · TOCFL Band A (2024)",
    ],
  },
  skills: {
    product: {
      title: "Product & Methodology",
      tags: [
        "Agile / Scrum",
        "Product roadmap & backlog",
        "Requirements engineering",
        "MVP scoping",
        "UAT",
        "Jira",
      ],
    },
    data: {
      title: "Databases & Languages",
      tags: [
        "SQL (advanced)",
        "PL/SQL (foundation)",
        "JavaScript / TypeScript (foundation)",
      ],
    },
    interfaces: {
      title: "Interfaces & Environments",
      tags: [
        "REST APIs",
        "SSO (SAML / OIDC)",
        "Postman",
        "DEV / QA / PROD stages",
      ],
    },
    domains: {
      title: "Domains",
      tags: [
        "Life-insurance core systems",
        "Bancassurance",
        "Digital journeys & SSO",
        "Public finance",
        "Full software lifecycle",
      ],
    },
    soft: {
      title: "Soft Skills",
      tags: [
        "Single point of contact",
        "Stakeholder facilitation",
        "Client demos",
        "Documentation",
        "Quality mindset",
        "Cross-cultural adaptability",
        "Autonomy",
      ],
    },
    languages: {
      title: "Languages",
      french: { name: "French", level: "Native" },
      portuguese: { name: "Portuguese", level: "Native" },
      english: { name: "English", level: "Fluent · professional" },
      spanish: { name: "Spanish", level: "Working proficiency" },
      mandarin: { name: "Mandarin", level: "HSK 4 · HSK 5 in prep." },
    },
  },
  hobbies: {
    running: {
      title: "Long-Distance Running",
      desc:
        "From 10 km road races to ultramarathons — including the Paris Marathon, twice.",
    },
    cycling: {
      title: "Cycling",
      desc: "Long rides around Chengdu and the Sichuan countryside.",
    },
    literature: {
      title: "French Literature",
      desc: "A passionate reader — I write book reviews in Chinese on Douban.",
    },
    cinema: {
      title: "Cinema",
      desc:
        "Wong Kar-wai, Melville, King Hu — film criticism in French is my most constant writing practice.",
    },
    language: {
      title: "Language Learning",
      desc:
        "Mandarin as daily life: classes, errands, and book reviews — HSK 5 next.",
    },
  },
  dialogue: {
    visitor: "Reader",
    width: "Container width",
    me: "Philippe",
    disclaimer:
      "The questions that actually come up, with the answers I actually give.",
    messages: [
      { me: false, text: "What is K4U?" },
      {
        me: true,
        text:
          "KAPIA-RGI's policyholder web portal. Several insurers, one product.",
      },
      { me: false, text: "What does a product owner actually decide?" },
      {
        me: true,
        text: "Three companies want the same sprint. One of them gets it.",
      },
      {
        me: false,
        text: "Twenty years in life insurance… isn't that a little dull?",
      },
      {
        me: true,
        text:
          "Death benefits, annuities, premium waivers — the suspense never stops.",
      },
      { me: false, text: "Why Chengdu?" },
      {
        me: true,
        text: "I came for the Mandarin. The hotpot convinced me to stay.",
      },
      { me: false, text: "How spicy can you go?" },
      { me: true, text: "微辣 — mild. I said adaptable, not reckless." },
      { me: false, text: "An ultramarathon? Seriously?" },
      {
        me: true,
        text:
          "It's like a major version upgrade: long, painful, and no business interruption.",
      },
      {
        me: false,
        text: "And how do I reach you? There isn't even an email…",
      },
      { me: true, text: "WeChat: frenchvandal. It's 2026." },
    ],
  },
  contact: {
    intro:
      "Twenty years in regulated financial software, now from Chengdu. Below: where to reach me, and where the rest of the work lives.",
    wechatLabel: "WeChat",
    githubLabel: "GitHub",
    linkedinLabel: "LinkedIn",
    locationLabel: "Location",
    footer: "© 2026 Philippe Ribeiro · Built with Bun & pretext",
  },
  ui: {
    skipLink: "Skip to content",
    intro: "Introduction",
    languageNav: "Language",
    sectionsNav: "Sections",
    copyWechat: "Copy WeChat ID",
    copied: "Copied",
    theme: {
      light: "Theme: light",
      dark: "Theme: dark",
    },
  },
};

/**
 * The canonical content type, inferred from the English source of truth.
 * `fr`, `zh` and `zhHant` are annotated with it, so any missing, extra or
 * misnamed key in a translation is a compile-time error.
 */
export type Translation = typeof en;

const fr: Translation = {
  name: {
    display: "Philippe Ribeiro",
    lines: ["Philippe Ribeiro"],
  },
  meta: {
    description:
      "Philippe Ribeiro — Product Owner et Business Analyst, 20 ans dans le logiciel pour services financiers : systèmes cœur d'assurance vie, bancassurance, finances publiques. Basé à Chengdu, Chine.",
  },
  nav: {
    about: "À propos",
    experience: "Expérience",
    education: "Formation",
    certifications: "Certifications",
    skills: "Compétences",
    hobbies: "Loisirs",
    dialogue: "Questions",
    contact: "Contact",
  },
  hero: {
    greeting: "Bonjour, je suis",
    title:
      "Product Owner · Business Analyst — 20 ans dans le logiciel financier",
    location: "Chengdu, Chine · Nationalité française",
    ctaPrimary: "Me contacter",
    ctaSecondary: "En savoir plus",
  },
  about: {
    p1:
      "Product Owner et Business Analyst, vingt ans dans le logiciel pour services financiers — systèmes cœur d'assurance vie, bancassurance et finances publiques. J'ai travaillé des deux côtés du métier : consultant en régie livrant des projets pour des clients de secteurs variés, puis responsable de produit chez un éditeur, aux commandes d'un progiciel.",
    p2:
      "Chez KAPIA-RGI, je porte K4U, un portail web d'assurance destiné aux clients finaux de plusieurs compagnies, de bout en bout : vision produit, feuille de route et backlog, priorisés entre des demandes concurrentes. J'ai piloté le déploiement transverse de l'authentification unique (SAML/OIDC), je fonde les décisions sur les retours utilisateurs et l'analyse SQL avancée, et je ne livre que des incréments testés et conformes — testeur certifié ISTQB, formé PSPO.",
    p3:
      "Installé à Chengdu depuis 2025 après une année de mandarin à temps plein à l'Université du Sichuan — le quotidien se vit en mandarin (HSK 4, HSK 5 en préparation). Français et portugais langues maternelles, anglais courant, espagnol professionnel.",
    stats: {
      years: "Ans dans le logiciel",
      languages: "Langues",
      defects: "% d'anomalies en moins",
      clients: "Nouveaux clients signés",
    },
  },
  experience: {
    kapiaRgi: {
      date: "2019 – aujourd'hui",
      company: "KAPIA-RGI",
      location: "Paris, France",
      sector: "Édition de logiciels d'assurance vie",
      title: "Web Product Owner",
    },
    open: {
      date: "2014 – 2019",
      company: "OPEN",
      location: "Paris, France",
      sector: "Conseil en informatique",
      title: "Consultant IT",
    },
    kapiaSolutions: {
      date: "2011 – 2014",
      company: "KAPIA Solutions (KAPIA-RGI)",
      location: "Paris, France",
      sector: "Édition de logiciels d'assurance vie",
      title: "Business Analyst",
    },
    adneom: {
      date: "2008 – 2011",
      company: "Adneom Technologies (CBTW)",
      location: "Paris, France",
      sector: "Conseil en informatique",
      title: "Consultant IT",
    },
    insurance: {
      date: "2004 – 2008",
      company: "Fidelidade, SwissLife & AXA",
      location: "Paris, France",
      sector: "Assurance",
      title: "Gestionnaire de contrats",
    },
  },
  education: {
    sichuan: {
      school: "Université du Sichuan",
      title: "Programme de langue chinoise",
      date: "2025 – 2026",
      subtitle: "Campus Wangjiang, Chengdu · Temps plein, en immersion",
      items: [
        "Année sabbatique de KAPIA-RGI pour étudier le mandarin à temps plein ; programme achevé en juillet 2026",
        "Résultats finaux : GPA de 3,88 / 4 sur 39 crédits — chinois intégré 92,8/100, compréhension et expression orales 93,9, expression écrite 92,8, informatique et Internet en chinois 90,3",
        "Cours, vie quotidienne et échanges en mandarin — une connaissance de l'intérieur de l'université chinoise",
        "HSK 4 obtenu (2023) ; HSK 5 en préparation",
      ],
    },
    master: {
      school: "Université de Cergy-Pontoise",
      title: "Master, Gestion des instruments financiers",
      date: "2004 – 2005",
      subtitle: "Aujourd'hui CY Cergy Paris Université",
      desc:
        "Ingénierie financière et gestion d'instruments — le socle quantitatif de vingt ans dans le logiciel financier.",
    },
    edc: {
      school: "EDC Paris Business School",
      title: "Diplôme d'école de commerce — Majeure Finance",
      date: "2000 – 2004",
      desc: "Commerce et gestion, avec une spécialisation en finance.",
    },
  },
  certifications: {
    date: "2016 – 2024",
    items: [
      "Professional Scrum Product Owner (PSPO) — formation 2024, certification en cours",
      "ISTQB — Testeur certifié, niveau fondation (2016)",
      "Gestion de projet — Fondamentaux & dimension relationnelle (2018)",
      "HSK 4 (2023) · HSKK chinois oral, débutant (2022) · TOCFL niveau A (2024)",
    ],
  },
  skills: {
    product: {
      title: "Produit & Méthodologie",
      tags: [
        "Agile / Scrum",
        "Feuille de route & backlog",
        "Ingénierie des besoins",
        "Cadrage MVP",
        "Recette (UAT)",
        "Jira",
      ],
    },
    data: {
      title: "Bases de données & Langages",
      tags: [
        "SQL (avancé)",
        "PL/SQL (notions)",
        "JavaScript / TypeScript (notions)",
      ],
    },
    interfaces: {
      title: "Interfaces & Environnements",
      tags: [
        "API REST",
        "SSO (SAML / OIDC)",
        "Postman",
        "Environnements DEV / QA / PROD",
      ],
    },
    domains: {
      title: "Domaines",
      tags: [
        "Systèmes cœur d'assurance vie",
        "Bancassurance",
        "Parcours numériques & SSO",
        "Finances publiques",
        "Cycle de vie logiciel complet",
      ],
    },
    soft: {
      title: "Savoir-être",
      tags: [
        "Interlocuteur unique",
        "Facilitation multi-acteurs",
        "Démonstrations clients",
        "Documentation",
        "Culture qualité",
        "Adaptabilité interculturelle",
        "Autonomie",
      ],
    },
    languages: {
      title: "Langues",
      french: { name: "Français", level: "Langue maternelle" },
      portuguese: { name: "Portugais", level: "Langue maternelle" },
      english: { name: "Anglais", level: "Courant · professionnel" },
      spanish: { name: "Espagnol", level: "Professionnel" },
      mandarin: { name: "Mandarin", level: "HSK 4 · HSK 5 en prép." },
    },
  },
  hobbies: {
    running: {
      title: "Course de fond",
      desc: "Du 10 km à l'ultramarathon — dont deux marathons de Paris.",
    },
    cycling: {
      title: "Cyclisme",
      desc: "Longues sorties autour de Chengdu et dans la campagne du Sichuan.",
    },
    literature: {
      title: "Littérature française",
      desc:
        "Lecteur passionné — je publie des critiques de romans en chinois sur Douban.",
    },
    cinema: {
      title: "Cinéma",
      desc:
        "Wong Kar-wai, Melville, King Hu — la critique de films en français est mon exercice d'écriture le plus constant.",
    },
    language: {
      title: "Apprentissage des langues",
      desc:
        "Le mandarin au quotidien : cours, démarches et critiques littéraires — cap sur le HSK 5.",
    },
  },
  dialogue: {
    visitor: "Lecteur",
    width: "Largeur du conteneur",
    me: "Philippe",
    disclaimer:
      "Les questions qui reviennent vraiment, avec les réponses que je donne vraiment.",
    messages: [
      { me: false, text: "K4U, c'est quoi ?" },
      {
        me: true,
        text:
          "Le portail assuré de KAPIA-RGI. Plusieurs compagnies clientes, un seul produit.",
      },
      { me: false, text: "Un Product Owner, ça arbitre quoi au juste ?" },
      {
        me: true,
        text: "Trois compagnies veulent le même sprint. Une seule l'aura.",
      },
      {
        me: false,
        text: "Vingt ans dans l'assurance vie… ce n'est pas un peu monotone ?",
      },
      {
        me: true,
        text:
          "Capital décès, rentes, exonération des primes — le suspense est permanent.",
      },
      { me: false, text: "Pourquoi Chengdu ?" },
      {
        me: true,
        text:
          "Je suis venu pour le mandarin. Le hotpot m'a convaincu de prolonger.",
      },
      { me: false, text: "Votre niveau de piment ?" },
      { me: true, text: "微辣 — doux. J'ai dit adaptable, pas téméraire." },
      { me: false, text: "Un ultramarathon, sérieusement ?" },
      {
        me: true,
        text:
          "C'est comme une montée de version majeure : long, douloureux, sans interruption d'activité.",
      },
      {
        me: false,
        text: "Et je vous contacte comment ? Il n'y a même pas d'e-mail…",
      },
      { me: true, text: "WeChat : frenchvandal. On est en 2026." },
    ],
  },
  contact: {
    intro:
      "Vingt ans dans le logiciel financier réglementé, aujourd'hui depuis Chengdu. Ci-dessous : où me joindre, et où vit le reste du travail.",
    wechatLabel: "WeChat",
    githubLabel: "GitHub",
    linkedinLabel: "LinkedIn",
    locationLabel: "Localisation",
    footer: "© 2026 Philippe Ribeiro · Construit avec Bun & pretext",
  },
  ui: {
    skipLink: "Aller au contenu",
    intro: "Introduction",
    languageNav: "Langue",
    sectionsNav: "Sections",
    copyWechat: "Copier l'ID WeChat",
    copied: "Copié",
    theme: {
      light: "Thème : clair",
      dark: "Thème : sombre",
    },
  },
};

/*
 * European Portuguese in the PRE-1990 orthography (pré-Acordo Ortográfico), on
 * purpose: the silent consonants the reform dropped are kept—"projecto" not
 * "projeto", "objectivo" not "objetivo", "sector" not "setor", "actual" not
 * "atual", "acção" not "ação"—and month names stay capitalised ("Julho").
 * Consonants that ARE pronounced in Portugal never fell under the reform, so
 * "contacto", "facto" and "secção" are spelled the same either way and are not
 * evidence of one norm or the other.
 *
 * Portugal, not Brazil, throughout: "utilizador" (not usuário), "ficheiro"
 * (not arquivo), "equipa" (not equipe), "a tempo inteiro" (not em tempo
 * integral), "prémio" (not prêmio), and the "estar a fazer" progressive.
 */
const pt: Translation = {
  name: {
    display: "Philippe Ribeiro",
    lines: ["Philippe Ribeiro"],
  },
  meta: {
    description:
      "Philippe Ribeiro — Product Owner e Analista de Negócio, 20 anos em software para serviços financeiros: sistemas centrais de seguros de vida, bancassurance, finanças públicas. Radicado em Chengdu, China.",
  },
  nav: {
    about: "Sobre",
    experience: "Experiência",
    education: "Formação",
    certifications: "Certificações",
    skills: "Competências",
    hobbies: "Interesses",
    dialogue: "Perguntas",
    contact: "Contacto",
  },
  hero: {
    greeting: "Olá, sou o",
    title:
      "Product Owner · Analista de Negócio — 20 anos em software financeiro",
    location: "Chengdu, China · Nacionalidade francesa",
    ctaPrimary: "Entrar em contacto",
    ctaSecondary: "Saber mais",
  },
  about: {
    p1:
      "Product Owner e Analista de Negócio, com vinte anos em software para serviços financeiros — sistemas centrais de seguros de vida, bancassurance e finanças públicas. Trabalhei dos dois lados do sector: como consultor destacado em cliente, a entregar projectos em indústrias muito diferentes, e como responsável de produto numa empresa de software, a conduzir a evolução de um produto standard.",
    p2:
      "Na KAPIA-RGI sou responsável pelo K4U, um portal web de seguros destinado aos clientes finais de várias companhias, de ponta a ponta: visão de produto, roadmap e backlog, priorizados entre pedidos concorrentes. Conduzi a adopção transversal da autenticação única (SAML/OIDC), fundamento as decisões no feedback dos utilizadores e em análise SQL avançada, e só entrego incrementos testados e conformes — testador certificado ISTQB, com formação PSPO.",
    p3:
      "Radicado em Chengdu desde 2025, após um ano de mandarim a tempo inteiro na Universidade de Sichuan — o quotidiano faz-se em mandarim (HSK 4, HSK 5 em preparação). Francês e português maternos, inglês fluente, espanhol profissional.",
    stats: {
      years: "Anos em software",
      languages: "Idiomas",
      defects: "% de anomalias reduzidas",
      clients: "Novos clientes angariados",
    },
  },
  experience: {
    kapiaRgi: {
      date: "2019 – actualidade",
      company: "KAPIA-RGI",
      location: "Paris, França",
      sector: "Software de sistemas centrais de seguros de vida",
      title: "Web Product Owner",
    },
    open: {
      date: "2014 – 2019",
      company: "OPEN",
      location: "Paris, França",
      sector: "Consultoria informática",
      title: "Consultor de TI",
    },
    kapiaSolutions: {
      date: "2011 – 2014",
      company: "KAPIA Solutions (KAPIA-RGI)",
      location: "Paris, França",
      sector: "Software de sistemas centrais de seguros de vida",
      title: "Analista de Negócio",
    },
    adneom: {
      date: "2008 – 2011",
      company: "Adneom Technologies (CBTW)",
      location: "Paris, França",
      sector: "Consultoria informática",
      title: "Consultor de TI",
    },
    insurance: {
      date: "2004 – 2008",
      company: "Fidelidade, SwissLife & AXA",
      location: "Paris, França",
      sector: "Seguros",
      title: "Gestor de Contratos",
    },
  },
  education: {
    sichuan: {
      school: "Universidade de Sichuan",
      title: "Programa de Língua Chinesa",
      date: "2025 – 2026",
      subtitle: "Campus de Wangjiang, Chengdu · Imersão a tempo inteiro",
      items: [
        "Ano sabático da KAPIA-RGI para estudar mandarim a tempo inteiro; programa concluído em Julho de 2026",
        "Resultados finais: média de 3,88 / 4,0 em 39 créditos — Chinês Integrado 92,8/100, Compreensão e Expressão Oral 93,9, Escrita 92,8, Informática e Internet em Chinês 90,3",
        "Aulas, quotidiano e convívio em mandarim — uma visão de dentro da vida universitária chinesa",
        "HSK 4 concluído (2023); HSK 5 em preparação",
      ],
    },
    master: {
      school: "Université de Cergy-Pontoise",
      title: "Mestrado em Gestão de Instrumentos Financeiros",
      date: "2004 – 2005",
      subtitle: "Actualmente CY Cergy Paris Université",
      desc:
        "Engenharia financeira e gestão de instrumentos — a base quantitativa por trás de vinte anos em software financeiro.",
    },
    edc: {
      school: "EDC Paris Business School",
      title: "Licenciatura em Gestão — especialização em Finanças",
      date: "2000 – 2004",
      desc:
        "Formação em gestão e administração, com especialização em finanças.",
    },
  },
  certifications: {
    date: "2016 – 2024",
    items: [
      "Professional Scrum Product Owner (PSPO) — formação em 2024, certificação em curso",
      "ISTQB Certified Tester — Foundation Level (2016)",
      "Gestão de Projectos — fundamentos e dimensão relacional (2018)",
      "HSK 4 (2023) · HSKK oral, nível inicial (2022) · TOCFL nível A (2024)",
    ],
  },
  skills: {
    product: {
      title: "Produto e Metodologia",
      tags: [
        "Agile / Scrum",
        "Roadmap e backlog de produto",
        "Engenharia de requisitos",
        "Definição de MVP",
        "Testes de aceitação (UAT)",
        "Jira",
      ],
    },
    data: {
      title: "Bases de Dados e Linguagens",
      tags: [
        "SQL (avançado)",
        "PL/SQL (base)",
        "JavaScript / TypeScript (base)",
      ],
    },
    interfaces: {
      title: "Interfaces e Ambientes",
      tags: [
        "APIs REST",
        "Autenticação única (SAML / OIDC)",
        "Postman",
        "Ambientes DEV / QA / PROD",
      ],
    },
    domains: {
      title: "Domínios",
      tags: [
        "Sistemas centrais de seguros de vida",
        "Bancassurance",
        "Percursos digitais e SSO",
        "Finanças públicas",
        "Ciclo de vida completo do software",
      ],
    },
    soft: {
      title: "Competências Transversais",
      tags: [
        "Ponto de contacto único",
        "Facilitação entre intervenientes",
        "Demonstrações a clientes",
        "Documentação",
        "Cultura de qualidade",
        "Adaptabilidade intercultural",
        "Autonomia",
      ],
    },
    languages: {
      title: "Idiomas",
      french: { name: "Francês", level: "Materno" },
      portuguese: { name: "Português", level: "Materno" },
      english: { name: "Inglês", level: "Fluente · profissional" },
      spanish: { name: "Espanhol", level: "Nível profissional" },
      mandarin: { name: "Mandarim", level: "HSK 4 · HSK 5 em preparação" },
    },
  },
  hobbies: {
    running: {
      title: "Corrida de Fundo",
      desc:
        "De provas de 10 km a ultramaratonas — incluindo a Maratona de Paris, por duas vezes.",
    },
    cycling: {
      title: "Ciclismo",
      desc: "Longas saídas por Chengdu e pelos campos do Sichuan.",
    },
    literature: {
      title: "Literatura Francesa",
      desc: "Leitor assíduo — escrevo recensões de livros em chinês no Douban.",
    },
    cinema: {
      title: "Cinema",
      desc:
        "Wong Kar-wai, Melville, King Hu — a crítica de cinema em francês é a minha prática de escrita mais constante.",
    },
    language: {
      title: "Aprendizagem de Línguas",
      desc:
        "O mandarim como quotidiano: aulas, recados e recensões — a seguir, HSK 5.",
    },
  },
  dialogue: {
    visitor: "Leitor",
    width: "Largura do contentor",
    me: "Philippe",
    disclaimer:
      "As perguntas que surgem sempre, com as respostas que dou sempre.",
    messages: [
      { me: false, text: "O que é o K4U?" },
      {
        me: true,
        text:
          "O portal do segurado da KAPIA-RGI. Várias companhias clientes, um só produto.",
      },
      { me: false, text: "Um Product Owner decide o quê, ao certo?" },
      {
        me: true,
        text: "Três companhias querem o mesmo sprint. Só uma o terá.",
      },
      {
        me: false,
        text: "Vinte anos em seguros de vida… não é um pouco monótono?",
      },
      {
        me: true,
        text:
          "Capital por morte, rendas, isenção de prémios — o suspense é permanente.",
      },
      { me: false, text: "Porquê Chengdu?" },
      {
        me: true,
        text: "Vim pelo mandarim. Foi o hotpot que me convenceu a ficar.",
      },
      { me: false, text: "Que nível de picante aguenta?" },
      { me: true, text: "微辣 — suave. Eu disse adaptável, não temerário." },
      { me: false, text: "Uma ultramaratona? A sério?" },
      {
        me: true,
        text:
          "É como uma actualização de versão maior: longa, dolorosa e sem interrupção do serviço.",
      },
      {
        me: false,
        text: "E contacto-o como? Nem sequer há um e-mail…",
      },
      { me: true, text: "WeChat: frenchvandal. Estamos em 2026." },
    ],
  },
  contact: {
    intro:
      "Vinte anos em software financeiro regulado, hoje a partir de Chengdu. Abaixo: onde me contactar e onde vive o resto do trabalho.",
    wechatLabel: "WeChat",
    githubLabel: "GitHub",
    linkedinLabel: "LinkedIn",
    locationLabel: "Localização",
    footer: "© 2026 Philippe Ribeiro · Feito com Bun e pretext",
  },
  ui: {
    skipLink: "Saltar para o conteúdo",
    intro: "Introdução",
    languageNav: "Idioma",
    sectionsNav: "Secções",
    copyWechat: "Copiar ID WeChat",
    copied: "Copiado",
    theme: {
      light: "Tema: claro",
      dark: "Tema: escuro",
    },
  },
};

/*
 * Peninsular Spanish (Spain), not Latin American: "ordenador" over
 * "computadora" where it comes up, peninsular business register, and the
 * opening ¿/¡ the dialogue needs. Chengdú carries its accent, which is the
 * form Spanish style guides settle on for the city.
 */
const es: Translation = {
  name: {
    display: "Philippe Ribeiro",
    lines: ["Philippe Ribeiro"],
  },
  meta: {
    description:
      "Philippe Ribeiro — Product Owner y Analista de Negocio con 20 años en software para servicios financieros: sistemas centrales de seguros de vida, banca-seguros y finanzas públicas. Residente en Chengdú, China.",
  },
  nav: {
    about: "Sobre mí",
    experience: "Experiencia",
    education: "Formación",
    certifications: "Certificaciones",
    skills: "Competencias",
    hobbies: "Intereses",
    dialogue: "Preguntas",
    contact: "Contacto",
  },
  hero: {
    greeting: "Hola, soy",
    title:
      "Product Owner · Analista de Negocio — 20 años en software financiero",
    location: "Chengdú, China · Nacionalidad francesa",
    ctaPrimary: "Contactar",
    ctaSecondary: "Saber más",
  },
  about: {
    p1:
      "Product Owner y Analista de Negocio con veinte años en software para servicios financieros: sistemas centrales de seguros de vida, banca-seguros y finanzas públicas. He trabajado en los dos lados del sector, como consultor desplazado en cliente entregando proyectos en industrias muy distintas y como responsable de producto en una empresa de software, dirigiendo la evolución de un producto estándar.",
    p2:
      "En KAPIA-RGI soy responsable de K4U, un portal web de seguros dirigido a los clientes finales de varias compañías, de principio a fin: visión de producto, hoja de ruta y backlog, priorizados entre peticiones que compiten entre sí. Dirigí la adopción transversal del inicio de sesión único (SAML/OIDC), fundamento las decisiones en los comentarios de los usuarios y en análisis SQL avanzado, y solo entrego incrementos probados y conformes: tester certificado ISTQB y formado en PSPO.",
    p3:
      "Residente en Chengdú desde 2025, tras un año de mandarín a tiempo completo en la Universidad de Sichuan: el día a día transcurre en mandarín (HSK 4, HSK 5 en preparación). Francés y portugués maternos, inglés fluido y español profesional.",
    stats: {
      years: "Años en software",
      languages: "Idiomas",
      defects: "% de incidencias reducidas",
      clients: "Nuevos clientes firmados",
    },
  },
  experience: {
    kapiaRgi: {
      date: "2019 – actualidad",
      company: "KAPIA-RGI",
      location: "París, Francia",
      sector: "Software de sistemas centrales de seguros de vida",
      title: "Web Product Owner",
    },
    open: {
      date: "2014 – 2019",
      company: "OPEN",
      location: "París, Francia",
      sector: "Consultoría informática",
      title: "Consultor TI",
    },
    kapiaSolutions: {
      date: "2011 – 2014",
      company: "KAPIA Solutions (KAPIA-RGI)",
      location: "París, Francia",
      sector: "Software de sistemas centrales de seguros de vida",
      title: "Analista de Negocio",
    },
    adneom: {
      date: "2008 – 2011",
      company: "Adneom Technologies (CBTW)",
      location: "París, Francia",
      sector: "Consultoría informática",
      title: "Consultor TI",
    },
    insurance: {
      date: "2004 – 2008",
      company: "Fidelidade, SwissLife & AXA",
      location: "París, Francia",
      sector: "Seguros",
      title: "Gestor de Contratos",
    },
  },
  education: {
    sichuan: {
      school: "Universidad de Sichuan",
      title: "Programa de Lengua China",
      date: "2025 – 2026",
      subtitle: "Campus de Wangjiang, Chengdú · Inmersión a tiempo completo",
      items: [
        "Año sabático en KAPIA-RGI para estudiar mandarín a tiempo completo; programa finalizado en julio de 2026",
        "Resultados finales: nota media de 3,88 / 4,0 en 39 créditos — Chino Integrado 92,8/100, Comprensión y Expresión Oral 93,9, Escritura 92,8, Informática e Internet en Chino 90,3",
        "Clases, vida diaria y trato en mandarín: una visión desde dentro de la universidad china",
        "HSK 4 superado (2023); HSK 5 en preparación",
      ],
    },
    master: {
      school: "Université de Cergy-Pontoise",
      title: "Máster en Gestión de Instrumentos Financieros",
      date: "2004 – 2005",
      subtitle: "Hoy CY Cergy Paris Université",
      desc:
        "Ingeniería financiera y gestión de instrumentos: la base cuantitativa de veinte años en software financiero.",
    },
    edc: {
      school: "EDC Paris Business School",
      title: "Grado en Empresariales — especialidad en Finanzas",
      date: "2000 – 2004",
      desc: "Formación en empresa y gestión, con especialidad en finanzas.",
    },
  },
  certifications: {
    date: "2016 – 2024",
    items: [
      "Professional Scrum Product Owner (PSPO) — formación en 2024, certificación en curso",
      "ISTQB Certified Tester — nivel Foundation (2016)",
      "Gestión de proyectos — fundamentos y dimensión relacional (2018)",
      "HSK 4 (2023) · HSKK oral, nivel inicial (2022) · TOCFL nivel A (2024)",
    ],
  },
  skills: {
    product: {
      title: "Producto y Metodología",
      tags: [
        "Agile / Scrum",
        "Hoja de ruta y backlog de producto",
        "Ingeniería de requisitos",
        "Definición de MVP",
        "Pruebas de aceptación (UAT)",
        "Jira",
      ],
    },
    data: {
      title: "Bases de Datos y Lenguajes",
      tags: [
        "SQL (avanzado)",
        "PL/SQL (nivel básico)",
        "JavaScript / TypeScript (nivel básico)",
      ],
    },
    interfaces: {
      title: "Interfaces y Entornos",
      tags: [
        "API REST",
        "Inicio de sesión único (SAML / OIDC)",
        "Postman",
        "Entornos DEV / QA / PROD",
      ],
    },
    domains: {
      title: "Dominios",
      tags: [
        "Sistemas centrales de seguros de vida",
        "Banca-seguros",
        "Recorridos digitales y SSO",
        "Finanzas públicas",
        "Ciclo de vida completo del software",
      ],
    },
    soft: {
      title: "Competencias Transversales",
      tags: [
        "Punto de contacto único",
        "Facilitación entre partes interesadas",
        "Demostraciones a clientes",
        "Documentación",
        "Cultura de calidad",
        "Adaptabilidad intercultural",
        "Autonomía",
      ],
    },
    languages: {
      title: "Idiomas",
      french: { name: "Francés", level: "Materno" },
      portuguese: { name: "Portugués", level: "Materno" },
      english: { name: "Inglés", level: "Fluido · profesional" },
      spanish: { name: "Español", level: "Nivel profesional" },
      mandarin: { name: "Mandarín", level: "HSK 4 · HSK 5 en preparación" },
    },
  },
  hobbies: {
    running: {
      title: "Carreras de Fondo",
      desc:
        "Desde carreras de 10 km hasta ultramaratones, incluida la Maratón de París, dos veces.",
    },
    cycling: {
      title: "Ciclismo",
      desc: "Salidas largas por Chengdú y el campo de Sichuan.",
    },
    literature: {
      title: "Literatura Francesa",
      desc: "Lector empedernido: escribo reseñas de libros en chino en Douban.",
    },
    cinema: {
      title: "Cine",
      desc:
        "Wong Kar-wai, Melville, King Hu: la crítica de cine en francés es mi práctica de escritura más constante.",
    },
    language: {
      title: "Aprendizaje de Idiomas",
      desc:
        "El mandarín como vida diaria: clases, recados y reseñas. El siguiente paso, HSK 5.",
    },
  },
  dialogue: {
    visitor: "Lector",
    width: "Anchura del contenedor",
    me: "Philippe",
    disclaimer:
      "Las preguntas que salen siempre, con las respuestas que doy siempre.",
    messages: [
      { me: false, text: "¿Qué es K4U?" },
      {
        me: true,
        text:
          "El portal del asegurado de KAPIA-RGI. Varias compañías clientes, un solo producto.",
      },
      { me: false, text: "¿Qué decide exactamente un Product Owner?" },
      {
        me: true,
        text: "Tres compañías quieren el mismo sprint. Solo una lo tendrá.",
      },
      {
        me: false,
        text: "Veinte años en seguros de vida… ¿no resulta un poco monótono?",
      },
      {
        me: true,
        text:
          "Capital por fallecimiento, rentas, exención de primas: el suspense no decae.",
      },
      { me: false, text: "¿Por qué Chengdú?" },
      {
        me: true,
        text: "Vine por el mandarín. El hotpot me convenció para quedarme.",
      },
      { me: false, text: "¿Cuánto picante aguanta?" },
      { me: true, text: "微辣 — suave. Dije adaptable, no temerario." },
      { me: false, text: "¿Una ultramaratón? ¿En serio?" },
      {
        me: true,
        text:
          "Es como una actualización de versión mayor: larga, dolorosa y sin interrupción del servicio.",
      },
      {
        me: false,
        text: "¿Y cómo le contacto? Si no hay ni un correo…",
      },
      { me: true, text: "WeChat: frenchvandal. Estamos en 2026." },
    ],
  },
  contact: {
    intro:
      "Veinte años en software financiero regulado, hoy desde Chengdú. Abajo: dónde localizarme y dónde vive el resto del trabajo.",
    wechatLabel: "WeChat",
    githubLabel: "GitHub",
    linkedinLabel: "LinkedIn",
    locationLabel: "Ubicación",
    footer: "© 2026 Philippe Ribeiro · Creado con Bun y pretext",
  },
  ui: {
    skipLink: "Ir al contenido",
    intro: "Introducción",
    languageNav: "Idioma",
    sectionsNav: "Secciones",
    copyWechat: "Copiar ID de WeChat",
    copied: "Copiado",
    theme: {
      light: "Tema: claro",
      dark: "Tema: oscuro",
    },
  },
};

const zh: Translation = {
  name: {
    display: "李北洛 Philippe Ribeiro",
    lines: ["李北洛"],
  },
  meta: {
    description:
      "李北洛（Philippe Ribeiro）— 产品负责人 / 业务分析师，二十年金融软件经验：人寿保险核心系统、银行保险、公共财政。现居中国成都。",
  },
  nav: {
    about: "关于我",
    experience: "经历",
    education: "教育",
    certifications: "认证",
    skills: "技能",
    hobbies: "爱好",
    dialogue: "常见问题",
    contact: "联系",
  },
  hero: {
    greeting: "你好，我是",
    title: "产品负责人 · 业务分析师 — 二十年金融软件经验",
    location: "中国成都 · 法国籍",
    ctaPrimary: "联系我",
    ctaSecondary: "了解更多",
  },
  about: {
    p1:
      "产品负责人兼业务分析师，二十年金融服务软件经验——人寿保险核心系统、银行保险与公共财政。我在软件行业的两端都工作过：先是驻场顾问，为多个行业的客户交付项目；后加入软件厂商，主导标准化产品的演进。",
    p2:
      "在 KAPIA-RGI，我全面负责 K4U——一个服务多家保险公司终端客户的网页门户：产品愿景、路线图与待办列表，在相互竞争的需求之间做优先级取舍。我主导了单点登录（SAML/OIDC）的跨公司部署，依托用户反馈与高级 SQL 分析驱动决策，只交付经过测试、符合监管要求的增量——持有 ISTQB 测试认证，受过 PSPO 培训。",
    p3:
      "2025 年起定居成都，在四川大学完成一年全日制中文学习——日常生活以中文进行（已通过 HSK 4，正备考 HSK 5）。法语、葡萄牙语为母语，英语流利，西班牙语可作工作语言。",
    stats: {
      years: "年软件经验",
      languages: "门语言",
      defects: "% 缺陷积压削减",
      clients: "位新客户签约",
    },
  },
  experience: {
    kapiaRgi: {
      date: "2019年 – 至今",
      company: "KAPIA-RGI",
      location: "法国巴黎",
      sector: "人寿保险核心系统软件",
      title: "网页产品负责人",
    },
    open: {
      date: "2014年 – 2019年",
      company: "OPEN",
      location: "法国巴黎",
      sector: "IT 咨询",
      title: "IT 顾问",
    },
    kapiaSolutions: {
      date: "2011年 – 2014年",
      company: "KAPIA Solutions (KAPIA-RGI)",
      location: "法国巴黎",
      sector: "人寿保险核心系统软件",
      title: "业务分析师",
    },
    adneom: {
      date: "2008年 – 2011年",
      company: "Adneom Technologies (CBTW)",
      location: "法国巴黎",
      sector: "IT 咨询",
      title: "IT 顾问",
    },
    insurance: {
      date: "2004年 – 2008年",
      company: "Fidelidade、SwissLife 与 AXA",
      location: "法国巴黎",
      sector: "保险",
      title: "合同管理专员",
    },
  },
  education: {
    sichuan: {
      school: "四川大学",
      title: "汉语进修项目",
      date: "2025年 – 2026年",
      subtitle: "成都望江校区 · 全日制沉浸式学习",
      items: [
        "从 KAPIA-RGI 停薪留职一年，全日制学习中文；项目于 2026 年 7 月结业",
        "结业成绩：GPA 3.88 / 4，共 39 学分——中级综合汉语 92.8、汉语听力口语 93.9、汉语写作基础 92.8、中文电脑与网络应用 90.3",
        "课程、日常生活与交流全程使用中文——对中国大学生活有切身了解",
        "已通过 HSK 4（2023），正备考 HSK 5",
      ],
    },
    master: {
      school: "塞尔吉-蓬图瓦兹大学",
      title: "金融工具管理硕士",
      date: "2004年 – 2005年",
      subtitle: "现 CY 塞尔吉巴黎大学",
      desc: "金融工程与金融工具管理——二十年金融软件生涯的量化根基。",
    },
    edc: {
      school: "EDC 巴黎商学院",
      title: "商科学位——金融方向",
      date: "2000年 – 2004年",
      desc: "商业与管理教育，主修金融。",
    },
  },
  certifications: {
    date: "2016年 – 2024年",
    items: [
      "Professional Scrum Product Owner（PSPO）——2024 年培训，认证进行中",
      "ISTQB 认证测试工程师——基础级（2016）",
      "项目管理——基础与人际维度（2018）",
      "HSK 4（2023）· HSKK 初级口语（2022）· TOCFL A 级（2024）",
    ],
  },
  skills: {
    product: {
      title: "产品与方法论",
      tags: [
        "敏捷 / Scrum",
        "产品路线图与待办列表",
        "需求工程",
        "MVP 范围界定",
        "验收测试（UAT）",
        "Jira",
      ],
    },
    data: {
      title: "数据库与编程语言",
      tags: [
        "SQL（高级）",
        "PL/SQL（入门）",
        "JavaScript / TypeScript（入门）",
      ],
    },
    interfaces: {
      title: "接口与环境",
      tags: [
        "REST API",
        "单点登录（SAML / OIDC）",
        "Postman",
        "DEV / QA / PROD 多环境",
      ],
    },
    domains: {
      title: "业务领域",
      tags: [
        "人寿保险核心系统",
        "银行保险",
        "数字化旅程与 SSO",
        "公共财政",
        "完整软件生命周期",
      ],
    },
    soft: {
      title: "软技能",
      tags: [
        "唯一接口人",
        "多方协调",
        "客户演示",
        "文档编写",
        "质量意识",
        "跨文化适应",
        "自主工作",
      ],
    },
    languages: {
      title: "语言",
      french: { name: "法语", level: "母语" },
      portuguese: { name: "葡萄牙语", level: "母语" },
      english: { name: "英语", level: "流利 · 工作语言" },
      spanish: { name: "西班牙语", level: "工作语言" },
      mandarin: { name: "中文", level: "HSK 4 · 备考 HSK 5" },
    },
  },
  hobbies: {
    running: {
      title: "长跑",
      desc: "从 10 公里路跑到超级马拉松——包括两次巴黎马拉松。",
    },
    cycling: {
      title: "骑行",
      desc: "环成都及川西乡野的长途骑行。",
    },
    literature: {
      title: "法国文学",
      desc: "热忱的读者——在豆瓣上用中文撰写书评。",
    },
    cinema: {
      title: "电影",
      desc: "王家卫、梅尔维尔、胡金铨——用法语写影评是我最持久的写作练习。",
    },
    language: {
      title: "语言学习",
      desc: "中文即日常：上课、办事、写书评——目标 HSK 5。",
    },
  },
  dialogue: {
    visitor: "读者",
    width: "容器宽度",
    me: "李北洛",
    disclaimer: "常被问到的问题，以及我一贯的回答。",
    messages: [
      { me: false, text: "K4U 是什么？" },
      {
        me: true,
        text: "KAPIA-RGI 的保险网页门户。多家保险公司客户，同一套产品。",
      },
      { me: false, text: "产品负责人到底决定什么？" },
      {
        me: true,
        text: "三家公司想要同一个迭代，只有一家能拿到。",
      },
      { me: false, text: "做了二十年寿险软件……不会很枯燥吗？" },
      {
        me: true,
        text: "身故保险金、年金、保费豁免——悬念从未停止。",
      },
      { me: false, text: "为什么选成都？" },
      {
        me: true,
        text: "本来是来学中文的，结果被火锅说服留下了。",
      },
      { me: false, text: "能吃多辣？" },
      { me: true, text: "微辣。我说的是适应力强，不是不要命。" },
      { me: false, text: "超级马拉松？认真的吗？" },
      {
        me: true,
        text: "就像一次重大版本升级：漫长、痛苦，但业务零中断。",
      },
      { me: false, text: "那怎么联系你？连邮箱都没有……" },
      { me: true, text: "微信：frenchvandal。都 2026 年了。" },
    ],
  },
  contact: {
    intro:
      "二十年受监管金融软件经验，如今落脚成都。以下是我的联系方式与公开主页。",
    wechatLabel: "微信",
    githubLabel: "GitHub",
    linkedinLabel: "领英",
    locationLabel: "所在地",
    footer: "© 2026 李北洛 Philippe Ribeiro · 使用 Bun 与 pretext 构建",
  },
  ui: {
    skipLink: "跳到内容",
    intro: "简介",
    languageNav: "语言",
    sectionsNav: "章节",
    copyWechat: "复制微信号",
    copied: "已复制",
    theme: {
      light: "主题：浅色",
      dark: "主题：深色",
    },
  },
};

const zhHant: Translation = {
  name: {
    display: "李北洛 Philippe Ribeiro",
    lines: ["李北洛"],
  },
  meta: {
    description:
      "李北洛（Philippe Ribeiro）— 產品負責人 / 商業分析師，二十年金融軟體經驗：壽險核心系統、銀行保險、公共財政。現居中國成都。",
  },
  nav: {
    about: "關於我",
    experience: "經歷",
    education: "學歷",
    certifications: "認證",
    skills: "技能",
    hobbies: "興趣",
    dialogue: "常見問題",
    contact: "聯絡",
  },
  hero: {
    greeting: "你好，我是",
    title: "產品負責人 · 商業分析師 — 二十年金融軟體經驗",
    location: "中國成都 · 法國籍",
    ctaPrimary: "聯絡我",
    ctaSecondary: "瞭解更多",
  },
  about: {
    p1:
      "產品負責人兼商業分析師，二十年金融服務軟體經驗——壽險核心系統、銀行保險與公共財政。我在軟體產業的兩端都工作過：先是駐點顧問，為多個產業的客戶交付專案；後加入軟體廠商，主導標準化產品的演進。",
    p2:
      "在 KAPIA-RGI，我全權負責 K4U——一個服務多家保險公司終端客戶的網頁入口網站：產品願景、路線圖與待辦清單，在相互競爭的需求之間做優先順序取捨。我主導了單一登入（SAML/OIDC）的跨公司導入，依據使用者回饋與進階 SQL 分析驅動決策，只交付通過測試、符合法規的增量——持有 ISTQB 測試認證，受過 PSPO 培訓。",
    p3:
      "2025 年起定居成都，在四川大學完成一年全日制中文課程——日常生活以中文進行（已通過 HSK 4，正準備 HSK 5）。法語、葡萄牙語為母語，英語流利，西班牙語可作工作語言。",
    stats: {
      years: "年軟體經驗",
      languages: "門語言",
      defects: "% 缺陷積壓削減",
      clients: "位新客戶簽約",
    },
  },
  experience: {
    kapiaRgi: {
      date: "2019年 – 迄今",
      company: "KAPIA-RGI",
      location: "法國巴黎",
      sector: "壽險核心系統軟體",
      title: "網頁產品負責人",
    },
    open: {
      date: "2014年 – 2019年",
      company: "OPEN",
      location: "法國巴黎",
      sector: "IT 顧問服務",
      title: "IT 顧問",
    },
    kapiaSolutions: {
      date: "2011年 – 2014年",
      company: "KAPIA Solutions (KAPIA-RGI)",
      location: "法國巴黎",
      sector: "壽險核心系統軟體",
      title: "商業分析師",
    },
    adneom: {
      date: "2008年 – 2011年",
      company: "Adneom Technologies (CBTW)",
      location: "法國巴黎",
      sector: "IT 顧問服務",
      title: "IT 顧問",
    },
    insurance: {
      date: "2004年 – 2008年",
      company: "Fidelidade、SwissLife 與 AXA",
      location: "法國巴黎",
      sector: "保險",
      title: "契約管理專員",
    },
  },
  education: {
    sichuan: {
      school: "四川大學",
      title: "漢語進修課程",
      date: "2025年 – 2026年",
      subtitle: "成都望江校區 · 全日制沉浸式學習",
      items: [
        "自 KAPIA-RGI 留職停薪一年，全日制學習中文；課程於 2026 年 7 月結業",
        "結業成績：GPA 3.88 / 4，共 39 學分——中級綜合漢語 92.8、漢語聽力口語 93.9、漢語寫作基礎 92.8、中文電腦與網路應用 90.3",
        "課程、日常生活與交流全程使用中文——對中國大學生活有第一手了解",
        "已通過 HSK 4（2023），正準備 HSK 5",
      ],
    },
    master: {
      school: "塞吉-蓬多瓦茲大學",
      title: "金融工具管理碩士",
      date: "2004年 – 2005年",
      subtitle: "現 CY 塞吉巴黎大學",
      desc: "金融工程與金融工具管理——二十年金融軟體生涯的量化根基。",
    },
    edc: {
      school: "EDC 巴黎商學院",
      title: "商學學位——金融方向",
      date: "2000年 – 2004年",
      desc: "商業與管理教育，主修金融。",
    },
  },
  certifications: {
    date: "2016年 – 2024年",
    items: [
      "Professional Scrum Product Owner（PSPO）——2024 年培訓，認證進行中",
      "ISTQB 認證測試工程師——基礎級（2016）",
      "專案管理——基礎與人際面向（2018）",
      "HSK 4（2023）· HSKK 初級口語（2022）· TOCFL A 級（2024）",
    ],
  },
  skills: {
    product: {
      title: "產品與方法論",
      tags: [
        "敏捷 / Scrum",
        "產品路線圖與待辦清單",
        "需求工程",
        "MVP 範疇界定",
        "驗收測試（UAT）",
        "Jira",
      ],
    },
    data: {
      title: "資料庫與程式語言",
      tags: [
        "SQL（進階）",
        "PL/SQL（入門）",
        "JavaScript / TypeScript（入門）",
      ],
    },
    interfaces: {
      title: "介面與環境",
      tags: [
        "REST API",
        "單一登入（SAML / OIDC）",
        "Postman",
        "DEV / QA / PROD 多環境",
      ],
    },
    domains: {
      title: "業務領域",
      tags: [
        "壽險核心系統",
        "銀行保險",
        "數位旅程與 SSO",
        "公共財政",
        "完整軟體生命週期",
      ],
    },
    soft: {
      title: "軟實力",
      tags: [
        "單一窗口",
        "多方協調",
        "客戶展示",
        "文件撰寫",
        "品質意識",
        "跨文化適應",
        "獨立作業",
      ],
    },
    languages: {
      title: "語言",
      french: { name: "法語", level: "母語" },
      portuguese: { name: "葡萄牙語", level: "母語" },
      english: { name: "英語", level: "流利 · 工作語言" },
      spanish: { name: "西班牙語", level: "工作語言" },
      mandarin: { name: "中文", level: "HSK 4 · 準備 HSK 5" },
    },
  },
  hobbies: {
    running: {
      title: "長跑",
      desc: "從 10 公里路跑到超級馬拉松——包括兩次巴黎馬拉松。",
    },
    cycling: {
      title: "自行車",
      desc: "環成都與川西鄉間的長途騎乘。",
    },
    literature: {
      title: "法國文學",
      desc: "熱情的讀者——在豆瓣以中文撰寫書評。",
    },
    cinema: {
      title: "電影",
      desc: "王家衛、梅爾維爾、胡金銓——以法文寫影評是我最持久的寫作練習。",
    },
    language: {
      title: "語言學習",
      desc: "中文即日常：上課、辦事、寫書評——目標 HSK 5。",
    },
  },
  dialogue: {
    visitor: "讀者",
    width: "容器寬度",
    me: "李北洛",
    disclaimer: "常被問到的問題，以及我一貫的回答。",
    messages: [
      { me: false, text: "K4U 是什麼？" },
      {
        me: true,
        text: "KAPIA-RGI 的保險網頁入口網站。多家保險公司客戶，同一套產品。",
      },
      { me: false, text: "產品負責人到底決定什麼？" },
      {
        me: true,
        text: "三家公司想要同一個迭代，只有一家拿得到。",
      },
      { me: false, text: "做了二十年壽險軟體……不會很枯燥嗎？" },
      {
        me: true,
        text: "身故給付、年金、保費豁免——懸念從未停過。",
      },
      { me: false, text: "為什麼選成都？" },
      {
        me: true,
        text: "本來是來學中文的，結果被火鍋說服留下來了。",
      },
      { me: false, text: "能吃多辣？" },
      { me: true, text: "微辣。我說的是適應力強，不是不要命。" },
      { me: false, text: "超級馬拉松？認真的嗎？" },
      {
        me: true,
        text: "就像一次重大版本升級：漫長、痛苦，但業務零中斷。",
      },
      { me: false, text: "那要怎麼聯絡你？連電子郵件都沒有……" },
      { me: true, text: "微信：frenchvandal。都 2026 年了。" },
    ],
  },
  contact: {
    intro:
      "二十年受監管金融軟體經驗，如今落腳成都。以下是我的聯絡方式與公開主頁。",
    wechatLabel: "微信",
    githubLabel: "GitHub",
    linkedinLabel: "領英",
    locationLabel: "所在地",
    footer: "© 2026 李北洛 Philippe Ribeiro · 以 Bun 與 pretext 打造",
  },
  ui: {
    skipLink: "跳至內容",
    intro: "簡介",
    languageNav: "語言",
    sectionsNav: "章節",
    copyWechat: "複製微信號",
    copied: "已複製",
    theme: {
      light: "主題：淺色",
      dark: "主題：深色",
    },
  },
};

/*
 * Hong Kong and Macau read the same Traditional script as Taiwan but not the
 * same technical vocabulary. These five terms are the whole difference across
 * this CV—measured, not guessed—so the HK page is a projection of the
 * Taiwan one rather than a seventh hand-written translation: a copy would mean
 * making every future edit twice, for five words.
 *
 * Deliberately NOT included: 品質 → 質素. 質素 is the distinctly Hong Kong word
 * for quality, but in the one place the CV uses it—品質意識, "quality
 * mindset"—品質 is idiomatic in Hong Kong too, and a CV is the wrong place
 * for a substitution that is merely defensible.
 */
const HK_LEXICON: Record<string, string> = {
  軟體: "軟件",
  專案: "項目",
  網路: "網絡",
  入口網站: "門戶網站",
  契約: "合約",
};

/**
 * The Hong Kong / Macau reading of the Traditional page. The round trip goes
 * through JSON because the content is plain data—strings, arrays and objects,
 * no dates, functions or classes—which makes one `replaceAll` per term the
 * whole implementation. The cast is the one place a `JSON.parse` of our own
 * serialization is what it claims to be; `translations.test.ts` pins that down
 * by asserting the result still matches the Taiwan page structurally.
 */
function toHongKong(t: Translation): Translation {
  let json = JSON.stringify(t);
  for (const [taiwan, hongKong] of Object.entries(HK_LEXICON)) {
    json = json.replaceAll(taiwan, hongKong);
  }
  return JSON.parse(json) as Translation;
}

/** The Taiwan→Hong Kong terms, exposed so the tests can hold the pair to it. */
export const HK_TERMS: readonly (readonly [string, string])[] = Object.entries(
  HK_LEXICON,
);

export const translations: Record<Lang, Translation> = {
  en,
  fr,
  pt,
  es,
  zh,
  "zh-hant": zhHant,
  "zh-hk": toHongKong(zhHant),
};
