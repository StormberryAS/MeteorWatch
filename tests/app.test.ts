// The app's logic as the page runs it: the compiled suncalc.js, peaks.js and app.js, run as
// classic scripts in one Node vm context. The document is a stub with a few elements that keep
// their textContent and className; the clock is fixed, and setTimeout only records its delay.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

interface Upcoming { peak: { id: string; name: string; utc: string; zhr: number }; time: number }
interface Visibility { moonPhaseText: string; visibilityScore: string; visibilityClass: string }
interface Element { textContent: string; className: string; classList: { toggle(name: string, force: boolean): void; remove(name: string): void }; long?: boolean }

let fixedNow = 0;
/** Date with a fixed "now": new Date() and Date.now() read fixedNow; any other use is the real Date. */
class FixedDate extends Date {
  constructor(...args: [] | [number]) {
    if (args.length === 0) super(fixedNow);
    else super(args[0]);
  }
  static override now(): number { return fixedNow; }
}

const IDS = ['shower-name', 'countdown-timer', 'shower-date', 'shower-region', 'shower-zhr', 'shower-moon', 'shower-visibility'];
const makeElement = (): Element => {
  const el: Element = {
    textContent: 'n/a', className: 'event-value',
    classList: { toggle: (_name: string, force: boolean): void => { el.long = force; }, remove: (): void => { el.long = false; } },
  };
  return el;
};

/**
 * A fresh page: new elements, new vm context, and the three scripts run again, so the card's
 * module-level state (which shower is shown) never carries over from one test to the next.
 * The tests that call updateUI each start with their own page.
 */
function loadPage() {
  const elements = new Map<string, Element>(IDS.map((id) => [id, makeElement()]));
  const listeners: string[] = [];
  const timeouts: { delay: number }[] = [];
  const counts = { cleared: 0 };
  const ctx = vm.createContext({
    document: {
      hidden: false,
      addEventListener: (type: string): void => { listeners.push(type); },
      getElementById: (id: string): Element | null => elements.get(id) ?? null,
    },
    Date: FixedDate,
    setTimeout: (_fn: () => void, delay: number): number => { timeouts.push({ delay }); return timeouts.length; },
    clearTimeout: (): void => { counts.cleared++; },
  });
  ctx.window = ctx; // suncalc.js publishes itself as window.SunCalc; app.js calls window.setTimeout
  for (const file of ['suncalc.js', 'peaks.js', 'app.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), ctx, { filename: file });
  }
  return {
    ctx, elements, listeners, timeouts, counts,
    updateUI: ctx.updateUI as () => void,
    text: (id: string): string => (elements.get(id) as Element).textContent,
    el: (id: string): Element => elements.get(id) as Element,
  };
}

// The page for the tests of the pure functions, which keep no state.
const base = loadPage();
const { ctx, listeners, timeouts } = base;
const findNextPeak = ctx.findNextPeak as (now: number) => Upcoming | null;
const moonPhaseName = ctx.moonPhaseName as (phase: number) => string;
const rateMoon = ctx.rateMoon as (pct: number) => { visibilityScore: string; visibilityClass: string };
const calculateVisibility = ctx.calculateVisibility as (peakDate: Date) => Visibility;
const formatPeak = ctx.formatPeak as (time: number, timeZone?: string, locale?: string) => string;
const formatCountdown = ctx.formatCountdown as (diff: number) => string;
const nextTickDelay = ctx.nextTickDelay as (now: number) => number;

test('app.js waits for DOMContentLoaded, and for the tab to be seen again, and touches nothing else on load', () => {
  assert.deepEqual(listeners, ['DOMContentLoaded', 'visibilitychange']);
  assert.equal(timeouts.length, 0);
});

test('findNextPeak: the first peak of the table strictly after now, one second either side of a peak', () => {
  const next = (clock: string): Upcoming | null => findNextPeak(Date.parse(clock));
  assert.equal(next('2026-11-17T23:42:59Z')?.peak.name, 'Leonids');
  assert.equal(next('2026-11-17T23:43:00Z')?.peak.name, 'Geminids'); // at the instant itself: the peak has come
  assert.equal(next('2026-11-17T23:43:01Z')?.peak.name, 'Geminids');
  assert.equal(next('2026-12-22T22:08:59Z')?.peak.name, 'Ursids');
  assert.equal(next('2026-12-22T22:09:01Z')?.peak.name, 'Quadrantids');
  assert.equal(next('2026-12-22T22:09:01Z')?.peak.utc, '2027-01-04T03:26Z');
  // The old model changed shower at 12:00 UTC on the day, 12 hours before this Leonid peak.
  assert.equal(next('2026-11-17T12:00:01Z')?.peak.name, 'Leonids');
});

test('findNextPeak: for every row of the table, one second before it is that row and one second after is a later one', () => {
  const rows = Array.from(vm.runInContext('PEAKS', ctx) as { utc: string }[], (p) => Date.parse(p.utc));
  for (const t of rows) {
    assert.equal(findNextPeak(t - 1000)?.time, t);
    const after = findNextPeak(t)?.time;
    assert.ok(after === undefined || after > t);
  }
});

test('findNextPeak: null when the table has run out', () => {
  assert.equal(findNextPeak(Date.parse('2038-01-01T00:00:00Z')), null);
  assert.notEqual(findNextPeak(Date.parse('2037-12-01T00:00:00Z')), null); // the Geminids and Ursids of 2037 are still to come
  assert.equal(findNextPeak(Date.parse('2037-12-22T17:00:00Z'))?.peak.name, 'Ursids');
});

test('moonPhaseName: the four named phases are bands of equal width centred on 0, 0.25, 0.5 and 0.75', () => {
  const cases: [number, string][] = [
    [0, 'New Moon'], [0.029, 'New Moon'], [0.971, 'New Moon'], [0.999, 'New Moon'],
    [0.031, 'Waxing Crescent'], [0.2, 'Waxing Crescent'], [0.219, 'Waxing Crescent'],
    [0.221, 'First Quarter'], [0.25, 'First Quarter'], [0.279, 'First Quarter'],
    [0.281, 'Waxing Gibbous'], [0.4, 'Waxing Gibbous'], [0.469, 'Waxing Gibbous'],
    [0.471, 'Full Moon'], [0.5, 'Full Moon'], [0.529, 'Full Moon'],
    [0.531, 'Waning Gibbous'], [0.6, 'Waning Gibbous'], [0.719, 'Waning Gibbous'],
    [0.721, 'Last Quarter'], [0.75, 'Last Quarter'], [0.779, 'Last Quarter'],
    [0.781, 'Waning Crescent'], [0.9, 'Waning Crescent'], [0.969, 'Waning Crescent'],
  ];
  for (const [phase, name] of cases) assert.equal(moonPhaseName(phase), name, String(phase));
  // The edges of a named phase belong to it, on both sides.
  for (const [phase, name] of [[0.03, 'New Moon'], [0.97, 'New Moon'], [0.22, 'First Quarter'], [0.28, 'First Quarter'], [0.47, 'Full Moon'], [0.53, 'Full Moon'], [0.72, 'Last Quarter'], [0.78, 'Last Quarter']] as [number, string][]) {
    assert.equal(moonPhaseName(phase), name, String(phase));
  }
  // A 99% lit Moon just before full (phase 0.49) was "Waxing Gibbous" under the old, lopsided bands.
  assert.equal(moonPhaseName(0.49), 'Full Moon');
  // Symmetry: a phase and its mirror (1 - phase) get mirrored names, over every thousandth.
  const mirror = (n: string): string => n.replace('Waxing', 'Waning').replace('First', 'Last');
  for (let i = 1; i < 1000; i++) {
    const a = moonPhaseName(i / 1000);
    const b = moonPhaseName((1000 - i) / 1000);
    assert.ok((a === b && (a === 'New Moon' || a === 'Full Moon')) || b === mirror(a) || a === mirror(b), `${i / 1000}: ${a} / ${b}`);
  }
});

test('rateMoon: under 20% excellent, 20 to 59% good, 60% and over poor', () => {
  const cases: [number, string][] = [[0, 'EXCELLENT'], [19, 'EXCELLENT'], [20, 'GOOD'], [59, 'GOOD'], [60, 'POOR'], [100, 'POOR']];
  for (const [pct, score] of cases) {
    assert.deepEqual({ ...rateMoon(pct) }, { visibilityScore: score, visibilityClass: `visibility-${score.toLowerCase()}` }, String(pct));
  }
});

test('calculateVisibility: the rating follows the rounded percentage that is shown', () => {
  const real = ctx.SunCalc.getMoonIllumination;
  try {
    const rated = (fraction: number): [string, string] => {
      ctx.SunCalc.getMoonIllumination = () => ({ fraction, phase: 0.6, angle: 0 });
      const v = calculateVisibility(new Date(0));
      return [v.moonPhaseText, v.visibilityScore];
    };
    assert.deepEqual(rated(0.5996), ['Waning Gibbous (60% illuminated)', 'POOR']); // 59.96% shows as 60%
    assert.deepEqual(rated(0.5949), ['Waning Gibbous (59% illuminated)', 'GOOD']);
    assert.deepEqual(rated(0.1996), ['Waning Gibbous (20% illuminated)', 'GOOD']); // 19.96% shows as 20%
    assert.deepEqual(rated(0.1949), ['Waning Gibbous (19% illuminated)', 'EXCELLENT']);
  } finally {
    ctx.SunCalc.getMoonIllumination = real;
  }
});

test('the Moon is evaluated at the true peak instant, not at 12:00 UTC', () => {
  const page = loadPage();
  const ctx = page.ctx;
  const real = ctx.SunCalc.getMoonIllumination;
  const seen: number[] = [];
  try {
    ctx.SunCalc.getMoonIllumination = (d: Date) => { seen.push(d.getTime()); return real(d); };
    fixedNow = Date.parse('2026-11-05T10:00:00Z');
    page.updateUI();
  } finally {
    ctx.SunCalc.getMoonIllumination = real;
  }
  assert.deepEqual(seen, [Date.parse('2026-11-17T23:43:00Z')]);
});

test('formatCountdown: days, hours, minutes and seconds, with three-digit days when needed', () => {
  assert.equal(formatCountdown(0), '00:00:00:00');
  assert.equal(formatCountdown(999), '00:00:00:00');
  assert.equal(formatCountdown(1000), '00:00:00:01');
  assert.equal(formatCountdown(((109 * 24 + 1) * 3600 + 2 * 60 + 3) * 1000 + 500), '109:01:02:03');
  assert.equal(formatCountdown(-5000), '00:00:00:00');
});

test('nextTickDelay: the time to the next whole second of the clock', () => {
  assert.equal(nextTickDelay(5000), 1000);
  assert.equal(nextTickDelay(5001), 999);
  assert.equal(nextTickDelay(5500), 500);
  assert.equal(nextTickDelay(5999), 1);
});

test('formatPeak: date and time in the viewer\'s zone, with the zone name', () => {
  const leonids = Date.parse('2026-11-17T23:43:00Z');
  assert.equal(formatPeak(leonids, 'Europe/Oslo', 'en-GB'), 'Wed, 18 Nov 2026, 00:43 CET');
  assert.equal(formatPeak(leonids, 'Pacific/Auckland', 'en-GB'), 'Wed, 18 Nov 2026, 12:43 GMT+13');
  assert.equal(formatPeak(leonids, 'America/Los_Angeles', 'en-GB'), 'Tue, 17 Nov 2026, 15:43 GMT-8');
  // Summer time: the Perseids in Oslo are on CEST, in Auckland on NZST (winter).
  const perseids = Date.parse('2027-08-13T08:11:00Z');
  assert.equal(formatPeak(perseids, 'Europe/Oslo', 'en-GB'), 'Fri, 13 Aug 2027, 10:11 CEST');
  assert.equal(formatPeak(perseids, 'Pacific/Auckland', 'en-GB'), 'Fri, 13 Aug 2027, 20:11 GMT+12');
  // A zone at UTC+13 sees the next day (the old page showed the date of 12:00 UTC with no time).
  assert.match(formatPeak(Date.parse('2027-01-04T03:26:00Z'), 'Pacific/Auckland', 'en-GB'), /^Mon, 4 Jan 2027, 16:26 /);
});

test('updateUI fills the card, schedules one tick on the next whole second and follows a change of time zone', () => {
  const { updateUI, text, el, timeouts, counts } = loadPage();
  const savedTz = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Oslo';
    fixedNow = Date.parse('2026-11-05T10:00:00.250Z');
    const before = timeouts.length;
    updateUI();
    assert.equal(text('shower-name'), 'Leonids');
    assert.equal(text('countdown-timer'), '12:13:42:59'); // 2026-11-17T23:43:00Z minus 10:00:00.250
    assert.equal(el('countdown-timer').long, false);
    assert.equal(text('shower-zhr'), 'ZHR 15');
    assert.equal(text('shower-region'), 'Both, better in the north');
    assert.match(text('shower-moon'), /^[A-Za-z ]+ \(\d+% illuminated\)$/);
    assert.match(el('shower-visibility').className, /^event-value visibility-pill visibility-(excellent|good|poor)$/);
    assert.equal(timeouts.length, before + 1);
    assert.equal(timeouts[timeouts.length - 1]?.delay, 750);
    const oslo = text('shower-date');
    assert.match(oslo, /00:43/);
    // The device changes zone while the page is open: the next tick formats the peak again.
    process.env.TZ = 'Pacific/Auckland';
    fixedNow += 1000;
    updateUI();
    const auckland = text('shower-date');
    assert.notEqual(auckland, oslo);
    assert.match(auckland, /12:43/);
    assert.ok(counts.cleared >= 1, 'the pending timer is replaced, not doubled');
  } finally {
    if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz;
  }
});

test('updateUI: three-digit days take the smaller type size (class countdown-long), and the end of the table does not', () => {
  const { updateUI, text, el } = loadPage();
  fixedNow = Date.parse('2027-01-05T00:00:00Z');
  updateUI();
  assert.equal(text('shower-name'), 'Lyrids');
  assert.match(text('countdown-timer'), /^\d{3}:/);
  assert.equal(el('countdown-timer').long, true);
  fixedNow = Date.parse('2038-01-02T00:00:00Z');
  updateUI();
  assert.equal(el('countdown-timer').long, false);
});

test('updateUI: when the table has run out the card says so', () => {
  const { updateUI, text, el } = loadPage();
  fixedNow = Date.parse('2038-01-02T00:00:00Z');
  updateUI();
  assert.equal(text('shower-name'), 'No peak data');
  assert.equal(text('countdown-timer'), '--:--:--:--');
  assert.match(text('shower-date'), /only knows peaks up to the end of 2037/);
  assert.doesNotMatch(text('shower-date'), /[Rr]eload/); // the APK bundles the page: a reload changes nothing
  assert.equal(el('shower-date').className, 'event-value event-message');
  assert.equal(el('shower-visibility').className, 'event-value');
  // And it recovers if the clock is put back.
  fixedNow = Date.parse('2026-11-05T10:00:00Z');
  updateUI();
  assert.equal(text('shower-name'), 'Leonids');
  assert.equal(el('shower-date').className, 'event-value'); // the full-width style goes with the message
});
