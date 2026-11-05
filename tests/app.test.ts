// The app's logic as the page runs it: the compiled app.js and the vendored suncalc.js, run as
// classic scripts in one Node vm context. There is no DOM: a stub document only takes the
// DOMContentLoaded listener, which never fires here. The clock is fixed. The expected values are
// what the hand-written app.js of 4cfd4aa (before the move to TypeScript) returned.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

interface Upcoming { name: string; peakMonth: number; peakDay: number; zhr: number; region: string; description: string; peakDate: Date; diff: number }
interface Visibility { moonPhaseText: string; visibilityScore: string; visibilityClass: string }

let fixedNow = 0;
/** Date with a fixed "now": new Date() and Date.now() read fixedNow; any other use is the real Date. */
class FixedDate extends Date {
  constructor(...args: [] | [number]) {
    if (args.length === 0) super(fixedNow);
    else super(args[0]);
  }
  static override now(): number { return fixedNow; }
}

const listeners: string[] = [];
const ctx = vm.createContext({ document: { addEventListener: (type: string): void => { listeners.push(type); } }, Date: FixedDate });
ctx.window = ctx; // suncalc.js publishes itself as window.SunCalc
for (const file of ['suncalc.js', 'app.js']) {
  vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), ctx, { filename: file });
}
const findNextShower = ctx.findNextShower as () => Upcoming;
// Objects and arrays from the vm's realm are copied (Array.from, { ...x }) before a deep compare.
const calculateVisibility = ctx.calculateVisibility as (peakDate: Date) => Visibility;
const showers = vm.runInContext('METEOR_SHOWERS', ctx) as { name: string; peakMonth: number; peakDay: number }[];

test('app.js waits for DOMContentLoaded and touches nothing else on load', () => {
  assert.deepEqual(listeners, ['DOMContentLoaded']);
});

test('the nine showers, in calendar order', () => {
  assert.deepEqual(Array.from(showers, (s) => s.name), ['Quadrantids', 'Lyrids', 'Eta Aquariids', 'Delta Aquariids', 'Perseids', 'Orionids', 'Leonids', 'Geminids', 'Ursids']);
});

test('findNextShower: the next peak (12:00 UTC) strictly after now, this year or next', () => {
  const cases: [string, string, string, number][] = [
    ['2026-11-05T10:00:00Z', 'Leonids', '2026-11-17T12:00:00.000Z', 1044000000],
    ['2026-11-17T11:59:59Z', 'Leonids', '2026-11-17T12:00:00.000Z', 1000],
    ['2026-11-17T12:00:01Z', 'Geminids', '2026-12-14T12:00:00.000Z', 2332799000],
    ['2026-12-22T12:00:01Z', 'Quadrantids', '2027-01-03T12:00:00.000Z', 1036799000],
    ['2027-01-01T00:00:00Z', 'Quadrantids', '2027-01-03T12:00:00.000Z', 216000000],
    ['2027-08-12T12:00:00Z', 'Orionids', '2027-10-21T12:00:00.000Z', 6048000000],
  ];
  for (const [clock, name, peak, diff] of cases) {
    fixedNow = Date.parse(clock);
    const next = findNextShower();
    assert.deepEqual([next.name, next.peakDate.toISOString(), next.diff], [name, peak, diff], clock);
  }
});

test('calculateVisibility: moon phase, illumination and rating at every peak of 2026 and 2027', () => {
  const expected: [string, string, string][] = [
    ['2026-01-03', 'Full Moon (100% illuminated)', 'POOR'],
    ['2026-04-22', 'Waxing Crescent (31% illuminated)', 'GOOD'],
    ['2026-05-06', 'Waning Gibbous (80% illuminated)', 'POOR'],
    ['2026-07-30', 'Full Moon (99% illuminated)', 'POOR'],
    ['2026-08-12', 'New Moon (0% illuminated)', 'EXCELLENT'],
    ['2026-10-21', 'Waxing Gibbous (77% illuminated)', 'POOR'],
    ['2026-11-17', 'First Quarter (51% illuminated)', 'GOOD'],
    ['2026-12-14', 'Waxing Crescent (25% illuminated)', 'GOOD'],
    ['2026-12-22', 'Waxing Gibbous (97% illuminated)', 'POOR'],
    ['2027-01-03', 'Waning Crescent (16% illuminated)', 'EXCELLENT'],
    ['2027-04-22', 'Waning Gibbous (97% illuminated)', 'POOR'],
    ['2027-05-06', 'New Moon (0% illuminated)', 'EXCELLENT'],
    ['2027-07-30', 'Waning Crescent (11% illuminated)', 'EXCELLENT'],
    ['2027-08-12', 'Waxing Gibbous (81% illuminated)', 'POOR'],
    ['2027-10-21', 'Waning Gibbous (64% illuminated)', 'POOR'],
    ['2027-11-17', 'Waning Gibbous (87% illuminated)', 'POOR'],
    ['2027-12-14', 'Full Moon (99% illuminated)', 'POOR'],
    ['2027-12-22', 'Waning Crescent (27% illuminated)', 'GOOD'],
  ];
  const peaks = [2026, 2027].flatMap((year) => showers.map((s) => new Date(Date.UTC(year, s.peakMonth, s.peakDay, 12, 0, 0))));
  assert.equal(peaks.length, expected.length);
  peaks.forEach((peak, i) => {
    const [day, text, score] = expected[i] ?? ['', '', ''];
    assert.equal(peak.toISOString().slice(0, 10), day);
    assert.deepEqual({ ...calculateVisibility(peak) }, { moonPhaseText: text, visibilityScore: score, visibilityClass: `visibility-${score.toLowerCase()}` }, day);
  });
});
