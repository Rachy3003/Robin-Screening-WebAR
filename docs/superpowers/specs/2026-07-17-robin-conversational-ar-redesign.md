# Robin Conversational AR Redesign — Design Specification

## Objective

Replace the fixed, nested-scroll BMI and screening container with a Robin-led conversational experience that keeps Robin visible, makes every active step readable, allows an unobstructed photo mode, preserves anonymous progress, and works consistently across AR and screen-based 3D.

This redesign applies to the standalone `Robin-Screening-WebAR` experience. It does not modify the legacy `Robin-WebAR` project.

## Experience principles

1. Robin is an active guide, not decorative scenery.
2. Active tasks show one decision at a time without nested scrolling.
3. Closing a task hides all task UI without discarding progress.
4. Users control whether to use AR or screen-based 3D.
5. BMI and screening share information rather than asking twice.
6. Screening guidance stays concise; cost and payment questions are handled on demand.
7. Every gesture has a visible, accessible alternative.
8. Anonymous inputs remain only in the active browser session.

## Interaction architecture

### Robin in AR

Robin remains world-anchored where the visitor places it. Normal camera movement changes Robin's apparent size and position through perspective. Robin does not automatically follow the camera.

Visitors may reposition Robin in two ways:

- press and drag Robin to a new valid surface position; or
- select **Move Robin**, then tap a new valid surface position.

The existing left and right rotation controls remain available. Repositioning and rotation do not reset BMI, screening, dialogue, or navigation state. If a requested position is invalid, Robin remains in the current position and the interface explains how to try again.

### Active BMI and screening dialogue

BMI and screening steps use a screen-space speech bubble that is visually tethered to Robin. The bubble:

- shows one task step at a time;
- occupies no more than 40% of portrait viewport height;
- avoids covering Robin's head and upper body;
- moves to the clearest safe side when its default position would cover Robin;
- includes a speech-tail pointing toward Robin;
- includes clear Close, Back and Continue controls as appropriate;
- uses no nested scrolling for ordinary steps; and
- maintains a minimum 16px body size and 44–48px touch targets.

Robin's portrait is adaptive rather than permanent. It appears only when Robin is partially hidden or outside the camera frame and fades when Robin becomes clearly visible again. The portrait is an orientation cue, not a duplicate decorative mascot.

### Close, photo and resume behaviour

Close removes the active bubble, adaptive portrait and task controls while preserving the exact task step and all entered values. The camera view remains unobstructed for three seconds for photos or direct interaction with Robin.

Tapping Robin during this period resumes the exact closed step immediately. Tapping Robin while the post-close prompt sequence is active also cancels that sequence and resumes the closed step. Reset is the only action that clears anonymous journey data.

### Post-close true 3D conversation

After three seconds of unobstructed photo mode, Robin presents true 3D bubbles beside the character. These bubbles:

- billboard toward the camera;
- counter-scale within defined minimum and maximum sizes;
- remain spatially attached when Robin is repositioned;
- contain one concise message and one primary action;
- replace one another rather than stacking; and
- can be dismissed without resuming the closed task.

The sequence is:

1. **How can I help?** → **Ask me a question**
2. three seconds later: **Would you like to visit HealthHub?** → **Visit HealthHub**
3. three seconds later: **Would you like the HealthHub app?** → official Apple App Store and Google Play badges

The final prompt remains for six seconds, then fades. A ten-second quiet interval follows. The sequence repeats once, then Robin remains idle. Tapping an action pauses the sequence. Tapping Robin after the two-loop limit restarts the sequence unless a closed task is available, in which case tapping Robin resumes that task.

Reduced-motion mode preserves timing and content but uses immediate or opacity-only state changes.

## Shared profile and journey logic

### Exact age as the source of truth

The experience asks exact age once through a playful, accessible age dial. That value is the source of truth for both BMI context and screening eligibility logic.

- Completing BMI first means screening skips its age question.
- Skipping BMI means screening asks age when needed.
- Editing age updates both journeys and recalculates affected results.
- Derived age bands are implementation details and are not collected again.
- Under-18 users follow the existing age-appropriate official route and do not receive adult BMI calculations.

Height, weight, calculation profile and activity remain local to the BMI journey and active browser session.

### BMI journey

Robin presents one step per screen-space bubble:

1. adult suitability;
2. calculation profile;
3. exact age;
4. interactive height instrument;
5. interactive weight instrument;
6. activity level when the selected calculation profile supports a calorie estimate; and
7. concise result.

The height ruler and weight dial remain interactive. Each instrument also provides visible increment and decrement buttons and an accessible value announcement.

The result includes:

- BMI and classification;
- calorie estimate when applicable;
- careful context that the result is an indicator, not a diagnosis;
- **Continue to screening**;
- **Adjust values**;
- **Ask Robin**; and
- **Close**.

Closing and reopening preserves the current step and values.

### Screening journey

Robin asks screening questions one at a time. Questions already answered through the shared profile are skipped.

The relevant-screening list remains compact. Selecting a screening opens a four-page guided sequence:

1. why it may be relevant;
2. what the check looks for;
3. what to expect; and
4. official HealthHub action.

Each page includes visible Back and Next controls where applicable, **Ask Robin**, and Close. Optional horizontal swiping may mirror Back and Next, but swiping is never required.

### Cost, support and MediSave

Cost, subsidies, support and MediSave are removed from standard screening results. These topics appear only when the visitor asks through Ask Robin.

Answers must:

- state that eligibility and payment support require official confirmation;
- avoid implying guaranteed MediSave coverage;
- distinguish general information from eligibility decisions; and
- provide an official HealthHub or provider verification path.

Every screening shortlist and detail page provides an **Ask Robin** action.

## Ask Robin

Ask Robin is available from:

- BMI results;
- screening shortlist;
- every screening detail page;
- the post-close 3D prompt sequence; and
- the secondary journey menu.

The first version continues to use reviewed intent matching for supported general topics. It does not diagnose, determine eligibility, or send free-form health data to an external AI service. Unmatched questions receive a safe limitation message and an official verification route.

## AR and 3D mode control

Mode choice is bidirectional and preserves journey state.

### AR to 3D

AR remains the default for visitors assigned to the AR variant. During extended camera startup or scanning, the experience offers **Use 3D instead** without stopping the camera automatically. During an active journey, **Switch to 3D** is available in a secondary menu rather than beside the primary answer.

Automatic fallback occurs only after a confirmed camera, device or tracking failure. A timeout alone is not a failure.

### 3D to AR

Visitors in screen-based 3D receive **Place Robin in my space** when the device supports AR. Selecting it starts camera permission and tracking while preserving the current task step and values.

Visitors assigned to the 3D A/B variant enter 3D directly but retain the option to choose AR.

### Analytics

Analytics records:

- assigned A/B variant;
- actual active mode;
- switch direction;
- switch source or reason;
- camera or tracking failure versus user choice; and
- whether the journey continued after switching.

Calculator inputs, exact age, height, weight, BMI, calorie values, free-form questions and health answers never enter analytics.

## Screen-based 3D environment

The supplied Singapore skyline artwork replaces the blank green background.

### Responsive art direction

- Portrait uses an immersive crop with its default focal point 34% from the left.
- Marina Bay Sands and Gardens by the Bay remain the visual priority.
- Robin sits higher in portrait mode, around the lower-middle of the frame.
- Landscape reveals more of the full skyline and returns Robin closer to the lower third.
- The artwork is never stretched.
- A subtle lower gradient preserves Robin and control contrast.

Production assets include responsive AVIF and WebP variants with PNG fallback. Dimensions and aspect ratio are declared to prevent layout shift. The background must not block initial Robin loading.

The 3D variant uses the same active screen-space dialogue, adaptive portrait, close/resume behaviour and post-close prompt logic as AR.

## Visual and motion system

- Retain the HealthHub-aligned green palette.
- Use semantic surface, foreground, muted, border, warning and focus tokens.
- Normal text must meet WCAG AA 4.5:1 contrast.
- Use a consistent 4px/8px spacing rhythm.
- Use one primary action per step.
- Use SVG icons with consistent stroke styling rather than emoji controls.
- Use visible focus states.
- Use 150–300ms opacity and transform transitions.
- Do not animate width, height or layout position.
- Limit motion to one or two meaningful elements per view.

## Accessibility

- All functionality is available without drag, swipe or precision gestures.
- Close, Move Robin, rotation, Back and Continue meet minimum touch target sizes.
- Each icon-only control has an accessible name.
- Focus moves to the new question heading after a step change.
- Closing returns focus to Robin or the control that opened the dialogue.
- Screen-reader announcements are concise and do not reread the entire conversation.
- Inputs expose labels, current values, bounds and validation feedback.
- Reduced motion preserves content and control timing.
- Layout supports text enlargement without truncating essential actions.
- Safe areas are respected in portrait and landscape.

## State and navigation

Journey state contains:

- current mode;
- current active or closed flow;
- exact current step;
- shared exact age;
- BMI inputs and result;
- screening answers and shortlist;
- selected screening and detail page;
- post-close sequence stage and loop count; and
- Robin placement and orientation state during ordinary tracking and recoverable tracking interruptions. If the runtime cannot restore the world anchor, the journey state remains intact and the visitor is prompted to place Robin again.

Browser Back returns to the previous journey step without clearing state. Mode switches, orientation changes, tracking recovery and close/resume preserve the state. Reset explicitly clears it.

## Error handling

- Invalid repositioning keeps Robin in place and gives retry guidance.
- Robin moving off-screen shows the adaptive portrait without closing the task.
- Camera or tracking loss preserves journey state and offers 3D.
- 3D model failure retains the complete dialogue journey with a static Robin fallback.
- Background-image failure falls back to the existing gradient.
- Campaign-data failure provides an official HealthHub route.
- Ask Robin unmatched or unsupported questions provide a limitation and official verification path.

## Simulator and validation

Extend both AR and 3D simulators with deterministic states for:

- active screen-space bubble;
- close and exact-step resume;
- Robin visible, partially hidden and off-screen;
- adaptive portrait appearance;
- valid and invalid repositioning;
- Move Robin;
- each post-close prompt stage;
- quiet interval and two-loop limit;
- reduced motion;
- AR-to-3D and 3D-to-AR switching;
- mode-switch state preservation;
- shared exact age;
- BMI-to-screening question skipping;
- screening detail pagination;
- Ask Robin entry from every required location;
- camera and tracking failure; and
- model or background failure.

Validation covers:

- 375px small phones;
- large phones;
- tablets;
- portrait and landscape;
- iOS and Android camera permission paths;
- keyboard navigation;
- screen readers;
- reduced motion;
- enlarged text;
- BMI and screening age boundaries;
- no duplicate age questions;
- no nested scrolling for ordinary steps;
- no cost, subsidy or MediSave content in standard results;
- analytics allow-list compliance; and
- anonymous state preservation across close, reposition and mode changes.

## Acceptance criteria

1. A visitor can close any BMI or screening step and take an unobstructed photo.
2. Tapping Robin resumes the exact closed step without data loss.
3. Ordinary BMI and screening steps require no internal vertical scrolling.
4. Robin remains visible or is represented by the adaptive portrait when off-screen.
5. Robin can be repositioned without resetting the journey.
6. Exact age is collected at most once and drives both journeys.
7. Standard screening results do not contain cost, support or MediSave sections.
8. Ask Robin is available from BMI results, screening shortlist and every screening detail page.
9. Post-close true 3D prompts replace one another, run for two loops and then stop.
10. Users can switch bidirectionally between AR and 3D without losing progress.
11. The 3D fallback uses the responsive left-focused Singapore artwork.
12. Both simulators can reproduce every new interaction and recovery state.

## Out of scope

- Diagnostic advice or clinical interpretation.
- Booking inside Robin.
- Login or HealthHub account integration.
- Server-side storage of age, BMI, screening answers or questions.
- Free-form generative medical answers.
- Automatic Robin camera-follow behaviour.
- Changes to the legacy `Robin-WebAR` project.
