/* GENERATED FILE. DO NOT EDIT BY HAND.
   Written by tools/gen-peaks.py; `python3 tools/gen-peaks.py --check` fails when this file is not
   what a fresh run writes. To change it, change the generator and run it again.

   The peaks of nine major meteor showers for 2026 to 2037: the UTC instant at which the
   Sun's geocentric ecliptic longitude equals the shower's longitude in the IMO Working List of
   Visual Meteor Showers (IMO Meteor Shower Calendars 2026 and 2027, Table 5, page 25: the
   longitude is for the equinox 2000.0, and the ZHR is IMO's). The Sun is computed with VSOP87B
   and the FK5 correction (Meeus, Astronomical Algorithms, ch. 25 and 32), geometric (no
   aberration, which would move every instant about 8 minutes later), Delta T from the Espenak
   and Meeus polynomial; instants are rounded to the minute. The generator's header has the full
   method.

   What the instants are, and are not. They are where the model puts the Earth at the stream's
   node. The real maximum of a shower varies from year to year. IMO gives the Quadrantid peak an
   uncertainty of about 2.5 hours; the Eta Aquariids, Southern Delta Aquariids, Perseids, Orionids
   and Geminids have broad maxima; and IMO prints the Orionid and Southern Delta Aquariid
   longitudes to the whole degree only (about a day). Use the instant as the centre of the best window, not as a
   promise.

   The radiant (ra, dec) is IMO's mean radiant at the peak instant: Table 6 (Radiant drift, page 26
   of both calendars), interpolated linearly in time and precessed from J2000.0 to the mean equinox
   of the peak date (Meeus ch. 21), right ascension and declination in degrees. The city filter of
   the page uses it with the Sun's position; see ts/visibility.ts.

   Rows are sorted by instant, then by id. Every shower has a row for every year from
   2026 to 2037; the Quadrantids of January belong to that calendar year. */

type ShowerId = 'QUA' | 'LYR' | 'ETA' | 'SDA' | 'PER' | 'ORI' | 'LEO' | 'GEM' | 'URS';

interface ShowerPeak {
  readonly id: ShowerId;
  readonly name: string;
  /** The peak, ISO 8601, UTC, to the minute. */
  readonly utc: string;
  /** IMO's solar longitude of the peak, degrees, equinox J2000.0. */
  readonly lambdaSun: number;
  /** IMO's zenithal hourly rate. */
  readonly zhr: number;
  /** The radiant's right ascension at the peak, degrees, mean equinox of the peak date (IMO Table 6, interpolated, precessed). */
  readonly ra: number;
  /** The radiant's declination at the peak, degrees, mean equinox of the peak date (IMO Table 6, interpolated, precessed). */
  readonly dec: number;
}

const PEAKS_FIRST_YEAR = 2026;
const PEAKS_LAST_YEAR = 2037;

const PEAKS: readonly ShowerPeak[] = [
  { id: 'QUA', name: 'Quadrantids', utc: '2026-01-03T21:16Z', lambdaSun: 283.15, zhr: 80, ra: 230.54, dec: 49.13 },
  { id: 'LYR', name: 'April Lyrids', utc: '2026-04-22T19:37Z', lambdaSun: 32.32, zhr: 18, ra: 272.06, dec: 34.0 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2026-05-06T09:13Z', lambdaSun: 45.5, zhr: 50, ra: 338.45, dec: -0.31 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2026-07-31T13:26Z', lambdaSun: 128.0, zhr: 25, ra: 341.65, dec: -15.34 },
  { id: 'PER', name: 'Perseids', utc: '2026-08-13T02:00Z', lambdaSun: 140.0, zhr: 100, ra: 49.22, dec: 57.71 },
  { id: 'ORI', name: 'Orionids', utc: '2026-10-21T18:20Z', lambdaSun: 208.0, zhr: 20, ra: 95.8, dec: 15.99 },
  { id: 'LEO', name: 'Leonids', utc: '2026-11-17T23:43Z', lambdaSun: 235.27, zhr: 15, ra: 152.17, dec: 21.67 },
  { id: 'GEM', name: 'Geminids', utc: '2026-12-14T13:41Z', lambdaSun: 262.2, zhr: 150, ra: 113.01, dec: 32.94 },
  { id: 'URS', name: 'Ursids', utc: '2026-12-22T22:09Z', lambdaSun: 270.7, zhr: 10, ra: 217.01, dec: 74.71 },
  { id: 'QUA', name: 'Quadrantids', utc: '2027-01-04T03:26Z', lambdaSun: 283.15, zhr: 80, ra: 230.7, dec: 49.08 },
  { id: 'LYR', name: 'April Lyrids', utc: '2027-04-23T01:41Z', lambdaSun: 32.32, zhr: 18, ra: 272.32, dec: 34.01 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2027-05-06T15:12Z', lambdaSun: 45.5, zhr: 50, ra: 338.66, dec: -0.21 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2027-07-31T19:37Z', lambdaSun: 128.0, zhr: 25, ra: 341.88, dec: -15.25 },
  { id: 'PER', name: 'Perseids', utc: '2027-08-13T08:11Z', lambdaSun: 140.0, zhr: 100, ra: 49.55, dec: 57.77 },
  { id: 'ORI', name: 'Orionids', utc: '2027-10-22T00:37Z', lambdaSun: 208.0, zhr: 20, ra: 96.02, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2027-11-18T05:59Z', lambdaSun: 235.27, zhr: 15, ra: 152.34, dec: 21.56 },
  { id: 'GEM', name: 'Geminids', utc: '2027-12-14T19:54Z', lambdaSun: 262.2, zhr: 150, ra: 113.28, dec: 32.94 },
  { id: 'URS', name: 'Ursids', utc: '2027-12-23T04:21Z', lambdaSun: 270.7, zhr: 10, ra: 217.02, dec: 74.6 },
  { id: 'QUA', name: 'Quadrantids', utc: '2028-01-04T09:31Z', lambdaSun: 283.15, zhr: 80, ra: 230.86, dec: 49.02 },
  { id: 'LYR', name: 'April Lyrids', utc: '2028-04-22T07:53Z', lambdaSun: 32.32, zhr: 18, ra: 271.58, dec: 34.0 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2028-05-05T21:22Z', lambdaSun: 45.5, zhr: 50, ra: 338.08, dec: -0.5 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2028-07-31T01:48Z', lambdaSun: 128.0, zhr: 25, ra: 341.28, dec: -15.49 },
  { id: 'PER', name: 'Perseids', utc: '2028-08-12T14:29Z', lambdaSun: 140.0, zhr: 100, ra: 48.68, dec: 57.63 },
  { id: 'ORI', name: 'Orionids', utc: '2028-10-21T06:40Z', lambdaSun: 208.0, zhr: 20, ra: 95.44, dec: 15.99 },
  { id: 'LEO', name: 'Leonids', utc: '2028-11-17T12:01Z', lambdaSun: 235.27, zhr: 15, ra: 151.9, dec: 21.86 },
  { id: 'GEM', name: 'Geminids', utc: '2028-12-14T01:57Z', lambdaSun: 262.2, zhr: 150, ra: 112.55, dec: 32.94 },
  { id: 'URS', name: 'Ursids', utc: '2028-12-22T10:20Z', lambdaSun: 270.7, zhr: 10, ra: 217.01, dec: 74.9 },
  { id: 'QUA', name: 'Quadrantids', utc: '2029-01-03T15:39Z', lambdaSun: 283.15, zhr: 80, ra: 230.42, dec: 49.17 },
  { id: 'LYR', name: 'April Lyrids', utc: '2029-04-22T14:01Z', lambdaSun: 32.32, zhr: 18, ra: 271.85, dec: 34.0 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2029-05-06T03:39Z', lambdaSun: 45.5, zhr: 50, ra: 338.3, dec: -0.39 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2029-07-31T08:04Z', lambdaSun: 128.0, zhr: 25, ra: 341.51, dec: -15.4 },
  { id: 'PER', name: 'Perseids', utc: '2029-08-12T20:36Z', lambdaSun: 140.0, zhr: 100, ra: 49.0, dec: 57.68 },
  { id: 'ORI', name: 'Orionids', utc: '2029-10-21T12:54Z', lambdaSun: 208.0, zhr: 20, ra: 95.66, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2029-11-17T18:12Z', lambdaSun: 235.27, zhr: 15, ra: 152.07, dec: 21.75 },
  { id: 'GEM', name: 'Geminids', utc: '2029-12-14T08:06Z', lambdaSun: 262.2, zhr: 150, ra: 112.82, dec: 32.94 },
  { id: 'URS', name: 'Ursids', utc: '2029-12-22T16:35Z', lambdaSun: 270.7, zhr: 10, ra: 217.01, dec: 74.79 },
  { id: 'QUA', name: 'Quadrantids', utc: '2030-01-03T21:49Z', lambdaSun: 283.15, zhr: 80, ra: 230.58, dec: 49.11 },
  { id: 'LYR', name: 'April Lyrids', utc: '2030-04-22T20:10Z', lambdaSun: 32.32, zhr: 18, ra: 272.11, dec: 34.01 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2030-05-06T09:37Z', lambdaSun: 45.5, zhr: 50, ra: 338.51, dec: -0.28 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2030-07-31T14:00Z', lambdaSun: 128.0, zhr: 25, ra: 341.73, dec: -15.31 },
  { id: 'PER', name: 'Perseids', utc: '2030-08-13T02:38Z', lambdaSun: 140.0, zhr: 100, ra: 49.33, dec: 57.73 },
  { id: 'ORI', name: 'Orionids', utc: '2030-10-21T19:07Z', lambdaSun: 208.0, zhr: 20, ra: 95.88, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2030-11-18T00:30Z', lambdaSun: 235.27, zhr: 15, ra: 152.24, dec: 21.64 },
  { id: 'GEM', name: 'Geminids', utc: '2030-12-14T14:24Z', lambdaSun: 262.2, zhr: 150, ra: 113.1, dec: 32.93 },
  { id: 'URS', name: 'Ursids', utc: '2030-12-22T22:48Z', lambdaSun: 270.7, zhr: 10, ra: 217.02, dec: 74.68 },
  { id: 'QUA', name: 'Quadrantids', utc: '2031-01-04T03:59Z', lambdaSun: 283.15, zhr: 80, ra: 230.74, dec: 49.06 },
  { id: 'LYR', name: 'April Lyrids', utc: '2031-04-23T02:15Z', lambdaSun: 32.32, zhr: 18, ra: 272.38, dec: 34.01 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2031-05-06T15:47Z', lambdaSun: 45.5, zhr: 50, ra: 338.73, dec: -0.17 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2031-07-31T20:10Z', lambdaSun: 128.0, zhr: 25, ra: 341.95, dec: -15.22 },
  { id: 'PER', name: 'Perseids', utc: '2031-08-13T08:52Z', lambdaSun: 140.0, zhr: 100, ra: 49.66, dec: 57.79 },
  { id: 'ORI', name: 'Orionids', utc: '2031-10-22T01:15Z', lambdaSun: 208.0, zhr: 20, ra: 96.1, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2031-11-18T06:37Z', lambdaSun: 235.27, zhr: 15, ra: 152.41, dec: 21.53 },
  { id: 'GEM', name: 'Geminids', utc: '2031-12-14T20:31Z', lambdaSun: 262.2, zhr: 150, ra: 113.37, dec: 32.93 },
  { id: 'URS', name: 'Ursids', utc: '2031-12-23T04:54Z', lambdaSun: 270.7, zhr: 10, ra: 217.02, dec: 74.58 },
  { id: 'QUA', name: 'Quadrantids', utc: '2032-01-04T10:11Z', lambdaSun: 283.15, zhr: 80, ra: 230.91, dec: 49.0 },
  { id: 'LYR', name: 'April Lyrids', utc: '2032-04-22T08:20Z', lambdaSun: 32.32, zhr: 18, ra: 271.64, dec: 34.0 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2032-05-05T21:56Z', lambdaSun: 45.5, zhr: 50, ra: 338.15, dec: -0.47 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2032-07-31T02:26Z', lambdaSun: 128.0, zhr: 25, ra: 341.35, dec: -15.46 },
  { id: 'PER', name: 'Perseids', utc: '2032-08-12T14:59Z', lambdaSun: 140.0, zhr: 100, ra: 48.78, dec: 57.65 },
  { id: 'ORI', name: 'Orionids', utc: '2032-10-21T07:29Z', lambdaSun: 208.0, zhr: 20, ra: 95.52, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2032-11-17T12:50Z', lambdaSun: 235.27, zhr: 15, ra: 151.98, dec: 21.82 },
  { id: 'GEM', name: 'Geminids', utc: '2032-12-14T02:43Z', lambdaSun: 262.2, zhr: 150, ra: 112.65, dec: 32.93 },
  { id: 'URS', name: 'Ursids', utc: '2032-12-22T11:12Z', lambdaSun: 270.7, zhr: 10, ra: 217.01, dec: 74.87 },
  { id: 'QUA', name: 'Quadrantids', utc: '2033-01-03T16:22Z', lambdaSun: 283.15, zhr: 80, ra: 230.47, dec: 49.15 },
  { id: 'LYR', name: 'April Lyrids', utc: '2033-04-22T14:37Z', lambdaSun: 32.32, zhr: 18, ra: 271.91, dec: 34.01 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2033-05-06T04:03Z', lambdaSun: 45.5, zhr: 50, ra: 338.36, dec: -0.36 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2033-07-31T08:25Z', lambdaSun: 128.0, zhr: 25, ra: 341.57, dec: -15.37 },
  { id: 'PER', name: 'Perseids', utc: '2033-08-12T21:05Z', lambdaSun: 140.0, zhr: 100, ra: 49.11, dec: 57.7 },
  { id: 'ORI', name: 'Orionids', utc: '2033-10-21T13:30Z', lambdaSun: 208.0, zhr: 20, ra: 95.74, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2033-11-17T18:56Z', lambdaSun: 235.27, zhr: 15, ra: 152.14, dec: 21.72 },
  { id: 'GEM', name: 'Geminids', utc: '2033-12-14T08:55Z', lambdaSun: 262.2, zhr: 150, ra: 112.92, dec: 32.93 },
  { id: 'URS', name: 'Ursids', utc: '2033-12-22T17:19Z', lambdaSun: 270.7, zhr: 10, ra: 217.02, dec: 74.76 },
  { id: 'QUA', name: 'Quadrantids', utc: '2034-01-03T22:34Z', lambdaSun: 283.15, zhr: 80, ra: 230.63, dec: 49.09 },
  { id: 'LYR', name: 'April Lyrids', utc: '2034-04-22T20:43Z', lambdaSun: 32.32, zhr: 18, ra: 272.17, dec: 34.01 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2034-05-06T10:17Z', lambdaSun: 45.5, zhr: 50, ra: 338.58, dec: -0.25 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2034-07-31T14:35Z', lambdaSun: 128.0, zhr: 25, ra: 341.8, dec: -15.28 },
  { id: 'PER', name: 'Perseids', utc: '2034-08-13T03:12Z', lambdaSun: 140.0, zhr: 100, ra: 49.43, dec: 57.75 },
  { id: 'ORI', name: 'Orionids', utc: '2034-10-21T19:35Z', lambdaSun: 208.0, zhr: 20, ra: 95.95, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2034-11-18T01:00Z', lambdaSun: 235.27, zhr: 15, ra: 152.31, dec: 21.61 },
  { id: 'GEM', name: 'Geminids', utc: '2034-12-14T14:59Z', lambdaSun: 262.2, zhr: 150, ra: 113.19, dec: 32.92 },
  { id: 'URS', name: 'Ursids', utc: '2034-12-22T23:25Z', lambdaSun: 270.7, zhr: 10, ra: 217.02, dec: 74.65 },
  { id: 'QUA', name: 'Quadrantids', utc: '2035-01-04T04:44Z', lambdaSun: 283.15, zhr: 80, ra: 230.79, dec: 49.04 },
  { id: 'LYR', name: 'April Lyrids', utc: '2035-04-23T02:50Z', lambdaSun: 32.32, zhr: 18, ra: 272.44, dec: 34.01 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2035-05-06T16:20Z', lambdaSun: 45.5, zhr: 50, ra: 338.8, dec: -0.14 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2035-07-31T20:44Z', lambdaSun: 128.0, zhr: 25, ra: 342.03, dec: -15.19 },
  { id: 'PER', name: 'Perseids', utc: '2035-08-13T09:18Z', lambdaSun: 140.0, zhr: 100, ra: 49.76, dec: 57.81 },
  { id: 'ORI', name: 'Orionids', utc: '2035-10-22T01:53Z', lambdaSun: 208.0, zhr: 20, ra: 96.18, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2035-11-18T07:16Z', lambdaSun: 235.27, zhr: 15, ra: 152.48, dec: 21.5 },
  { id: 'GEM', name: 'Geminids', utc: '2035-12-14T21:11Z', lambdaSun: 262.2, zhr: 150, ra: 113.46, dec: 32.92 },
  { id: 'URS', name: 'Ursids', utc: '2035-12-23T05:39Z', lambdaSun: 270.7, zhr: 10, ra: 217.02, dec: 74.55 },
  { id: 'QUA', name: 'Quadrantids', utc: '2036-01-04T10:49Z', lambdaSun: 283.15, zhr: 80, ra: 230.95, dec: 48.98 },
  { id: 'LYR', name: 'April Lyrids', utc: '2036-04-22T09:08Z', lambdaSun: 32.32, zhr: 18, ra: 271.71, dec: 34.01 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2036-05-05T22:34Z', lambdaSun: 45.5, zhr: 50, ra: 338.22, dec: -0.44 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2036-07-31T02:52Z', lambdaSun: 128.0, zhr: 25, ra: 341.42, dec: -15.43 },
  { id: 'PER', name: 'Perseids', utc: '2036-08-12T15:34Z', lambdaSun: 140.0, zhr: 100, ra: 48.89, dec: 57.66 },
  { id: 'ORI', name: 'Orionids', utc: '2036-10-21T07:55Z', lambdaSun: 208.0, zhr: 20, ra: 95.59, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2036-11-17T13:19Z', lambdaSun: 235.27, zhr: 15, ra: 152.04, dec: 21.8 },
  { id: 'GEM', name: 'Geminids', utc: '2036-12-14T03:17Z', lambdaSun: 262.2, zhr: 150, ra: 112.73, dec: 32.92 },
  { id: 'URS', name: 'Ursids', utc: '2036-12-22T11:39Z', lambdaSun: 270.7, zhr: 10, ra: 217.01, dec: 74.84 },
  { id: 'QUA', name: 'Quadrantids', utc: '2037-01-03T16:57Z', lambdaSun: 283.15, zhr: 80, ra: 230.51, dec: 49.13 },
  { id: 'LYR', name: 'April Lyrids', utc: '2037-04-22T15:17Z', lambdaSun: 32.32, zhr: 18, ra: 271.97, dec: 34.01 },
  { id: 'ETA', name: 'Eta Aquariids', utc: '2037-05-06T04:53Z', lambdaSun: 45.5, zhr: 50, ra: 338.44, dec: -0.33 },
  { id: 'SDA', name: 'Southern Delta Aquariids', utc: '2037-07-31T09:09Z', lambdaSun: 128.0, zhr: 25, ra: 341.65, dec: -15.34 },
  { id: 'PER', name: 'Perseids', utc: '2037-08-12T21:42Z', lambdaSun: 140.0, zhr: 100, ra: 49.22, dec: 57.72 },
  { id: 'ORI', name: 'Orionids', utc: '2037-10-21T14:03Z', lambdaSun: 208.0, zhr: 20, ra: 95.81, dec: 15.98 },
  { id: 'LEO', name: 'Leonids', utc: '2037-11-17T19:27Z', lambdaSun: 235.27, zhr: 15, ra: 152.21, dec: 21.69 },
  { id: 'GEM', name: 'Geminids', utc: '2037-12-14T09:24Z', lambdaSun: 262.2, zhr: 150, ra: 113.0, dec: 32.92 },
  { id: 'URS', name: 'Ursids', utc: '2037-12-22T17:54Z', lambdaSun: 270.7, zhr: 10, ra: 217.02, dec: 74.73 },
];
