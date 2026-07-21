/**
 * Portfolio content, fully typed and available in four languages.
 *
 * The English object `en` is the source of truth: its inferred type is
 * {@link Translation}, so `fr`, `zh` and `zhHant` must expose the exact same
 * shape — a missing or misnamed key is a compile-time error. This guarantees
 * parity across languages without hand-writing a large interface.
 *
 * `zh` (Simplified) and `zh-hant` (Traditional) are independent translations,
 * not script conversions of each other: vocabulary differs between the two
 * (软件/軟體, 业务分析师/商業分析師, 待办列表/待辦清單…), so each is written
 * for its audience. The Chinese pages use Philippe's Chinese name, 李北洛.
 */

export const LANGS = ["en", "fr", "zh", "zh-hant"] as const;
export type Lang = (typeof LANGS)[number];

/** Type guard for language values coming from the DOM or the URL (dataset, path). */
export function isLang(value: string | undefined): value is Lang {
  return value !== undefined && (LANGS as readonly string[]).includes(value);
}

/** BCP-47 tags used for the `<html lang>` attribute and `hreflang` links. */
export const HTML_LANG: Record<Lang, string> = {
  en: "en",
  fr: "fr",
  zh: "zh-Hans",
  "zh-hant": "zh-Hant",
};

/** Human-readable endonyms for the language switcher. */
export const LANG_LABEL: Record<Lang, string> = {
  en: "EN",
  fr: "FR",
  zh: "简",
  "zh-hant": "繁",
};

/** Full language names (endonyms) for accessible labels on the switcher links. */
export const LANG_NAME: Record<Lang, string> = {
  en: "English",
  fr: "Français",
  zh: "简体中文",
  "zh-hant": "繁體中文",
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
      "Philippe Ribeiro — Product Owner and Business Analyst with 20 years in financial-services software: insurance core systems, bancassurance, public finance. Based in Chengdu, China, available immediately.",
  },
  nav: {
    about: "About",
    experience: "Experience",
    education: "Education",
    certifications: "Certifications",
    skills: "Skills",
    hobbies: "Hobbies",
    dialogue: "Dialogue",
    contact: "Contact",
  },
  hero: {
    greeting: "Hello, I'm",
    title: "Product Owner · Business Analyst — 20 years in financial software",
    location:
      "Chengdu, China — mobile nationwide · French national · Available immediately",
    ctaPrimary: "Get in Touch",
    ctaSecondary: "Learn More",
  },
  about: {
    p1:
      "Product Owner and Business Analyst with twenty years in financial-services software — insurance core systems, bancassurance, and public finance. I have worked on both sides of the software business: as an on-site consultant delivering projects for clients across industries, and as a product owner inside a vendor, steering a packaged product.",
    p2:
      "At KAPIA-RGI I own K4U, a customer-facing insurance web portal serving multiple client companies, end to end: product vision, roadmap, and backlog, prioritized across competing stakeholder demands. I led the cross-company rollout of single sign-on (SAML/OIDC), drive decisions from user feedback and advanced SQL analysis, and ship only tested, compliant increments — ISTQB-certified tester, PSPO-trained.",
    p3:
      "Living in Chengdu since 2025 after a year of full-time Mandarin study at Sichuan University — daily life runs in Mandarin (HSK 4, HSK 5 in preparation). Native French and Portuguese, fluent English, working Spanish. Available immediately, mobile across China.",
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
      company: "Groupe Open",
      location: "Paris, France",
      sector: "IT consulting",
      title: "IT Consultant",
    },
    kapiaSolutions: {
      date: "2011 – 2014",
      company: "KAPIA Solutions (KAPIA-RGI)",
      location: "Paris, France",
      sector: "Life-insurance core-systems software",
      title: "Business Analyst",
    },
    adneom: {
      date: "2008 – 2011",
      company: "Adneom Technologies (CBTW)",
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
      date: "2005",
      subtitle: "Now CY Cergy Paris Université",
      desc:
        "Financial engineering and instruments management — the quantitative grounding behind twenty years in financial software.",
    },
    edc: {
      school: "EDC Paris Business School",
      title: "Business Degree — Finance Major",
      date: "2004",
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
    visitor: "Visitor",
    me: "Philippe",
    disclaimer: "A barely embellished transcript of a real conversation.",
    messages: [
      { me: false, text: "Are you really available immediately?" },
      {
        me: true,
        text:
          "Yes. My personal backlog is empty — everything prioritized, tested, shipped.",
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
      "I'm looking for Product Owner, Business Analyst, or project-management roles — in China or in Europe-facing remote collaboration. Twenty years in regulated financial software, based in Chengdu, mobile nationwide, available immediately.",
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
      "Philippe Ribeiro — Product Owner et Business Analyst, 20 ans dans le logiciel pour services financiers : systèmes cœur d'assurance vie, bancassurance, finances publiques. Basé à Chengdu, Chine, disponible immédiatement.",
  },
  nav: {
    about: "À propos",
    experience: "Expérience",
    education: "Formation",
    certifications: "Certifications",
    skills: "Compétences",
    hobbies: "Loisirs",
    dialogue: "Dialogue",
    contact: "Contact",
  },
  hero: {
    greeting: "Bonjour, je suis",
    title:
      "Product Owner · Business Analyst — 20 ans dans le logiciel financier",
    location:
      "Chengdu, Chine — mobile dans toute la Chine · Nationalité française · Disponible immédiatement",
    ctaPrimary: "Me contacter",
    ctaSecondary: "En savoir plus",
  },
  about: {
    p1:
      "Product Owner et Business Analyst, vingt ans dans le logiciel pour services financiers — systèmes cœur d'assurance vie, bancassurance et finances publiques. J'ai travaillé des deux côtés du métier : consultant en régie livrant des projets pour des clients de secteurs variés, puis responsable de produit chez un éditeur, aux commandes d'un progiciel.",
    p2:
      "Chez KAPIA-RGI, je porte K4U, un portail web d'assurance destiné aux clients finaux de plusieurs compagnies, de bout en bout : vision produit, feuille de route et backlog, priorisés entre des demandes concurrentes. J'ai piloté le déploiement transverse de l'authentification unique (SAML/OIDC), je fonde les décisions sur les retours utilisateurs et l'analyse SQL avancée, et je ne livre que des incréments testés et conformes — testeur certifié ISTQB, formé PSPO.",
    p3:
      "Installé à Chengdu depuis 2025 après une année de mandarin à temps plein à l'Université du Sichuan — le quotidien se vit en mandarin (HSK 4, HSK 5 en préparation). Français et portugais langues maternelles, anglais courant, espagnol professionnel. Disponible immédiatement, mobile dans toute la Chine.",
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
      company: "Groupe Open",
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
      date: "2005",
      subtitle: "Aujourd'hui CY Cergy Paris Université",
      desc:
        "Ingénierie financière et gestion d'instruments — le socle quantitatif de vingt ans dans le logiciel financier.",
    },
    edc: {
      school: "EDC Paris Business School",
      title: "Diplôme d'école de commerce — Majeure Finance",
      date: "2004",
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
    visitor: "Visiteur",
    me: "Philippe",
    disclaimer:
      "Transcription à peine romancée d'une conversation authentique.",
    messages: [
      { me: false, text: "Vous êtes vraiment disponible immédiatement ?" },
      {
        me: true,
        text:
          "Oui. Mon backlog personnel est vide : tout est priorisé, testé, livré.",
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
      "Je recherche des postes de Product Owner, Business Analyst ou conduite de projet — en Chine ou en collaboration à distance avec l'Europe. Vingt ans dans le logiciel financier réglementé, basé à Chengdu, mobile dans toute la Chine, disponible immédiatement.",
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

const zh: Translation = {
  name: {
    display: "李北洛 Philippe Ribeiro",
    lines: ["李北洛"],
  },
  meta: {
    description:
      "李北洛（Philippe Ribeiro）— 产品负责人 / 业务分析师，二十年金融软件经验：人寿保险核心系统、银行保险、公共财政。现居中国成都，可随时到岗。",
  },
  nav: {
    about: "关于我",
    experience: "经历",
    education: "教育",
    certifications: "认证",
    skills: "技能",
    hobbies: "爱好",
    dialogue: "对话",
    contact: "联系",
  },
  hero: {
    greeting: "你好，我是",
    title: "产品负责人 · 业务分析师 — 二十年金融软件经验",
    location: "中国成都 · 可在全国范围工作 · 法国籍 · 可随时到岗",
    ctaPrimary: "联系我",
    ctaSecondary: "了解更多",
  },
  about: {
    p1:
      "产品负责人兼业务分析师，二十年金融服务软件经验——人寿保险核心系统、银行保险与公共财政。我在软件行业的两端都工作过：先是驻场顾问，为多个行业的客户交付项目；后加入软件厂商，主导标准化产品的演进。",
    p2:
      "在 KAPIA-RGI，我全面负责 K4U——一个服务多家保险公司终端客户的网页门户：产品愿景、路线图与待办列表，在相互竞争的需求之间做优先级取舍。我主导了单点登录（SAML/OIDC）的跨公司部署，依托用户反馈与高级 SQL 分析驱动决策，只交付经过测试、符合监管要求的增量——持有 ISTQB 测试认证，受过 PSPO 培训。",
    p3:
      "2025 年起定居成都，在四川大学完成一年全日制中文学习——日常生活以中文进行（已通过 HSK 4，正备考 HSK 5）。法语、葡萄牙语为母语，英语流利，西班牙语可作工作语言。可随时到岗，可在全国范围内工作。",
    stats: {
      years: "年软件经验",
      languages: "门语言",
      defects: "% 缺陷积压削减",
      clients: "位新客户签约",
    },
  },
  experience: {
    kapiaRgi: {
      date: "2019 – 至今",
      company: "KAPIA-RGI",
      location: "法国巴黎",
      sector: "人寿保险核心系统软件",
      title: "网页产品负责人",
    },
    open: {
      date: "2014 – 2019",
      company: "Groupe Open",
      location: "法国巴黎",
      sector: "IT 咨询",
      title: "IT 顾问",
    },
    kapiaSolutions: {
      date: "2011 – 2014",
      company: "KAPIA Solutions (KAPIA-RGI)",
      location: "法国巴黎",
      sector: "人寿保险核心系统软件",
      title: "业务分析师",
    },
    adneom: {
      date: "2008 – 2011",
      company: "Adneom Technologies (CBTW)",
      location: "法国巴黎",
      sector: "IT 咨询",
      title: "IT 顾问",
    },
    insurance: {
      date: "2004 – 2008",
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
      date: "2025 – 2026",
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
      date: "2005",
      subtitle: "现 CY 塞尔吉巴黎大学",
      desc: "金融工程与金融工具管理——二十年金融软件生涯的量化根基。",
    },
    edc: {
      school: "EDC 巴黎商学院",
      title: "商科学位——金融方向",
      date: "2004",
      desc: "商业与管理教育，主修金融。",
    },
  },
  certifications: {
    date: "2016 – 2024",
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
    visitor: "访客",
    me: "李北洛",
    disclaimer: "以下对话根据真实故事（几乎）改编。",
    messages: [
      { me: false, text: "你真的可以随时到岗？" },
      {
        me: true,
        text: "真的。我的个人待办列表是空的——全部已排序、已测试、已交付。",
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
      "我正在寻找产品负责人、业务分析师或项目管理类职位——在中国工作或远程面向欧洲协作均可。二十年受监管金融软件经验，现居成都，可在全国范围工作，可随时到岗。",
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
      "李北洛（Philippe Ribeiro）— 產品負責人 / 商業分析師，二十年金融軟體經驗：壽險核心系統、銀行保險、公共財政。現居中國成都，可隨時到職。",
  },
  nav: {
    about: "關於我",
    experience: "經歷",
    education: "學歷",
    certifications: "認證",
    skills: "技能",
    hobbies: "興趣",
    dialogue: "對話",
    contact: "聯絡",
  },
  hero: {
    greeting: "你好，我是",
    title: "產品負責人 · 商業分析師 — 二十年金融軟體經驗",
    location: "中國成都 · 可於中國各地工作 · 法國籍 · 可隨時到職",
    ctaPrimary: "聯絡我",
    ctaSecondary: "瞭解更多",
  },
  about: {
    p1:
      "產品負責人兼商業分析師，二十年金融服務軟體經驗——壽險核心系統、銀行保險與公共財政。我在軟體產業的兩端都工作過：先是駐點顧問，為多個產業的客戶交付專案；後加入軟體廠商，主導標準化產品的演進。",
    p2:
      "在 KAPIA-RGI，我全權負責 K4U——一個服務多家保險公司終端客戶的網頁入口網站：產品願景、路線圖與待辦清單，在相互競爭的需求之間做優先順序取捨。我主導了單一登入（SAML/OIDC）的跨公司導入，依據使用者回饋與進階 SQL 分析驅動決策，只交付通過測試、符合法規的增量——持有 ISTQB 測試認證，受過 PSPO 培訓。",
    p3:
      "2025 年起定居成都，在四川大學完成一年全日制中文課程——日常生活以中文進行（已通過 HSK 4，正準備 HSK 5）。法語、葡萄牙語為母語，英語流利，西班牙語可作工作語言。可隨時到職，可於中國各地工作。",
    stats: {
      years: "年軟體經驗",
      languages: "門語言",
      defects: "% 缺陷積壓削減",
      clients: "位新客戶簽約",
    },
  },
  experience: {
    kapiaRgi: {
      date: "2019 – 迄今",
      company: "KAPIA-RGI",
      location: "法國巴黎",
      sector: "壽險核心系統軟體",
      title: "網頁產品負責人",
    },
    open: {
      date: "2014 – 2019",
      company: "Groupe Open",
      location: "法國巴黎",
      sector: "IT 顧問服務",
      title: "IT 顧問",
    },
    kapiaSolutions: {
      date: "2011 – 2014",
      company: "KAPIA Solutions (KAPIA-RGI)",
      location: "法國巴黎",
      sector: "壽險核心系統軟體",
      title: "商業分析師",
    },
    adneom: {
      date: "2008 – 2011",
      company: "Adneom Technologies (CBTW)",
      location: "法國巴黎",
      sector: "IT 顧問服務",
      title: "IT 顧問",
    },
    insurance: {
      date: "2004 – 2008",
      company: "Fidelidade、SwissLife 與 AXA",
      location: "法國巴黎",
      sector: "保險",
      title: "契約管理專員",
    },
  },
  education: {
    sichuan: {
      school: "四川大學",
      title: "華語進修課程",
      date: "2025 – 2026",
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
      date: "2005",
      subtitle: "現 CY 塞吉巴黎大學",
      desc: "金融工程與金融工具管理——二十年金融軟體生涯的量化根基。",
    },
    edc: {
      school: "EDC 巴黎商學院",
      title: "商學學位——金融方向",
      date: "2004",
      desc: "商業與管理教育，主修金融。",
    },
  },
  certifications: {
    date: "2016 – 2024",
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
    visitor: "訪客",
    me: "李北洛",
    disclaimer: "以下對話（幾乎）改編自真實故事。",
    messages: [
      { me: false, text: "你真的可以隨時到職？" },
      {
        me: true,
        text: "真的。我的個人待辦清單是空的——全部已排序、已測試、已交付。",
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
      "我正在尋找產品負責人、商業分析師或專案管理類職位——在中國工作或遠端面向歐洲協作皆可。二十年受監管金融軟體經驗，現居成都，可於中國各地工作，可隨時到職。",
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

export const translations: Record<Lang, Translation> = {
  en,
  fr,
  zh,
  "zh-hant": zhHant,
};
