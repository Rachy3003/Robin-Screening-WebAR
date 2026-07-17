# Robin Collapsible Sheet

Date: 2026-07-17

The grey sheet handle becomes an accessible two-state control.

- Tapping the handle on an open sheet collapses it to a fixed bottom strip.
- The collapsed strip shows only the handle, overflow menu and full-close button.
- Tapping the handle again restores the exact content, step and scroll position.
- The overflow menu and full-close button remain usable while collapsed.
- Collapsing never starts the post-close prompt sequence; full close still does.
- The strip includes bottom safe-area padding and remains operable at 200% text size.
- Robin’s floating rotation controls sit above either the expanded sheet or collapsed strip.
- The handle has a minimum 48px target, visible press feedback, `aria-expanded`, and a descriptive label.
- The simulator exposes collapsed and expanded states.

Acceptance requires the supplied Android viewport to preserve the journey, restore scroll position, and avoid overlap between the strip and floating controls.
