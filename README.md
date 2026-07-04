# Jorge Paula Pinheiro — Portfolio

A measurement-driven, trilingual portfolio website. The layout geometry is computed from the actual text content using [pretext](https://github.com/chenglou/pretext), so the typography drives the grid rather than the other way around.

## 🚀 Features

- **Measurement-driven layout**: Column widths, hero scale, and section title sizes are derived from pretext measurements of the real content.
- **Trilingual**: Full content in English, French, and Simplified Chinese with a single click.
- **Original design**: No design-system dependencies — custom CSS, custom components, and a typographic grid.
- **Dark / light theme**: Toggle between themes; preference is persisted in `localStorage`.
- **Responsive**: Adapts from wide desktop to mobile with a single-column layout.
- **Fast**: Built with Vite and served as a static site.
- **Auto-deploy**: GitHub Actions deploys to GitHub Pages on every push to `main`.

## 🛠 Tech Stack

- [Vite](https://vitejs.dev/) 6
- [Bun](https://bun.sh/) 1.3+
- [TypeScript](https://www.typescriptlang.org/) 6
- [pretext](https://github.com/chenglou/pretext) 0.0.8 — text measurement & layout
- [Noto Sans](https://fonts.google.com/noto) & Noto Sans SC via Google Fonts
- GitHub Actions for CI/CD

## 📦 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.0.0 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/jorgepaulapinheiro/CV.git
cd CV

# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

## 🏗 Project Structure

```
src/
  data/
    translations.ts   # Trilingual content source of truth
  lib/
    pretext.ts        # pretext wrappers and font helpers
    layout.ts         # Measurement-driven layout engine
    render.ts         # Template-based renderer
  styles/
    global.css        # Custom design tokens & layout
  types/
    vite.d.ts         # Vite ambient types
  main.ts             # App bootstrap, theme & language state
index.html            # App shell with font preconnect
vite.config.ts        # Vite config (base: /cv/)
```

## 🚀 Deployment

The site is automatically deployed to GitHub Pages when you push to the `main` branch.

To enable this:
1. Go to your repository settings on GitHub.
2. Navigate to the **Pages** section.
3. Set **Source** to "GitHub Actions".
4. The workflow will handle the rest.

## 📝 Content Updates

To update your portfolio:
1. Edit `src/data/translations.ts`.
2. Commit and push to `main`.
3. GitHub Actions will automatically rebuild and deploy.

## 📄 License

© 2026 Jorge Paula Pinheiro. All rights reserved.
