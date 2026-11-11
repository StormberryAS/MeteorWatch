// The city filter's rule (ts/visibility.ts, compiled to visibility.js), run as the page runs it:
// the compiled scripts in a Node vm context. The rule is held to the Skyfield oracle (JPL DE440s,
// geometric altitudes) in tests/visibility-vectors.json: 180 cells, every one of the 9 showers at
// its 2026 and 2027 peak for 10 cities. The page must give the same visible or hidden result in all
// 180, and minutes within 10 of the oracle's. Those cells are far from the limits of the rule; the
// 71 cells of tests/visibility-edge-vectors.json are near them (0.2 to 1 degree from a threshold),
// and the page must give the same visible or hidden result there too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPage } from './load.ts';

interface Cell { code: string; year: number; city: string; lat: number; lon: number; tz: string; minutes: number; visible: boolean }
const vectors = JSON.parse(readFileSync(new URL('./visibility-vectors.json', import.meta.url), 'utf8')) as {
  about: string; source: { path: string; sha256: string }; rule: string; vectors: Cell[];
};

interface EdgeCell extends Cell { margin: number }
const edgeVectors = JSON.parse(readFileSync(new URL('./visibility-edge-vectors.json', import.meta.url), 'utf8')) as {
  about: string; source: { path: string; sha256: string }; rule: string; vectors: EdgeCell[];
};

const page = loadPage({ cities: 'lazy', init: false });
const gmstDeg = page.run<(ms: number) => number>('gmstDeg');
const radiantAltitudeDeg = page.run<(ms: number, lat: number, lon: number, ra: number, dec: number) => number>('radiantAltitudeDeg');
const darkRadiantMinutes = page.run<(peakMs: number, ra: number, dec: number, lat: number, lon: number) => number>('darkRadiantMinutes');
const isVisibleMinutes = page.run<(minutes: number) => boolean>('isVisibleMinutes');
const PEAKS = page.run<Array<{ id: string; utc: string; ra: number; dec: number }>>('PEAKS');

test('the constants are rule A: Sun at or below -12 degrees, radiant at or above 15, 30 minutes, 12 hours either side, 5 minute step', () => {
  assert.equal(page.run('VIS_SUN_MAX_DEG'), -12);
  assert.equal(page.run('VIS_RADIANT_MIN_DEG'), 15);
  assert.equal(page.run('VIS_MIN_MINUTES'), 30);
  assert.equal(page.run('VIS_HALF_WINDOW_MS'), 12 * 3600 * 1000);
  assert.equal(page.run('VIS_STEP_MS'), 5 * 60 * 1000);
  assert.equal(isVisibleMinutes(29), false);
  assert.equal(isVisibleMinutes(30), true);
});

test('gmstDeg: the two worked examples of Meeus, Astronomical Algorithms, chapter 12', () => {
  // Example 12.a: 1987 April 10 at 0h UT, theta0 = 197.693195 degrees.
  assert.ok(Math.abs(gmstDeg(Date.UTC(1987, 3, 10, 0, 0, 0)) - 197.693195) < 1e-5);
  // Example 12.b: 1987 April 10 at 19h21m00s UT, theta0 = 128.7378734 degrees.
  assert.ok(Math.abs(gmstDeg(Date.UTC(1987, 3, 10, 19, 21, 0)) - 128.7378734) < 1e-5);
  // Always in [0, 360).
  for (const t of [Date.UTC(1970, 0, 1), Date.UTC(2026, 10, 11, 12), Date.UTC(2037, 11, 22, 17, 54), Date.UTC(1950, 5, 5)]) {
    const g = gmstDeg(t);
    assert.ok(g >= 0 && g < 360, String(g));
  }
});

test('radiantAltitudeDeg: overhead on the meridian, on the horizon at the pole of the sky, symmetric either side', () => {
  const t = Date.UTC(2026, 10, 17, 23, 43);
  const lat = 45, lon = 10;
  const raOnMeridian = gmstDeg(t) + lon;
  assert.ok(Math.abs(radiantAltitudeDeg(t, lat, lon, raOnMeridian, 45) - 90) < 1e-9);
  // A point on the celestial equator crosses the meridian at 90 - lat.
  assert.ok(Math.abs(radiantAltitudeDeg(t, lat, lon, raOnMeridian, 0) - 45) < 1e-9);
  // The altitude of the celestial pole is the latitude, whatever the time.
  assert.ok(Math.abs(radiantAltitudeDeg(t, lat, lon, 0, 90) - lat) < 1e-9);
  // Six hours (90 degrees) either side of the meridian: the same altitude.
  const east = radiantAltitudeDeg(t, lat, lon, raOnMeridian + 90, 20);
  const west = radiantAltitudeDeg(t, lat, lon, raOnMeridian - 90, 20);
  assert.ok(Math.abs(east - west) < 1e-9);
});

test('darkRadiantMinutes: 289 samples from 12 hours before to 12 hours after the peak, 5 minutes apart, both ends included', () => {
  const peak = Date.parse('2026-11-17T23:43:00Z');
  const real = page.run<{ getPosition: (d: Date, lat: number, lon: number) => { altitude: number } }>('SunCalc');
  const originalGetPosition = real.getPosition;
  const times: number[] = [];
  try {
    // The Sun at -20 degrees all the time, and a radiant that is always at the zenith of a polar observer:
    // every sample counts.
    real.getPosition = (d: Date) => { times.push(d.getTime()); return { altitude: (-20 * Math.PI) / 180 }; };
    const minutes = darkRadiantMinutes(peak, 0, 90, 90, 0);
    assert.equal(times.length, 289);
    assert.equal(times[0], peak - 12 * 3600 * 1000);
    assert.equal(times[288], peak + 12 * 3600 * 1000);
    for (let i = 1; i < times.length; i++) assert.equal((times[i] as number) - (times[i - 1] as number), 5 * 60 * 1000);
    assert.equal(minutes, 289 * 5);
    // The Sun at -12 degrees exactly still counts (at or below); at -11.9 it does not.
    real.getPosition = () => ({ altitude: (-12 * Math.PI) / 180 });
    assert.equal(darkRadiantMinutes(peak, 0, 90, 90, 0), 289 * 5);
    real.getPosition = () => ({ altitude: (-11.9 * Math.PI) / 180 });
    assert.equal(darkRadiantMinutes(peak, 0, 90, 90, 0), 0);
    // A radiant at 14.9 degrees is too low, at 15.01 it counts: the pole of the sky is as high as the latitude.
    real.getPosition = () => ({ altitude: (-20 * Math.PI) / 180 });
    assert.equal(darkRadiantMinutes(peak, 0, 90, 15.01, 0), 289 * 5);
    assert.equal(darkRadiantMinutes(peak, 0, 90, 14.9, 0), 0);
  } finally {
    real.getPosition = originalGetPosition;
  }
});

test('the vectors file is the 180 cells of 9 showers, 2 years and 10 cities, from the research data', () => {
  assert.equal(vectors.vectors.length, 180);
  assert.match(vectors.source.sha256, /^[0-9a-f]{64}$/);
  assert.match(vectors.rule, /-12 degrees/);
  assert.equal(new Set(vectors.vectors.map((v) => v.city)).size, 10);
  assert.equal(new Set(vectors.vectors.map((v) => v.code)).size, 9);
  assert.deepEqual([...new Set(vectors.vectors.map((v) => v.year))], [2026, 2027]);
});

test('all 180 cells give the same visible or hidden result as the Skyfield oracle, and minutes within 10', () => {
  const wrong: string[] = [];
  let worst = 0;
  for (const cell of vectors.vectors) {
    const peak = PEAKS.find((p) => p.id === cell.code && p.utc.startsWith(String(cell.year)));
    assert.ok(peak, `${cell.code} ${cell.year}`);
    const minutes = darkRadiantMinutes(Date.parse(peak.utc), peak.ra, peak.dec, cell.lat, cell.lon);
    const visible = isVisibleMinutes(minutes);
    worst = Math.max(worst, Math.abs(minutes - cell.minutes));
    if (visible !== cell.visible) wrong.push(`${cell.code} ${cell.year} ${cell.city}: page ${minutes} min (${visible}), oracle ${cell.minutes} min (${cell.visible})`);
    else if (Math.abs(minutes - cell.minutes) > 10) wrong.push(`${cell.code} ${cell.year} ${cell.city}: page ${minutes} min, oracle ${cell.minutes} min`);
  }
  assert.deepEqual(wrong, []);
  assert.ok(worst <= 10, `worst difference ${worst} min`);
});

test('the edge cells (0.2 to 1 degree from a limit of the rule) give the same visible or hidden result as the oracle, minutes within 15', () => {
  assert.equal(edgeVectors.vectors.length, 71);
  assert.match(edgeVectors.source.sha256, /^[0-9a-f]{64}$/);
  // Every shower has edge cells, so the Eta Aquariid limit near 44 N and the Perseid limit near 63 N are held.
  assert.equal(new Set(edgeVectors.vectors.map((v) => v.code)).size, 9);
  for (const city of ['Bordeaux, France', 'Toronto, Canada', 'Trondheim, Norway']) assert.ok(edgeVectors.vectors.some((v) => v.city === city), city);
  const wrong: string[] = [];
  let worst = 0;
  for (const cell of edgeVectors.vectors) {
    assert.ok(Math.abs(cell.margin) >= 0.2 && Math.abs(cell.margin) < 1, `${cell.code} ${cell.year} ${cell.city}: margin ${cell.margin}`);
    const peak = PEAKS.find((p) => p.id === cell.code && p.utc.startsWith(String(cell.year)));
    assert.ok(peak, `${cell.code} ${cell.year}`);
    const minutes = darkRadiantMinutes(Date.parse(peak.utc), peak.ra, peak.dec, cell.lat, cell.lon);
    const visible = isVisibleMinutes(minutes);
    worst = Math.max(worst, Math.abs(minutes - cell.minutes));
    if (visible !== cell.visible) wrong.push(`${cell.code} ${cell.year} ${cell.city}: page ${minutes} min (${visible}), oracle ${cell.minutes} min (${cell.visible}), margin ${cell.margin}`);
  }
  assert.deepEqual(wrong, []);
  assert.ok(worst <= 15, `worst difference ${worst} min`);
});

test('the limit cases of the research note: Tromsø hides the April Lyrids, Bergen shows the Perseids, Quito hides the Ursids', () => {
  const cell = (code: string, year: number, city: string): Cell => vectors.vectors.find((v) => v.code === code && v.year === year && v.city === city) as Cell;
  assert.equal(cell('LYR', 2026, 'Tromsø').visible, false);
  assert.equal(cell('PER', 2026, 'Bergen').visible, true);
  assert.equal(cell('URS', 2026, 'Quito').visible, false);
  assert.equal(cell('GEM', 2026, 'Sydney').visible, true);
});
