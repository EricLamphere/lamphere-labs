# lamphere-labs

Static site for [lampherelabs.com](https://lampherelabs.com), hosted on Cloudflare Pages.

## Structure

```
index.html              Homepage
product-dbt-ui/          dbt-ui product page (lampherelabs.com/product-dbt-ui)
assets/img/               Images used across pages
```

No build step — plain HTML/CSS, no framework, no package.json. Add new pages as `<folder>/index.html` so they're reachable at `lampherelabs.com/<folder>`.

## How updates go live

This repo is connected to Cloudflare Pages via Git integration, tracking the `main` branch.

1. Push to `main` (or merge a PR into it)
2. Cloudflare's GitHub webhook automatically triggers a new deployment — no CI/CD workflow in this repo, no manual build/deploy step
3. Since there's no build command, Cloudflare serves the repo's files as-is
4. The new deployment goes live at lampherelabs.com within a minute or two of the push

Check deployment status in the Cloudflare dashboard: **Workers & Pages → lamphere-labs → Deployments**.

To preview before pushing, just open the HTML files directly in a browser — there's nothing to compile.
