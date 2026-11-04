import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeClick,
  labelFor,
  referrerHost,
  sectionFor,
  targetFor,
} from '../assets/js/track.js';

// Just enough of a DOM element for the pure helpers.
function fakeElement({ attrs = {}, text = '', closest = null, query = {}, id = '', className = '', tagName = 'A' } = {}) {
  return {
    id,
    className,
    tagName,
    textContent: text,
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    closest: () => closest,
    querySelector: (selector) => query[selector] ?? null,
  };
}

test('label prefers data-track over everything else', () => {
  const el = fakeElement({ attrs: { 'data-track': 'Hero CTA', 'aria-label': 'Aria' }, text: 'Text' });
  assert.equal(labelFor(el), 'Hero CTA');
});

test('label uses aria-label for icon-only controls', () => {
  assert.equal(labelFor(fakeElement({ attrs: { 'aria-label': 'Next image' }, text: '›' })), 'Next image');
});

test('label uses the caption for gallery thumbnails', () => {
  const el = fakeElement({ attrs: { 'data-cap': 'Metric dashboards' }, tagName: 'DIV' });
  assert.equal(labelFor(el), 'Metric dashboards');
});

test('label uses only the closed text of a two-state toggle', () => {
  const el = fakeElement({
    text: 'See 16 more screenshotsShow fewer',
    query: { '.when-closed': { textContent: 'See 16 more screenshots' } },
    tagName: 'SUMMARY',
  });
  assert.equal(labelFor(el), 'See 16 more screenshots');
});

test('label collapses whitespace and is capped at 80 characters', () => {
  assert.equal(labelFor(fakeElement({ text: '  Download\n   for   macOS ' })), 'Download for macOS');
  assert.equal(labelFor(fakeElement({ text: 'x'.repeat(200) })).length, 80);
});

test('section prefers an explicit name, then id, then first class, then tag', () => {
  assert.equal(sectionFor(fakeElement({ closest: fakeElement({ attrs: { 'data-track-section': 'Named' }, id: 'x' }) })), 'Named');
  assert.equal(sectionFor(fakeElement({ closest: fakeElement({ id: 'pricing', className: 'a' }) })), 'pricing');
  assert.equal(sectionFor(fakeElement({ closest: fakeElement({ className: 'hero wide' }) })), 'hero');
  assert.equal(sectionFor(fakeElement({ closest: fakeElement({ tagName: 'FOOTER' }) })), 'footer');
});

test('section is empty outside any landmark', () => {
  assert.equal(sectionFor(fakeElement()), '');
});

test('target keeps the href but never an email address or query string', () => {
  assert.equal(targetFor(fakeElement({ attrs: { href: '#pricing' } })), '#pricing');
  assert.equal(targetFor(fakeElement({ attrs: { href: 'mailto:someone@example.com' } })), 'mailto');
  assert.equal(targetFor(fakeElement({ attrs: { href: 'https://a.example/b?token=1#c' } })), 'https://a.example/b');
  assert.equal(targetFor(fakeElement({ tagName: 'BUTTON' })), '');
});

test('referrer host is the bare hostname, and empty for our own pages or junk', () => {
  assert.equal(referrerHost('https://news.ycombinator.com/item?id=1', 'lampherelabs.com'), 'news.ycombinator.com');
  assert.equal(referrerHost('https://lampherelabs.com/', 'lampherelabs.com'), '');
  assert.equal(referrerHost('', 'lampherelabs.com'), '');
  assert.equal(referrerHost('not a url', 'lampherelabs.com'), '');
});

test('describeClick assembles the payload', () => {
  const el = fakeElement({
    attrs: { href: 'https://example.com/file.dmg' },
    text: 'Download',
    closest: fakeElement({ id: 'pricing' }),
  });
  const location = { pathname: '/tools/wickd/', hostname: 'lampherelabs.com' };
  assert.deepEqual(describeClick(el, location, 'https://www.google.com/'), {
    page: '/tools/wickd/',
    section: 'pricing',
    label: 'Download',
    target: 'https://example.com/file.dmg',
    referrer_host: 'www.google.com',
  });
});
