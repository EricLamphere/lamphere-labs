# lamphere-labs

Static site for [lampherelabs.com](https://lampherelabs.com), hosted on Cloudflare Pages.

## Structure

```
index.html              Homepage
tools/wickd/            wickd product page (lampherelabs.com/tools/wickd)
assets/img/             Images used across pages
assets/js/track.js      Click tracking script, included on every page
functions/api/click.js  Cloudflare Pages Function that stores clicks (POST /api/click)
db/schema.sql           Click tracking database table
docs/                   Documentation
tests/                  Tests for the click tracking code
_redirects              Cloudflare Pages redirects (old dbt-ui URLs → /tools/wickd)
```

No build step — plain HTML/CSS/JS, no framework, no package.json. Add new pages as `<folder>/index.html` so they're reachable at `lampherelabs.com/<folder>`, and include the tracking script at the bottom of each one.

## Click tracking

Clicks on every link and button are stored in a Cloudflare D1 database, with no cookies or visitor IDs. Visit `lampherelabs.com/?notrack` once in each browser to exclude your own clicks.

See [docs/click-tracking.md](docs/click-tracking.md) for how it works, database setup, and queries for reading the data. Run the tests with `node --test "tests/*.test.mjs"`.

## How updates go live

This repo is connected to Cloudflare Pages via Git integration, tracking the `main` branch.

1. Push to `main` (or merge a PR into it)
2. Cloudflare's GitHub webhook automatically triggers a new deployment — no CI/CD workflow in this repo, no manual build/deploy step
3. Since there's no build command, Cloudflare serves the repo's files as-is
4. The new deployment goes live at lampherelabs.com within a minute or two of the push

Check deployment status in the Cloudflare dashboard: **Workers & Pages → lamphere-labs → Deployments**.

To preview before pushing, just open the HTML files directly in a browser — there's nothing to compile.
