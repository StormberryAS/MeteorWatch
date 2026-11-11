// The table of peak instants (ts/peaks.ts, written by tools/gen-peaks.py), run as the page runs it:
// the compiled peaks.js in a Node vm context, as a classic script.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

interface Peak { id: string; name: string; utc: string; lambdaSun: number; zhr: number }

const root = fileURLToPath(new URL('../', import.meta.url));
const ctx = vm.createContext({});
vm.runInContext(readFileSync(`${root}peaks.js`, 'utf8'), ctx, { filename: 'peaks.js' });
const PEAKS = Array.from(vm.runInContext('PEAKS', ctx) as Peak[], (p) => ({ ...p }));
const FIRST_YEAR = vm.runInContext('PEAKS_FIRST_YEAR', ctx) as number;
const LAST_YEAR = vm.runInContext('PEAKS_LAST_YEAR', ctx) as number;

const HOUR = 3600 * 1000;
const ms = (utc: string): number => Date.parse(utc);

/** IMO Working List of Visual Meteor Showers, Table 5, page 25 of the IMO 2026 and 2027 calendars. */
const IMO: Record<string, { name: string; lambdaSun: number; zhr: number }> = {
  QUA: { name: 'Quadrantids', lambdaSun: 283.15, zhr: 80 },
  LYR: { name: 'Lyrids', lambdaSun: 32.32, zhr: 18 },
  ETA: { name: 'Eta Aquariids', lambdaSun: 45.5, zhr: 50 },
  SDA: { name: 'Delta Aquariids', lambdaSun: 128, zhr: 25 },
  PER: { name: 'Perseids', lambdaSun: 140, zhr: 100 },
  ORI: { name: 'Orionids', lambdaSun: 208, zhr: 20 },
  LEO: { name: 'Leonids', lambdaSun: 235.27, zhr: 15 },
  GEM: { name: 'Geminids', lambdaSun: 262.2, zhr: 150 },
  URS: { name: 'Ursids', lambdaSun: 270.7, zhr: 10 },
};

const peakOf = (id: string, year: number): Peak => {
  const found = PEAKS.filter((p) => p.id === id && p.utc.startsWith(String(year)));
  assert.equal(found.length, 1, `${id} ${year}`);
  return found[0] as Peak;
};

test('every shower has exactly one peak in every year of the table, 2026 to 2037', () => {
  assert.equal(FIRST_YEAR, 2026);
  assert.equal(LAST_YEAR, 2037);
  assert.equal(PEAKS.length, 9 * 12);
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    for (const id of Object.keys(IMO)) peakOf(id, year);
  }
});

test('the rows are sorted by instant, with no instant twice', () => {
  const times = PEAKS.map((p) => ms(p.utc));
  assert.ok(times.every((t) => Number.isFinite(t)), 'every utc parses');
  for (let i = 1; i < times.length; i++) assert.ok((times[i] as number) > (times[i - 1] as number), `${PEAKS[i - 1]?.utc} < ${PEAKS[i]?.utc}`);
  assert.ok(PEAKS.every((p) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(p.utc)), 'ISO UTC to the minute');
});

test("each row records IMO's solar longitude, name and ZHR", () => {
  for (const p of PEAKS) assert.deepEqual({ name: p.name, lambdaSun: p.lambdaSun, zhr: p.zhr }, IMO[p.id], p.id);
});

test('the Quadrantid peak of early January belongs to its own calendar year', () => {
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) assert.match(peakOf('QUA', year).utc, new RegExp(`^${year}-01-0[1-9]T`));
});

// What IMO prints, UT. A range is the span IMO gives. A date alone means IMO prints no time.
const IMO_PRINTED: [string, string, string, string?][] = [
  // 2026 calendar
  ['QUA', '2026-01-03T21:00Z', '2026-01-03T21:00Z'], // "close to 21h UT", p3
  ['LYR', '2026-04-22T19:40Z', '2026-04-22T19:40Z'], // p7
  ['PER', '2026-08-13T02:00Z', '2026-08-13T04:00Z'], // "02h to 04h UT", p11
  ['LEO', '2026-11-17T23:45Z', '2026-11-17T23:45Z'], // p18
  ['GEM', '2026-12-14T14:00Z', '2026-12-14T14:00Z'], // p20
  ['URS', '2026-12-22T22:00Z', '2026-12-22T22:00Z'], // p14
  // 2027 calendar
  ['QUA', '2027-01-04T03:25Z', '2027-01-04T03:25Z'], // p4
  ['LYR', '2027-04-23T01:40Z', '2027-04-23T01:40Z'], // p6
  ['PER', '2027-08-13T08:00Z', '2027-08-13T10:00Z'], // "08h to 10h UT", p11
  ['LEO', '2027-11-18T06:00Z', '2027-11-18T06:00Z'], // p17
  ['GEM', '2027-12-14T20:00Z', '2027-12-14T20:00Z'], // "centred around 20h UT", p14
  ['URS', '2027-12-23T04:00Z', '2027-12-23T04:00Z'], // p20
];

test("the 2026 and 2027 instants are within 1 hour of the times IMO prints", () => {
  for (const [id, from, to] of IMO_PRINTED) {
    const year = Number(from.slice(0, 4));
    const t = ms(peakOf(id, year).utc);
    const gap = Math.max(ms(from) - t, t - ms(to), 0);
    assert.ok(gap <= HOUR, `${id} ${year}: table ${peakOf(id, year).utc}, IMO ${from} to ${to}`);
  }
});

test('where IMO prints a date but no time, the table has the same UTC date', () => {
  const dates: [string, string][] = [
    ['ETA', '2026-05-06'], ['SDA', '2026-07-31'], ['ORI', '2026-10-21'], // Table 5 of the 2026 calendar
    ['SDA', '2027-07-31'], ['ORI', '2027-10-22'], // Table 5 of the 2027 calendar
    // The 2027 calendar prints "May 6, 09h UT" for the Eta Aquariids at 45.5 degrees, but the Sun is
    // at 45.5 degrees at about 15h UT in 2027 (09h is the 2026 time; 09h UT is 45.25 degrees). IMO's
    // printed time disagrees with its own printed longitude. The table keeps the longitude, and the
    // date agrees; the time test above leaves ETA 2027 out for that reason (it would be 6.2 h out).
    ['ETA', '2027-05-06'],
  ];
  for (const [id, date] of dates) assert.equal(peakOf(id, Number(date.slice(0, 4))).utc.slice(0, 10), date, id + ' ' + date);
});

test('the same peak four years apart is four sidereal years apart (the longitude is for the fixed J2000 equinox)', () => {
  for (const id of Object.keys(IMO)) {
    const gap = ms(peakOf(id, 2033).utc) - ms(peakOf(id, 2029).utc);
    assert.ok(Math.abs(gap - 4 * 365.256363 * 24 * HOUR) < HOUR, id);
  }
});

test('the table does not run out within two years: renew it before the last year but one ends', () => {
  // Fails after 1 January of the last year but one of the table, so the table is renewed (python3
  // tools/gen-peaks.py with a later LAST_YEAR) while there are still two years of peaks to come.
  // An APK release is frozen for as long as it stays installed, hence the longer margin.
  const deadline = Date.UTC(LAST_YEAR - 1, 0, 1);
  assert.ok(Date.now() <= deadline, `the peak table ends in ${LAST_YEAR}: extend FIRST_YEAR..LAST_YEAR in tools/gen-peaks.py and regenerate`);
});

test('tools/gen-peaks.py --check passes: ts/peaks.ts is what a fresh generation writes', () => {
  const out = execFileSync('python3', ['-I', `${root}tools/gen-peaks.py`, '--check'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, /^gen-peaks: peaks\.ts matches a fresh generation$/m);
});
