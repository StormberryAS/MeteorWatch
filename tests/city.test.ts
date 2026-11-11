// The city filter, driven as a person drives it, in the stub page of tests/load.ts: the lazy
// load of cities.js, picking a city, keeping it on the device (and the page without storage),
// clearing it, and what the card shows with a city: the showers the city cannot see are skipped,
// times are in the city's zone. The clock is fixed per test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPage } from './load.ts';
import type { LoadedPage, PickedCity } from './load.ts';
import { search } from './capture-search.ts';

const KEY = 'meteorwatch.city';
const GRACE = 12 * 3600 * 1000;
const BERGEN: PickedCity = { name: 'Bergen', country: 'Norway', lat: 60.393, lon: 5.3242, tz: 'Europe/Oslo' };
const RECORD = JSON.stringify({ v: 1, ...BERGEN });
const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Types the query and clicks the first row, as a person would. */
function pick(page: LoadedPage, query: string, row = 0): void {
  search(page, query);
  const els = page.get('els');
  page.fn('onDropdownClick')({ target: { closest: () => els.cityDropdown.children[row] } });
}

/** The card the page would show now, from the page's own pickCard and filter. */
function cardNow(page: LoadedPage): { kind: string; id: string; time: number } {
  return page.run('(() => { const c = pickCard(Date.now(), visibleFor(state.city)); return { kind: c.kind, id: c.entry ? c.entry.peak.id : "", time: c.entry ? c.entry.time : 0 }; })()');
}

test('cities.js is not loaded with the page; the first use of the field adds it once, from the same origin, with its cache stamp', async () => {
  const page = loadPage({ cities: 'lazy', scripts: 'hold' });
  const els = page.get('els');
  assert.equal(page.dom.scripts.length, 0);
  assert.equal(page.run('typeof CITIES'), 'undefined');
  assert.equal(els.citySearch.getAttribute('aria-busy'), null);

  els.citySearch.fire('focus');
  assert.equal(page.dom.scripts.length, 1);
  const script = page.dom.scripts[0];
  assert.ok(script);
  assert.equal(script.tagName, 'SCRIPT');
  assert.equal(script.src, './cities.js?v=2f08782c'); // a relative, same-origin address, stamped by bump_assets.py
  assert.equal(els.citySearch.getAttribute('aria-busy'), 'true');
  assert.equal(els.cityStatus.textContent, 'Loading the city list.');

  // A second focus, a click, and typing add no second script, whatever the load is doing.
  els.citySearch.fire('focus');
  els.citySearch.fire('pointerdown');
  els.citySearch.value = 'tromso';
  els.citySearch.fire('input');
  assert.equal(page.dom.scripts.length, 1);
  // Before the load, onCityInput does nothing: the list stays closed and CITIES is not read.
  page.fn('onCityInput')();
  assert.equal(els.cityDropdown.hidden, true);

  // The load ends: the text typed while it ran is searched, the busy flag and the status go.
  page.finishScript(0);
  await nextTurn();
  assert.equal(els.citySearch.getAttribute('aria-busy'), null);
  assert.equal(els.cityStatus.textContent, '');
  assert.equal(els.cityDropdown.hidden, false);
  assert.equal(els.cityDropdown.children[0] && (page.run<string>('els.cityDropdown.children[0]._city.name')), 'Tromsø');
  // And once it is there, focus adds nothing.
  els.citySearch.fire('focus');
  assert.equal(page.dom.scripts.length, 1);
});

test('the field is not read before it is used: an empty query never touches CITIES', () => {
  const page = loadPage({ cities: 'lazy' });
  page.run(`Object.defineProperty(globalThis, 'CITIES', { configurable: true, get() { globalThis.__reads = (globalThis.__reads || 0) + 1; return []; } }); globalThis.foldQuery = (s) => s;`);
  const els = page.get('els');
  els.citySearch.value = '   ';
  page.fn('onCityInput')();
  els.citySearch.value = '';
  page.fn('onCityInput')();
  assert.equal(page.run('globalThis.__reads || 0'), 0);
  els.citySearch.value = 'a';
  page.fn('onCityInput')();
  assert.equal(page.run('globalThis.__reads || 0'), 1);
});

test('a catalogue that fails to load leaves all showers, says so, removes the script and lets the next use try again', async () => {
  const page = loadPage({ cities: 'lazy', scripts: 'fail' });
  const els = page.get('els');
  els.citySearch.fire('focus');
  await nextTurn();
  assert.equal(els.cityStatus.textContent, 'The city list did not load. All showers are shown.');
  assert.equal(els.citySearch.getAttribute('aria-busy'), null);
  assert.equal(page.get('state').city, null);
  assert.equal(page.dom.removed.length, 1);
  els.citySearch.fire('focus');
  assert.equal(page.dom.scripts.length, 2);
  await nextTurn();
});

test('with a stored city the failed load does not say that all showers are shown', async () => {
  const page = loadPage({ cities: 'lazy', scripts: 'fail', stored: RECORD });
  page.get('els').citySearch.fire('focus');
  await nextTurn();
  assert.equal(page.get('els').cityStatus.textContent, 'The city list did not load. The city you picked is still in use.');
  assert.equal(page.get('state').city?.name, 'Bergen');
});

test('a stored valid record restores the filter and the chip, and loads no catalogue', () => {
  const page = loadPage({ cities: 'lazy', stored: RECORD, now: '2027-08-02T00:00:00Z' });
  assert.deepEqual({ ...(page.get('state').city as PickedCity) }, BERGEN);
  assert.equal(page.dom.scripts.length, 0);
  assert.equal(page.run('typeof CITIES'), 'undefined');
  assert.equal(page.el('city-selected').hidden, false);
  assert.equal(page.text('city-selected-text'), 'Bergen, Norway');
  assert.equal(page.text('shower-name'), 'Perseids');
  assert.equal(page.text('card-city'), "For Bergen, Norway. Times are in the city's time zone.");
  assert.equal(page.el('card-city').hidden, false);
  assert.equal(page.el('row-dark').hidden, false);
  assert.match(page.text('shower-dark'), /^(\d+ h( \d+ min)?|\d+ min)$/);
  assert.equal(page.store.get(KEY), RECORD, 'the record is not rewritten');
});

test('records that fail a check are removed and the page shows all showers', () => {
  const good = { v: 1, ...BERGEN };
  const bad: Array<[string, string]> = [
    ['not JSON', '{oops'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"Bergen"'],
    ['version 2', JSON.stringify({ ...good, v: 2 })],
    ['no version', JSON.stringify({ name: 'Bergen', country: 'Norway', lat: 60, lon: 5, tz: 'Europe/Oslo' })],
    ['an empty name', JSON.stringify({ ...good, name: '' })],
    ['a name of 201 characters', JSON.stringify({ ...good, name: 'x'.repeat(201) })],
    ['a name that is a number', JSON.stringify({ ...good, name: 5 })],
    ['an empty country', JSON.stringify({ ...good, country: '' })],
    ['a latitude of 91', JSON.stringify({ ...good, lat: 91 })],
    ['a latitude of -90.5', JSON.stringify({ ...good, lat: -90.5 })],
    ['a longitude of 181', JSON.stringify({ ...good, lon: 181 })],
    ['a longitude of -180.1', JSON.stringify({ ...good, lon: -180.1 })],
    ['a latitude that is a string', JSON.stringify({ ...good, lat: '60.39' })],
    ['a missing longitude', JSON.stringify({ v: 1, name: 'Bergen', country: 'Norway', lat: 60, tz: 'Europe/Oslo' })],
    ['an empty time zone', JSON.stringify({ ...good, tz: '' })],
    ['a time zone that is a number', JSON.stringify({ ...good, tz: 1 })],
  ];
  for (const [why, raw] of bad) {
    const page = loadPage({ cities: 'lazy', stored: raw, now: '2027-08-02T00:00:00Z' });
    assert.equal(page.get('state').city, null, why);
    assert.equal(page.store.has(KEY), false, `${why}: the bad record is removed`);
    assert.equal(page.el('city-selected').hidden, true, why);
    assert.equal(page.el('card-city').hidden, true, why);
    assert.equal(page.text('shower-name'), 'Perseids', why);
  }
  // The limits themselves are valid.
  for (const edge of [{ lat: 90, lon: 180 }, { lat: -90, lon: -180 }, { lat: 0, lon: 0 }]) {
    const page = loadPage({ cities: 'lazy', stored: JSON.stringify({ ...good, ...edge }) });
    assert.ok(page.get('state').city, JSON.stringify(edge));
  }
});

test('a stored record whose time zone this browser does not know is kept, and the times show in the viewer\'s zone', () => {
  const raw = JSON.stringify({ v: 1, ...BERGEN, tz: 'Mars/Olympus_Mons' });
  const page = loadPage({ cities: 'lazy', stored: raw, now: '2027-08-02T00:00:00Z' });
  assert.equal(page.get('state').city?.name, 'Bergen');
  assert.equal(page.store.get(KEY), raw);
  assert.equal(page.text('shower-name'), 'Perseids');
  assert.equal(page.text('card-city'), "For Bergen, Norway. Times are in your own time zone, because this browser does not know the city's zone.");
  const perseids = page.run<number>('SCHEDULE.find((e) => e.peak.id === "PER" && e.time > Date.now()).time');
  assert.equal(page.text('shower-date'), page.fn('formatPeak')(perseids, undefined));
});

test('a pick whose time zone this browser does not know does not stop the countdown: the viewer\'s zone is used and the status says so', () => {
  const page = loadPage({ now: '2027-08-02T00:00:00Z' });
  const els = page.get('els');
  search(page, 'bergen');
  // The catalogue row is the real one; only its zone is one that this browser rejects.
  page.run(`els.cityDropdown.children[0]._city = Object.assign({}, els.cityDropdown.children[0]._city, { tz: 'Mars/Olympus_Mons' });`);
  const timersBefore = page.timeouts.length;
  page.fn('onDropdownClick')({ target: { closest: () => els.cityDropdown.children[0] } });
  assert.equal(page.get('state').city?.name, 'Bergen');
  assert.match(els.cityStatus.textContent, /^Showing showers visible from Bergen, Norway\. This browser does not know the time zone of the city, so times show in your own time zone\./);
  assert.equal(page.text('shower-name'), 'Perseids');
  assert.ok(page.timeouts.length > timersBefore, 'the next tick is armed');
});

test('one error in a tick does not stop the clock: the next tick is armed in finally', () => {
  const page = loadPage({ now: '2027-08-02T00:00:00Z' });
  const before = page.timeouts.length;
  page.run(`globalThis.__realZone = zoneFor; zoneFor = () => { throw new RangeError('boom'); };`);
  assert.throws(() => page.fn('updateUI')(), /boom/);
  assert.ok(page.timeouts.length > before, 'a tick is armed although the tick threw');
  page.run(`zoneFor = globalThis.__realZone;`);
});

test('picking a city keeps a small validated record on the device and tells the person', () => {
  const page = loadPage({ now: '2027-08-02T00:00:00Z' });
  pick(page, 'bergen');
  assert.deepEqual(JSON.parse(page.store.get(KEY) as string), { v: 1, ...BERGEN });
  assert.equal(page.get('els').cityStatus.textContent, 'Showing showers visible from Bergen, Norway.');
  assert.deepEqual({ ...(page.get('state').city as PickedCity) }, BERGEN);
  // A fresh visit with that record gives the same filter.
  const again = loadPage({ cities: 'lazy', stored: page.store.get(KEY) as string, now: '2027-08-02T00:00:00Z' });
  assert.equal(again.text('shower-name'), page.text('shower-name'));
});

test('without usable storage the filter still works until the page closes, and the person is told', () => {
  for (const storage of ['absent', 'property-throws', 'write-throws'] as const) {
    const page = loadPage({ storage, now: '2027-08-02T00:00:00Z' });
    assert.equal(page.get('state').city, null, storage);
    assert.equal(page.text('shower-name'), 'Perseids', storage);
    pick(page, 'tromso');
    assert.equal(page.get('state').city?.name, 'Tromsø', storage);
    assert.equal(page.text('shower-name'), 'Orionids', storage); // Tromsø cannot see the Perseids
    assert.equal(page.get('els').cityStatus.textContent, 'Showing showers visible from Tromsø, Norway. This browser will not keep the city after you close the page.', storage);
    assert.equal(page.store.size, 0, storage);
    page.fn('clearCitySelection')(); // clearing does not throw either
    assert.equal(page.get('state').city, null, storage);
    assert.equal(page.text('shower-name'), 'Perseids', storage);
    assert.equal(page.get('els').cityStatus.textContent, 'Showing all showers.', storage);
  }
});

test('Clear removes the record, the chip and the filter, closes the list, says so and puts the focus back on the field', () => {
  const page = loadPage({ now: '2027-08-02T00:00:00Z' });
  const els = page.get('els');
  pick(page, 'tromso');
  assert.equal(page.text('shower-name'), 'Orionids');
  assert.ok(page.store.has(KEY));
  search(page, 'oslo'); // a list is open when Clear is pressed
  assert.equal(els.cityDropdown.hidden, false);
  els.cityClearBtn.fire('click');
  assert.equal(page.get('state').city, null);
  assert.equal(page.store.has(KEY), false);
  assert.equal(els.citySelected.hidden, true);
  assert.equal(els.cityDropdown.hidden, true);
  assert.equal(els.citySearch.value, '');
  assert.equal(els.citySearch.getAttribute('aria-expanded'), 'false');
  assert.equal(els.cityStatus.textContent, 'Showing all showers.');
  assert.equal(page.dom.activeElement, els.citySearch);
  assert.equal(page.text('shower-name'), 'Perseids');
  assert.equal(page.el('card-city').hidden, true);
  assert.equal(page.el('row-dark').hidden, true);
  assert.equal(page.el('city-skipped').hidden, true);
  // Enter after Clear picks nothing from an old list.
  els.citySearch.fire('keydown', { key: 'Enter', preventDefault: () => undefined });
  assert.equal(page.get('state').city, null);
});

test('Clear on a return visit (stored city, list not loaded) starts no download and leaves "Showing all showers." in the status line', async () => {
  const page = loadPage({ cities: 'lazy', stored: RECORD, now: '2027-08-02T00:00:00Z' });
  const els = page.get('els');
  assert.equal(page.dom.scripts.length, 0);
  els.cityClearBtn.fire('click');
  assert.equal(els.cityStatus.textContent, 'Showing all showers.');
  assert.equal(page.dom.scripts.length, 0, 'the focus that Clear causes does not load the list');
  assert.equal(page.dom.activeElement, els.citySearch);
  await nextTurn();
  assert.equal(els.cityStatus.textContent, 'Showing all showers.');
  assert.equal(page.get('state').city, null);
  // A later use of the field loads the list as before, and the status line goes back to what it said.
  els.citySearch.fire('pointerdown');
  assert.equal(page.dom.scripts.length, 1);
  await nextTurn();
  assert.equal(els.cityStatus.textContent, 'Showing all showers.');
});

test('a load that is running when Clear is pressed does not overwrite the status of the clear', async () => {
  const page = loadPage({ cities: 'lazy', stored: RECORD, scripts: 'hold', now: '2027-08-02T00:00:00Z' });
  const els = page.get('els');
  els.citySearch.fire('pointerdown'); // the load starts
  assert.equal(els.cityStatus.textContent, 'Loading the city list.');
  els.cityClearBtn.fire('click');
  assert.equal(els.cityStatus.textContent, 'Showing all showers.');
  page.finishScript(0);
  await nextTurn();
  assert.equal(els.cityStatus.textContent, 'Showing all showers.');
});

test('the keyboard: arrows move the highlight and set aria-activedescendant and aria-selected, Enter picks, Escape closes', () => {
  const page = loadPage();
  const els = page.get('els');
  const key = (k: string): void => els.citySearch.fire('keydown', { key: k, preventDefault: () => undefined });
  search(page, 'bergen'); // Bergen NO, Bergen NL, Bergen op Zoom, ...
  assert.equal(els.citySearch.getAttribute('aria-expanded'), 'true');
  assert.equal(els.citySearch.getAttribute('aria-activedescendant'), null);
  const rows = els.cityDropdown.children;
  assert.ok(rows.length >= 3);
  assert.deepEqual(rows.map((r) => r.getAttribute('role')), rows.map(() => 'option'));
  assert.deepEqual(rows.map((r) => r.getAttribute('aria-selected')), rows.map(() => 'false'));
  key('ArrowDown');
  assert.equal(els.citySearch.getAttribute('aria-activedescendant'), 'city-option-0');
  key('ArrowDown');
  assert.equal(els.citySearch.getAttribute('aria-activedescendant'), 'city-option-1');
  assert.deepEqual(rows.map((r) => r.getAttribute('aria-selected')), rows.map((_, i) => String(i === 1)));
  key('ArrowUp');
  assert.equal(els.citySearch.getAttribute('aria-activedescendant'), 'city-option-0');
  key('ArrowUp'); // stays on the first row
  assert.equal(els.citySearch.getAttribute('aria-activedescendant'), 'city-option-0');
  key('Escape');
  assert.equal(els.cityDropdown.hidden, true);
  assert.equal(els.citySearch.getAttribute('aria-expanded'), 'false');
  assert.equal(els.citySearch.getAttribute('aria-activedescendant'), null);
  // Enter with a highlighted row picks it.
  search(page, 'tromso');
  key('ArrowDown');
  key('Enter');
  assert.equal(page.get('state').city?.name, 'Tromsø');
  assert.equal(els.cityDropdown.hidden, true);
  assert.equal(els.citySearch.getAttribute('aria-activedescendant'), null);
  // Enter with no highlighted row picks nothing.
  const before = page.get('state').city;
  search(page, 'oslo');
  key('Enter');
  assert.equal(page.get('state').city, before);
  // A click outside the search closes the list; a click inside leaves it.
  search(page, 'oslo');
  page.fire('click', { target: els.citySearch });
  assert.equal(els.cityDropdown.hidden, false);
  page.fire('click', { target: page.el('city-card') });
  assert.equal(els.cityDropdown.hidden, true);
});

test('a name with markup is shown as text, not as markup', () => {
  const page = loadPage();
  const els = page.get('els');
  // The catalogue has two names with an ampersand: "Choi Wan Estate (I & II)" and "Lower Wong Tai Sin Estate (I & II)".
  search(page, 'choi wan');
  const rowHtml = els.cityDropdown.children.map((li) => li.innerHTML);
  assert.ok(rowHtml.length >= 1, 'the search finds the estate');
  for (const html of rowHtml) assert.doesNotMatch(html, /<(?!\/?span)/);
  assert.ok(rowHtml.some((html) => html.includes('(I &amp; II)')), 'the ampersand is escaped in the markup');
  assert.ok(page.run<string[]>('els.cityDropdown.children.map((li) => li._city.name)').some((name) => name.includes('(I & II)')), 'and the city itself keeps the plain ampersand');
  // The stored name goes to textContent only.
  const evil = loadPage({ cities: 'lazy', stored: JSON.stringify({ v: 1, name: '<img src=x onerror=1>', country: 'A&B', lat: 1, lon: 1, tz: 'UTC' }) });
  assert.equal(evil.get('els').citySelectedTxt.textContent, '&lt;img src=x onerror=1&gt;, A&amp;B');
  assert.equal(evil.get('els').citySelectedTxt.innerHTML, '&lt;img src=x onerror=1&gt;, A&amp;B');
});

// ---- What the card shows with a city (expected sets: research/VISIBILITY.md, rule A) ----

test('Tromsø at 2027-04-01: the Orionids count down and the four showers before them are listed as not visible', () => {
  const page = loadPage({ now: '2027-04-01T00:00:00Z' });
  assert.equal(page.text('shower-name'), 'April Lyrids');
  pick(page, 'tromso');
  assert.equal(page.text('shower-name'), 'Orionids');
  assert.equal(page.text('city-skipped'), 'Not visible from Tromsø before then: April Lyrids, Eta Aquariids, Southern Delta Aquariids and Perseids.');
  assert.equal(page.el('city-skipped').hidden, false);
  assert.match(page.text('countdown-timer'), /^\d{3}:\d\d:\d\d:\d\d$/);
  assert.equal(page.text('card-city'), "For Tromsø, Norway. Times are in the city's time zone.");
});

test('Rio de Janeiro: the Southern Delta Aquariids grace card on 2027-08-01, the Orionids from 2027-08-02, the Perseids skipped', () => {
  const page = loadPage({ now: '2027-08-01T00:00:00Z' });
  pick(page, 'rio de janeiro');
  assert.equal(page.get('state').city?.name, 'Rio de Janeiro, RJ');
  assert.equal(page.text('shower-name'), 'Southern Delta Aquariids'); // peak 2027-07-31T19:37Z, 4 h 23 min ago
  assert.equal(page.text('countdown-timer'), 'Peak passed');
  assert.equal(page.text('peak-status'), 'The peak was 4 h 23 min ago.');
  assert.match(page.text('peak-next'), /^Next: Orionids, /); // the Perseids are hidden in Rio
  page.setNow('2027-08-02T00:00:00Z');
  page.fn('updateUI')();
  assert.equal(page.text('shower-name'), 'Orionids');
  assert.equal(page.text('city-skipped'), 'Not visible from Rio de Janeiro, RJ before then: Perseids.');
  assert.equal(page.el('peak-next').hidden, true);
});

test('Bergen on 2027-08-02: the Perseids count down, the peak line is in Oslo time', () => {
  const savedTz = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Auckland';
    const page = loadPage({ now: '2027-08-02T00:00:00Z' });
    assert.equal(page.text('shower-name'), 'Perseids');
    const viewer = page.text('shower-date');
    pick(page, 'bergen');
    assert.equal(page.text('shower-name'), 'Perseids');
    const perseids = Date.parse('2027-08-13T08:11:00Z');
    assert.equal(page.text('shower-date'), page.fn('formatPeak')(perseids, 'Europe/Oslo'));
    assert.equal(page.fn('formatPeak')(perseids, 'Europe/Oslo', 'en-GB'), 'Fri, 13 Aug 2027, 10:11 CEST');
    assert.notEqual(page.text('shower-date'), viewer); // the viewer is in Auckland
    assert.equal(page.el('city-skipped').hidden, true);
  } finally {
    if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz;
  }
});

test('the peak line follows the city zone: Sydney sees the Leonids of 2026 on 18 November, 10:43', () => {
  const savedTz = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Oslo';
    const page = loadPage({ now: '2026-11-17T20:00:00Z' });
    const leonids = Date.parse('2026-11-17T23:43:00Z');
    assert.equal(page.text('shower-date'), page.fn('formatPeak')(leonids, undefined)); // the viewer's zone
    pick(page, 'sydney');
    assert.equal(page.get('state').city?.tz, 'Australia/Sydney');
    assert.equal(page.text('shower-name'), 'Leonids');
    assert.equal(page.text('shower-date'), page.fn('formatPeak')(leonids, 'Australia/Sydney'));
    assert.equal(page.fn('formatPeak')(leonids, 'Australia/Sydney', 'en-GB'), 'Wed, 18 Nov 2026, 10:43 GMT+11');
    // The Moon line is the same instant, whoever the city is.
    const moon = page.text('shower-moon');
    page.fn('clearCitySelection')();
    assert.equal(page.text('shower-moon'), moon);
    assert.equal(page.text('shower-date'), page.fn('formatPeak')(leonids, undefined));
  } finally {
    if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz;
  }
});

test('Quito sees all nine showers except the Ursids, with the Leonids at 3 h 30 min of dark radiant time', () => {
  const page = loadPage({ now: '2026-11-17T20:00:00Z' });
  pick(page, 'quito');
  assert.equal(page.get('state').city?.name, 'Quito');
  assert.equal(page.text('shower-name'), 'Leonids');
  // The oracle has 210 minutes for the Leonids at Quito in 2026; the page is within 10.
  const m = /^(?:(\d+) h)?(?: ?(\d+) min)?$/.exec(page.text('shower-dark'));
  assert.ok(m, page.text('shower-dark'));
  const minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  assert.ok(Math.abs(minutes - 210) <= 10, String(minutes));
  page.setNow('2026-12-15T12:00:00Z'); // after the Geminids and their grace window: the Ursids are hidden in Quito, so the Quadrantids follow
  page.fn('updateUI')();
  assert.equal(page.text('shower-name'), 'Quadrantids');
  assert.equal(page.text('city-skipped'), 'Not visible from Quito before then: Ursids.');
});

test('across the ten test cities the cards walk through exactly the peaks the oracle lists as visible, in 2026 and 2027', () => {
  const vectors = JSON.parse(readFileSync(new URL('./visibility-vectors.json', import.meta.url), 'utf8')) as {
    vectors: Array<{ code: string; year: number; city: string; visible: boolean }>;
  };
  const queries: Record<string, string> = {
    Bergen: 'bergen', Oslo: 'oslo', Tromsø: 'tromso', Lisbon: 'lisbon', 'Rio de Janeiro': 'rio de janeiro', Sydney: 'sydney',
    'Cape Town': 'cape town', Quito: 'quito', Reykjavík: 'reykjavik', Anchorage: 'anchorage',
  };
  for (const [label, query] of Object.entries(queries)) {
    const page = loadPage({ now: '2026-01-01T00:00:00Z' });
    pick(page, query);
    assert.equal(page.get('state').city?.name.split(',')[0], label.split(',')[0], label);
    // The oracle's visible peaks of the two years, in time order (the table is in time order).
    const order = page.run<Array<{ peak: { id: string; utc: string } }>>('SCHEDULE').map((e) => `${e.peak.id} ${e.peak.utc.slice(0, 4)}`);
    const expected = vectors.vectors.filter((v) => v.city === label && v.visible).map((v) => `${v.code} ${v.year}`)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const walked: string[] = [];
    while (walked.length < expected.length) {
      const card = cardNow(page);
      assert.equal(card.kind, 'countdown', `${label} after ${walked.join(', ')}`);
      walked.push(`${card.id} ${new Date(card.time).toISOString().slice(0, 4)}`);
      page.setNow(new Date(card.time + GRACE).toISOString());
    }
    assert.deepEqual(walked, expected, label);
  }
});

test('a city that sees nothing for a year gets the "No shower visible" card, and Clear brings the showers back', () => {
  const page = loadPage({ now: '2026-11-11T00:00:00Z' });
  // No catalogue city is in this state today; the page keeps the card as a safe fallback.
  page.fn('applyCity')({ name: 'Nowhere', country: 'Testland', lat: 0, lon: 0, tz: 'UTC' }, false);
  page.run('visibleFor = () => () => false');
  page.fn('updateUI')();
  assert.equal(page.text('shower-name'), 'No shower visible');
  assert.equal(page.text('countdown-timer'), '--:--:--:--');
  assert.equal(page.text('shower-date'), 'None of the nine showers can be seen from Nowhere in the next 12 months. Clear the city to see all showers.');
  assert.equal(page.el('shower-date').className, 'event-value event-message');
  assert.equal(page.text('shower-zhr'), 'n/a');
  assert.equal(page.text('shower-moon'), 'n/a');
  assert.equal(page.text('shower-visibility'), 'n/a');
  assert.equal(page.el('row-dark').hidden, true);
  assert.equal(page.el('city-skipped').hidden, true);
  assert.equal(page.el('peak-status').hidden, true);
  assert.equal(page.el('peak-next').hidden, true);
  assert.equal(page.text('card-city'), "For Nowhere, Testland. Times are in the city's time zone.");
});

test('no catalogue city sees fewer than three showers over the next 12 months from 2026-11-11 (spot check of the high latitudes and the far south)', () => {
  // The research found at least 3 of 9 for all 25,007 cities. Spot check the extremes that are in the
  // catalogue here: Longyearbyen (78 N), Ushuaia (55 S), Caleta Olivia (46 S), Tromsø.
  for (const query of ['longyearbyen', 'ushuaia', 'caleta olivia', 'tromso', 'murmansk', 'nuuk']) {
    const page = loadPage({ now: '2026-11-11T00:00:00Z' });
    pick(page, query);
    assert.ok(page.get('state').city, query);
    let now = Date.parse('2026-11-11T00:00:00Z');
    const seen = new Set<string>();
    for (let n = 0; n < 12; n++) {
      page.setNow(new Date(now).toISOString());
      const card = cardNow(page);
      if (card.kind !== 'countdown' || card.time > Date.parse('2027-11-11T00:00:00Z')) break;
      seen.add(card.id);
      now = card.time + GRACE;
    }
    assert.ok(seen.size >= 3, `${query}: ${[...seen].join(', ')}`);
  }
});
