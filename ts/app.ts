/* MeteorWatch Logic
   Offline determination of upcoming meteor showers and their visibility.

   A classic script, not a module: index.html loads suncalc.js (which publishes window.SunCalc,
   typed in ts/suncalc.d.ts) and then app.js, and both share one global scope. This file has no
   import or export, so tsc compiles it to a plain script at the same path (app.js).
*/

interface MeteorShower {
  name: string;
  /** 0 is January, as in Date. */
  peakMonth: number;
  peakDay: number;
  /** Zenithal hourly rate at the peak. */
  zhr: number;
  region: string;
  description: string;
}

interface UpcomingShower extends MeteorShower {
  /** The peak, at 12:00 UTC on the peak day. */
  peakDate: Date;
  /** Milliseconds from now to the peak when it was chosen. */
  diff: number;
}

interface Visibility {
  moonPhaseText: string;
  visibilityScore: 'EXCELLENT' | 'GOOD' | 'POOR';
  visibilityClass: 'visibility-excellent' | 'visibility-good' | 'visibility-poor';
}

const METEOR_SHOWERS: readonly MeteorShower[] = [
  { name: 'Quadrantids',   peakMonth: 0, peakDay: 3,  zhr: 110, region: 'Northern Hemisphere', description: 'Brief but intense peak.' },
  { name: 'Lyrids',        peakMonth: 3, peakDay: 22, zhr: 18,  region: 'Northern Hemisphere', description: 'Known for bright meteors with glowing trails.' },
  { name: 'Eta Aquariids', peakMonth: 4, peakDay: 6,  zhr: 50,  region: 'Southern Hemisphere', description: 'Debris from Halley\'s Comet.' },
  { name: 'Delta Aquariids',peakMonth:6, peakDay: 30, zhr: 20,  region: 'Southern Hemisphere', description: 'Faint meteors best seen from southern latitudes.' },
  { name: 'Perseids',      peakMonth: 7, peakDay: 12, zhr: 100, region: 'Northern Hemisphere', description: 'One of the most popular and reliable showers.' },
  { name: 'Orionids',      peakMonth: 9, peakDay: 21, zhr: 20,  region: 'Global', description: 'Fast meteors with persistent trains, from Halley\'s.' },
  { name: 'Leonids',       peakMonth: 10,peakDay: 17, zhr: 15,  region: 'Global', description: 'Fast meteors, occasional outburst storms.' },
  { name: 'Geminids',      peakMonth: 11,peakDay: 14, zhr: 120, region: 'Global (Best in North)', description: 'Often the strongest shower of the year.' },
  { name: 'Ursids',        peakMonth: 11,peakDay: 22, zhr: 10,  region: 'Northern Hemisphere', description: 'A low-key shower preceding Christmas.' }
];

let nextShower: UpcomingShower | null = null;
let moonDataCalculated = false;

/** The element with this id; the page always has it, so a miss is a broken page. */
function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`MeteorWatch: #${id} is missing from the page`);
  return el;
}

function findNextShower(): UpcomingShower {
  const now = new Date();
  const currentYear = now.getFullYear();
  let upcoming: UpcomingShower | null = null;
  let minDiff = Infinity;

  // Check this year and next year
  for (const year of [currentYear, currentYear + 1]) {
    for (const shower of METEOR_SHOWERS) {
      // Create date for the peak
      const peakDate = new Date(Date.UTC(year, shower.peakMonth, shower.peakDay, 12, 0, 0));
      const diff = peakDate.getTime() - now.getTime();

      if (diff > 0 && diff < minDiff) {
        minDiff = diff;
        upcoming = {
          ...shower,
          peakDate: peakDate,
          diff: diff
        };
      }
    }
  }
  // Never true: every year has a peak, and next year's are all in the future.
  if (!upcoming) throw new Error('MeteorWatch: no upcoming meteor shower');
  return upcoming;
}

function calculateVisibility(peakDate: Date): Visibility {
  // Use SunCalc to determine moon illumination at the exact peak date
  // Since moon phase is roughly independent of location, we can use 0,0
  const moonIllumination = SunCalc.getMoonIllumination(peakDate);
  const phase = moonIllumination.phase; // 0 to 1
  const fraction = moonIllumination.fraction; // 0 to 1 (0% to 100% illuminated)

  let moonPhaseText = '';
  if (phase < 0.03 || phase > 0.97) moonPhaseText = 'New Moon';
  else if (phase < 0.25) moonPhaseText = 'Waxing Crescent';
  else if (phase < 0.28) moonPhaseText = 'First Quarter';
  else if (phase < 0.50) moonPhaseText = 'Waxing Gibbous';
  else if (phase < 0.53) moonPhaseText = 'Full Moon';
  else if (phase < 0.75) moonPhaseText = 'Waning Gibbous';
  else if (phase < 0.78) moonPhaseText = 'Last Quarter';
  else moonPhaseText = 'Waning Crescent';

  const illuminationPct = Math.round(fraction * 100);

  // Visibility is excellent if moon is < 20% illuminated, poor if > 70%
  let visibilityScore: Visibility['visibilityScore'] = 'POOR';
  let visibilityClass: Visibility['visibilityClass'] = 'visibility-poor';

  if (fraction < 0.2) {
    visibilityScore = 'EXCELLENT';
    visibilityClass = 'visibility-excellent';
  } else if (fraction < 0.6) {
    visibilityScore = 'GOOD';
    visibilityClass = 'visibility-good';
  }

  return {
    moonPhaseText: `${moonPhaseText} (${illuminationPct}% illuminated)`,
    visibilityScore,
    visibilityClass
  };
}

function updateUI(): void {
  const now = new Date().getTime();

  if (!nextShower || nextShower.peakDate.getTime() - now < 0) {
    nextShower = findNextShower();
    moonDataCalculated = false;
  }

  const diff = nextShower.peakDate.getTime() - now;

  // Calculate time components
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  // Format with leading zeros
  const d = String(days).padStart(2, '0');
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(seconds).padStart(2, '0');

  // Update DOM
  byId('countdown-timer').textContent = `${d}:${h}:${m}:${s}`;

  if (!moonDataCalculated) {
    byId('shower-name').textContent = nextShower.name;

    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZoneName: 'short'
    });
    byId('shower-date').textContent = formatter.format(nextShower.peakDate);
    byId('shower-region').textContent = nextShower.region;
    byId('shower-zhr').textContent = `${nextShower.zhr} meteors/hr`;

    const vis = calculateVisibility(nextShower.peakDate);
    byId('shower-moon').textContent = vis.moonPhaseText;

    const visEl = byId('shower-visibility');
    visEl.textContent = vis.visibilityScore;
    visEl.className = `event-value visibility-pill ${vis.visibilityClass}`;

    moonDataCalculated = true;
  }

  requestAnimationFrame(updateUI);
}

// Start simulation
document.addEventListener('DOMContentLoaded', () => {
  updateUI();
});
