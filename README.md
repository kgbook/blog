# coolshin blog

Personal Zola blog for `coolshin`, using a local `simple-pure` theme and deployed with GitHub Pages.

## Stack

- Zola
- Local theme: `themes/simple-pure`
- GitHub Pages via GitHub Actions

## Local development

Install `zola` first, then run:

```bash
zola serve --interface 127.0.0.1 --port 1111
```

Build the static site into `public/`:

```bash
zola build
```

Check templates and links:

```bash
zola check
```

Clean generated files:

```bash
rm -rf public
```

## Content structure

- Site config: `config.toml`
- Posts: `content/blog/`
- Standalone pages: `content/about.md`, `content/archives.md`
- Theme templates and assets: `themes/simple-pure/`

## Deployment

This repository uses GitHub Pages Actions from [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

- Site URL: https://kgbook.github.io/blog/
- Pages source: GitHub Actions

Push to `main` to trigger a Pages deployment after the repository is connected to GitHub Pages with `GitHub Actions` as the publishing source.
