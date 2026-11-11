/* MeteorWatch Visibility
   The city filter's rule: can the radiant of a shower be seen from a place, in a dark sky,
   around the peak? Calculated in the browser from the Sun's position (SunCalc) and the radiant's
   position (the right ascension and declination in ts/peaks.ts, from IMO Table 6).

   Rule A. A shower peak is visible from a place when, in the window from 12 hours before to
   12 hours after the peak instant, sampled every 5 minutes (289 samples, both ends included), the
   samples with the Sun at or below -12 degrees AND the radiant at or above 15 degrees add up to
   30 minutes or more. Geometric altitudes: no refraction, no nutation, no aberration. The radiant
   in ts/peaks.ts is already precessed to the mean equinox of the peak date (tools/gen-peaks.py), so
   it goes with Greenwich mean sidereal time as it is. The Moon, the weather, light pollution,
   hills and buildings are not taken into account.

   Classic script, as app.ts: index.html loads suncalc.js (which publishes window.SunCalc), then
   peaks.js, then visibility.js and then app.js, and all share one global scope. This file has no
   import or export, so tsc compiles it to a plain script at the same path (visibility.js).
*/

/** The Sun must be at or below this altitude, degrees (the end of nautical twilight). */
const VIS_SUN_MAX_DEG = -12;
/** The radiant must be at or above this altitude, degrees. */
const VIS_RADIANT_MIN_DEG = 15;
/** The dark radiant time that makes a peak visible, minutes. */
const VIS_MIN_MINUTES = 30;
/** The window runs this long on each side of the peak instant. */
const VIS_HALF_WINDOW_MS = 12 * 3600 * 1000;
/** The sampling step. */
const VIS_STEP_MS = 5 * 60 * 1000;

/**
 * Greenwich mean sidereal time at a Unix time in milliseconds, degrees in [0, 360):
 * Meeus, Astronomical Algorithms, 2nd ed., formula 12.4, with UT used for the time argument.
 */
function gmstDeg(ms: number): number {
  const jd = ms / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  const theta = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000;
  return ((theta % 360) + 360) % 360;
}

/**
 * The altitude of a fixed point of the sky above the horizon, degrees, geometric, at a Unix time
 * in milliseconds. `lat` and `lon` are the observer's (north and east positive), `ra` and `dec`
 * are the point's, all in degrees. The hour angle is GMST + longitude - right ascension.
 */
function radiantAltitudeDeg(ms: number, lat: number, lon: number, ra: number, dec: number): number {
  const rad = Math.PI / 180;
  const hourAngle = (gmstDeg(ms) + lon - ra) * rad;
  const sinAlt = Math.sin(lat * rad) * Math.sin(dec * rad) + Math.cos(lat * rad) * Math.cos(dec * rad) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
}

/**
 * The minutes, in the 289 samples around a peak, with the Sun at or below VIS_SUN_MAX_DEG and the
 * radiant at or above VIS_RADIANT_MIN_DEG. Each sample stands for VIS_STEP_MS.
 */
function darkRadiantMinutes(peakMs: number, ra: number, dec: number, lat: number, lon: number): number {
  let samples = 0;
  for (let t = peakMs - VIS_HALF_WINDOW_MS; t <= peakMs + VIS_HALF_WINDOW_MS; t += VIS_STEP_MS) {
    const sunDeg = SunCalc.getPosition(new Date(t), lat, lon).altitude * (180 / Math.PI);
    if (sunDeg > VIS_SUN_MAX_DEG) continue;
    if (radiantAltitudeDeg(t, lat, lon, ra, dec) >= VIS_RADIANT_MIN_DEG) samples++;
  }
  return (samples * VIS_STEP_MS) / 60000;
}

/** Whether that many dark radiant minutes make a peak visible. */
function isVisibleMinutes(minutes: number): boolean {
  return minutes >= VIS_MIN_MINUTES;
}
