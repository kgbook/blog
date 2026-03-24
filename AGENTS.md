# Repository Guidelines

## Project Structure & Module Organization
This repository is a Zola blog. Write posts under `content/blog/`, using page bundles when a post has local images. Standalone pages live directly under `content/`, and site-wide settings belong in [`config.toml`](/Users/dl/tools/blog/config.toml). Theme-specific templates and assets live under `themes/simple-pure/`, with templates in `themes/simple-pure/templates/` and static assets in `themes/simple-pure/static/`. Do not edit generated output such as `public/`.

## Build, Test, and Development Commands
Install `zola` locally. Use `zola serve` to start the local dev server, usually at `http://127.0.0.1:1111`. Use `zola build` to generate the static site into `public/`. Use `rm -rf public` before a rebuild if stale output is suspected. Use `zola check` for template and link validation.

## Coding Style & Naming Conventions
Write Markdown with clear front matter and concise filenames. Keep TOML indentation consistent with the existing files. Preserve the current Zola and Tera template conventions in `themes/simple-pure/`; template filenames use lowercase names such as `base.html` and `taxonomy_single.html`. Prefer small, targeted theme edits instead of broad restyling.

## Testing Guidelines
There is no automated test suite in the root project. Treat `zola build` as the required verification step for every content or theme change, and use `zola serve` for manual checks of navigation, post rendering, and asset loading. When editing templates or CSS, verify at least the home page, a post page, and one archive-style page.

## Commit & Pull Request Guidelines
Follow short, conventional commit subjects such as `feat: ...` and `fix: ...`. Keep commits focused and imperative, for example `feat: migrate blog to zola`. Pull requests should include a short summary, note any config, content, or template paths changed, link related issues if present, and add screenshots for visible theme or layout changes.
