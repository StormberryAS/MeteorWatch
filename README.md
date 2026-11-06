# MeteorWatch

Deterministic meteor shower tracker. MeteorWatch calculates the countdown to the next major annual meteor shower peak and dynamically cross-references it with local moon illumination data to predict true visibility without any external APIs. The page comes from the web; the calculation then runs in your browser and nothing is sent to a server. There is no service worker, so the page does not promise to open again without a connection.

**Live:** [meteor.stormberry.as](https://meteor.stormberry.as)

## Features
- **Embedded Showers**: includes Perseids, Geminids, Leonids, Lyrids, Orionids, and more.
- **Countdown**: real-time countdown to the next peak, calculated in your browser.
- **Moon Interference Score**: utilises `suncalc.js` to determine the exact moon phase and illumination percentage during the shower peak to rate visibility as EXCELLENT, GOOD, or POOR.
- **Responsive Layout**: optimised for mobile and desktop with a cinematic indigo glassmorphism theme.

## Architecture
- **Vanilla HTML and CSS, TypeScript**, no frameworks.
- **TypeScript source in `ts/`, compiled JavaScript committed.** `ts/app.ts` compiles to `app.js`, at the same path the page has always loaded, as a classic script (no modules). The compiled file is committed because GitHub Pages serves the repository as it is, with no build step of its own; `.gitattributes` marks it as generated. Edit the TypeScript, never the `.js`.
- **SunCalc vendored.** `suncalc.js` is SunCalc 1.8.0, kept byte for byte and marked as vendored; `ts/suncalc.d.ts` types it for the TypeScript.
- **Build:** `npm run build` (`tools/build-ts.sh`) installs the pinned compiler (`npm ci`), compiles, then runs `bump_assets.py` to restamp the `?v=` cache stamps. `npm run check` changes nothing and fails when the committed JavaScript is not what the TypeScript compiles to. `npm test` runs the tests in `tests/` with the test runner built into Node 24. The published app has no runtime dependencies.
- **Privacy First**, no cookies, no tracking. Zero external API calls.
- Stormberry dark-mode glassmorphism design system, Inter typography.
- **Sovereign AI**, built and maintained using high-speed agentic workflows.

## Stack
- Browser `Date` for real-time countdown calculations.
- Hardcoded localised astronomical dataset for meteor peaks.
- [SunCalc](https://github.com/mourner/suncalc) for local moon phase/illumination modelling.
- [Inter](https://rsms.me/inter/) typeface, locally hosted.

## Local development
```bash
git clone https://github.com/StormberryAS/MeteorWatch.git
cd MeteorWatch
python3 -m http.server 3004
```
Open `http://localhost:3004` in your browser.

## Credits
Built by [Stormberry AS](https://stormberry.as). Proudly powered by sovereign AI agents.

## Disclaimer

Supplied free of charge, **as is**, with no warranty of any kind. Using it creates no client or advisory relationship with Stormberry AS, and nothing it produces is professional advice.


This is a **functioning prototype**, not a certified instrument and not a professional service. Values are computed or modelled, not measured. Check anything that matters against an authoritative source before you act on it. Stormberry AS reimburses no cost or loss arising from use of this application.

Full terms: [DISCLAIMER.md](DISCLAIMER.md).
