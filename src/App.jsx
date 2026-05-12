import { useEffect, useState } from 'react'
import './portfolio.css'

const translations = {
  en: {
    nav: {
      about: 'About',
      education: 'Education',
      experience: 'Experience',
      skills: 'Skills',
      hobbies: 'Hobbies',
      contact: 'Contact'
    },
    hero: {
      greeting: "Hello, I'm",
      title: 'Economics · Data · IT — Available August 2026',
      location: '📍 Currently in Chengdu, China · Based in Lausanne, Switzerland · 🎓 Bachelor in Economics',
      ctaPrimary: 'Get in Touch',
      ctaSecondary: 'Learn More'
    },
    about: {
      tag: 'About Me',
      title: 'Bridging Technology & Economics',
      p1: "Economics student with solid professional experience in information technology, currently completing my bachelor's degree while engaged in an intensive language program abroad alongside my studies.",
      p2: 'I aim to pivot my career toward economic and financial analysis, leveraging both my technical skills and academic training. My background combines 8 years of IT infrastructure experience with rigorous quantitative training in econometrics, macroeconomics, and financial modeling.',
      p3: 'Currently in Chengdu, China, completing an intensive Mandarin program as a CSC Scholarship recipient. Based in Lausanne, Switzerland.',
      stats: {
        years: 'Years IT Experience',
        gpa: 'Grade / 6',
        languages: 'Languages',
        ects: 'ECTS Earned'
      }
    },
    education: {
      tag: 'Education',
      title: 'Academic Background',
      bachelor: {
        title: 'Bachelor in Economics and Management',
        date: '2023 – Present',
        subtitle: 'UniDistance Switzerland · 152/180 ECTS · 5.66/6',
        courses: [
          'Curriculum: 152 ECTS completed with average 5.66/6',
          'Economics & Policy — Macroeconomics, Microeconomics, Public Economics, Industrial Organization (all 6.0/6)',
          'Finance & Control — Money & Finance, Management Control, Corporate Finance, International Finance, International Trade (5.75–6.0/6)',
          'Quantitative Methods — Econometrics, Statistics, Mathematics for Economists (5.5–5.75/6)',
          'Business Foundations — Financial Accounting, Business Management, Entrepreneurship, Business Law'
        ],
        thesisTitle: 'Bachelor Thesis',
        thesis: 'Global Determinants of Real Estate Prices: A Multi-Country Panel Analysis',
        thesisSubject: 'Impact of financial cycles on real estate markets — transmission of international financial shocks',
        methodology: 'Methodology:',
        methodologyValue: 'Multivariate linear regressions (OLS) + Linear projections on panel data',
        dataSources: 'Data Sources:',
        dataSourcesValue: 'IMF, BIS — international macroeconomic datasets',
        tools: 'Tools:',
        toolsValue: 'R (tidyverse: dplyr, tidyr)',
        focus: 'Focus:',
        focusValue: 'Stabilizing effect of macroprudential measures and capital controls against international financial shocks'
      },
      china: {
        title: 'Chinese Language Program — CSC Scholar',
        date: '2025 – Present',
        subtitle: 'Sichuan University · Chengdu, China · Full Mandarin Immersion',
        csc: 'CSC Scholarship recipient — competitive Chinese government grant (CSC/ bilateral program)',
        gpa: 'Grade 4.0/4.0',
        gpaDesc: 'on all semester assessments',
        immersion: 'Complete immersion: coursework, daily life, and interactions 100% in Mandarin',
        adaptability: 'Developed strong cross-cultural adaptability through direct integration into Chinese academic and social environments'
      },
      cfc: {
        title: 'CFC in Computer Science',
        date: '2015 – 2017',
        subtitle: 'CPNV · 5.3/6',
        desc: "Comprehensive generalist training: development (C#, JavaScript, PHP), databases (SQL), networking, systems (Windows/Linux), technical support"
      },
      epfl: {
        title: 'EPFL — Swiss Federal Institute of Technology',
        date: '2011 – 2015',
        subtitle: 'Microtechnology · Propédeutique 4.41/6 · Bachelor not completed',
        desc: "Initial engineering training: programming (C), mathematics, physics, statistics — solid analytical foundation before career pivot"
      }
    },
    experience: {
      tag: 'Experience',
      title: 'Professional Journey',
      chuv: {
        title: 'IT Technician',
        company: 'CHUV — Centre Hospitalier Universitaire Vaudois, Lausanne',
        date: '2017 – 2025',
        items: [
          'IT park management (10,000+ workstations) via SCCM: installation, maintenance and hardware/software troubleshooting',
          'iPhone configuration and deployment via AirWatch / Workspace ONE',
          'Cisco phone configuration via Agile Provisioning',
          'Interventions on medical equipment and non-standard systems',
          'Helpdesk support and user assistance: diagnosis and resolution of incidents',
          'Printer and network peripheral troubleshooting',
          'Writing and standardization of technical procedures for the team',
          'Methodical work under pressure respecting priorities and deadlines'
        ]
      },
      studentJobsTitle: 'Student Jobs',
      galexis: {
        title: 'Warehouse Worker',
        company: 'Galexis SA · Écublens, Vaud',
        date: '2014 – 2017',
        desc: 'Student job alongside my studies. Logistics support and participation in pharmaceutical distribution operations.'
      },
      uber: {
        title: 'Uber Pop Driver',
        company: 'Uber · Freelance',
        date: '2016 – 2017',
        desc: 'Student job alongside my studies.'
      },
      gfk: {
        title: 'Call Center Operator',
        company: 'GFK · Lausanne',
        date: '2011 – 2012',
        desc: 'Student job.'
      }
    },
    skills: {
      tag: 'Skills',
      title: 'Competencies',
      data: {
        title: '📊 Data & Analytics',
        tags: ['R', 'SQL', 'Excel', 'Python', 'Linear Regressions', 'Panel Data Analysis', 'OLS', 'Statistical Modeling']
      },
      econometrics: {
        title: '📈 Econometrics',
        tags: ['Multivariate Analysis', 'Time Series', 'Fixed Effects Models', 'Robustness Analysis']
      },
      it: {
        title: '🖥️ IT Infrastructure',
        tags: ['Asset Management (10K+ devices)', 'Large-Scale Deployment', 'System Administration', 'Incident Management', 'Helpdesk L2']
      },
      finance: {
        title: '💰 Finance',
        tags: ['Financial Analysis', 'DCF Models', 'Comparables']
      },
      economics: {
        title: '📉 Economics',
        tags: ['Macroeconomics', 'Econometrics', 'Int. Finance']
      },
      accounting: {
        title: '📋 Accounting',
        tags: ['Financial Accounting', 'Management Control']
      },
      programming: {
        title: '💻 Programming',
        tags: ['PowerShell', 'C#', 'PHP', 'JavaScript']
      },
      soft: {
        title: '🤝 Soft Skills',
        tags: ['Rigorous', 'User Support', 'Confidentiality', 'Documentation', 'Synthesis', 'Cross-cultural Adaptability', 'International Mobility', 'Collaboration']
      },
      languages: {
        title: '🌍 Languages',
        french: { name: 'French', level: 'Native' },
        portuguese: { name: 'Portuguese', level: 'Native' },
        english: { name: 'English', level: 'Fluent (IELTS 8/9)' },
        chinese: { name: 'Chinese', level: 'Intermediate' }
      }
    },
    hobbies: {
      tag: 'Beyond Work',
      title: 'Hobbies & Interests',
      music: {
        title: 'Music Production',
        desc: 'Cyber Metal / Industrial Metal artist — 3 self-produced albums, solo composition & recording, 2-3 occasional collaborations',
        link: 'Listen on Spotify →'
      },
      gaming: {
        title: 'Video Games',
        desc: 'Passionate gamer exploring virtual worlds and interactive storytelling'
      },
      travel: {
        title: 'Traveling',
        desc: 'Exploring new cultures and destinations. Recent focus on Asia-Pacific region'
      },
      cycling: {
        title: 'Cycling',
        desc: 'Enjoying the outdoors on two wheels'
      },
      language: {
        title: 'Language Learning',
        desc: 'Currently immersed in Mandarin Chinese'
      }
    },
    contact: {
      tag: 'Get in Touch',
      title: "Let's Connect",
      intro: "I'm currently looking for opportunities at the intersection of economics and technology — data-driven roles where I can leverage both my IT experience and economic training. Open to internships and entry-level positions starting August 2026.",
      footer: '© 2026 Jorge Paula Pinheiro · Built with React'
    }
  },
  fr: {
    nav: {
      about: 'À propos',
      education: 'Formation',
      experience: 'Expérience',
      skills: 'Compétences',
      hobbies: 'Loisirs',
      contact: 'Contact'
    },
    hero: {
      greeting: "Bonjour, je suis",
      title: 'Économie · Data · IT — Disponible août 2026',
      location: '📍 Actuellement à Chengdu, Chine · Basé à Lausanne, Suisse · 🎓 Bachelor en Économie',
      ctaPrimary: 'Me contacter',
      ctaSecondary: 'En savoir plus'
    },
    about: {
      tag: 'À propos',
      title: 'Allier Technologie & Économie',
      p1: "Étudiant en économie avec une solide expérience professionnelle en informatique, actuellement en fin de bachelor tout en suivant un programme intensif de langue à l'étranger en parallèle de mes études.",
      p2: "Je vise à réorienter ma carrière vers l'analyse économique et financière, en m'appuyant à la fois sur mes compétences techniques et ma formation académique. Mon parcours combine 8 ans d'expérience en infrastructure IT avec une formation quantitative rigoureuse en économétrie, macroéconomie et modélisation financière.",
      p3: "Actuellement à Chengdu, Chine, en tant que boursier CSC suivant un programme intensif de mandarin. Basé à Lausanne, Suisse.",
      stats: {
        years: "Années d'exp. IT",
        gpa: 'Note / 6',
        languages: 'Langues',
        ects: 'ECTS Acquis'
      }
    },
    education: {
      tag: 'Formation',
      title: 'Parcours Académique',
      bachelor: {
        title: 'Bachelor en Économie et Management',
        date: '2023 – Présent',
        subtitle: 'UniDistance Suisse · 152/180 ECTS · 5.66/6',
        courses: [
          'Programme complet : 152 ECTS acquis, moyenne 5.66/6',
          'Économie & Politique — Macroéconomie, Microéconomie, Économie publique, Organisation industrielle (toutes 6.0/6)',
          'Finance & Contrôle — Monnaie et finance, Contrôle de gestion, Finance d\'entreprise, Finance internationale, Commerce international (5.75–6.0/6)',
          'Méthodes quantitatives — Économétrie, Statistiques, Mathématiques pour économistes (5.5–5.75/6)',
          'Fondements business — Comptabilité financière, Gestion des entreprises, Entrepreneuriat, Droit de l\'entreprise'
        ],
        thesisTitle: 'Mémoire de Bachelor',
        thesis: 'Déterminants globaux des prix immobiliers : Une analyse de panel multi-pays',
        thesisSubject: "Impact des cycles financiers sur les marchés immobiliers — transmission des chocs financiers internationaux",
        methodology: 'Méthodologie :',
        methodologyValue: 'Régressions linéaires multivariées (MCO) + Projections linéaires sur données de panel',
        dataSources: 'Sources de données :',
        dataSourcesValue: 'FMI, BRI — jeux de données macroéconomiques internationaux',
        tools: 'Outils :',
        toolsValue: 'R (tidyverse : dplyr, tidyr)',
        focus: 'Objet d\'étude :',
        focusValue: "Effet stabilisateur des mesures macroprudentielles et des contrôles de capitaux contre les chocs financiers internationaux"
      },
      china: {
        title: 'Programme de Chinois — Boursier CSC',
        date: '2025 – Présent',
        subtitle: 'Université du Sichuan · Chengdu, Chine · Immersion complète en mandarin',
        csc: 'Boursier CSC — bourse gouvernementale chinoise compétitive (programme CSC/bilatéral)',
        gpa: 'Note 4.0/4.0',
        gpaDesc: 'à tous les semestres',
        immersion: 'Immersion totale : cours, vie quotidienne et interactions 100% en mandarin',
        adaptability: "Développement d'une forte capacité d'adaptation interculturelle par intégration directe dans les environnements académiques et sociaux chinois"
      },
      cfc: {
        title: 'CFC en Informatique',
        date: '2015 – 2017',
        subtitle: 'CPNV · 5.3/6',
        desc: "Formation généraliste complète : développement (C#, JavaScript, PHP), bases de données (SQL), réseaux, systèmes (Windows/Linux), support technique"
      },
      epfl: {
        title: 'EPFL — École polytechnique fédérale de Lausanne',
        date: '2011 – 2015',
        subtitle: 'Microtechnique · Propédeutique 4.41/6 · Bachelor non terminé',
        desc: "Formation initiale en ingénierie : programmation (C), mathématiques, physique, statistiques — base analytique solide avant réorientation"
      }
    },
    experience: {
      tag: 'Expérience',
      title: 'Parcours Professionnel',
      chuv: {
        title: 'Informaticien',
        company: 'CHUV — Centre Hospitalier Universitaire Vaudois, Lausanne',
        date: '2017 – 2025',
        items: [
          "Gestion du parc informatique (10 000+ postes) via SCCM : installation, maintenance et dépannage hardware et software",
          "Configuration et déploiement d'iPhone via AirWatch / Workspace ONE",
          "Configuration de téléphones Cisco via Agile Provisioning",
          "Interventions sur du matériel médical et des systèmes non standards",
          "Tenue du guichet support et assistance aux utilisateurs : diagnostic et résolution des incidents",
          "Dépannage des imprimantes et des périphériques réseau",
          "Rédaction et standardisation de procédures techniques pour l'équipe",
          "Travail méthodique sous pression avec respect des priorités et des délais"
        ]
      },
      studentJobsTitle: 'Jobs Étudiants',
      galexis: {
        title: 'Manutentionnaire',
        company: 'Galexis SA · Écublens, Vaud',
        date: '2014 – 2017',
        desc: "Job étudiant en parallèle des études. Support logistique et participation aux opérations de distribution pharmaceutique."
      },
      uber: {
        title: 'Chauffeur Uber Pop',
        company: 'Uber · Freelance',
        date: '2016 – 2017',
        desc: 'Job étudiant en parallèle des études.'
      },
      gfk: {
        title: 'Opérateur Call Center',
        company: 'GFK · Lausanne',
        date: '2011 – 2012',
        desc: 'Job étudiant.'
      }
    },
    skills: {
      tag: 'Compétences',
      title: 'Compétences',
      data: {
        title: '📊 Data & Analytics',
        tags: ['R', 'SQL', 'Excel', 'Python', 'Régressions Linéaires', "Analyse de Données de Panel", 'MCO', 'Modélisation Statistique']
      },
      econometrics: {
        title: '📈 Économétrie',
        tags: ['Analyse Multivariée', 'Séries Temporelles', 'Modèles à Effets Fixes', 'Analyse de Robustesse']
      },
      it: {
        title: '🖥️ Infrastructure IT',
        tags: ['Gestion de Parc (10K+ postes)', 'Déploiement Large Échelle', 'Administration Système', 'Gestion des Incidents', 'Support Niveau 2']
      },
      finance: {
        title: '💰 Finance',
        tags: ['Analyse Financière', 'Modèles DCF', 'Comparables']
      },
      economics: {
        title: '📉 Économie',
        tags: ['Macroéconomie', 'Économétrie', 'Finance Internationale']
      },
      accounting: {
        title: '📋 Comptabilité',
        tags: ['Comptabilité Financière', 'Contrôle de Gestion']
      },
      programming: {
        title: '💻 Programmation',
        tags: ['PowerShell', 'C#', 'PHP', 'JavaScript']
      },
      soft: {
        title: '🤝 Soft Skills',
        tags: ['Rigueur', 'Support Utilisateurs', 'Confidentialité', 'Documentation', 'Synthèse', 'Adaptabilité Interculturelle', 'Mobilité Internationale', 'Collaboration']
      },
      languages: {
        title: '🌍 Langues',
        french: { name: 'Français', level: 'Langue maternelle' },
        portuguese: { name: 'Portugais', level: 'Langue maternelle' },
        english: { name: 'Anglais', level: 'Courant (IELTS 8/9)' },
        chinese: { name: 'Chinois', level: 'Intermédiaire' }
      }
    },
    hobbies: {
      tag: 'Au-delà du Travail',
      title: 'Loisirs & Intérêts',
      music: {
        title: 'Production Musicale',
        desc: "Artiste Cyber Metal / Metal Industriel — 3 albums auto-produits, composition et enregistrement en solo, 2-3 collaborations ponctuelles",
        link: 'Écouter sur Spotify →'
      },
      gaming: {
        title: 'Jeux Vidéo',
        desc: "Gamer passionné explorant les mondes virtuels et le storytelling interactif"
      },
      travel: {
        title: 'Voyages',
        desc: "Explorer de nouvelles cultures et destinations. Focus récent sur la région Asie-Pacifique"
      },
      cycling: {
        title: 'Vélo',
        desc: "Profiter de l'extérieur sur deux roues"
      },
      language: {
        title: "Apprentissage des Langues",
        desc: 'Actuellement immergé dans le Mandarin'
      }
    },
    contact: {
      tag: 'Me Contacter',
      title: 'Restons en Contact',
      intro: "Je recherche activement des opportunités à l'intersection de l'économie et de la technologie — des rôles orientés data où je peux valoriser mon expérience IT et ma formation économique. Ouvert aux stages et postes junior à partir d'août 2026.",
      footer: '© 2026 Jorge Paula Pinheiro · Construit avec React'
    }
  },
  zh: {
    nav: {
      about: '关于我',
      education: '教育',
      experience: '经历',
      skills: '技能',
      hobbies: '爱好',
      contact: '联系'
    },
    hero: {
      greeting: "你好，我是",
      title: '经济学 · 数据 · IT — 2026年8月可入职',
      location: '📍 目前在中国成都 · 常驻瑞士洛桑 · 🎓 经济学学士',
      ctaPrimary: '联系我',
      ctaSecondary: '了解更多'
    },
    about: {
      tag: '关于我',
      title: '技术与经济学的交汇',
      p1: "我是一名拥有扎实信息技术专业背景的经济学学生，目前正在通过瑞士远程大学完成学士学位，同时在中国成都参加密集型中文课程。",
      p2: "我的目标是转向经济与金融领域，充分发挥我的技术能力和学术训练。我的背景融合了8年IT基础设施经验，以及计量经济学、宏观经济学和金融建模方面的严谨定量培训。",
      p3: "目前在中国成都，作为CSC奖学金获得者完成密集型中文课程。常驻瑞士洛桑。",
      stats: {
        years: '年IT经验',
        gpa: '绩点 / 6',
        languages: '语言',
        ects: '已获学分'
      }
    },
    education: {
      tag: '教育背景',
      title: '学术经历',
      bachelor: {
        title: '经济学与管理学士',
        date: '2023 – 在读',
        subtitle: '瑞士远程大学 · 152/180 ECTS · 5.66/6',
        courses: [
          '完整课程：已完成152 ECTS，平均成绩5.66/6',
          '经济学与政策 — 宏观经济学、微观经济学、公共经济学、产业组织（均为6.0/6）',
          '财务与管理 — 货币与金融、管理控制、企业财务、国际金融、国际贸易（5.75–6.0/6）',
          '定量方法 — 计量经济学、统计学、经济学家数学（5.5–5.75/6）',
          '商业基础 — 财务会计、企业管理、创业学、商业法'
        ],
        thesisTitle: '学士论文',
        thesis: '房地产价格的全球决定因素：多国面板分析',
        thesisSubject: "金融周期对房地产市场的影响——国际金融冲击的传导机制",
        methodology: '研究方法：',
        methodologyValue: '多元线性回归（OLS）+ 面板数据线性投影',
        dataSources: '数据来源：',
        dataSourcesValue: '国际货币基金组织（IMF）、国际清算银行（BIS）——国际宏观经济数据集',
        tools: '工具：',
        toolsValue: 'R语言（tidyverse：dplyr, tidyr）',
        focus: '研究重点：',
        focusValue: '宏观审慎措施和资本管制对国际金融冲击的稳定效应'
      },
      china: {
        title: '中文课程 — CSC奖学金获得者',
        date: '2025 – 在读',
        subtitle: '四川大学 · 中国成都 · 全中文沉浸式学习',
        csc: 'CSC奖学金获得者 — 中国政府竞争性奖学金项目',
        gpa: '成绩 4.0/4.0',
        gpaDesc: '所有学期评估',
        immersion: '完全沉浸式学习：课程、日常生活和社交互动100%使用中文',
        adaptability: '通过直接融入中国学术和社交环境，培养了强大的跨文化适应能力'
      },
      cfc: {
        title: '计算机科学CFC证书',
        date: '2015 – 2017',
        subtitle: 'CPNV · 5.3/6',
        desc: "全面的通识培训：开发（C#、JavaScript、PHP）、数据库（SQL）、网络、系统（Windows/Linux）、技术支持"
      },
      epfl: {
        title: '洛桑联邦理工学院（EPFL）',
        date: '2011 – 2015',
        subtitle: '微技术 · 预科 4.41/6 · 学士未完成',
        desc: "工程基础训练：编程（C）、数学、物理、统计学——在职业转型前打下了扎实的分析基础"
      }
    },
    experience: {
      tag: '职业经历',
      title: '职业历程',
      chuv: {
        title: 'IT技术员',
        company: 'CHUV — 洛桑大学中心医院',
        date: '2017 – 2025',
        items: [
          "通过SCCM管理IT设备群（10,000+台）：安装、维护和软硬件故障排除",
          "通过AirWatch / Workspace ONE配置和部署iPhone",
          "通过Agile Provisioning配置Cisco电话",
          "对医疗设备和非标准系统进行干预",
          "负责服务台支持并协助用户：诊断和解决事件",
          "打印机和网络外设故障排除",
          "为团队编写和标准化技术程序",
          "在压力下按优先级和截止日期进行有条理的工作"
        ]
      },
      studentJobsTitle: '学生兼职',
      galexis: {
        title: '仓库工作人员',
        company: 'Galexis SA · 瑞士沃州埃屈布朗',
        date: '2014 – 2017',
        desc: '边学习边工作。提供物流支持并参与药品分销业务。'
      },
      uber: {
        title: 'Uber Pop司机',
        company: 'Uber · 自由职业',
        date: '2016 – 2017',
        desc: '边学习边工作。'
      },
      gfk: {
        title: '呼叫中心接线员',
        company: 'GFK · 洛桑',
        date: '2011 – 2012',
        desc: '学生兼职。'
      }
    },
    skills: {
      tag: '技能',
      title: '专业能力',
      data: {
        title: '📊 数据与分析',
        tags: ['R语言', 'SQL', 'Excel', 'Python', '线性回归', '面板数据分析', 'OLS', '统计建模']
      },
      econometrics: {
        title: '📈 计量经济学',
        tags: ['多元分析', '时间序列', '固定效应模型', '稳健性分析']
      },
      it: {
        title: '🖥️ IT基础设施',
        tags: ['资产管理（10K+设备）', '大规模部署', '系统管理', '事件管理', '二级技术支持']
      },
      finance: {
        title: '💰 金融',
        tags: ['财务分析', 'DCF模型', '可比公司分析']
      },
      economics: {
        title: '📉 经济学',
        tags: ['宏观经济学', '计量经济学', '国际金融']
      },
      accounting: {
        title: '📋 会计',
        tags: ['财务会计', '管理控制']
      },
      programming: {
        title: '💻 编程',
        tags: ['PowerShell', 'C#', 'PHP', 'JavaScript']
      },
      soft: {
        title: '🤝 软技能',
        tags: ['严谨细致', '用户支持', '保密意识', '文档编写', '综合分析', '跨文化适应', '国际流动性', '团队协作']
      },
      languages: {
        title: '🌍 语言',
        french: { name: '法语', level: '母语' },
        portuguese: { name: '葡萄牙语', level: '母语' },
        english: { name: '英语', level: '流利（IELTS 8/9）' },
        chinese: { name: '中文', level: '中级' }
      }
    },
    hobbies: {
      tag: '工作之余',
      title: '爱好与兴趣',
      music: {
        title: '音乐制作',
        desc: '赛博金属/工业金属艺术家 — 3张自主制作专辑，独立作曲与录制，偶有2-3次合作',
        link: '在Spotify上收听 →'
      },
      gaming: {
        title: '电子游戏',
        desc: '热爱探索虚拟世界和互动叙事的玩家'
      },
      travel: {
        title: '旅行',
        desc: '探索新的文化和目的地。近期重点关注亚太地区'
      },
      cycling: {
        title: '骑行',
        desc: '享受户外骑行的乐趣'
      },
      language: {
        title: '语言学习',
        desc: '目前正在沉浸式学习中文'
      }
    },
    contact: {
      tag: '联系我',
      title: '保持联系',
      intro: "我正在积极寻找经济学与技术交叉领域的机会——能够发挥我的IT经验和经济学训练的数据驱动型岗位。欢迎2026年8月开始的实习和初级职位机会。",
      footer: '© 2026 Jorge Paula Pinheiro · 使用React构建'
    }
  }
}

function App() {
  const [scrolled, setScrolled] = useState(false)
  const [lang, setLang] = useState('en')
  const t = translations[lang]

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' })
  }

  const setLanguage = (newLang) => {
    setLang(newLang)
  }

  return (
    <div className="portfolio">
      {/* Navigation */}
      <nav className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-logo">J. PAULA PINHEIRO</div>
          <ul className="nav-links">
            <li onClick={() => scrollTo('about')}>{t.nav.about}</li>
            <li onClick={() => scrollTo('education')}>{t.nav.education}</li>
            <li onClick={() => scrollTo('experience')}>{t.nav.experience}</li>
            <li onClick={() => scrollTo('skills')}>{t.nav.skills}</li>
            <li onClick={() => scrollTo('hobbies')}>{t.nav.hobbies}</li>
            <li onClick={() => scrollTo('contact')}>{t.nav.contact}</li>
            <li className="lang-selector">
              <div className="lang-options">
                <button 
                  className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                  onClick={() => setLanguage('en')}
                >
                  <span className="lang-label">EN</span>
                </button>
                <span className="lang-divider">/</span>
                <button 
                  className={`lang-btn ${lang === 'fr' ? 'active' : ''}`}
                  onClick={() => setLanguage('fr')}
                >
                  <span className="lang-label">FR</span>
                </button>
                <span className="lang-divider">/</span>
                <button 
                  className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
                  onClick={() => setLanguage('zh')}
                >
                  <span className="lang-label">中文</span>
                </button>
              </div>
            </li>
          </ul>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <p className="hero-greeting">{t.hero.greeting}</p>
          <h1 className="hero-name">JORGE<br/>PAULA PINHEIRO</h1>
          <p className="hero-title">
            <span className="typing">{t.hero.title}</span>
          </p>
          <p className="hero-location">{t.hero.location}</p>
          <div className="hero-buttons">
            <button onClick={() => scrollTo('contact')} className="btn-primary">{t.hero.ctaPrimary}</button>
            <button onClick={() => scrollTo('about')} className="btn-secondary">{t.hero.ctaSecondary}</button>
          </div>
        </div>
        <div className="hero-scroll" onClick={() => scrollTo('about')}>
          <span>↓</span>
        </div>
      </section>

      {/* About / Objectif */}
      <section id="about" className="section section-white">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">{t.about.tag}</span>
            <h2 className="section-title">{t.about.title}</h2>
          </div>
          <div className="about-grid">
            <div className="about-text">
              <p>{t.about.p1}</p>
              <p>{t.about.p2}</p>
              <p dangerouslySetInnerHTML={{ __html: t.about.p3 }} />
            </div>
            <div className="about-highlights">
              <div className="highlight-card">
                <span className="highlight-number">8+</span>
                <span className="highlight-label">{t.about.stats.years}</span>
              </div>
              <div className="highlight-card">
                <span className="highlight-number">5.66</span>
                <span className="highlight-label">{t.about.stats.gpa}</span>
              </div>
              <div className="highlight-card">
                <span className="highlight-number">4</span>
                <span className="highlight-label">{t.about.stats.languages}</span>
              </div>
              <div className="highlight-card">
                <span className="highlight-number">152</span>
                <span className="highlight-label">{t.about.stats.ects}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Education */}
      <section id="education" className="section section-gray">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">{t.education.tag}</span>
            <h2 className="section-title">{t.education.title}</h2>
          </div>
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <h3>{t.education.bachelor.title}</h3>
                  <span className="timeline-date">{t.education.bachelor.date}</span>
                </div>
                <p className="timeline-subtitle">{t.education.bachelor.subtitle}</p>
                <ul className="timeline-list">
                  {t.education.bachelor.courses.map((course, i) => (
                    <li key={i}>{course}</li>
                  ))}
                </ul>
                <div className="thesis-box">
                  <span className="thesis-label">{t.education.bachelor.thesisTitle}</span>
                  <p className="thesis-title">{t.education.bachelor.thesis}</p>
                  <p className="thesis-subject">
                    <em>{t.education.bachelor.thesisSubject}</em>
                  </p>
                  <div className="thesis-details">
                    <div className="thesis-item">
                      <span className="thesis-label">{t.education.bachelor.methodology}</span>
                      <span>{t.education.bachelor.methodologyValue}</span>
                    </div>
                    <div className="thesis-item">
                      <span className="thesis-label">{t.education.bachelor.dataSources}</span>
                      <span>{t.education.bachelor.dataSourcesValue}</span>
                    </div>
                    <div className="thesis-item">
                      <span className="thesis-label">{t.education.bachelor.tools}</span>
                      <span>{t.education.bachelor.toolsValue}</span>
                    </div>
                    <div className="thesis-item">
                      <span className="thesis-label">{t.education.bachelor.focus}</span>
                      <span>{t.education.bachelor.focusValue}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <h3>{t.education.china.title}</h3>
                  <span className="timeline-date">{t.education.china.date}</span>
                </div>
                <p className="timeline-subtitle">{t.education.china.subtitle}</p>
                <ul className="timeline-list">
                  <li>{t.education.china.csc}</li>
                  <li>Intensive language program (25+ hours/week) — {t.education.china.gpa} {t.education.china.gpaDesc}</li>
                  <li>{t.education.china.immersion}</li>
                  <li>{t.education.china.adaptability}</li>
                </ul>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <h3>{t.education.cfc.title}</h3>
                  <span className="timeline-date">{t.education.cfc.date}</span>
                </div>
                <p className="timeline-subtitle">{t.education.cfc.subtitle}</p>
                <p className="timeline-desc">{t.education.cfc.desc}</p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <h3>{t.education.epfl.title}</h3>
                  <span className="timeline-date">{t.education.epfl.date}</span>
                </div>
                <p className="timeline-subtitle">{t.education.epfl.subtitle}</p>
                <p className="timeline-desc">{t.education.epfl.desc}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Experience */}
      <section id="experience" className="section section-white">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">{t.experience.tag}</span>
            <h2 className="section-title">{t.experience.title}</h2>
          </div>
          <div className="experience-card">
            <div className="exp-header">
              <div>
                <h3>{t.experience.chuv.title}</h3>
                <p className="exp-company">{t.experience.chuv.company}</p>
              </div>
              <span className="exp-date">{t.experience.chuv.date}</span>
            </div>
            <ul className="exp-list">
              {t.experience.chuv.items.map((item, idx) => (
                <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </div>
          
          <div className="exp-divider">{t.experience.studentJobsTitle}</div>
          
          <div className="student-jobs">
            <div className="student-job">
              <div className="student-job-header">
                <div>
                  <h4>{t.experience.galexis.title}</h4>
                  <p>{t.experience.galexis.company}</p>
                </div>
                <span className="student-job-date">{t.experience.galexis.date}</span>
              </div>
              <p>{t.experience.galexis.desc}</p>
            </div>
            
            <div className="student-job">
              <div className="student-job-header">
                <div>
                  <h4>{t.experience.uber.title}</h4>
                  <p>{t.experience.uber.company}</p>
                </div>
                <span className="student-job-date">{t.experience.uber.date}</span>
              </div>
              <p>{t.experience.uber.desc}</p>
            </div>
            
            <div className="student-job">
              <div className="student-job-header">
                <div>
                  <h4>{t.experience.gfk.title}</h4>
                  <p>{t.experience.gfk.company}</p>
                </div>
                <span className="student-job-date">{t.experience.gfk.date}</span>
              </div>
              <p>{t.experience.gfk.desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Skills */}
      <section id="skills" className="section section-gray">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">{t.skills.tag}</span>
            <h2 className="section-title">{t.skills.title}</h2>
          </div>
          <div className="skills-grid">
            <div className="skill-category">
              <h4>{t.skills.data.title}</h4>
              <div className="skill-tags">
                {t.skills.data.tags.map((tag, idx) => (
                  <span key={idx} className="skill-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="skill-category">
              <h4>{t.skills.econometrics.title}</h4>
              <div className="skill-tags">
                {t.skills.econometrics.tags.map((tag, idx) => (
                  <span key={idx} className="skill-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="skill-category">
              <h4>{t.skills.it.title}</h4>
              <div className="skill-tags">
                {t.skills.it.tags.map((tag, idx) => (
                  <span key={idx} className="skill-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="skill-category">
              <h4>{t.skills.finance.title}</h4>
              <div className="skill-tags">
                {t.skills.finance.tags.map((tag, idx) => (
                  <span key={idx} className="skill-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="skill-category">
              <h4>{t.skills.economics.title}</h4>
              <div className="skill-tags">
                {t.skills.economics.tags.map((tag, idx) => (
                  <span key={idx} className="skill-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="skill-category">
              <h4>{t.skills.accounting.title}</h4>
              <div className="skill-tags">
                {t.skills.accounting.tags.map((tag, idx) => (
                  <span key={idx} className="skill-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="skill-category">
              <h4>{t.skills.programming.title}</h4>
              <div className="skill-tags">
                {t.skills.programming.tags.map((tag, idx) => (
                  <span key={idx} className="skill-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="skill-category">
              <h4>{t.skills.soft.title}</h4>
              <div className="skill-tags">
                {t.skills.soft.tags.map((tag, idx) => (
                  <span key={idx} className="skill-tag">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="languages-section">
            <h3>{t.skills.languages.title}</h3>
            <div className="languages-grid">
              <div className="language-item">
                <span className="lang-flag">🇫🇷</span>
                <span className="lang-name">{t.skills.languages.french.name}</span>
                <span className="lang-level">{t.skills.languages.french.level}</span>
              </div>
              <div className="language-item">
                <span className="lang-flag">🇵🇹</span>
                <span className="lang-name">{t.skills.languages.portuguese.name}</span>
                <span className="lang-level">{t.skills.languages.portuguese.level}</span>
              </div>
              <div className="language-item">
                <span className="lang-flag">🇬🇧</span>
                <span className="lang-name">{t.skills.languages.english.name}</span>
                <span className="lang-level">{t.skills.languages.english.level}</span>
              </div>
              <div className="language-item">
                <span className="lang-flag">🇨🇳</span>
                <span className="lang-name">{t.skills.languages.chinese.name}</span>
                <span className="lang-level">{t.skills.languages.chinese.level}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hobbies */}
      <section id="hobbies" className="section section-white">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">{t.hobbies.tag}</span>
            <h2 className="section-title">{t.hobbies.title}</h2>
          </div>
          <div className="hobbies-grid">
            <div className="hobby-card">
              <div className="hobby-icon">🎸</div>
              <h4>{t.hobbies.music.title}</h4>
              <p>{t.hobbies.music.desc}</p>
              <a href="https://open.spotify.com/intl-fr/artist/0CKa7wVI7tiJaFdIBNHw8T" target="_blank" rel="noopener noreferrer" className="hobby-link">{t.hobbies.music.link}</a>
            </div>
            <div className="hobby-card">
              <div className="hobby-icon">🎮</div>
              <h4>{t.hobbies.gaming.title}</h4>
              <p>{t.hobbies.gaming.desc}</p>
            </div>
            <div className="hobby-card">
              <div className="hobby-icon">✈️</div>
              <h4>{t.hobbies.travel.title}</h4>
              <p>{t.hobbies.travel.desc}</p>
            </div>
            <div className="hobby-card">
              <div className="hobby-icon">🚴</div>
              <h4>{t.hobbies.cycling.title}</h4>
              <p>{t.hobbies.cycling.desc}</p>
            </div>
            <div className="hobby-card">
              <div className="hobby-icon">🌏</div>
              <h4>{t.hobbies.language.title}</h4>
              <p>{t.hobbies.language.desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="section section-dark">
        <div className="container">
          <div className="section-header">
            <span className="section-tag section-tag-light">{t.contact.tag}</span>
            <h2 className="section-title section-title-light">{t.contact.title}</h2>
          </div>
          <div className="contact-grid">
            <div className="contact-info">
              <p className="contact-intro">{t.contact.intro}</p>
              <div className="contact-items">
                <div className="contact-item">
                  <span className="contact-icon">📍</span>
                  <span>Lausanne, Switzerland</span>
                </div>
                
                <div className="contact-item">
                  <span className="contact-icon">✉️</span>
                  <a href="mailto:jorge.paulapinheiro@gmail.com">jorge.paulapinheiro@gmail.com</a>
                </div>
              </div>
            </div>
          </div>
          <footer className="footer">
            <p>{t.contact.footer}</p>
          </footer>
        </div>
      </section>
    </div>
  )
}

export default App
