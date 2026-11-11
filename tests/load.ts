// Loads the page's scripts into a Node vm context the way a browser does: as classic scripts
// sharing one global scope, suncalc.js, peaks.js, visibility.js, then (in the 'eager' mode)
// cities.js, then the compiled app.js. Used by the Node tests (tests/*.test.ts) to call the
// page's own functions with no change to the page code. Not a test file itself.
//
// Ported on 11 November 2026 from MoonApp's tests/load.ts (itself from SunApp's), cut to what this
// page uses: no canvas, no tab buttons, and these additions. The document is a stub with a
// <head>, so app.js can add cities.js to the page as a script element: in the 'lazy' mode (the
// real page) nothing runs cities.js until the page adds it, and the stub then runs it, fails it or
// holds it (option `scripts`). The clock is fixed and moves only when a test asks (setNow). A
// fake localStorage can be absent, can throw on the property read, or can throw on a write.
//
// The document stub hands out one inert element per id; listeners are recorded and fired only
// when a test asks (fire, fireOn); setTimeout only records its delay.
//
// Two traps, written down so nobody has to find them again:
//  * Everything the page code creates (a Date, an array, a promise) belongs to the context's
//    realm, so `instanceof Date` in this realm is false for a page Date. Tests compare only
//    primitives: strings, numbers, booleans, and JSON. To call a page function, take it with
//    fn('name'), typed by PageFunctions below, and call it from TypeScript: code inside a string
//    passed to run() is JavaScript the strict check never reads, so run() is for reading a value.
//  * Top-level const and let of a classic script are not properties of the global object.
//    run('state.city') reaches them, because the code runs as a script in that same global
//    scope; ctx.state does not.

import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const REPO = new URL('../', import.meta.url);

/** A stand-in for one DOM element: the properties and methods app.js touches. */
export class FakeElement {
  id: string;
  readonly tagName: string;
  value = '';
  className = '';
  hidden = false;
  src = '';
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(e: unknown) => unknown>>();
  readonly children: FakeElement[] = [];
  private html = '';
  private readonly dom: FakeDom;

  constructor(dom: FakeDom, id: string, tagName = 'DIV') {
    this.dom = dom;
    this.id = id;
    this.tagName = tagName;
  }

  get innerHTML(): string { return this.html; }
  set innerHTML(v: string) { this.html = String(v); if (this.html === '') this.children.length = 0; }
  /** Text, as a browser would give it back: the markup with its tags removed. */
  get textContent(): string { return this.html.replace(/<[^>]*>/g, ''); }
  set textContent(v: string | null) {
    this.html = String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  setAttribute(name: string, v: string): void {
    this.attributes.set(name, String(v));
    if (name === 'hidden') this.hidden = true;
    if (name === 'id') this.id = String(v);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === 'hidden') this.hidden = false;
  }
  getAttribute(name: string): string | null {
    if (name === 'hidden') return this.hidden ? '' : null;
    return this.attributes.get(name) ?? null;
  }
  readonly classList = {
    set: new Set<string>(),
    toggle(name: string, on?: boolean): boolean {
      const want = on ?? !this.set.has(name);
      if (want) this.set.add(name); else this.set.delete(name);
      return want;
    },
    contains(name: string): boolean { return this.set.has(name); },
    add(name: string): void { this.set.add(name); },
    remove(name: string): void { this.set.delete(name); },
  };
  addEventListener(type: string, fn: (e: unknown) => unknown): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  /** Fires this element's listeners of one type, as the browser would. */
  fire(type: string, event: Record<string, unknown> = {}): void {
    for (const fn of this.listeners.get(type) ?? []) fn({ type, target: this, ...event });
  }
  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    this.dom.onAppend?.(this, child);
    return child;
  }
  remove(): void {
    for (const el of this.dom.elements.values()) {
      const at = el.children.indexOf(this);
      if (at >= 0) el.children.splice(at, 1);
    }
    this.dom.removed.push(this);
  }
  querySelectorAll(selector: string): FakeElement[] {
    return selector === 'li' ? this.children.filter((c) => c.tagName === 'LI') : [];
  }
  /** Real browsers fire `focus` on the element when it takes the focus. */
  focus(): void { this.dom.activeElement = this; this.fire('focus'); }
  scrollIntoView(): void { /* nothing to scroll */ }
  /** Only the one selector app.js asks the field for: '.search-wrapper', which holds the field and the list. */
  closest(selector: string): { contains(node: unknown): boolean } | null {
    if (selector !== '.search-wrapper') return null;
    const input = this.dom.getElementById('city-search');
    const list = this.dom.getElementById('city-dropdown');
    return { contains: (node) => node === input || node === list || list.children.includes(node as FakeElement) };
  }
}

/** The stub document, and what the page did with it. */
export class FakeDom {
  readonly elements = new Map<string, FakeElement>();
  readonly listeners = new Map<string, Array<(e: unknown) => unknown>>();
  /** The elements the page created with createElement('script') and appended to the head, in order. */
  readonly scripts: FakeElement[] = [];
  /** The elements the page removed. */
  readonly removed: FakeElement[] = [];
  readonly head: FakeElement;
  activeElement: FakeElement | null = null;
  hidden = false;
  /** Set by loadPage: reacts to the page adding a script to the head. */
  onAppend: ((parent: FakeElement, child: FakeElement) => void) | null = null;

  constructor() {
    this.head = new FakeElement(this, '', 'HEAD');
  }

  getElementById(id: string): FakeElement {
    let el = this.elements.get(id);
    if (!el) {
      el = new FakeElement(this, id);
      this.elements.set(id, el);
    }
    return el;
  }
  createElement(tag: string): FakeElement { return new FakeElement(this, '', tag.toUpperCase()); }
  addEventListener(type: string, fn: (e: unknown) => unknown): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
}

/** A city as cities.js holds it (ts/cities.d.ts). */
export interface PageCity {
  name: string; fold: string; country: string; cfold: string;
  lat: number; lon: number; tz: string; alt: string;
}

/** The city the filter holds (PickedCity in ts/app.ts). */
export interface PickedCity { name: string; country: string; lat: number; lon: number; tz: string }

/** The result of pickCard (Card in ts/app.ts); entry is a peak of the table. */
export interface PageCard { kind: 'countdown' | 'passed' | 'end' | 'none'; entry?: { peak: { id: string; name: string; utc: string }; time: number }; index?: number }

/**
 * The page functions the tests call directly, typed as ts/app.ts declares them, so the calls are
 * TypeScript the strict check reads rather than JavaScript inside a string. A page function runs
 * in the page's realm whoever calls it. This is written by hand: when a signature in ts/app.ts
 * changes, change it here too. PAGE_ARITY below is checked on every lookup, so a parameter added
 * or removed on one side only fails at once.
 */
export interface PageFunctions {
  updateUI(): void;
  pickCard(now: number, visible: (index: number) => boolean): PageCard;
  formatPeak(time: number, timeZone?: string, locale?: string): string;
  formatDuration(minutes: number): string;
  joinNames(names: string[]): string;
  onCityInput(): void;
  /** Takes the click event; only target.closest is read. */
  onDropdownClick(e: { target: { closest(selector: string): FakeElement | undefined } }): void;
  loadCatalogue(): Promise<void>;
  clearCitySelection(): void;
  applyCity(city: PickedCity | null, save: boolean): void;
  readStoredCity(): PickedCity | null;
  parseStoredCity(raw: string): PickedCity | null;
}

/** Each page function's declared parameter count (Function.length), checked by fn(). */
const PAGE_ARITY: { readonly [K in keyof PageFunctions]: number } = {
  updateUI: 0,
  pickCard: 2,
  formatPeak: 3,
  formatDuration: 1,
  joinNames: 1,
  onCityInput: 0,
  onDropdownClick: 1,
  loadCatalogue: 0,
  clearCitySelection: 0,
  applyCity: 2,
  readStoredCity: 0,
  parseStoredCity: 1,
};

/** The page's top-level objects the tests use. */
export interface PageGlobals {
  state: { city: PickedCity | null };
  /** The entries the tests read, each a stub element. */
  els: Record<'citySearch' | 'cityDropdown' | 'citySelected' | 'citySelectedTxt' | 'cityClearBtn' | 'cityStatus', FakeElement>;
  GRACE_MS: number;
  HORIZON_MS: number;
  CITY_STORAGE_KEY: string;
}

/** How the fake localStorage behaves. */
export type StorageMode = 'ok' | 'absent' | 'property-throws' | 'write-throws';

/** What the stub does when the page adds a script to the head. */
export type ScriptMode = 'run' | 'hold' | 'fail';

export interface LoadOptions {
  /** 'eager' runs cities.js before app.js (the search tests); 'lazy' leaves it to the page. */
  cities?: 'eager' | 'lazy';
  /** The clock, as a UTC time such as '2026-11-17T23:43:00Z' (default: the real time). */
  now?: string;
  storage?: StorageMode;
  /** The record in localStorage at the start, as the string stored under the page's key. */
  stored?: string;
  scripts?: ScriptMode;
  /** The checkout whose page the tests load (default: this one). */
  root?: URL;
  /** Stop before firing DOMContentLoaded. */
  init?: boolean;
}

/** A loaded page: run code in its global scope, and reach its stub document. */
export interface LoadedPage {
  /** A page function by name, typed by PageFunctions; it throws if the page has no such function
      or its parameter count is not the one PageFunctions declares. */
  fn<K extends keyof PageFunctions>(name: K): PageFunctions[K];
  /** The page's state or els (top-level consts, which are not properties of the global object). */
  get<K extends keyof PageGlobals>(name: K): PageGlobals[K];
  /** Runs code as a script in the page's global scope and returns its value (from the page's realm). */
  run<T = unknown>(code: string): T;
  /** Fires every document listener of this type, as the browser would. */
  fire(type: string, event?: Record<string, unknown>): void;
  /** Moves the page's clock (a UTC time string). */
  setNow(utc: string): void;
  /** The text of an element of the page, by id. */
  text(id: string): string;
  /** An element of the page, by id. */
  el(id: string): FakeElement;
  /** Runs the script element at this position in dom.scripts (the 'hold' mode) and fires its load event. */
  finishScript(index: number): void;
  /** The fake localStorage, as the page left it. */
  readonly store: Map<string, string>;
  /** The delays of the timeouts the page set. */
  readonly timeouts: number[];
  readonly dom: FakeDom;
}

/**
 * Loads the page's scripts from root (the repository unless given) into a fresh context, then
 * fires DOMContentLoaded so initCity() and the first updateUI() run. With init: false it stops
 * before that.
 */
export function loadPage(options: LoadOptions = {}): LoadedPage {
  const { cities = 'eager', storage = 'ok', scripts = 'run', root = REPO, init = true } = options;
  const clock = { now: options.now ? Date.parse(options.now) : Date.now() };
  /** Date with a fixed "now": new Date() and Date.now() read the clock; any other use is the real Date. */
  class FixedDate extends Date {
    constructor(...args: [] | [number]) {
      if (args.length === 0) super(clock.now);
      else super(args[0]);
    }
    static override now(): number { return clock.now; }
  }
  const dom = new FakeDom();
  const timeouts: number[] = [];
  const store = new Map<string, string>();
  if (options.stored !== undefined) store.set('meteorwatch.city', options.stored);
  const sandbox: Record<string, unknown> = {
    document: dom,
    console,
    Date: FixedDate,
    setTimeout: (_fn: () => void, delay: number): number => { timeouts.push(delay); return timeouts.length; },
    clearTimeout: (): void => { /* nothing is scheduled for real */ },
  };
  const ctx = vm.createContext(sandbox);
  // window is the global object itself, as in a browser: SunCalc publishes itself on it.
  vm.runInContext('globalThis.window = globalThis;', ctx);

  const storageApi = {
    getItem: (k: string): string | null => store.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      if (storage === 'write-throws') throw new Error('QuotaExceededError');
      store.set(k, String(v));
    },
    removeItem: (k: string): void => { store.delete(k); },
  };
  if (storage === 'property-throws') {
    Object.defineProperty(sandbox, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
  } else if (storage !== 'absent') {
    sandbox.localStorage = storageApi;
  }

  const runFile = (file: string): void => {
    vm.runInContext(readFileSync(new URL(file.replace(/\?.*$/, ''), root), 'utf8'), ctx, { filename: file });
  };
  const finishScript = (index: number): void => {
    const script = dom.scripts[index];
    if (!script) throw new Error(`the page added no script at position ${index}`);
    if (scripts === 'fail') script.fire('error');
    else {
      runFile(script.src);
      script.fire('load');
    }
  };
  dom.onAppend = (parent, child) => {
    if (parent !== dom.head || child.tagName !== 'SCRIPT') return;
    dom.scripts.push(child);
    // The load event of a real script comes after the current task.
    if (scripts !== 'hold') queueMicrotask(() => finishScript(dom.scripts.indexOf(child)));
  };

  // The elements that index.html marks `hidden` start hidden, as in the browser.
  const html = readFileSync(new URL('index.html', root), 'utf8');
  for (const tag of html.match(/<[a-z][^>]*>/g) ?? []) {
    const id = /\bid="([^"]+)"/.exec(tag)?.[1];
    if (id && /\shidden(\s|>|\/)/.test(tag)) dom.getElementById(id).hidden = true;
  }

  const files = ['suncalc.js', 'peaks.js', 'visibility.js'];
  if (cities === 'eager') files.push('cities.js');
  files.push('app.js');
  for (const file of files) runFile(file);

  const page: LoadedPage = {
    fn: <K extends keyof PageFunctions>(name: K): PageFunctions[K] => {
      const f: unknown = vm.runInContext(`typeof ${name} === 'function' ? ${name} : undefined`, ctx);
      if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
      if (f.length !== PAGE_ARITY[name]) throw new Error(`${name} takes ${f.length} parameters in the page, ${PAGE_ARITY[name]} in PageFunctions`);
      return f as PageFunctions[K];
    },
    get: <K extends keyof PageGlobals>(name: K): PageGlobals[K] => vm.runInContext(name, ctx) as PageGlobals[K],
    run: <T>(code: string): T => vm.runInContext(code, ctx) as T,
    fire: (type, event = {}) => { for (const fn of dom.listeners.get(type) ?? []) fn({ type, ...event }); },
    setNow: (utc) => { clock.now = Date.parse(utc); },
    text: (id) => dom.getElementById(id).textContent,
    el: (id) => dom.getElementById(id),
    finishScript,
    store,
    timeouts,
    dom,
  };
  if (init) page.fire('DOMContentLoaded');
  return page;
}
