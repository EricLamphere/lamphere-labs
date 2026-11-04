import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestPost } from '../functions/api/click.js';

const ORIGIN = 'https://lampherelabs.com';
const VALID = { page: '/tools/wickd/', section: 'pricing', label: 'Download', target: 'https://x.example/a', referrer_host: 'www.google.com' };

function fakeDb({ fail = false } = {}) {
  const inserted = [];
  return {
    inserted,
    prepare: (sql) => ({
      bind: (...values) => ({
        run: async () => {
          if (fail) throw new Error('db down');
          inserted.push({ sql, values });
          return { success: true };
        },
      }),
    }),
  };
}

function post(body, { origin = ORIGIN, country } = {}) {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  const request = new Request(`${ORIGIN}/api/click`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  if (country) Object.defineProperty(request, 'cf', { value: { country } });
  return request;
}

async function quietly(fn) {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

test('stores a valid click with parameter binding', async () => {
  const DB = fakeDb();
  const response = await onRequestPost({ request: post(VALID, { country: 'US' }), env: { DB } });
  assert.equal(response.status, 204);
  assert.equal(DB.inserted.length, 1);
  assert.deepEqual(DB.inserted[0].values, ['/tools/wickd/', 'pricing', 'Download', 'https://x.example/a', 'www.google.com', 'US']);
  assert.ok(!DB.inserted[0].sql.includes('Download'), 'values must be bound, not interpolated');
});

test('discards clicks without error until the database is connected', async () => {
  const response = await quietly(() => onRequestPost({ request: post(VALID), env: {} }));
  assert.equal(response.status, 204);
});

test('rejects other origins, including a missing one', async () => {
  for (const origin of ['https://evil.example', 'https://lamphere-labs.pages.dev', null]) {
    const DB = fakeDb();
    const response = await onRequestPost({ request: post(VALID, { origin }), env: { DB } });
    assert.equal(response.status, 403, String(origin));
    assert.equal(DB.inserted.length, 0);
  }
});

test('rejects malformed JSON, non-objects and oversized bodies', async () => {
  for (const body of ['{nope', '[]', 'null', JSON.stringify({ ...VALID, label: 'x'.repeat(5000) })]) {
    const DB = fakeDb();
    const response = await onRequestPost({ request: post(body), env: { DB } });
    assert.ok([400, 413].includes(response.status), body.slice(0, 20));
    assert.equal(DB.inserted.length, 0);
  }
});

test('rejects a missing label or an invalid page', async () => {
  for (const body of [
    { ...VALID, label: '' },
    { ...VALID, label: 42 },
    { ...VALID, page: 'https://evil.example/' },
    { ...VALID, page: '/<script>/' },
    { ...VALID, page: undefined },
  ]) {
    const DB = fakeDb();
    const response = await onRequestPost({ request: post(body), env: { DB } });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(DB.inserted.length, 0);
  }
});

test('strips control characters, caps lengths and drops a bad referrer', async () => {
  const DB = fakeDb();
  const body = { ...VALID, label: 'Down\u0000load\n', target: 'y'.repeat(400), section: 7, referrer_host: 'not a host!' };
  const response = await onRequestPost({ request: post(body), env: { DB } });
  assert.equal(response.status, 204);
  const [, section, label, target, referrer] = DB.inserted[0].values;
  assert.equal(section, '');
  assert.equal(label, 'Download');
  assert.equal(target.length, 200);
  assert.equal(referrer, '');
});

test('reports a database failure as 500 without leaking its message', async () => {
  const response = await quietly(() => onRequestPost({ request: post(VALID), env: { DB: fakeDb({ fail: true }) } }));
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('db down'));
});
