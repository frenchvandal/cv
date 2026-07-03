import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// https://astro.build/config
// Static site deployed to GitHub Pages at https://frenchvandal.github.io/cv/
export default defineConfig({
  site: 'https://frenchvandal.github.io',
  base: '/cv/',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'zh'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [react()],
  build: {
    format: 'directory',
  },
});
