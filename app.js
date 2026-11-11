"use strict";
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
let shown;
let timer;
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
function showPeak(next) {
    byId('shower-name').textContent = next.peak.name;
    byId('shower-date').className = 'event-value';
    byId('shower-region').textContent = REGION[next.peak.id];
    byId('shower-zhr').textContent = `ZHR ${next.peak.zhr}`;
    const vis = calculateVisibility(new Date(next.time));
    byId('shower-moon').textContent = vis.moonPhaseText;
    const visEl = byId('shower-visibility');
    visEl.textContent = vis.visibilityScore;
    visEl.className = `event-value visibility-pill ${vis.visibilityClass}`;
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
}
function setText(id, text) {
    const el = byId(id);
    if (el.textContent !== text)
        el.textContent = text;
}
function updateUI() {
    const now = Date.now();
    const next = findNextPeak(now);
    if (next !== shown) {
        shown = next;
        if (next === null)
            showTableEnd();
        else
            showPeak(next);
    }
    if (next !== null) {
        const countdown = formatCountdown(next.time - now);
        setText('countdown-timer', countdown);
        byId('countdown-timer').classList.toggle('countdown-long', countdown.length > 11);
        setText('shower-date', formatPeak(next.time));
    }
    if (timer !== undefined)
        clearTimeout(timer);
    timer = window.setTimeout(updateUI, nextTickDelay(Date.now()));
}
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
});
document.addEventListener('visibilitychange', () => {
    if (!document.hidden)
        updateUI();
});
