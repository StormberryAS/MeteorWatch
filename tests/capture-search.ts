// The search helper of MoonApp's tests/capture-search.ts, ported on 11 November 2026: types a
// query into the city search of a page loaded in Node (tests/load.ts), exactly as the input event
// would (set the field, call onCityInput), and reads back the rows the dropdown then lists, in
// order, as [name, country, tz]. tests/search.test.ts replays tests/search-vectors.json with it.
//
// MoonApp's file also holds a command line part that recaptures the vectors from a checkout of
// the MoonApp 90d11dd tree. It is not ported: MeteorWatch never recaptures. The vectors are the
// MoonApp ones, copied byte for byte, so this page is held to MoonApp's results. Not a test file
// itself.

import type { FakeElement, LoadedPage, PageCity } from './load.ts';

/** One captured query: what was typed, whether the list opened, and the rows it listed. */
export interface SearchVector { q: string; open: boolean; rows: Array<[string, string, string]> }

/** Types q into the page's city search and reads back the dropdown. */
export function search(page: LoadedPage, q: string): SearchVector {
  const els = page.get('els');
  els.citySearch.value = q;
  page.fn('onCityInput')();
  const open = !els.cityDropdown.hidden;
  const rows = open ? els.cityDropdown.children.map((li): [string, string, string] => {
    const city = (li as FakeElement & { _city: PageCity })._city;
    return [city.name, city.country, city.tz];
  }) : [];
  return { q, open, rows };
}
