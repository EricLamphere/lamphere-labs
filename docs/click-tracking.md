# Click tracking

Records clicks on every link and button on the site, so you can see which buttons get used. It answers questions Cloudflare Web Analytics can't, such as how many people clicked Download and from which part of the page.

It uses no cookies or visitor IDs and doesn't store IP addresses, so **it counts clicks, not people**.

## How it works

```
Click on the page
  → assets/js/track.js      describes the click and sends it in the background
  → POST /api/click         functions/api/click.js checks it and adds the country
  → D1 database             one row in the clicks table
```

| File | Purpose |
|---|---|
| `assets/js/track.js` | Browser script, included at the bottom of each page |
| `functions/api/click.js` | Cloudflare Pages Function that validates and stores clicks |
| `db/schema.sql` | The `clicks` table |
| `tests/` | Unit tests for the script and the function |

### What gets tracked

The script listens for clicks across the whole page, so new links and buttons are tracked automatically. It covers `a`, `button`, `summary`, `.gallery-item` and anything with a `data-track` attribute.

Clicks are not sent, or not recorded, in these cases:

- The page isn't on `lampherelabs.com` or `www.lampherelabs.com`, which excludes local previews and `*.pages.dev` deployments.
- The browser has opted out with `?notrack`.
- The browser identifies itself as automated, or doesn't run JavaScript.
- An ad blocker stops the request.

### What gets stored

| Column | Example | Source |
|---|---|---|
| `clicked_at` | `2026-11-04T16:31:25Z` | Database, in UTC |
| `page` | `/tools/wickd/` | Page path |
| `section` | `pricing` | Nearest section, header, footer, nav or lightbox |
| `label` | `Download` | See below |
| `target` | `https://github.com/.../wickd_aarch64.dmg` | Link address without its query string. Email links are stored as just `mailto`, never the address |
| `referrer_host` | `news.ycombinator.com` | Site the visitor came from, hostname only. Empty for direct visits and clicks after moving between your own pages |
| `country` | `US` | Cloudflare, from the request |

### Naming things

The label is the first of these that exists: `data-track`, `aria-label`, `data-cap` (gallery captions), then the visible text.

The section is the first of these that exists on the nearest landmark: `data-track-section`, `id`, its first class, then the tag name.

To name something explicitly:

```html
<a href="..." data-track="Download (hero)">Download for macOS</a>
<section data-track-section="pricing">...</section>
```

Changing a label starts a new row group in your queries, so old and new names won't combine automatically.

To track a new page, add this at the bottom of its HTML:

```html
<script type="module" src="/assets/js/track.js"></script>
```

## Setup

The code is safe to deploy before the database exists: until the `DB` connection is set up, the endpoint accepts clicks and discards them. **Create the table before connecting the database**, because once `DB` is connected, a missing table makes every click fail with a 500 and that click is lost.

Cloudflare's dashboard labels change from time to time, so these may differ slightly.

### 1. Create the database

1. In the Cloudflare dashboard, go to **Storage & databases → D1**.
2. Create a database named `lamphere-labs-prod-db`.

### 2. Create the table

Open the database's **Console** tab and run each statement from `db/schema.sql`. It's safe to run them again.

### 3. Connect it to the site

1. Go to **Workers & Pages → lamphere-labs → Settings → Bindings**.
2. Add a **D1 database** binding, with the variable name exactly `DB`, pointing to `lamphere-labs-prod-db`. Add it to the Production environment.
3. Bindings apply on the next deployment, so push a commit or retry the latest deployment under **Deployments**.

### 4. Check that it works

1. Open the live site and click something. Do this before step 5, since opting out stops your clicks being recorded.
2. Run this in the D1 console:

   ```sql
   SELECT * FROM clicks ORDER BY id DESC LIMIT 5;
   ```

If nothing appears, see [Troubleshooting](#troubleshooting).

### 5. Exclude your own clicks

Delete your test clicks, then visit this once in each browser you use:

```
https://lampherelabs.com/?notrack
```

That browser stays opted out until you clear its site data or visit `?track`. Private windows and other devices need it separately.

```sql
DELETE FROM clicks;
```

### 6. Optional: rate limit the endpoint

The endpoint is public, so anyone can send it fake clicks. It rejects other origins and malformed requests, but a script can imitate your origin. To limit the damage, add a rate limiting rule under **Security → Security rules** for requests whose path equals `/api/click`.

## Reading the data

Run these in the D1 console.

Clicks per button in the last 30 days:

```sql
SELECT page, section, label, COUNT(*) AS clicks
FROM clicks
WHERE clicked_at >= datetime('now', '-30 days')
GROUP BY page, section, label
ORDER BY clicks DESC;
```

Download clicks per week:

```sql
SELECT strftime('%Y-%W', clicked_at) AS week, section, COUNT(*) AS clicks
FROM clicks
WHERE target LIKE '%.dmg'
GROUP BY week, section
ORDER BY week DESC;
```

Where download clicks came from:

```sql
SELECT referrer_host, country, COUNT(*) AS clicks
FROM clicks
WHERE target LIKE '%.dmg'
GROUP BY referrer_host, country
ORDER BY clicks DESC;
```

A Download click means someone started a download, not that they finished or installed it. People who download directly from GitHub aren't counted.

Rows are kept until you delete them. To remove old ones:

```sql
DELETE FROM clicks WHERE clicked_at < datetime('now', '-1 year');
```

## Cost and limits

This should stay within Cloudflare's free tier at this site's traffic. Each click uses one function request and writes about one row. As of November 2026, the free limits are:

- 100,000 function requests per day, shared with any Workers
- 100,000 D1 rows written per day
- 5 million D1 rows read per day
- 5 GB of D1 storage

If the D1 limits are reached on the free plan, queries return errors until the reset at 00:00 UTC, so clicks are lost but the plan doesn't start charging you. The site itself keeps working because the script ignores failures. See [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).

## Tests

There's no `package.json`, so the tests run with Node's built-in runner (Node 22 or later):

```bash
node --test "tests/*.test.mjs"
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No rows, and no request to `/api/click` in the browser's Network tab | This browser is opted out (visit `?track`), an ad blocker is blocking it, or the page isn't on the live domain |
| Requests return `204` but there are no rows | `DB` isn't connected, or the site hasn't been redeployed since. Check the variable name and the Production environment |
| Requests return `500` | The `clicks` table is missing. Run `db/schema.sql` |
| Requests return `403` | The site is on a domain missing from `ALLOWED_ORIGINS` in `functions/api/click.js` |
| Requests return `400` | The page path has unusual characters, or the clicked element has no label. Add `data-track` to it |

Previewing an HTML file by opening it directly logs a harmless console error for the script and tracks nothing.

## Note: these docs are public

The site is deployed from the repo root, so every file in the repo is publicly reachable, including this one, the README and `db/schema.sql`. Don't put secrets or private notes in this repo's files, even though the repo itself is private.
