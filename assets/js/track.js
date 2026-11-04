// Click tracking for every clickable thing on the site. See docs/click-tracking.md.
// Uses no cookies and no visitor identifiers. Failures never affect the page.

const ENDPOINT = '/api/click';
const TRACKED_HOSTS = new Set(['lampherelabs.com', 'www.lampherelabs.com']);
const CLICKABLE = 'a, button, summary, [data-track], .gallery-item';
const LANDMARK = '[data-track-section], section, header, footer, nav, #lightbox';
const OPT_OUT_KEY = 'lamphere:notrack';
const MAX_LABEL = 80;
const MAX_TARGET = 200;

const collapse = (text) => (text || '').replace(/\s+/g, ' ').trim();

export function labelFor(el) {
  const named = el.getAttribute('data-track') || el.getAttribute('aria-label') || el.getAttribute('data-cap');
  // Two-state toggles hold both labels in the DOM; only the closed one names the control.
  const text = named || el.querySelector('.when-closed')?.textContent || el.textContent;
  return collapse(text).slice(0, MAX_LABEL);
}

export function sectionFor(el) {
  const landmark = el.closest(LANDMARK);
  if (!landmark) return '';
  return (
    landmark.getAttribute('data-track-section') ||
    landmark.id ||
    collapse(landmark.className).split(' ')[0] ||
    landmark.tagName.toLowerCase()
  );
}

export function targetFor(el) {
  const href = el.getAttribute('href') || '';
  if (href.startsWith('mailto:')) return 'mailto';
  if (href.startsWith('#')) return href.slice(0, MAX_TARGET);
  return href.split(/[?#]/)[0].slice(0, MAX_TARGET);
}

export function referrerHost(referrer, ownHost) {
  if (!referrer) return '';
  try {
    const { hostname } = new URL(referrer);
    return hostname === ownHost ? '' : hostname;
  } catch {
    return '';
  }
}

export function describeClick(el, location, referrer) {
  return {
    page: location.pathname,
    section: sectionFor(el),
    label: labelFor(el),
    target: targetFor(el),
    referrer_host: referrerHost(referrer, location.hostname),
  };
}

// `?notrack` opts this browser out for good and `?track` opts it back in.
function isOptedOut(location) {
  const params = new URLSearchParams(location.search);
  try {
    if (params.has('notrack')) localStorage.setItem(OPT_OUT_KEY, '1');
    if (params.has('track')) localStorage.removeItem(OPT_OUT_KEY);
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    // Storage can be blocked. The URL flag still covers this page load.
    return params.has('notrack');
  }
}

function start() {
  if (!TRACKED_HOSTS.has(window.location.hostname)) return;
  if (navigator.webdriver || !navigator.sendBeacon) return;
  if (isOptedOut(window.location)) return;

  const handle = (event) => {
    // Middle-click opens a link too, but auxclick also fires for the right button.
    if (event.type === 'auxclick' && event.button !== 1) return;
    const el = event.target.closest?.(CLICKABLE);
    if (!el) return;
    const payload = describeClick(el, window.location, document.referrer);
    // sendBeacon survives the navigation a click on a link starts.
    navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
  };

  // Capture phase, because the lightbox's buttons call stopPropagation().
  document.addEventListener('click', handle, true);
  document.addEventListener('auxclick', handle, true);
}

if (typeof document !== 'undefined') start();
