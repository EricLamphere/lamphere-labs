// POST /api/click: stores one click from assets/js/track.js. See docs/click-tracking.md.

const ALLOWED_ORIGINS = new Set(['https://lampherelabs.com', 'https://www.lampherelabs.com']);
const MAX_BODY_BYTES = 2048;
const MAX_LENGTHS = { page: 200, section: 80, label: 80, target: 200, referrer_host: 253 };
const PAGE_PATTERN = /^\/[a-zA-Z0-9/_-]*$/;
const HOST_PATTERN = /^[a-zA-Z0-9.-]+$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

const INSERT_CLICK = `
  INSERT INTO clicks (page, section, label, target, referrer_host, country)
  VALUES (?, ?, ?, ?, ?, ?)
`;

const empty = (status) => new Response(null, { status });

function clean(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}

// Returns the row to store, or null if the click is invalid.
function parseClick(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const page = clean(body.page, MAX_LENGTHS.page);
  const label = clean(body.label, MAX_LENGTHS.label);
  if (!label || !PAGE_PATTERN.test(page)) return null;
  const host = clean(body.referrer_host, MAX_LENGTHS.referrer_host);
  return {
    page,
    label,
    section: clean(body.section, MAX_LENGTHS.section),
    target: clean(body.target, MAX_LENGTHS.target),
    referrerHost: HOST_PATTERN.test(host) ? host : '',
  };
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function onRequestPost({ request, env }) {
  if (!ALLOWED_ORIGINS.has(request.headers.get('Origin'))) return empty(403);

  const declaredBytes = Number(request.headers.get('Content-Length') || 0);
  if (declaredBytes > MAX_BODY_BYTES) return empty(413);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return empty(413);

  const click = parseClick(parseJson(raw));
  if (!click) return empty(400);

  // Keeps the code safe to deploy before the database exists: clicks are discarded.
  if (!env.DB) {
    console.warn('click discarded: D1 binding "DB" is not configured');
    return empty(204);
  }

  try {
    await env.DB.prepare(INSERT_CLICK)
      .bind(click.page, click.section, click.label, click.target, click.referrerHost, request.cf?.country ?? '')
      .run();
    return empty(204);
  } catch (error) {
    console.error('click insert failed', error);
    return empty(500);
  }
}
