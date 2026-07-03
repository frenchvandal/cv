/** @jsxImportSource react */
import { useEffect, useState } from 'react';
import type { Lang } from '../data/translations.ts';

/**
 * Sticky site header (a React island).
 *
 * It owns the three pieces of behaviour that genuinely need client-side state:
 *  - a condensed/elevated style once the page is scrolled,
 *  - active-section tracking via IntersectionObserver (drives `aria-current`),
 *  - a persisted auto/light/dark theme toggle.
 *
 * Smooth scrolling and header-offset anchoring stay in CSS (`scroll-behavior`
 * + `scroll-margin-top`), so in-page navigation is plain, accessible `<a>`s.
 */

export interface NavItem {
  /** The id of the section this link targets (without `#`). */
  id: string;
  label: string;
}

export interface LangLink {
  code: Lang;
  label: string;
  href: string;
  current: boolean;
}

export interface SiteHeaderProps {
  logo: string;
  homeHref: string;
  navItems: NavItem[];
  langLinks: LangLink[];
  labels: {
    primaryNav: string;
    languageNav: string;
    theme: { auto: string; light: string; dark: string };
  };
}

type Theme = 'auto' | 'light' | 'dark';
const THEME_ORDER: readonly Theme[] = ['auto', 'light', 'dark'];
const THEME_STORAGE_KEY = 'theme';

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') {
    delete root.dataset.theme;
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    root.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'auto';
}

export default function SiteHeader({ logo, homeHref, navItems, langLinks, labels }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('auto');

  // Sync the toggle with whatever the no-flash inline script already applied.
  useEffect(() => setTheme(readStoredTheme()), []);

  useEffect(() => {
    const onScroll = () => setScrolled(globalThis.scrollY > 8);
    onScroll();
    globalThis.addEventListener('scroll', onScroll, { passive: true });
    return () => globalThis.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      // Trip the active state as a section crosses the vertical middle.
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [navItems]);

  const cycleTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]!;
    setTheme(next);
    applyTheme(next);
  };

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="site-header__inner">
        <a className="brand" href={homeHref}>{logo}</a>

        <nav className="primary-nav" aria-label={labels.primaryNav}>
          <ul className="primary-nav__list">
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  className="primary-nav__link"
                  href={`#${item.id}`}
                  aria-current={activeId === item.id ? 'true' : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <nav className="lang-switch" aria-label={labels.languageNav}>
            <ul className="lang-switch__list">
              {langLinks.map((link) => (
                <li key={link.code}>
                  <a
                    className={`lang-switch__link${link.current ? ' is-current' : ''}`}
                    href={link.href}
                    lang={link.code}
                    hrefLang={link.code}
                    aria-current={link.current ? 'page' : undefined}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            className="theme-toggle"
            onClick={cycleTheme}
            aria-label={labels.theme[theme]}
            title={labels.theme[theme]}
          >
            <ThemeIcon theme={theme} />
          </button>
        </div>
      </div>
    </header>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 16 16',
    fill: 'currentColor',
    'aria-hidden': true,
    focusable: false,
  } as const;

  if (theme === 'light') {
    return (
      <svg {...common}>
        <path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.657-8.157a.75.75 0 0 1 0 1.061l-1.061 1.06a.749.749 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.061 0Zm-9.193 9.193a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 0 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8Zm13 0a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8ZM8 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13ZM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.751.751 0 0 1-1.06 1.06l-1.061-1.06a.75.75 0 0 1 0-1.061Zm9.193 9.193a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061Z" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg {...common}>
        <path d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM2.5 8a5.5 5.5 0 0 1 5.5-5.5v11A5.5 5.5 0 0 1 2.5 8Z" />
    </svg>
  );
}
