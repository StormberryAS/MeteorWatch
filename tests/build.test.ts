// The build: the committed app.js is what ts/app.ts compiles to, and the only JavaScript in the
// repository is that compiled output plus the vendored SunCalc 1.8.0, each marked for GitHub's
// language bar (Marcos, 2026-10-17: no hand-written JavaScript).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const COMPILED = ['app.js'];
const VENDORED = ['suncalc.js'];

/** SunCalc 1.8.0 exactly as vendored in the Labs repositories (sha256 of suncalc.js), as in SunApp's tests. */
const SUNCALC_SHA256 = 'e17fa013a5ab354c22844f3cebecd4a2b866518e5b63d132d537ea6578cb217b';

test('tools/build-ts.sh --check passes: app.js equals a fresh compile', () => {
  const out = execFileSync(`${root}tools/build-ts.sh`, ['--check'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, /^build-ts: app\.js matches ts\/app\.ts$/m);
  assert.match(out, /^build-ts: check passed$/m);
});

test('the vendored suncalc.js is SunCalc 1.8.0 byte for byte', () => {
  assert.equal(createHash('sha256').update(readFileSync(`${root}suncalc.js`)).digest('hex'), SUNCALC_SHA256);
});

test('the only JavaScript is compiled or vendored output, each file marked so', (t) => {
  const git = (...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  let inGit = false;
  try { inGit = git('rev-parse', '--is-inside-work-tree').trim() === 'true'; } catch { inGit = false; }
  if (!inGit) { t.skip('not a git checkout'); return; }
  const js = git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.js', '*.mjs', '*.cjs').split('\0').filter(Boolean);
  assert.deepEqual([...new Set(js)].sort(), [...COMPILED, ...VENDORED].sort());
  for (const f of COMPILED) assert.equal(git('check-attr', 'linguist-generated', '--', f).trim(), `${f}: linguist-generated: true`);
  for (const f of VENDORED) assert.equal(git('check-attr', 'linguist-vendored', '--', f).trim(), `${f}: linguist-vendored: true`);
});
