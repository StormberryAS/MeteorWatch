# MeteorWatch

Deterministic offline meteor shower tracker. MeteorWatch calculates the countdown to the next major annual meteor shower peak and dynamically cross-references it with local moon illumination data to predict true visibility without any external APIs.

**Live:** [meteor.stormberry.as](https://meteor.stormberry.as)

## Features
- **Embedded Showers**: includes Perseids, Geminids, Leonids, Lyrids, Orionids, and more.
- **Offline Countdown**: real-time countdown to the next peak.
- **Moon Interference Score**: utilizes `suncalc.js` to determine the exact moon phase and illumination percentage during the shower peak to rate visibility as EXCELLENT, GOOD, or POOR.
- **Responsive Layout**: optimized for mobile and desktop with a cinematic indigo glassmorphism theme.

## Architecture
- **Vanilla HTML/CSS/JS**, no frameworks, no build step.
- **Privacy First**, no cookies, no tracking. Zero external API calls.
- Stormberry dark-mode glassmorphism design system, Inter typography.
- **Sovereign AI**, built and maintained using high-speed agentic workflows.

## Stack
- Browser `Date` for real-time countdown calculations.
- Hardcoded localized astronomical dataset for meteor peaks.
- [SunCalc](https://github.com/mourner/suncalc) for local moon phase/illumination modeling.
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
