# Robin Mobile Interaction Fixes

Date: 2026-07-17

## Goal

Remove the mobile testing blocker and make Robin’s core spatial interactions understandable without sacrificing accessibility. The work covers initial orientation, AR/3D switching, repositioning, responsive task sheets, and touch-operated calculator dials.

## Initial orientation

Whenever Robin is placed or repositioned in AR, the experience calculates a horizontal yaw from Robin’s placement point toward the active camera. Robin faces the visitor at placement time and then remains anchored at that orientation. He does not continuously rotate to follow subsequent camera movement.

If camera position is temporarily unavailable, the placement system uses the last valid camera-facing yaw. If no valid yaw exists, it uses the model’s known front-facing fallback rotation.

## Persistent AR toggle

A compact, labelled toggle sits in the top-right safe area and remains available while a task sheet is open or closed.

- **AR on:** room-based AR placement.
- **AR off:** screen-based 3D Robin with the Singapore skyline.
- Switching modes preserves the exact journey, values and screening page.
- Switching from 3D to AR opens surface detection and resumes the saved journey after Robin is placed.
- The control includes text and an accessible name; it does not rely on red/green colour alone.
- The visual treatment follows approved Option A: a white capsule containing an `AR` label and a compact green/neutral switch.

The existing overflow menu may retain a mode-changing action as a secondary route, but the persistent toggle is the primary control.

## Repositioning Robin

Long-pressing Robin for 600 milliseconds enters picked-up mode.

1. Robin gives immediate press feedback.
2. At 600 milliseconds, Robin lifts or pulses and the experience announces: “Robin picked up—tap a surface to place.”
3. The existing Robin instance is hidden or removed only after pickup is confirmed.
4. The visitor may release their finger, move the phone and tap a valid surface.
5. A valid tap places Robin facing the camera without resetting the active journey.
6. An invalid tap keeps picked-up mode active and gives retry guidance.

Moving beyond the drag threshold before 600 milliseconds cancels the long press. A normal short tap continues to close or resume the journey. “Move Robin” remains available in the options menu as an accessible non-gesture alternative.

## Responsive task sheet

The task UI becomes a single adaptive bottom sheet rather than a clipped fixed-height card.

- The sheet uses the visual viewport and safe-area insets, including changes caused by the Android or iOS browser chrome.
- Its maximum height is the usable viewport minus the top status/toggle area and a minimum view of Robin.
- Short steps remain compact.
- Tall steps scroll as one continuous surface; no nested scroll container is introduced.
- The primary action can always be reached by scrolling within the sheet.
- Bottom padding includes `env(safe-area-inset-bottom)` plus comfortable touch spacing.
- Sheet headings use responsive type sizing so large text does not consume most of a short viewport.
- Floating rotation controls remain above the visible sheet edge and never cover its menu, close button or content.
- Close/menu controls remain at least 48 by 48 CSS pixels and do not overlap the progress indicator.

The Android screenshots supplied on 2026-07-17 are the minimum regression viewport. The introduction and age steps must expose their primary bottom action without content being irretrievably clipped.

## Touch dials

Age and weight use the same reusable rotary interaction.

- Pointer down captures the pointer on the dial.
- Pointer movement maps the finger angle to the field’s own minimum and maximum.
- The pointer position updates the needle, numeric value and ARIA value continuously.
- Pointer up and cancellation release capture cleanly.
- Keyboard arrows and visible plus/minus buttons remain supported.
- The dial has `touch-action: none`; the surrounding sheet retains vertical scrolling.
- Age uses 18–100 and updates the derived age band.
- Weight uses the calculator’s existing 25–250 kg limits.
- Adjusting either dial does not rerender the full sheet during pointer movement.

## Error and recovery behaviour

- If AR cannot start, the toggle settles in the off position and explains that screen-based 3D is active.
- If returning to AR fails, the saved journey remains available in 3D.
- If long-press pickup is cancelled, Robin remains at the original position.
- If pointer capture is lost, the current dial value remains valid and plus/minus controls still work.
- Browser back and close/resume continue to preserve anonymous in-memory state.

## Validation

Automated and manual checks cover:

- initial and repositioned Robin facing the camera;
- short tap versus 600 ms long press;
- cancelled long press after movement;
- valid and invalid replacement surfaces;
- AR-to-3D and 3D-to-AR switching during introduction, BMI and screening;
- progress preservation across switching;
- age and weight touch rotation, plus/minus and keyboard controls;
- Android portrait dimensions matching the supplied screenshots;
- small iPhone portrait;
- landscape with a short visual viewport;
- browser toolbar expansion and contraction;
- safe-area spacing and 200% text scaling;
- reduced-motion behaviour;
- simulator controls for orientation, pickup and both mode states.

## Acceptance criteria

1. Robin faces the visitor when first placed and after repositioning.
2. A persistent, labelled AR toggle changes modes without resetting progress.
3. Long press reliably picks Robin up; a later valid surface tap places him.
4. Every journey step remains operable on the supplied Android viewport.
5. No primary action is permanently clipped below the task sheet.
6. Both age and weight dials rotate by touch and retain plus/minus alternatives.
7. Floating controls never overlap task controls.
8. Calculator tests and the production build pass before deployment.
