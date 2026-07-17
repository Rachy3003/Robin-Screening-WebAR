# Robin Screening WebAR

Independent 8th Wall pilot for a Robin-led screening journey with an optional BMI and calorie calculator. This project does not replace or modify `Robin-WebAR`.

Run `npm ci`, then `npm run serve`. Use the 8th Wall device connection workflow for camera and world-tracking tests.

Calculator inputs and results remain only in the active browser session and never enter analytics. Production analytics use an allow-listed adapter and remain disabled unless a privacy-approved Plausible configuration is supplied.

Run `npm test` to verify HealthHub formula parity and BMI boundary behaviour. Simulator URLs accept `?simulator=1&variant=ar` or `?simulator=1&variant=3d`; optional `simstate` values include `offer`, `height`, `weight`, `activity`, and `result`.
