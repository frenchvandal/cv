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
 * (软件/軟體, 网络/網路, 宏观/總體…), so each is written for its audience.
 */

export const LANGS = ["en", "fr", "zh", "zh-hant"] as const;
export type Lang = (typeof LANGS)[number];

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

/** Language-invariant profile constants (proper nouns, URLs, contact). */
export const PROFILE = {
  fullName: "Jorge Paula Pinheiro",
  nameLines: ["JORGE", "PAULA PINHEIRO"] as const,
  email: "jorge.paulapinheiro@gmail.com",
  location: "Lausanne, Switzerland",
  spotifyUrl: "https://open.spotify.com/intl-fr/artist/0CKa7wVI7tiJaFdIBNHw8T",
} as const;

const en = {
  meta: {
    description:
      "Jorge Paula Pinheiro — Economics student with 8 years of IT background, transitioning to economic and financial analysis. Based in Lausanne, currently a CSC scholar in Chengdu.",
  },
  nav: {
    about: "About",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    hobbies: "Hobbies",
    contact: "Contact",
  },
  hero: {
    greeting: "Hello, I'm",
    title: "Economics · Data · IT — Available August 2026",
    location:
      "📍 Currently in Chengdu, China · Based in Lausanne, Switzerland · 🎓 Bachelor in Economics",
    ctaPrimary: "Get in Touch",
    ctaSecondary: "Learn More",
  },
  about: {
    p1:
      "Economics student with solid professional experience in information technology, currently completing my bachelor's degree while engaged in an intensive language program abroad alongside my studies.",
    p2:
      "I aim for roles in IT support or economic and financial analysis where my IT + economics dual background is actively leveraged as a differentiating asset. My background combines 8 years of IT infrastructure experience with rigorous quantitative training in econometrics, macroeconomics, and financial modeling.",
    p3:
      "Currently in Chengdu, China, completing an intensive Mandarin program as a CSC Scholarship recipient. Based in Lausanne, Switzerland.",
    stats: {
      years: "Years IT Experience",
      gpa: "Grade / 6",
      languages: "Languages",
      ects: "ECTS Earned",
    },
  },
  experience: {
    chuv: {
      title: "IT Technician",
      company: "CHUV — Centre Hospitalier Universitaire Vaudois, Lausanne",
      date: "2017 – 2025",
      items: [
        "IT park management (10,000+ workstations) via SCCM: installation, maintenance and hardware/software troubleshooting",
        "iPhone configuration and deployment via AirWatch / Workspace ONE",
        "Cisco phone configuration via Agile Provisioning",
        "Interventions on medical equipment and non-standard systems",
        "Helpdesk support and user assistance: diagnosis and resolution of incidents",
        "Printer and network peripheral troubleshooting",
        "Writing and standardization of technical procedures for the team",
        "Methodical work under pressure respecting priorities and deadlines",
      ],
    },
    studentJobsTitle: "Student Jobs",
    galexis: {
      title: "Warehouse Worker",
      company: "Galexis SA · Écublens, Vaud",
      date: "2014 – 2017",
      desc:
        "Student job alongside my studies. Logistics support and participation in pharmaceutical distribution operations.",
    },
    uber: {
      title: "Uber Pop Driver",
      company: "Uber · Freelance",
      date: "2016 – 2017",
      desc: "Student job alongside my studies.",
    },
    gfk: {
      title: "Call Center Operator",
      company: "GFK · Lausanne",
      date: "2011 – 2012",
      desc: "Student job.",
    },
  },
  education: {
    bachelor: {
      title: "Bachelor in Economics and Management",
      date: "2023 – Present",
      subtitle: "UniDistance Switzerland · 152/180 ECTS · 5.66/6",
      courses: [
        "Curriculum: 152 ECTS completed with average 5.66/6",
        "Economics & Policy — Macroeconomics, Microeconomics, Public Economics, Industrial Organization",
        "Finance & Control — Money & Finance, Management Control, Corporate Finance, International Finance, International Trade",
        "Quantitative Methods — Econometrics, Statistics, Mathematics for Economists",
        "Business Foundations — Financial Accounting, Business Management, Entrepreneurship, Business Law",
      ],
      thesisTitle: "Bachelor Thesis",
      thesis:
        "Global Determinants of Real Estate Prices: A Multi-Country Panel Analysis",
      thesisSubject:
        "Impact of financial cycles on real estate markets — transmission of international financial shocks",
      methodology: "Methodology",
      methodologyValue:
        "Multivariate linear regressions (OLS) + Linear projections on panel data",
      dataSources: "Data Sources",
      dataSourcesValue: "IMF, BIS — international macroeconomic datasets",
      tools: "Tools",
      toolsValue: "R (tidyverse: dplyr, tidyr)",
      focus: "Focus",
      focusValue:
        "Stabilizing effect of macroprudential measures and capital controls against international financial shocks",
    },
    china: {
      title: "Chinese Language Program — CSC Scholar",
      date: "2025 – Present",
      subtitle: "Sichuan University · Chengdu, China · Full Mandarin Immersion",
      csc:
        "CSC Scholarship recipient — competitive Chinese government grant (CSC/bilateral program)",
      intensive: "Intensive language program (25+ hours/week)",
      gpa: "GPA 4.0/4.0",
      gpaDesc: "on all first-semester courses",
      immersion:
        "Complete immersion: coursework, daily life, and interactions 100% in Mandarin",
      adaptability:
        "Developed strong cross-cultural adaptability through direct integration into Chinese academic and social environments",
    },
    cfc: {
      title: "CFC in Computer Science",
      date: "2015 – 2017",
      subtitle: "CPNV · 5.3/6",
      desc:
        "Comprehensive generalist training: development (C#, JavaScript, PHP), databases (SQL), networking, systems (Windows/Linux), technical support",
    },
    epfl: {
      title: "EPFL — Swiss Federal Institute of Technology",
      date: "2011 – 2015",
      subtitle:
        "Microtechnology · Propédeutique 4.41/6 · Bachelor not completed",
      desc:
        "Initial engineering training: programming (C), mathematics, physics, statistics — solid analytical foundation before career pivot",
    },
  },
  skills: {
    data: {
      title: "📊 Data & Analytics",
      tags: [
        "R",
        "SQL",
        "Excel",
        "Python",
        "Linear Regressions",
        "Panel Data Analysis",
        "OLS",
        "Statistical Modeling",
      ],
    },
    econometrics: {
      title: "📈 Econometrics",
      tags: [
        "Multivariate Analysis",
        "Time Series",
        "Fixed Effects Models",
        "Robustness Analysis",
      ],
    },
    it: {
      title: "🖥️ IT Infrastructure",
      tags: [
        "Asset Management (10K+ devices)",
        "Large-Scale Deployment",
        "System Administration",
        "Incident Management",
        "Helpdesk L2",
      ],
    },
    finance: {
      title: "💰 Finance",
      tags: ["Financial Analysis", "DCF Models", "Comparables"],
    },
    economics: {
      title: "📉 Economics",
      tags: ["Macroeconomics", "Econometrics", "Int. Finance"],
    },
    accounting: {
      title: "📋 Accounting",
      tags: ["Financial Accounting", "Management Control"],
    },
    programming: {
      title: "💻 Programming",
      tags: ["PowerShell", "C#", "PHP", "JavaScript"],
    },
    soft: {
      title: "🤝 Soft Skills",
      tags: [
        "Rigorous",
        "User Support",
        "Confidentiality",
        "Documentation",
        "Synthesis",
        "Cross-cultural Adaptability",
        "International Mobility",
        "Collaboration",
      ],
    },
    languages: {
      title: "🌍 Languages",
      french: { name: "French", level: "Native" },
      portuguese: { name: "Portuguese", level: "Native" },
      english: { name: "English", level: "Fluent (IELTS 8/9)" },
      chinese: { name: "Chinese", level: "Intermediate" },
    },
  },
  hobbies: {
    music: {
      title: "Music Production",
      desc:
        "Cyber Metal / Industrial Metal artist — 3 self-produced albums, solo composition & recording, 2-3 occasional collaborations",
      link: "Listen on Spotify",
    },
    gaming: {
      title: "Video Games",
      desc:
        "Passionate gamer exploring virtual worlds and interactive storytelling",
    },
    travel: {
      title: "Traveling",
      desc:
        "Exploring new cultures and destinations. Recent focus on Asia-Pacific region",
    },
    cycling: {
      title: "Cycling",
      desc: "Enjoying the outdoors on two wheels",
    },
    language: {
      title: "Language Learning",
      desc: "Currently immersed in Mandarin Chinese",
    },
  },
  contact: {
    intro:
      "I'm looking for roles in IT support or economic and financial analysis where my IT + economics dual background is valued. Open to internships and entry-level positions starting August 2026.",
    emailLabel: "Email",
    locationLabel: "Location",
    footer: "© 2026 Jorge Paula Pinheiro · Built with Bun & pretext",
  },
  ui: {
    skipLink: "Skip to content",
    languageNav: "Language",
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
  meta: {
    description:
      "Jorge Paula Pinheiro — Étudiant en économie avec 8 ans d'expérience IT, en réorientation vers l'analyse économique et financière. Basé à Lausanne, actuellement boursier CSC à Chengdu.",
  },
  nav: {
    about: "À propos",
    experience: "Expérience",
    education: "Formation",
    skills: "Compétences",
    hobbies: "Loisirs",
    contact: "Contact",
  },
  hero: {
    greeting: "Bonjour, je suis",
    title: "Économie · Data · IT — Disponible août 2026",
    location:
      "📍 Actuellement à Chengdu, Chine · Basé à Lausanne, Suisse · 🎓 Bachelor en Économie",
    ctaPrimary: "Me contacter",
    ctaSecondary: "En savoir plus",
  },
  about: {
    p1:
      "Étudiant en économie avec une solide expérience professionnelle en informatique, actuellement en fin de bachelor tout en suivant un programme intensif de langue à l'étranger en parallèle de mes études.",
    p2:
      "Je vise des postes en support informatique ou en analyse économique et financière où mon double bagage IT + économie est exploité comme un atout différenciant. Mon parcours combine 8 ans d'expérience en infrastructure IT avec une formation quantitative rigoureuse en économétrie, macroéconomie et modélisation financière.",
    p3:
      "Actuellement à Chengdu, Chine, en tant que boursier CSC suivant un programme intensif de mandarin. Basé à Lausanne, Suisse.",
    stats: {
      years: "Années d'exp. IT",
      gpa: "Note / 6",
      languages: "Langues",
      ects: "ECTS Acquis",
    },
  },
  experience: {
    chuv: {
      title: "Informaticien",
      company: "CHUV — Centre Hospitalier Universitaire Vaudois, Lausanne",
      date: "2017 – 2025",
      items: [
        "Gestion du parc informatique (10 000+ postes) via SCCM : installation, maintenance et dépannage hardware et software",
        "Configuration et déploiement d'iPhone via AirWatch / Workspace ONE",
        "Configuration de téléphones Cisco via Agile Provisioning",
        "Interventions sur du matériel médical et des systèmes non standards",
        "Tenue du guichet support et assistance aux utilisateurs : diagnostic et résolution des incidents",
        "Dépannage des imprimantes et des périphériques réseau",
        "Rédaction et standardisation de procédures techniques pour l'équipe",
        "Travail méthodique sous pression avec respect des priorités et des délais",
      ],
    },
    studentJobsTitle: "Jobs Étudiants",
    galexis: {
      title: "Manutentionnaire",
      company: "Galexis SA · Écublens, Vaud",
      date: "2014 – 2017",
      desc:
        "Job étudiant en parallèle des études. Support logistique et participation aux opérations de distribution pharmaceutique.",
    },
    uber: {
      title: "Chauffeur Uber Pop",
      company: "Uber · Freelance",
      date: "2016 – 2017",
      desc: "Job étudiant en parallèle des études.",
    },
    gfk: {
      title: "Opérateur Call Center",
      company: "GFK · Lausanne",
      date: "2011 – 2012",
      desc: "Job étudiant.",
    },
  },
  education: {
    bachelor: {
      title: "Bachelor en Économie et Management",
      date: "2023 – Présent",
      subtitle: "UniDistance Suisse · 152/180 ECTS · 5.66/6",
      courses: [
        "Programme complet : 152 ECTS acquis, moyenne 5.66/6",
        "Économie & Politique — Macroéconomie, Microéconomie, Économie publique, Organisation industrielle",
        "Finance & Contrôle — Monnaie et finance, Contrôle de gestion, Finance d'entreprise, Finance internationale, Commerce international",
        "Méthodes quantitatives — Économétrie, Statistiques, Mathématiques pour économistes",
        "Fondements business — Comptabilité financière, Gestion des entreprises, Entrepreneuriat, Droit de l'entreprise",
      ],
      thesisTitle: "Mémoire de Bachelor",
      thesis:
        "Déterminants globaux des prix immobiliers : Une analyse de panel multi-pays",
      thesisSubject:
        "Impact des cycles financiers sur les marchés immobiliers — transmission des chocs financiers internationaux",
      methodology: "Méthodologie",
      methodologyValue:
        "Régressions linéaires multivariées (MCO) + Projections linéaires sur données de panel",
      dataSources: "Sources de données",
      dataSourcesValue:
        "FMI, BRI — jeux de données macroéconomiques internationaux",
      tools: "Outils",
      toolsValue: "R (tidyverse : dplyr, tidyr)",
      focus: "Objet d'étude",
      focusValue:
        "Effet stabilisateur des mesures macroprudentielles et des contrôles de capitaux contre les chocs financiers internationaux",
    },
    china: {
      title: "Programme de Chinois — Boursier CSC",
      date: "2025 – Présent",
      subtitle:
        "Université du Sichuan · Chengdu, Chine · Immersion complète en mandarin",
      csc:
        "Boursier CSC — bourse gouvernementale chinoise compétitive (programme CSC/bilatéral)",
      intensive: "Programme de langue intensif (25+ heures/semaine)",
      gpa: "GPA 4.0/4.0",
      gpaDesc: "à tous les cours du premier semestre",
      immersion:
        "Immersion totale : cours, vie quotidienne et interactions 100% en mandarin",
      adaptability:
        "Développement d'une forte capacité d'adaptation interculturelle par intégration directe dans les environnements académiques et sociaux chinois",
    },
    cfc: {
      title: "CFC en Informatique",
      date: "2015 – 2017",
      subtitle: "CPNV · 5.3/6",
      desc:
        "Formation généraliste complète : développement (C#, JavaScript, PHP), bases de données (SQL), réseaux, systèmes (Windows/Linux), support technique",
    },
    epfl: {
      title: "EPFL — École polytechnique fédérale de Lausanne",
      date: "2011 – 2015",
      subtitle: "Microtechnique · Propédeutique 4.41/6 · Bachelor non terminé",
      desc:
        "Formation initiale en ingénierie : programmation (C), mathématiques, physique, statistiques — base analytique solide avant réorientation",
    },
  },
  skills: {
    data: {
      title: "📊 Data & Analytics",
      tags: [
        "R",
        "SQL",
        "Excel",
        "Python",
        "Régressions Linéaires",
        "Analyse de Données de Panel",
        "MCO",
        "Modélisation Statistique",
      ],
    },
    econometrics: {
      title: "📈 Économétrie",
      tags: [
        "Analyse Multivariée",
        "Séries Temporelles",
        "Modèles à Effets Fixes",
        "Analyse de Robustesse",
      ],
    },
    it: {
      title: "🖥️ Infrastructure IT",
      tags: [
        "Gestion de Parc (10K+ postes)",
        "Déploiement Large Échelle",
        "Administration Système",
        "Gestion des Incidents",
        "Support Niveau 2",
      ],
    },
    finance: {
      title: "💰 Finance",
      tags: ["Analyse Financière", "Modèles DCF", "Comparables"],
    },
    economics: {
      title: "📉 Économie",
      tags: ["Macroéconomie", "Économétrie", "Finance Internationale"],
    },
    accounting: {
      title: "📋 Comptabilité",
      tags: ["Comptabilité Financière", "Contrôle de Gestion"],
    },
    programming: {
      title: "💻 Programmation",
      tags: ["PowerShell", "C#", "PHP", "JavaScript"],
    },
    soft: {
      title: "🤝 Soft Skills",
      tags: [
        "Rigueur",
        "Support Utilisateurs",
        "Confidentialité",
        "Documentation",
        "Synthèse",
        "Adaptabilité Interculturelle",
        "Mobilité Internationale",
        "Collaboration",
      ],
    },
    languages: {
      title: "🌍 Langues",
      french: { name: "Français", level: "Langue maternelle" },
      portuguese: { name: "Portugais", level: "Langue maternelle" },
      english: { name: "Anglais", level: "Courant (IELTS 8/9)" },
      chinese: { name: "Chinois", level: "Intermédiaire" },
    },
  },
  hobbies: {
    music: {
      title: "Production Musicale",
      desc:
        "Artiste Cyber Metal / Metal Industriel — 3 albums auto-produits, composition et enregistrement en solo, 2-3 collaborations ponctuelles",
      link: "Écouter sur Spotify",
    },
    gaming: {
      title: "Jeux Vidéo",
      desc:
        "Gamer passionné explorant les mondes virtuels et le storytelling interactif",
    },
    travel: {
      title: "Voyages",
      desc:
        "Explorer de nouvelles cultures et destinations. Focus récent sur la région Asie-Pacifique",
    },
    cycling: {
      title: "Vélo",
      desc: "Profiter de l'extérieur sur deux roues",
    },
    language: {
      title: "Apprentissage des Langues",
      desc: "Actuellement immergé dans le Mandarin",
    },
  },
  contact: {
    intro:
      "Je recherche des postes en support informatique ou en analyse économique et financière où mon double bagage IT + économie est un atout. Ouvert aux stages et postes junior à partir d'août 2026.",
    emailLabel: "E-mail",
    locationLabel: "Localisation",
    footer: "© 2026 Jorge Paula Pinheiro · Construit avec Bun & pretext",
  },
  ui: {
    skipLink: "Aller au contenu",
    languageNav: "Langue",
    theme: {
      light: "Thème : clair",
      dark: "Thème : sombre",
    },
  },
};

const zh: Translation = {
  meta: {
    description:
      "Jorge Paula Pinheiro — 拥有8年IT背景的经济学学生，正转向经济与金融分析。常驻瑞士洛桑，目前为成都的CSC奖学金学者。",
  },
  nav: {
    about: "关于我",
    experience: "经历",
    education: "教育",
    skills: "技能",
    hobbies: "爱好",
    contact: "联系",
  },
  hero: {
    greeting: "你好，我是",
    title: "经济学 · 数据 · IT — 2026年8月可入职",
    location: "📍 目前在中国成都 · 常驻瑞士洛桑 · 🎓 经济学学士",
    ctaPrimary: "联系我",
    ctaSecondary: "了解更多",
  },
  about: {
    p1:
      "我是一名拥有扎实信息技术专业背景的经济学学生，目前正在通过瑞士远程大学完成学士学位，同时在中国成都参加密集型中文课程。",
    p2:
      "我的目标是从事IT技术支持或经济金融分析类岗位，充分发挥IT+经济双背景的独特优势。我的背景融合了8年IT基础设施经验，以及计量经济学、宏观经济学和金融建模方面的严谨定量培训。",
    p3: "目前在中国成都，作为CSC奖学金获得者完成密集型中文课程。常驻瑞士洛桑。",
    stats: {
      years: "年IT经验",
      gpa: "绩点 / 6",
      languages: "语言",
      ects: "已获学分",
    },
  },
  experience: {
    chuv: {
      title: "IT技术员",
      company: "CHUV — 洛桑大学中心医院",
      date: "2017 – 2025",
      items: [
        "通过SCCM管理IT设备群（10,000+台）：安装、维护和软硬件故障排除",
        "通过AirWatch / Workspace ONE配置和部署iPhone",
        "通过Agile Provisioning配置Cisco电话",
        "对医疗设备和非标准系统进行干预",
        "负责服务台支持并协助用户：诊断和解决事件",
        "打印机和网络外设故障排除",
        "为团队编写和标准化技术程序",
        "在压力下按优先级和截止日期进行有条理的工作",
      ],
    },
    studentJobsTitle: "学生兼职",
    galexis: {
      title: "仓库工作人员",
      company: "Galexis SA · 瑞士沃州埃屈布朗",
      date: "2014 – 2017",
      desc: "边学习边工作。提供物流支持并参与药品分销业务。",
    },
    uber: {
      title: "Uber Pop司机",
      company: "Uber · 自由职业",
      date: "2016 – 2017",
      desc: "边学习边工作。",
    },
    gfk: {
      title: "呼叫中心接线员",
      company: "GFK · 洛桑",
      date: "2011 – 2012",
      desc: "学生兼职。",
    },
  },
  education: {
    bachelor: {
      title: "经济学与管理学士",
      date: "2023 – 在读",
      subtitle: "瑞士远程大学 · 152/180 ECTS · 5.66/6",
      courses: [
        "完整课程：已完成152 ECTS，平均成绩5.66/6",
        "经济学与政策 — 宏观经济学、微观经济学、公共经济学、产业组织",
        "财务与管理 — 货币与金融、管理控制、企业财务、国际金融、国际贸易",
        "定量方法 — 计量经济学、统计学、经济学家数学",
        "商业基础 — 财务会计、企业管理、创业学、商业法",
      ],
      thesisTitle: "学士论文",
      thesis: "房地产价格的全球决定因素：多国面板分析",
      thesisSubject: "金融周期对房地产市场的影响——国际金融冲击的传导机制",
      methodology: "研究方法",
      methodologyValue: "多元线性回归（OLS）+ 面板数据线性投影",
      dataSources: "数据来源",
      dataSourcesValue:
        "国际货币基金组织（IMF）、国际清算银行（BIS）——国际宏观经济数据集",
      tools: "工具",
      toolsValue: "R语言（tidyverse：dplyr, tidyr）",
      focus: "研究重点",
      focusValue: "宏观审慎措施和资本管制对国际金融冲击的稳定效应",
    },
    china: {
      title: "中文课程 — CSC奖学金获得者",
      date: "2025 – 在读",
      subtitle: "四川大学 · 中国成都 · 全中文沉浸式学习",
      csc: "CSC奖学金获得者 — 中国政府竞争性奖学金项目",
      intensive: "强化语言课程（每周25+小时）",
      gpa: "GPA 4.0/4.0",
      gpaDesc: "第一学期所有课程",
      immersion: "完全沉浸式学习：课程、日常生活和社交互动100%使用中文",
      adaptability:
        "通过直接融入中国学术和社交环境，培养了强大的跨文化适应能力",
    },
    cfc: {
      title: "计算机科学CFC证书",
      date: "2015 – 2017",
      subtitle: "CPNV · 5.3/6",
      desc:
        "全面的通识培训：开发（C#、JavaScript、PHP）、数据库（SQL）、网络、系统（Windows/Linux）、技术支持",
    },
    epfl: {
      title: "洛桑联邦理工学院（EPFL）",
      date: "2011 – 2015",
      subtitle: "微技术 · 预科 4.41/6 · 学士未完成",
      desc:
        "工程基础训练：编程（C）、数学、物理、统计学——在职业转型前打下了扎实的分析基础",
    },
  },
  skills: {
    data: {
      title: "📊 数据与分析",
      tags: [
        "R语言",
        "SQL",
        "Excel",
        "Python",
        "线性回归",
        "面板数据分析",
        "OLS",
        "统计建模",
      ],
    },
    econometrics: {
      title: "📈 计量经济学",
      tags: ["多元分析", "时间序列", "固定效应模型", "稳健性分析"],
    },
    it: {
      title: "🖥️ IT基础设施",
      tags: [
        "资产管理（10K+设备）",
        "大规模部署",
        "系统管理",
        "事件管理",
        "二级技术支持",
      ],
    },
    finance: {
      title: "💰 金融",
      tags: ["财务分析", "DCF模型", "可比公司分析"],
    },
    economics: {
      title: "📉 经济学",
      tags: ["宏观经济学", "计量经济学", "国际金融"],
    },
    accounting: {
      title: "📋 会计",
      tags: ["财务会计", "管理控制"],
    },
    programming: {
      title: "💻 编程",
      tags: ["PowerShell", "C#", "PHP", "JavaScript"],
    },
    soft: {
      title: "🤝 软技能",
      tags: [
        "严谨细致",
        "用户支持",
        "保密意识",
        "文档编写",
        "综合分析",
        "跨文化适应",
        "国际流动性",
        "团队协作",
      ],
    },
    languages: {
      title: "🌍 语言",
      french: { name: "法语", level: "母语" },
      portuguese: { name: "葡萄牙语", level: "母语" },
      english: { name: "英语", level: "流利（IELTS 8/9）" },
      chinese: { name: "中文", level: "中级" },
    },
  },
  hobbies: {
    music: {
      title: "音乐制作",
      desc:
        "赛博金属/工业金属艺术家 — 3张自主制作专辑，独立作曲与录制，偶有2-3次合作",
      link: "在Spotify上收听",
    },
    gaming: {
      title: "电子游戏",
      desc: "热爱探索虚拟世界和互动叙事的玩家",
    },
    travel: {
      title: "旅行",
      desc: "探索新的文化和目的地。近期重点关注亚太地区",
    },
    cycling: {
      title: "骑行",
      desc: "享受户外骑行的乐趣",
    },
    language: {
      title: "语言学习",
      desc: "目前正在沉浸式学习中文",
    },
  },
  contact: {
    intro:
      "我正在寻找IT技术支持或经济金融分析类岗位，希望充分发挥IT+经济双背景的优势。欢迎2026年8月开始的实习和初级职位机会。",
    emailLabel: "电子邮件",
    locationLabel: "所在地",
    footer: "© 2026 Jorge Paula Pinheiro · 使用 Bun 与 pretext 构建",
  },
  ui: {
    skipLink: "跳到内容",
    languageNav: "语言",
    theme: {
      light: "主题：浅色",
      dark: "主题：深色",
    },
  },
};

const zhHant: Translation = {
  meta: {
    description:
      "Jorge Paula Pinheiro — 擁有8年IT背景的經濟學學生，正轉向經濟與金融分析。常駐瑞士洛桑，目前為成都的CSC獎學金學者。",
  },
  nav: {
    about: "關於我",
    experience: "經歷",
    education: "學歷",
    skills: "技能",
    hobbies: "興趣",
    contact: "聯絡",
  },
  hero: {
    greeting: "你好，我是",
    title: "經濟學 · 資料 · IT — 2026年8月可到職",
    location: "📍 目前在中國成都 · 常駐瑞士洛桑 · 🎓 經濟學學士",
    ctaPrimary: "聯絡我",
    ctaSecondary: "瞭解更多",
  },
  about: {
    p1:
      "我是一名擁有紮實資訊科技專業背景的經濟學學生，目前正透過瑞士遠距大學完成學士學位，同時在中國成都參加密集中文課程。",
    p2:
      "我的目標是從事IT技術支援或經濟金融分析類職位，充分發揮IT+經濟雙背景的獨特優勢。我的背景結合了8年IT基礎架構經驗，以及計量經濟學、總體經濟學與金融建模方面的嚴謹量化訓練。",
    p3: "目前在中國成都，作為CSC獎學金得主修讀密集中文課程。常駐瑞士洛桑。",
    stats: {
      years: "年IT經驗",
      gpa: "成績 / 6",
      languages: "語言",
      ects: "已修學分",
    },
  },
  experience: {
    chuv: {
      title: "IT技術員",
      company: "CHUV — 洛桑大學中心醫院",
      date: "2017 – 2025",
      items: [
        "透過SCCM管理IT設備群（10,000+台）：安裝、維護與軟硬體故障排除",
        "透過AirWatch / Workspace ONE設定與部署iPhone",
        "透過Agile Provisioning設定Cisco電話",
        "處理醫療設備與非標準系統的維護作業",
        "負責服務台支援並協助使用者：診斷與排除事件",
        "印表機與網路周邊設備故障排除",
        "為團隊撰寫並標準化技術作業程序",
        "在壓力下依優先順序與截止期限有條理地工作",
      ],
    },
    studentJobsTitle: "學生兼職",
    galexis: {
      title: "倉儲人員",
      company: "Galexis SA · 瑞士沃州埃屈布朗",
      date: "2014 – 2017",
      desc: "半工半讀。提供物流支援並參與藥品經銷業務。",
    },
    uber: {
      title: "Uber Pop司機",
      company: "Uber · 自由接案",
      date: "2016 – 2017",
      desc: "半工半讀。",
    },
    gfk: {
      title: "客服中心接線員",
      company: "GFK · 洛桑",
      date: "2011 – 2012",
      desc: "學生兼職。",
    },
  },
  education: {
    bachelor: {
      title: "經濟與管理學士",
      date: "2023 – 就讀中",
      subtitle: "瑞士遠距大學 · 152/180 ECTS · 5.66/6",
      courses: [
        "完整課程：已修畢152 ECTS，平均成績5.66/6",
        "經濟學與政策 — 總體經濟學、個體經濟學、公共經濟學、產業組織",
        "財務與管理 — 貨幣與金融、管理控制、公司理財、國際金融、國際貿易",
        "量化方法 — 計量經濟學、統計學、經濟學家數學",
        "商業基礎 — 財務會計、企業管理、創業學、商事法",
      ],
      thesisTitle: "學士論文",
      thesis: "房地產價格的全球決定因素：多國面板資料分析",
      thesisSubject: "金融循環對房地產市場的影響——國際金融衝擊的傳導機制",
      methodology: "研究方法",
      methodologyValue: "多元線性迴歸（OLS）+ 面板資料線性投影",
      dataSources: "資料來源",
      dataSourcesValue:
        "國際貨幣基金組織（IMF）、國際清算銀行（BIS）——國際總體經濟資料集",
      tools: "工具",
      toolsValue: "R語言（tidyverse：dplyr, tidyr）",
      focus: "研究重點",
      focusValue: "總體審慎措施與資本管制對國際金融衝擊的穩定效果",
    },
    china: {
      title: "中文課程 — CSC獎學金得主",
      date: "2025 – 就讀中",
      subtitle: "四川大學 · 中國成都 · 全中文沉浸式學習",
      csc: "CSC獎學金得主 — 中國政府競爭性獎學金計畫",
      intensive: "密集語言課程（每週25+小時）",
      gpa: "GPA 4.0/4.0",
      gpaDesc: "第一學期所有課程",
      immersion: "完全沉浸式學習：課程、日常生活與社交互動100%使用中文",
      adaptability:
        "透過直接融入中國學術與社交環境，培養出強大的跨文化適應能力",
    },
    cfc: {
      title: "資訊科學CFC證書",
      date: "2015 – 2017",
      subtitle: "CPNV · 5.3/6",
      desc:
        "全面的通才訓練：開發（C#、JavaScript、PHP）、資料庫（SQL）、網路、系統（Windows/Linux）、技術支援",
    },
    epfl: {
      title: "洛桑聯邦理工學院（EPFL）",
      date: "2011 – 2015",
      subtitle: "微技術 · 預科 4.41/6 · 學士未完成",
      desc:
        "工程基礎訓練：程式設計（C）、數學、物理、統計學——在職涯轉換前打下紮實的分析基礎",
    },
  },
  skills: {
    data: {
      title: "📊 資料與分析",
      tags: [
        "R語言",
        "SQL",
        "Excel",
        "Python",
        "線性迴歸",
        "面板資料分析",
        "OLS",
        "統計建模",
      ],
    },
    econometrics: {
      title: "📈 計量經濟學",
      tags: ["多元分析", "時間序列", "固定效果模型", "穩健性分析"],
    },
    it: {
      title: "🖥️ IT基礎架構",
      tags: [
        "資產管理（10K+設備）",
        "大規模部署",
        "系統管理",
        "事件管理",
        "二線技術支援",
      ],
    },
    finance: {
      title: "💰 金融",
      tags: ["財務分析", "DCF模型", "可比公司分析"],
    },
    economics: {
      title: "📉 經濟學",
      tags: ["總體經濟學", "計量經濟學", "國際金融"],
    },
    accounting: {
      title: "📋 會計",
      tags: ["財務會計", "管理控制"],
    },
    programming: {
      title: "💻 程式設計",
      tags: ["PowerShell", "C#", "PHP", "JavaScript"],
    },
    soft: {
      title: "🤝 軟實力",
      tags: [
        "嚴謹細心",
        "使用者支援",
        "保密意識",
        "文件撰寫",
        "綜合分析",
        "跨文化適應",
        "國際移動力",
        "團隊合作",
      ],
    },
    languages: {
      title: "🌍 語言",
      french: { name: "法語", level: "母語" },
      portuguese: { name: "葡萄牙語", level: "母語" },
      english: { name: "英語", level: "流利（IELTS 8/9）" },
      chinese: { name: "中文", level: "中級" },
    },
  },
  hobbies: {
    music: {
      title: "音樂製作",
      desc:
        "賽博金屬/工業金屬藝術家 — 3張自製專輯，獨立作曲與錄音，偶有2-3次合作",
      link: "在Spotify上收聽",
    },
    gaming: {
      title: "電玩遊戲",
      desc: "熱愛探索虛擬世界與互動敘事的玩家",
    },
    travel: {
      title: "旅行",
      desc: "探索新的文化與目的地。近期聚焦亞太地區",
    },
    cycling: {
      title: "單車",
      desc: "享受戶外騎乘的樂趣",
    },
    language: {
      title: "語言學習",
      desc: "目前正沉浸式學習中文",
    },
  },
  contact: {
    intro:
      "我正在尋找IT技術支援或經濟金融分析類職位，希望充分發揮IT+經濟雙背景的優勢。歡迎2026年8月起的實習與初階職位機會。",
    emailLabel: "電子郵件",
    locationLabel: "所在地",
    footer: "© 2026 Jorge Paula Pinheiro · 以 Bun 與 pretext 打造",
  },
  ui: {
    skipLink: "跳至內容",
    languageNav: "語言",
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
