# HealthHub Bot Rename Design

## Objective

Rename the character from “Robin” to “HealthHub Bot” everywhere users can see or hear the name, without changing the existing experience, model, interaction design, or technical behaviour.

## User-facing scope

- Replace visible interface copy such as “Meet Robin,” “Ask Robin,” and “Robin Simulator” with equivalent “HealthHub Bot” wording.
- Update browser metadata, accessibility labels, live announcements, loading and placement messages, fallback text, image alternative text, and analytics event labels that are meaningful to product reviewers.
- Update supporting project documentation where it describes the user-facing character.
- Preserve natural grammar in possessive copy, using “HealthHub Bot’s.”

## Stability boundary

Do not rename internal identifiers whose names are not exposed to users. This includes `robin-*` DOM IDs, CSS classes, filenames, storage keys, component names, JavaScript variables, custom events, repository/package names, and asset paths. Keeping these identifiers stable avoids unnecessary regression risk in AR placement, repositioning, calculator state, analytics wiring, and the 3D fallback.

## Visual and behavioural impact

The robot model, portrait, colours, layout, interaction timing, AR/3D switching, BMI calculator, screening flow, and simulator behaviour remain unchanged. Copy must continue to fit the existing mobile layouts; longer HealthHub Bot labels will be checked at narrow mobile widths.

## Verification

- Search the shipped source for remaining user-visible “Robin” copy and review each remaining occurrence as either technical-only or intentionally retained.
- Run the existing calculation tests and production build.
- Check the principal introduction, calculator, screening, Ask page, experience menu, AR placement states, 3D fallback, accessibility labels, and simulator at a narrow mobile viewport.
- Confirm that internal `robin-*` event and selector contracts remain intact.

## Deployment

Commit only the scoped source and documentation changes, push to the existing GitHub repository, and confirm the GitHub Pages deployment completes successfully.
