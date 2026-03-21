# coolshin blog

Personal Hexo blog for `coolshin`, built with the `pure` theme and deployed with GitHub Pages.

## Stack

- Hexo 8
- EJS-based `pure` theme
- GitHub Pages via GitHub Actions

## Local development

Install dependencies and start the local server:

```bash
npm install
npm run server
```

Build the static site into `public/`:

```bash
npm run build
```

Clean generated files before a fresh build:

```bash
npm run clean
```

## Content structure

- Posts: `source/_posts/`
- Standalone pages: `source/about/`, `source/categories/`, `source/tags/`
- Hexo scaffolds: `scaffolds/`
- Theme customization: `themes/pure/`

## Deployment

This repository uses GitHub Pages Actions from [`.github/workflows/pages.yml`](/home/cory/tools/coolshin.work.gd/.github/workflows/pages.yml).

- Site URL: `https://coolshin.work.gd`
- Custom domain file: `source/CNAME`

Push to `main` to trigger a Pages deployment after the repository is connected to GitHub Pages with `GitHub Actions` as the publishing source.
