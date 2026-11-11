// What the published page may and may not do, checked on the files as they are published: every
// script and style it loads comes from its own origin, the compiled scripts contain no way to
// reach another host or the device's location, and cities.js is added by the page (never by
// index.html) with the cache stamp of the pinned file. Node reads the files; nothing is run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const CITIES_PIN = '2f08782c7f41df5eb95c15a4a668a389505bd4bfba059040d048cbc1324afce2';

test('every script and stylesheet index.html loads is a plain relative path in this repository, with a stamp', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1] as string);
  assert.deepEqual(scripts.map((s) => s.replace(/\?v=[0-9a-f]{8}$/, '')), ['suncalc.js', 'peaks.js', 'visibility.js', 'app.js']);
  const sheets = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]*)"/g)].map((m) => m[1] as string);
  assert.deepEqual(sheets.map((s) => s.replace(/\?v=[0-9a-f]{8}$/, '')), ['fonts/inter/inter.css', 'style.css']);
  for (const url of [...scripts, ...sheets]) {
    assert.match(url, /^[a-z0-9][a-z0-9/_.-]*\.(js|css)\?v=[0-9a-f]{8}$/i, url);
  }
});

test('nothing in index.html, style.css or the fonts stylesheet names another origin for a file to load', () => {
  // src and href of anything that loads (not the links a person may click, and not the canonical address).
  const loads = [...html.matchAll(/<(?:script|img|link|iframe|source|video|audio)\b(?![^>]*rel="canonical")[^>]*\b(?:src|href)="([^"]*)"/g)].map((m) => m[1] as string);
  for (const url of loads) assert.doesNotMatch(url, /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i, url);
  for (const css of ['style.css', 'fonts/inter/inter.css']) assert.doesNotMatch(read(css), /url\(\s*['"]?(?:[a-z][a-z0-9+.-]*:|\/\/)/i, css);
  assert.doesNotMatch(html, /<(?:iframe|form|object|embed)\b/i);
});

test('index.html does not load cities.js: the page adds it when the field is used', () => {
  assert.doesNotMatch(html, /cities\.js/);
});

test('app.js and visibility.js have no way to reach another host, the location, a service worker or a cookie', () => {
  for (const file of ['app.js', 'visibility.js', 'peaks.js']) {
    const src = read(file);
    for (const banned of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'navigator.geolocation', 'serviceWorker', 'document.cookie', 'import(', 'http://', 'https://']) {
      assert.ok(!src.includes(banned), `${file} contains ${banned}`);
    }
  }
});

test('the only thing the page keeps on the device is the city record, under one key', () => {
  const app = read('app.js');
  assert.deepEqual([...new Set([...app.matchAll(/(?:getItem|setItem|removeItem)\(([^,)]*)/g)].map((m) => m[1]))], ['CITY_STORAGE_KEY']);
  assert.match(app, /const CITY_STORAGE_KEY = 'meteorwatch\.city';/);
  assert.doesNotMatch(app, /sessionStorage|indexedDB|caches\./);
});

test('app.js names cities.js once, as a same-origin address with the stamp of the pinned file', () => {
  const app = read('app.js');
  const literals = [...app.matchAll(/(['"])(\.\/[^'"]*cities\.js[^'"]*)\1/g)].map((m) => m[2]);
  assert.deepEqual(literals, [`./cities.js?v=${CITIES_PIN.slice(0, 8)}`]);
  // The TypeScript keeps the bare address; bump_assets.py adds the stamp to the compiled file.
  assert.match(read('ts/app.ts'), /script\.src = '\.\/cities\.js';/);
});

test('cities.js starts with the generator\'s two header lines', () => {
  assert.match(read('cities.js'), /^\/\/ Stormberry Labs shared city catalogue\.\n\/\/ GENERATED FILE, DO NOT EDIT BY HAND\.\n/);
});

test('no hand-written JavaScript in ts/, tests/ or tools/', () => {
  for (const dir of ['ts', 'tests', 'tools']) {
    assert.deepEqual(readdirSync(new URL(`../${dir}/`, import.meta.url)).filter((n) => /\.(m?js|cjs)$/.test(n)), [], dir);
  }
});

test('the page says it calculates in the browser and never that it works offline', () => {
  for (const file of ['index.html', 'README.md', 'ts/app.ts']) assert.doesNotMatch(read(file), /\boffline\b/i, file);
  assert.match(html, /Runs entirely in your browser/);
});

test('every new or changed sentence of the page uses British spelling and no dash that the style rule forbids', () => {
  const strip = (markup: string): string => markup.replace(/<[^>]*>/g, ' ');
  const cityCard = /<section class="card city-card"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
  const footer = /<div class="footer-powered">[\s\S]*?<\/div>/.exec(html)?.[0] ?? '';
  assert.ok(cityCard.length > 500 && footer.length > 100);
  for (const text of [strip(cityCard), strip(footer), read('ts/app.ts'), read('ts/visibility.ts')]) {
    assert.doesNotMatch(text, /\u2014|\u2013|\s--\s/);
    assert.doesNotMatch(text, /\b(?:color|center|organize|neighbor)\b/i);
  }
});
