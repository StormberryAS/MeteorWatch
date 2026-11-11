"use strict";
const VIS_SUN_MAX_DEG = -12;
const VIS_RADIANT_MIN_DEG = 15;
const VIS_MIN_MINUTES = 30;
const VIS_HALF_WINDOW_MS = 12 * 3600 * 1000;
const VIS_STEP_MS = 5 * 60 * 1000;
function gmstDeg(ms) {
    const jd = ms / 86400000 + 2440587.5;
    const t = (jd - 2451545.0) / 36525;
    const theta = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000;
    return ((theta % 360) + 360) % 360;
}
function radiantAltitudeDeg(ms, lat, lon, ra, dec) {
    const rad = Math.PI / 180;
    const hourAngle = (gmstDeg(ms) + lon - ra) * rad;
    const sinAlt = Math.sin(lat * rad) * Math.sin(dec * rad) + Math.cos(lat * rad) * Math.cos(dec * rad) * Math.cos(hourAngle);
    return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
}
function darkRadiantMinutes(peakMs, ra, dec, lat, lon) {
    let samples = 0;
    for (let t = peakMs - VIS_HALF_WINDOW_MS; t <= peakMs + VIS_HALF_WINDOW_MS; t += VIS_STEP_MS) {
        const sunDeg = SunCalc.getPosition(new Date(t), lat, lon).altitude * (180 / Math.PI);
        if (sunDeg > VIS_SUN_MAX_DEG)
            continue;
        if (radiantAltitudeDeg(t, lat, lon, ra, dec) >= VIS_RADIANT_MIN_DEG)
            samples++;
    }
    return (samples * VIS_STEP_MS) / 60000;
}
function isVisibleMinutes(minutes) {
    return minutes >= VIS_MIN_MINUTES;
}
