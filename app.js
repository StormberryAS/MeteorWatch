"use strict";
const GRACE_MS = 12 * 3600 * 1000;
const HORIZON_MS = 366 * 86400 * 1000;
const CITY_STORAGE_KEY = 'meteorwatch.city';
const REGION = {
    QUA: 'Northern Hemisphere',
    LYR: 'Both, better in the north',
    ETA: 'Both, better in the south',
    SDA: 'Both, better in the south',
    PER: 'Northern Hemisphere',
    ORI: 'Both hemispheres',
    LEO: 'Both, better in the north',
    GEM: 'Both, better in the north',
    URS: 'Northern Hemisphere'
};
const SCHEDULE = PEAKS.map((peak) => ({ peak, time: Date.parse(peak.utc) }));
const state = { city: null };
let shownKey;
let timer;
const darkCache = new Map();
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`MeteorWatch: #${id} is missing from the page`);
    return el;
}
function findNextPeak(now) {
    let next = null;
    for (const entry of SCHEDULE) {
        if (entry.time > now && (next === null || entry.time < next.time))
            next = entry;
    }
    return next;
}
function moonPhaseName(phase) {
    if (phase <= 0.03 || phase >= 0.97)
        return 'New Moon';
    if (phase < 0.22)
        return 'Waxing Crescent';
    if (phase <= 0.28)
        return 'First Quarter';
    if (phase < 0.47)
        return 'Waxing Gibbous';
    if (phase <= 0.53)
        return 'Full Moon';
    if (phase < 0.72)
        return 'Waning Gibbous';
    if (phase <= 0.78)
        return 'Last Quarter';
    return 'Waning Crescent';
}
function rateMoon(illuminationPct) {
    if (illuminationPct < 20)
        return { visibilityScore: 'EXCELLENT', visibilityClass: 'visibility-excellent' };
    if (illuminationPct < 60)
        return { visibilityScore: 'GOOD', visibilityClass: 'visibility-good' };
    return { visibilityScore: 'POOR', visibilityClass: 'visibility-poor' };
}
function calculateVisibility(peakDate) {
    const moon = SunCalc.getMoonIllumination(peakDate);
    const illuminationPct = Math.round(moon.fraction * 100);
    return {
        moonPhaseText: `${moonPhaseName(moon.phase)} (${illuminationPct}% illuminated)`,
        ...rateMoon(illuminationPct)
    };
}
function formatPeak(time, timeZone, locale) {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short'
    }).format(time);
}
function formatCountdown(diff) {
    const total = Math.max(0, Math.floor(diff / 1000));
    const parts = [
        Math.floor(total / 86400),
        Math.floor((total % 86400) / 3600),
        Math.floor((total % 3600) / 60),
        total % 60
    ];
    return parts.map((n) => String(n).padStart(2, '0')).join(':');
}
function nextTickDelay(now) {
    return 1000 - (now % 1000);
}
function formatDuration(minutes) {
    const total = Math.max(0, Math.floor(minutes));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h > 0 && m > 0)
        return `${h} h ${m} min`;
    if (h > 0)
        return `${h} h`;
    return `${m} min`;
}
function cityLabel(city) {
    return `${city.name}, ${city.country}`;
}
const zoneKnownCache = new Map();
function zoneKnown(tz) {
    let known = zoneKnownCache.get(tz);
    if (known === undefined) {
        try {
            new Intl.DateTimeFormat('en-GB', { timeZone: tz });
            known = true;
        }
        catch {
            known = false;
        }
        zoneKnownCache.set(tz, known);
    }
    return known;
}
function zoneFor(city) {
    return city !== null && zoneKnown(city.tz) ? city.tz : undefined;
}
function cityLine(city) {
    return zoneKnown(city.tz)
        ? `For ${cityLabel(city)}. Times are in the city's time zone.`
        : `For ${cityLabel(city)}. Times are in your own time zone, because this browser does not know the city's zone.`;
}
function joinNames(names) {
    if (names.length <= 1)
        return names.join('');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
function darkMinutes(index, city) {
    let minutes = darkCache.get(index);
    if (minutes === undefined) {
        const entry = SCHEDULE[index];
        minutes = darkRadiantMinutes(entry.time, entry.peak.ra, entry.peak.dec, city.lat, city.lon);
        darkCache.set(index, minutes);
    }
    return minutes;
}
function visibleFor(city) {
    if (city === null)
        return () => true;
    return (index) => isVisibleMinutes(darkMinutes(index, city));
}
function pickCard(now, visible) {
    let passed = -1;
    for (let i = 0; i < SCHEDULE.length; i++) {
        const t = SCHEDULE[i].time;
        if (t <= now && now < t + GRACE_MS && visible(i))
            passed = i;
    }
    if (passed >= 0)
        return { kind: 'passed', entry: SCHEDULE[passed], index: passed };
    for (let i = 0; i < SCHEDULE.length; i++) {
        const t = SCHEDULE[i].time;
        if (t > now && t <= now + HORIZON_MS && visible(i))
            return { kind: 'countdown', entry: SCHEDULE[i], index: i };
    }
    const last = SCHEDULE[SCHEDULE.length - 1];
    if (last === undefined || last.time <= now || last.time < now + HORIZON_MS)
        return { kind: 'end' };
    return { kind: 'none' };
}
function setText(id, text) {
    const el = byId(id);
    if (el.textContent !== text)
        el.textContent = text;
}
function setHidden(id, hidden) {
    const el = byId(id);
    if (el.hidden !== hidden)
        el.hidden = hidden;
}
function showPeak(entry, index, city) {
    byId('shower-name').textContent = entry.peak.name;
    byId('shower-date').className = 'event-value';
    byId('shower-region').textContent = REGION[entry.peak.id];
    byId('shower-zhr').textContent = `ZHR ${entry.peak.zhr}`;
    const vis = calculateVisibility(new Date(entry.time));
    byId('shower-moon').textContent = vis.moonPhaseText;
    const visEl = byId('shower-visibility');
    visEl.textContent = vis.visibilityScore;
    visEl.className = `event-value visibility-pill ${vis.visibilityClass}`;
    if (city !== null) {
        byId('card-city').textContent = cityLine(city);
        byId('shower-dark').textContent = formatDuration(darkMinutes(index, city));
    }
    setHidden('card-city', city === null);
    setHidden('row-dark', city === null);
}
function showTableEnd() {
    byId('shower-name').textContent = 'No peak data';
    byId('countdown-timer').textContent = '--:--:--:--';
    byId('countdown-timer').classList.remove('countdown-long');
    byId('shower-date').textContent = `This version only knows peaks up to the end of ${PEAKS_LAST_YEAR}. A newer version of MeteorWatch has a longer table.`;
    byId('shower-date').className = 'event-value event-message';
    byId('shower-region').textContent = 'n/a';
    byId('shower-zhr').textContent = 'n/a';
    byId('shower-moon').textContent = 'n/a';
    const visEl = byId('shower-visibility');
    visEl.textContent = 'n/a';
    visEl.className = 'event-value';
    setHidden('card-city', true);
    setHidden('row-dark', true);
}
function showNoneVisible(city) {
    byId('shower-name').textContent = 'No shower visible';
    byId('countdown-timer').textContent = '--:--:--:--';
    byId('countdown-timer').classList.remove('countdown-long');
    byId('shower-date').textContent = `None of the nine showers can be seen from ${city.name} in the next 12 months. Clear the city to see all showers.`;
    byId('shower-date').className = 'event-value event-message';
    byId('shower-region').textContent = 'n/a';
    byId('shower-zhr').textContent = 'n/a';
    byId('shower-moon').textContent = 'n/a';
    const visEl = byId('shower-visibility');
    visEl.textContent = 'n/a';
    visEl.className = 'event-value';
    byId('card-city').textContent = cityLine(city);
    setHidden('card-city', false);
    setHidden('row-dark', true);
}
function cardKey(card, city) {
    const cityKey = city === null ? '' : `${city.name}|${city.country}|${city.lat}|${city.lon}`;
    const index = card.kind === 'countdown' || card.kind === 'passed' ? card.index : -1;
    return `${card.kind}:${index}:${cityKey}`;
}
function showCard(card, city) {
    const passed = card.kind === 'passed';
    byId('countdown-labels').hidden = passed;
    byId('countdown-timer').classList.toggle('countdown-passed', passed);
    setHidden('peak-status', !passed);
    setHidden('peak-next', true);
    setHidden('city-skipped', true);
    if (card.kind === 'countdown' || card.kind === 'passed') {
        showPeak(card.entry, card.index, city);
        if (passed)
            byId('countdown-timer').classList.remove('countdown-long');
    }
    else if (card.kind === 'end') {
        showTableEnd();
    }
    else if (city !== null) {
        showNoneVisible(city);
    }
}
function skippedNames(now, until, city) {
    const names = [];
    for (let i = 0; i < SCHEDULE.length; i++) {
        const entry = SCHEDULE[i];
        if (entry.time > now && entry.time < until && !isVisibleMinutes(darkMinutes(i, city)))
            names.push(entry.peak.name);
    }
    return names;
}
function updateUI() {
    try {
        const now = Date.now();
        const city = state.city;
        const card = pickCard(now, visibleFor(city));
        const zone = zoneFor(city);
        const key = cardKey(card, city);
        if (key !== shownKey) {
            shownKey = key;
            showCard(card, city);
        }
        if (card.kind === 'countdown') {
            const countdown = formatCountdown(card.entry.time - now);
            setText('countdown-timer', countdown);
            byId('countdown-timer').classList.toggle('countdown-long', countdown.length > 11);
            setText('shower-date', formatPeak(card.entry.time, zone));
            const skipped = city === null ? [] : skippedNames(now, card.entry.time, city);
            if (city !== null && skipped.length > 0)
                setText('city-skipped', `Not visible from ${city.name} before then: ${joinNames(skipped)}.`);
            setHidden('city-skipped', skipped.length === 0);
        }
        else if (card.kind === 'passed') {
            setText('countdown-timer', 'Peak passed');
            const minutes = Math.floor((now - card.entry.time) / 60000);
            setText('peak-status', minutes < 1 ? 'The peak was less than a minute ago.' : `The peak was ${formatDuration(minutes)} ago.`);
            setText('shower-date', formatPeak(card.entry.time, zone));
            const after = pickCard(card.entry.time + GRACE_MS, visibleFor(city));
            if (after.kind === 'countdown')
                setText('peak-next', `Next: ${after.entry.peak.name}, ${formatPeak(after.entry.time, zone)}`);
            setHidden('peak-next', after.kind !== 'countdown');
        }
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
        timer = window.setTimeout(updateUI, nextTickDelay(Date.now()));
    }
}
let els;
let highlightedIndex = -1;
let focusFromClear = false;
const LOADING_TEXT = 'Loading the city list.';
let cataloguePromise = null;
function setCityStatus(text) {
    els.cityStatus.textContent = text;
}
function loadCatalogue() {
    if ('CITIES' in globalThis)
        return Promise.resolve();
    if (cataloguePromise !== null)
        return cataloguePromise;
    els.citySearch.setAttribute('aria-busy', 'true');
    const before = els.cityStatus.textContent ?? '';
    setCityStatus(LOADING_TEXT);
    const script = document.createElement('script');
    const loading = new Promise((resolve, reject) => {
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => reject(new Error('MeteorWatch: cities.js did not load')));
        script.src = './cities.js?v=2f08782c';
        document.head.appendChild(script);
    });
    cataloguePromise = loading;
    loading.then(() => {
        els.citySearch.removeAttribute('aria-busy');
        if (els.cityStatus.textContent === LOADING_TEXT)
            setCityStatus(before);
        onCityInput();
    }, () => {
        cataloguePromise = null;
        script.remove();
        els.citySearch.removeAttribute('aria-busy');
        setCityStatus(state.city === null
            ? 'The city list did not load. All showers are shown.'
            : 'The city list did not load. The city you picked is still in use.');
    });
    return loading;
}
function startCatalogueLoad() {
    loadCatalogue().catch(() => undefined);
}
function onCityInput() {
    if (!('CITIES' in globalThis))
        return;
    const query = els.citySearch.value.trim().toLowerCase();
    if (query.length < 1) {
        closeDropdown();
        return;
    }
    const qf = foldQuery(query);
    const startsWith = [], contains = [];
    for (const c of CITIES) {
        if (c.fold.startsWith(qf) || c.alt.startsWith(qf))
            startsWith.push(c);
        else if (c.fold.includes(qf) || c.alt.includes(qf) || c.cfold.includes(qf))
            contains.push(c);
    }
    const matches = startsWith.concat(contains).slice(0, 8);
    if (!matches.length) {
        closeDropdown();
        return;
    }
    renderDropdown(matches);
}
function renderDropdown(cities) {
    els.cityDropdown.innerHTML = '';
    highlightedIndex = -1;
    els.citySearch.removeAttribute('aria-activedescendant');
    cities.forEach((city, idx) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('id', 'city-option-' + idx);
        li.setAttribute('aria-selected', 'false');
        li.dataset.idx = String(idx);
        li.innerHTML = '<span class="city-name">' + escapeHtml(city.name) + '</span>'
            + '<span class="city-country">' + escapeHtml(city.country) + '</span>';
        li._city = city;
        els.cityDropdown.appendChild(li);
    });
    els.cityDropdown.hidden = false;
    els.citySearch.setAttribute('aria-expanded', 'true');
}
function onCityKeydown(e) {
    if (els.cityDropdown.hidden)
        return;
    const items = els.cityDropdown.querySelectorAll('li');
    if (!items.length)
        return;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        updateHighlight(items);
    }
    else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        updateHighlight(items);
    }
    else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0)
            selectCity(items[highlightedIndex]._city);
    }
    else if (e.key === 'Escape') {
        closeDropdown();
    }
}
function updateHighlight(items) {
    items.forEach((li, i) => {
        const on = i === highlightedIndex;
        li.classList.toggle('highlighted', on);
        li.setAttribute('aria-selected', String(on));
        if (on) {
            els.citySearch.setAttribute('aria-activedescendant', li.id);
            if (typeof li.scrollIntoView === 'function')
                li.scrollIntoView({ block: 'nearest' });
        }
    });
}
function onDropdownClick(e) {
    const li = e.target.closest('li');
    if (li && li._city)
        selectCity(li._city);
}
function selectCity(city) {
    els.citySearch.value = '';
    closeDropdown();
    applyCity({ name: city.name, country: city.country, lat: city.lat, lon: city.lon, tz: city.tz }, true);
}
function clearCitySelection() {
    els.citySearch.value = '';
    closeDropdown();
    applyCity(null, true);
    focusFromClear = true;
    try {
        els.citySearch.focus();
    }
    finally {
        focusFromClear = false;
    }
}
function closeDropdown() {
    els.cityDropdown.hidden = true;
    els.cityDropdown.innerHTML = '';
    els.citySearch.setAttribute('aria-expanded', 'false');
    els.citySearch.removeAttribute('aria-activedescendant');
    highlightedIndex = -1;
}
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function showCityChip(city) {
    if (city !== null)
        els.citySelectedTxt.textContent = cityLabel(city);
    els.citySelected.hidden = city === null;
}
function applyCity(city, save) {
    state.city = city;
    darkCache.clear();
    let kept = true;
    if (save)
        kept = city === null ? forgetCity() : storeCity(city);
    showCityChip(city);
    if (city === null)
        setCityStatus('Showing all showers.');
    else
        setCityStatus(`Showing showers visible from ${cityLabel(city)}.`
            + (zoneKnown(city.tz) ? '' : ' This browser does not know the time zone of the city, so times show in your own time zone.')
            + (kept ? '' : ' This browser will not keep the city after you close the page.'));
    updateUI();
}
function storeCity(city) {
    try {
        window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ v: 1, name: city.name, country: city.country, lat: city.lat, lon: city.lon, tz: city.tz }));
        return true;
    }
    catch {
        return false;
    }
}
function forgetCity() {
    try {
        window.localStorage.removeItem(CITY_STORAGE_KEY);
        return true;
    }
    catch {
        return false;
    }
}
function parseStoredCity(raw) {
    try {
        const rec = JSON.parse(raw);
        if (typeof rec !== 'object' || rec === null)
            return null;
        const r = rec;
        const text = (v) => typeof v === 'string' && v.length >= 1 && v.length <= 200;
        const within = (v, limit) => typeof v === 'number' && Number.isFinite(v) && v >= -limit && v <= limit;
        if (r.v !== 1 || !text(r.name) || !text(r.country) || !text(r.tz) || !within(r.lat, 90) || !within(r.lon, 180))
            return null;
        return { name: r.name, country: r.country, lat: r.lat, lon: r.lon, tz: r.tz };
    }
    catch {
        return null;
    }
}
function readStoredCity() {
    let raw = null;
    try {
        raw = window.localStorage.getItem(CITY_STORAGE_KEY);
    }
    catch {
        return null;
    }
    if (raw === null)
        return null;
    const city = parseStoredCity(raw);
    if (city === null)
        forgetCity();
    return city;
}
function initCity() {
    els = {
        citySearch: byId('city-search'),
        cityDropdown: byId('city-dropdown'),
        citySelected: byId('city-selected'),
        citySelectedTxt: byId('city-selected-text'),
        cityClearBtn: byId('city-clear-btn'),
        cityStatus: byId('city-status'),
    };
    els.citySearch.addEventListener('input', () => { startCatalogueLoad(); onCityInput(); });
    els.citySearch.addEventListener('keydown', onCityKeydown);
    els.citySearch.addEventListener('focus', () => { if (!focusFromClear)
        startCatalogueLoad(); });
    els.citySearch.addEventListener('pointerdown', startCatalogueLoad);
    els.cityDropdown.addEventListener('click', onDropdownClick);
    els.cityClearBtn.addEventListener('click', clearCitySelection);
    document.addEventListener('click', e => {
        if (!els.citySearch.closest('.search-wrapper').contains(e.target))
            closeDropdown();
    });
    const stored = readStoredCity();
    if (stored !== null) {
        state.city = stored;
        showCityChip(stored);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    initCity();
    updateUI();
});
document.addEventListener('visibilitychange', () => {
    if (!document.hidden)
        updateUI();
});
