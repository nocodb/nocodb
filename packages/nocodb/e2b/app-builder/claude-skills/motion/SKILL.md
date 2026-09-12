---
name: motion
description: Use when adding or fixing ANY animation — hover/press feedback, a panel or dialog opening, a kanban card moving between columns, a list reordering, an optimistic update, a value changing. Decides whether it should animate at all, then which tool, properties, curve and duration. Read before writing a single transition.
---

# Motion

Motion in an internal tool is feedback, orientation and continuity — never decoration. These apps are
used all day, every day, by people doing their job: **the more often a user sees an animation, the
shorter and subtler it must be, and the most common correct answer is no animation at all.**

Work the steps in order. Steps 1 and 2 gate everything else — don't pick a curve before you know
whether the thing animates.

## 1. Should this animate at all?

| How often the user sees it | Decision |
|---|---|
| 100+ times a day (a row hover in a long table, a keyboard-triggered panel, a filter toggle) | **No animation.** Instant state change. |
| Tens of times a day (opening a detail sheet, switching a tab) | Near-imperceptible only — ≤150ms opacity/colour, or nothing |
| Occasional (dialog, drawer, toast, drag-and-drop) | Standard animation |
| Rare / first run (empty-state illustration, first successful publish) | The only place delight belongs |

A keyboard-initiated action is a disqualifier, not a judgement call. If the answer is "no animation",
say so and move on — that is a correct outcome, not a dodge.

## 2. Name the purpose

One of these words, before you write anything: **feedback** (the click landed) · **spatial
consistency** (where did it go / come from) · **state indication** (what changed) · **preventing a
jarring jump** (content would otherwise teleport). Can't name it? Don't build it.

And never animate the data itself for style — a table the user is reading, a chart they're comparing,
a number they're checking must not move for effect.

## 3. Pick the cheapest tool that works

Stop at the first row that fits.

| Need | Tool |
|---|---|
| Hover, press, colour, a class/attribute state you control | **CSS transition** |
| A dialog, sheet, popover, dropdown, tooltip, accordion | **Nothing — the vendored primitive already animates.** Don't re-animate it |
| A collapse (height) | **`grid-template-rows: 0fr → 1fr`** on a wrapper with an `overflow: hidden` child |
| Exit animation, reorder/layout change, drag with momentum | **`motion`** (installed — `import { motion, AnimatePresence } from "motion/react"`) |

Don't add another animation library; `motion` plus CSS covers everything these apps need.

## 4. Pick the properties

- **`transform` and `opacity` only.** They skip layout and paint. `width`/`height`/`top`/`left`/
  `margin`/`padding` relayout the document every frame and jank a long list — the only tolerated
  exception is an accordion's height, and even there prefer the grid-rows trick above.
- **Never `scale(0)`** — nothing appears from nothing. Enter from `scale(0.95–0.97)` + `opacity: 0`.
- **Enter with a small `translateY` (4–8px)**, never a big slide.
- **`translate` percentages** are relative to the element's own size — `translateY(100%)` moves a
  drawer by its own height whatever the content. Prefer that to hardcoded pixels.
- **In `motion`, animate the full transform string, not the `x`/`y`/`scale` shorthands** — the
  shorthands aren't hardware-accelerated and drop frames while the page is busy:

```tsx
<motion.div animate={{ x: 100 }} />                          // drops frames under load
<motion.div animate={{ transform: "translateX(100px)" }} />  // accelerated
```

- **Name the properties you transition** (`transition-[opacity,transform]`). Never `transition-all` —
  it sweeps up layout properties you didn't intend.

## 5. Easing and duration — or a spring

| Situation | Easing |
|---|---|
| Entering or exiting | `ease-out` |
| Moving A→B on screen | `ease-in-out` |
| Hover / colour | `ease` |
| Continuous (marquee, indeterminate progress) | `linear` |

**Never `ease-in` on UI** — it stalls at the exact moment the user is watching. The browser's built-in
curves are weak; use these (they're worth adding to `index.css` as tokens if you animate more than
once):

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* UI entrances/exits */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* iOS-like drawer/sheet */
```

| Element | Duration |
|---|---|
| Press feedback | 100–160ms |
| Tooltip, small popover | 125–200ms |
| Dropdown, select | 150–250ms |
| Dialog, drawer | 200–300ms |

**Nothing in this app exceeds 300ms.** A 180ms dropdown feels more responsive than a 400ms one.

Use a **spring** instead when motion is gesture-driven or interruptible — a dragged card, a
swipe-to-dismiss:

```tsx
{ type: "spring", duration: 0.3, bounce: 0 }    // tools: no overshoot
{ type: "spring", duration: 0.4, bounce: 0.2 }  // only for a deliberately playful, rare interaction
```

Keep `bounce: 0` for anything in the daily path — overshoot reads as a toy.

## 6. Interruption and exit

- **Transitions, not keyframes**, for anything a user can fire twice in a second (a toggle, a toast,
  a status change). Transitions retarget from the current value; keyframes restart from zero.
- **Exit the way it entered** — a sheet that came from the right leaves to the right. Symmetry is
  what makes swipe-to-dismiss feel obvious.
- **`AnimatePresence initial={false}`** so a list doesn't animate itself in on first paint.

## 7. Reduced motion and hover gating — ship with the animation

```css
@media (prefers-reduced-motion: reduce) {
  .thing { transition: opacity 150ms ease; transform: none; animation: none; }
}
@media (hover: hover) and (pointer: fine) {
  .thing:hover { transform: translateY(-1px); }  /* touch fires false hovers on tap */
}
```

Reduced motion means gentler, not zero: keep opacity and colour, drop movement.

## The cases that actually come up in these apps

**Kanban drop — the movement IS the feedback.** Move the card optimistically the instant it drops,
run the action underneath, and animate it back with a toast if the write fails. `layout` keeps the
card's identity as the columns reflow:

```tsx
<motion.div layout transition={{ type: "spring", duration: 0.3, bounce: 0 }} />
```

**Row/card entering a list**: fade + 4px rise, 200ms `ease-out`. A whole list re-rendering does not
get a stagger; a genuinely staged first paint may use 30–80ms between items, once.

**Optimistic edits**: the row updates immediately with no animation; only a *failure* animates
(revert + toast). Success needs no celebration.

**Loading**: skeletons that mirror the final layout, not spinners (see the `design` skill). A spinner
belongs inside a button that's mid-submit.

**A number that changes while watched**: brief highlight, `tabular-nums` so digits don't shift. No
count-up tickers in a tool.

## Never ship

| Never | Instead |
|---|---|
| `transition-all` | Name the properties |
| `scale(0)` entrance | `scale(0.95)` + `opacity: 0` |
| `ease-in` on UI | `ease-out`, or the strong curve above |
| A UI animation over 300ms without a reason | 150–250ms |
| Keyframes on a toggle/toast/status change | CSS transitions |
| Animating `width`/`height`/`top`/`left`/`margin` | `transform` / `opacity` / grid-rows |
| `motion`'s `x`/`y`/`scale` props | Full `transform` string |
| Ungated `:hover` motion | `@media (hover: hover) and (pointer: fine)` |
| Missing `prefers-reduced-motion` | Gentler variant |
| Re-animating a `Dialog`/`Sheet`/`Popover` | Use the primitive as-is |
| Animation on a 100×/day interaction | Nothing |
| Parallax, float-on-idle, animated gradients, confetti | Nothing |
