# Repository Guidelines

## Project Structure & Module Organization
This repository is a Hexo blog. Write posts under `source/_posts/`, grouped by topic folders when useful (for example `source/_posts/Linux/`). Reusable post templates live in `scaffolds/`. Site-wide settings belong in [`_config.yml`](/home/cory/tools/coolshin.work.gd/_config.yml), while theme-specific configuration and templates live under `themes/pure/`. Theme layouts are in `themes/pure/layout/`, static assets in `themes/pure/source/`, and bundled data pages in `themes/pure/_source/`. Do not edit generated output such as `public/`, `db.json`, or dependencies in `node_modules/`.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Use `npm run server` to start the local Hexo dev server, usually at `http://localhost:4000`. Use `npm run build` to generate the static site into `public/`. Use `npm run clean` before a rebuild if stale output is suspected. `npm run deploy` is wired to Hexo deploy support, but requires deployment settings in `_config.yml` before it is usable.

## Coding Style & Naming Conventions
Write Markdown with clear front matter and concise filenames; this site currently uses Chinese titles directly in filenames, which is acceptable. Keep YAML indentation to two spaces. Preserve existing Hexo and EJS conventions in `themes/pure/`; template partials use lowercase filenames such as `archive-post.ejs`. Prefer small, targeted theme edits instead of reformatting vendor files broadly.

## Testing Guidelines
There is no automated test suite in the root project. Treat `npm run build` as the required verification step for every content or theme change, and use `npm run server` for manual checks of navigation, post rendering, and asset loading. When editing templates or CSS, verify at least the home page, a post page, and one archive-style page.

## Commit & Pull Request Guidelines
The embedded `themes/pure` history uses short, conventional subjects such as `feat: ...`, `fix: ...`, and `Update README.md`; follow that style for this repository. Keep commits focused and imperative, for example `feat: add Linux memory troubleshooting post`. Pull requests should include a short summary, note any config or content paths changed, link related issues if present, and add screenshots for visible theme or layout changes.
