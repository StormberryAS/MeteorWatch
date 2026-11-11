// The build: the committed app.js, peaks.js and visibility.js are what the TypeScript compiles to, and
// the only JavaScript in the repository is that compiled output plus the vendored SunCalc 1.8.0 and
// the copied city catalogue (cities.js), each marked for GitHub's language bar (Marcos, 2026-10-17:
// no hand-written JavaScript).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const COMPILED = ['app.js', 'peaks.js', 'visibility.js'];
const VENDORED = ['suncalc.js'];
/** Copied byte for byte from another repository (the shared Stormberry Labs city catalogue), never edited here. */
const GENERATED_COPIED = ['cities.js'];

/** SunCalc 1.8.0 exactly as vendored in the Labs repositories (sha256 of suncalc.js), as in SunApp's tests. */
const SUNCALC_SHA256 = 'e17fa013a5ab354c22844f3cebecd4a2b866518e5b63d132d537ea6578cb217b';

/** cities.js as SunApp's update_cities.py wrote it on 2026-08-21: the same bytes in nine Labs repositories. */
const CITIES_SHA256 = '2f08782c7f41df5eb95c15a4a668a389505bd4bfba059040d048cbc1324afce2';
const CITIES_BYTES = 1135691;

test('tools/build-ts.sh --check passes: app.js, peaks.js and visibility.js equal a fresh compile', () => {
  const out = execFileSync(`${root}tools/build-ts.sh`, ['--check'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, /^build-ts: app\.js matches ts\/app\.ts$/m);
  assert.match(out, /^build-ts: peaks\.js matches ts\/peaks\.ts$/m);
  assert.match(out, /^build-ts: visibility\.js matches ts\/visibility\.ts$/m);
  assert.match(out, /^city parity OK: 25007 cities/m);
  assert.match(out, /^build-ts: check passed$/m);
});

test('the vendored suncalc.js is SunCalc 1.8.0 byte for byte', () => {
  assert.equal(createHash('sha256').update(readFileSync(`${root}suncalc.js`)).digest('hex'), SUNCALC_SHA256);
});

test('cities.js is the shared city catalogue byte for byte (the pin), with the generator\'s header', () => {
  const bytes = readFileSync(`${root}cities.js`);
  assert.equal(bytes.length, CITIES_BYTES);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), CITIES_SHA256);
  assert.ok(bytes.toString('utf8').startsWith('// Stormberry Labs shared city catalogue.\n// GENERATED FILE, DO NOT EDIT BY HAND.\n'));
});

test('the only JavaScript is compiled, vendored or copied output, each file marked so', (t) => {
  const git = (...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  let inGit = false;
  try { inGit = git('rev-parse', '--is-inside-work-tree').trim() === 'true'; } catch { inGit = false; }
  if (!inGit) { t.skip('not a git checkout'); return; }
  const js = git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.js', '*.mjs', '*.cjs').split('\0').filter(Boolean);
  assert.deepEqual([...new Set(js)].sort(), [...COMPILED, ...VENDORED, ...GENERATED_COPIED].sort());
  for (const f of [...COMPILED, ...GENERATED_COPIED, 'tests/search-vectors.json', 'tests/visibility-vectors.json']) assert.equal(git('check-attr', 'linguist-generated', '--', f).trim(), `${f}: linguist-generated: true`);
  for (const f of VENDORED) assert.equal(git('check-attr', 'linguist-vendored', '--', f).trim(), `${f}: linguist-vendored: true`);
});
