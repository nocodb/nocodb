# Product tours

In-app guided tours, built on [driver.js](https://driverjs.com). Two jobs:

- **Onboarding** — walk a new user around the product.
- **Feature announcement** — when we ship something, show the people who can
  actually use it, and only them.

---

## Quick start

Add one file to `tours/defs/`. That's the whole registration step — it's picked
up by a glob.

```ts
// packages/nc-gui/tours/defs/my-feature.ts
import { getI18n } from '~/plugins/a.i18n'
import { defineTour } from '../types'

// Deferred, not `useI18n()`: this file is imported before the i18n plugin installs,
// and none of it runs inside component setup.
const t = (key: string) => getI18n().global.t(key)

export default defineTour({
  id: 'my-feature-v1',
  kind: 'feature',
  releasedAt: '2026-08-01',
  title: () => t('tour.myFeature.title'),
  trigger: { type: 'beacon', anchor: 'my-thing' },
  steps: [
    {
      anchor: 'my-thing',
      title: () => t('tour.myFeature.look.title'),
      description: () => t('tour.myFeature.look.description'),
    },
  ],
})
```

Copy goes in `lang/en.json` under `tour.*`, like every other user-visible string.
`title`/`description` accept a plain string too, but only use that for copy no user
reads — anything on screen must go through `t()`.

Then mark the element it points at:

```html
<NcButton data-tour="my-thing">…</NcButton>
```

Run it from the avatar menu → **Product Tours**, or wait for its trigger.

---

## How it works

```
tours/
  types.ts             the contract — defineTour, NcTour, NcTourStep, TourTrigger
  index.ts             anchor resolution, event bus, collectTours()
  anchors.catalog.md   generated — every anchor and where it lives
  defs/*.ts            ← tours live here
ee/tours/defs/         ← EE-only tours

modules/
  tour-anchors.ts      Nuxt module — generates the NcTourAnchorId union

composables/
  useTourRegistry.ts   globs defs/          (EE override globs CE + EE)
  useTours.ts          everything else
components/tour/
  Host.vue         mounted in app.vue — calls init(), owns the popover CSS
  LauncherMenu.vue Help-menu tour list
```

A tour reaches the screen in five stages:

**1. Collection (build time).** `useTourRegistry` globs `tours/defs/*.ts`.
Duplicate `id` throws at module init — ids key persisted state, so a silent
merge would corrupt two tours' history. Tours sort newest-first by `releasedAt`.

**2. Trigger.** `Host.vue` calls `init()` once at app root, registering a route
watcher, a delegated click listener, and an event-bus subscription. They live
for the app's lifetime.

**3. `canTrigger()` — may this interrupt?**

```
tours enabled? → nothing running? → not already seen?
  → not already auto-fired? → cooldown ok (passive triggers only)?
  → trigger.when() passes? → eligible?
```

**4. `explain()` — is this relevant to this viewer?** Deployment mode, roles,
beta flag, route, `audience.when`. It holds **no gating rules of its own** — it
only calls gates the app already enforces.

**5. `start()`.** Filters steps by `when`, navigates to step 0's `goto`, warns
about unresolved anchors, lazily imports driver.js, and drives.

---

## Eligibility vs trigger — the distinction that matters

**`audience` = who it's relevant to. `trigger.when` = when it should fire on its own.**

`audience` also controls Help-menu listing. Put "new users only" there and
existing users lose the ability to replay the tour.

| Condition | Belongs in |
|---|---|
| plan, role, deployment, feature flag | `audience` |
| new signups only, first-time-in-view | `trigger.when` |

---

## Triggers

| Type | Fires when | Cooldown |
|---|---|---|
| `{ type: 'manual' }` | Help menu / deep link only | — |
| `{ type: 'auto', delay?, when? }` | as soon as eligible | ✅ |
| `{ type: 'route', path, delay?, when? }` | navigating to `path` — string prefix or RegExp | ✅ |
| `{ type: 'click', on, delay?, when? }` | user clicks the anchor (delegated) | ❌ |
| `{ type: 'event', name, delay?, when? }` | `emitTourEvent(name)` fires | ✅ |
| `{ type: 'beacon', anchor }` | user clicks the beacon | — |

Every app-initiated trigger is also gated on: never if already seen, never twice,
never while another tour runs.

`click` skips the cooldown because the user initiated it — it isn't an
interruption. The 7-day cooldown on passive triggers exists so a run of releases
can't become a stream of popups; that's the failure mode that teaches people to
reflex-dismiss, which poisons onboarding too.

Firing an event from anywhere:

```ts
import { emitTourEvent } from '~/tours'

emitTourEvent('base-created')
```

---

## Anchors

The element a step highlights.

| You write | Resolves to |
|---|---|
| `'create-base'` | `[data-tour="create-base"]` |
| `'selector:.nc-sidebar-item'` | `.nc-sidebar-item` |

**Anchor ids are type-safe and autocomplete.** `modules/tour-anchors.ts` scans
every template for `data-tour="..."` at build time and generates the
`NcTourAnchorId` union, so a mistyped anchor is a compile error:

```
Type '"create-bse"' is not assignable to type 'TourAnchor'.
Did you mean '"create-base"'?
```

Nothing to maintain — add the attribute, and it appears in the union (and in
`tours/anchors.catalog.md`) on the next build. The dev server regenerates on
save.

The `selector:` prefix is the escape hatch for a raw CSS selector. It is
deliberately explicit: a plain `string` arm would make *every* string assignable
and silently defeat the typo checking.

Prefer ids. `data-tour` is a visible contract, so whoever refactors the component
can see a tour depends on it; raw selectors break silently when markup moves.

Omit `anchor` entirely for a centered popover with no highlight — good for an
opener or a sign-off.

### Three traps

**EE overrides.** If `ee/components/<same path>` exists, it replaces the CE file
wholesale in EE builds. An attribute added only to the CE copy never renders.
Check before adding — and check the other direction too: a tour in `tours/defs/`
also loads in CE, so an anchor that exists *only* in an `ee/` component needs
`when: () => isEeUI` on that step, or the step is dead weight in CE.

**Page scope.** Workspace home and inside-a-base use completely different
sidebars. Use `goto` to bring the user to the right page, and put a route check in
**`trigger.when`** to stop a delayed trigger opening the tour somewhere its anchors
don't exist — it is re-evaluated when the delay expires, not only when scheduled,
so it catches a user who navigated in between.

Prefer `trigger.when` over `audience.when` / `audience.route` for this: `audience`
also drives Help-menu listing, so a route condition there removes **Product Tours**
from the menu on every other page. Gate the auto-fire, not the availability.

**The grid can't be highlighted.** It's canvas-rendered, so cells, column headers
and row controls have no DOM node. Anchor on the toolbar control instead.

### Missing anchors fail quietly — on purpose

A step whose anchor isn't found is skipped. That's right at runtime: the UI
already gates itself, so a missing element usually means the viewer legitimately
lacks that feature.

But it means a misconfigured tour looks *broken* rather than misconfigured — if
every step after the first is missing, driver.js correctly labels step 1 "Done".
So `start()` logs every unresolved anchor. **Watch the console the first time you
run a new tour.**

Skipping is also why Next stays enabled when the *next* anchor is missing but a
later one resolves. An earlier version disabled it, which turned any absent anchor
into a tour with no way forward — and, since Esc and the backdrop are both
deliberately inert, no way out either.

---

## Steps

```ts
{
  anchor: 'create-base',              // omit for a centered step
  title: () => t('tour.x.title'),
  description: () => t('tour.x.desc'), // the message may contain <b>inline HTML</b>
  side: 'bottom', align: 'end',

  goto: '/nc/workspace',              // navigate here first (string or function)
  advanceOnClick: true,               // the click IS the step; no Next button
  advanceWhen: () => cond,            // advance when this turns true; no Next button
  allowInteraction: false,            // default true; false blocks clicks
  when: ({ route }) => cond,          // skip this step entirely
  onNext: async () => { … },          // awaited before advancing
}
```

Every gate — `audience.when`, `trigger.when`, `step.when` — receives
`{ route }`. Predicates run outside component setup, so `useRoute()` is not
available to them; use the passed route with the app's own helpers
(`isWsHomeRoute(route)`) instead of matching paths by hand.

### Three ways a step finishes

| | Use when | Next button |
|---|---|---|
| Next button (default) | the step is just something to read | shown |
| `advanceOnClick` | the click on the highlighted element *is* the action | hidden, unless the target is disabled |
| `advanceWhen` | finished by a select, a field, a toggle — anything but a click | hidden |

Next is hidden for the latter two on purpose: leaving it gives two contradictory
ways forward, and it would vanish mid-click anyway once the condition flipped.

**Except when the target can't be clicked.** An `advanceOnClick` step whose element
is `disabled` would otherwise have no way forward at all — the workflows tour hits
this on Publish, which the product disables until every node has a fresh test. Next
reappears in that case and disappears again once the control is usable. `advanceWhen`
gets no such fallback, so only use it for a condition the user can actually satisfy
from where the step leaves them.

### `goto` — how a tour spans pages

Without it a step can only point at whatever happens to be mounted where the tour
started. A string is pushed as a path; a **function** is awaited and navigates
itself, for destinations whose URL isn't known when the tour is written:

```ts
goto: ({ route }) => {
  if (/\/workflows\/[^/]+/.test(route.path)) return   // already there
  ncNavigateTo({ workspaceId: route.params.typeOrId, baseId, workflowId })
}
```

The engine hands it `{ route, router }` so tour files never call `useRoute()`
from an async continuation, where the Nuxt context is gone.

### Next is gated on the next step's target

Action-driven tours reveal their own UI: the config sidebar appears only once a
node is selected, publish only once there are draft changes. Next stays disabled
until the *next* step's anchor exists, so a step can't land on a popover attached
to nothing. Hovering the disabled button explains why.

---

## Fields at a glance

| Field | Required | What it does |
|---|---|---|
| `id` | yes | keys persisted seen-state; changing it re-shows the tour |
| `kind` | yes | `'onboarding' \| 'feature'` — picks the launcher icon, and splits telemetry so you can ask "did feature tours drive adoption" separately from onboarding |
| `releasedAt` | yes | ISO date; orders the Help-menu list and trigger priority |
| `title` | yes | shown in the Help menu |
| `trigger` | yes | see [Triggers](#triggers) |
| `steps` | yes | see [Steps](#steps) |
| `audience` | no | see below — omit for "everyone" |

`kind` is deliberately thin: two small behaviours, no gating. If you find yourself wanting a
third value, that's usually a sign the thing you want is an `audience` gate or a new trigger,
not a new category.

---

## Audience

```ts
audience: {
  when: () => !useEeConfig().blockInterfacePivotWidget.value,
  roles: [WorkspaceUserRoles.OWNER],
  deployment: ['cloud', 'onprem-licensed'],
  route: /^\/nc\//,
  betaFlag: FEATURE_FLAG.SOME_BETA,
}
```

`audience.when` must reference **the same gate the feature itself uses**. Never
restate the rule — a second copy drifts, and you end up advertising a button the
user can't click.

### Teaching vs pitching

On-prem-unlicensed *shows* EE features behind upgrade badges, so **visible ≠ usable**. Decide
which audience a tour is for and invert the gate accordingly — there is no separate field for
this, just the predicate:

```ts
// teach — they can use it, so walk them through the workflow
audience: { when: () => !useEeConfig().blockX.value }

// pitch — they can see it but it's plan-blocked, so sell the value
audience: { when: () => useEeConfig().blockX.value }
```

There used to be an `intent: 'adopt' | 'upsell'` field. It was removed: it drove no behaviour
(no upgrade CTA was ever wired up), and a required field that does nothing gets filled in
arbitrarily, so it can't be relied on later. If pitch-tours become real and need a different
ending, reintroduce it *together with* the CTA that gives it meaning.

---

## When predicates are evaluated

There are three `when`s and they have three different lifetimes. This matters more than it
looks.

| Predicate | Evaluated | Reacts to later changes |
|---|---|---|
| `step.when` | **once**, when the tour starts | no — the step list is frozen |
| `audience.when` | on every eligibility check, incl. inside computeds | **yes**, if it reads reactive state |
| `trigger.when` | **twice** — when the trigger is considered, and again when its `delay` expires | only across that gap |

All three receive `{ route }`. They run outside component setup, so `useRoute()` is
unavailable to them — use the passed route.

**`trigger.when` runs twice on purpose.** A `delay` is a window in which the user can
navigate away, so a gate that held when the trigger was scheduled may not hold when it
fires. Re-checking is what makes a route condition here trustworthy — and keeps it out of
`audience`, where it would also hide the tour from the Help menu.

**`step.when` is frozen on purpose.** driver.js navigates by index and the popover shows
"2 of 5"; if the step list mutated mid-run the count would be a lie and navigation would
desync from the engine's own copy. A tour is a fixed sequence once it opens.

**`audience.when` is reactive — but only if your predicate reads reactive state.** It runs
inside the `availableTours` and `activeBeacons` computeds, so Vue tracks whatever refs it
touches:

```ts
when: () => !useEeConfig().blockX.value    // ✅ tracked — menu and beacon update live
when: () => document.querySelector('.x')   // ❌ not tracked — computed caches forever
when: () => window.__someFlag              // ❌ not tracked
```

Because it runs on every recompute, keep it **cheap and side-effect free** — no DOM queries,
no API calls.

**Nothing re-checks eligibility mid-tour.** Once a tour is running, a plan downgrade or role
change won't stop it; it plays to the end. The only mid-run abort is navigating to a route the
tour didn't declare via `goto`. Low harm in practice, but worth knowing.

**Predicates never fail open.** All of them are wrapped: a throwing predicate logs and returns
`false`. An errored gate must never advertise a blocked feature or interrupt someone.

**They run with no component context** — from computeds and from the engine's timer. Use Pinia
stores and `createSharedComposable`s only. An injection-state composable (anything `…OrThrow`)
throws there, the throw is swallowed, and the step silently never advances. This is the single
easiest way to write a tour that looks broken for no visible reason.

**They run outside component setup**, from a shared composable — so they may only touch
`createSharedComposable`s and Pinia stores, never `inject()`-based state like
`useSmartsheetStore()`.

---

## CE vs EE

EE-only tours go in **`ee/tours/defs/`**, never in the shared folder.

`import.meta.glob` resolves relative to the file it's written in, and the EE Nuxt
layer (`extends: ['../']`) overrides by *directory convention* — it does not
redirect a relative import. So the globs live in `composables/useTourRegistry.ts`,
which the EE build replaces with a version globbing both directories.

A CE build never evaluates the EE glob, so **paid-feature names and copy never
reach the open-source bundle**. Don't move the glob back into `tours/index.ts`.

---

## API

```ts
const {
  activeTour, isActive, availableTours, activeBeacons,  // state
  start, stop, refresh, init,                           // control
  isSeen, reset, markOnboardingHandoff,                 // persistence
  explain,                                              // why isn't my tour showing?
} = useTours()
```

`start(id, source)` is async. `explain(tour)` returns `{ eligible, reason }`.

---

## State

| What | Where | Why there |
|---|---|---|
| seen / dismissed | `user.meta.tours` | follows the user across devices |
| auto-fired | `localStorage`, keyed by user id | shared across tabs |
| onboarding handoff | `localStorage`, keyed by user id | survives the navigation |

Seen-state writes go through `updateUserMeta()` — the backend replaces `meta`
wholesale, so a partial write would drop other keys. Writes are optimistic and
fire-and-forget; a lost write just re-shows a tour.

Both localStorage entries are **maps keyed by user id**, not bare values:
localStorage is per-browser while what they record is per-person, so on a shared
machine a bare value would let the first user to finish onboarding suppress the
tour for everyone signing in after them.

"Auto-fired" is recorded **only after a tour actually opens**. Marking on attempt
would permanently suppress a tour whose start failed, now that the record
persists.

---

## Telemetry

`$e('c:tour:{start,step,complete,dismiss}')` with `{ tourId, kind, source, stepIndex }`.
This is the whole measurement story — there is no server-side tour analytics table.

---

## Debugging

```js
// Both keys are { [userId]: value }. The signed-in id isn't in localStorage —
// read it off the JWT the app already stores:
const uid = JSON.parse(atob(JSON.parse(localStorage.getItem('nocodb-gui-v2')).token.split('.')[1])).id

// force the onboarding trigger without a fresh signup
localStorage.setItem('nc-tours-onboarding-handoff', JSON.stringify({ [uid]: true }))

// let everything trigger again (clears every user on this browser)
localStorage.removeItem('nc-tours-auto-fired')
```

- `start(id, 'debug')` bypasses eligibility, to preview a tour you don't qualify for.
- `explain(tour)` says why a tour isn't eligible.
- Avatar menu → **Product Tours** lists eligible tours and replays them (`reset()`
  clears both seen-state and the auto-fired record).
- Tours are hard-disabled under `NODE_ENV=test` so overlays can't intercept
  Playwright clicks, and can be switched off with `NC_DISABLE_TOURS=true`. They
  stay **enabled** in development so you can author them.

---

## Not built yet

- **No CI anchor check.** The generated union guarantees an id *exists* somewhere in the
  codebase, but not that it renders on the page the step runs on, nor that a CE component's
  `ee/` override carries it. A job that drives every tour and asserts its anchors resolve would
  close that gap — both anchor bugs found so far would have been caught by it.
- **The launcher is behind a flag.** The Product Tours menu is gated on the
  `product_tours_menu` beta flag (`isEngineering`, `isEE`), off by default. Consequence: with
  it off, a user who dismisses a tour has **no way to get it back**. Fine while this is
  internal; needs another re-entry point before tours ship broadly.
- **No announcement inbox.** `/nc/feed` is unmaintained and must not be built on, so a tour is
  only discoverable if the user is on the page holding its beacon. There is no "I was away when
  that shipped" surface.
- **Eligibility isn't re-checked mid-tour** — see
  [When predicates are evaluated](#when-predicates-are-evaluated).
- **Tour copy is inline English**, not i18n.
- **Runtime coverage is thin.** `click`, `event`, `goto` and `advanceOnClick` are typechecked but
  not yet exercised in a browser. Two tours exist: `onboarding-workspace-basics` (`auto`) and
  `ee/tours/defs/feature-workflows` (`route` + `trigger.when`).
- **Nothing exercises `trigger: 'beacon'`.** `Beacon.vue` renders and is wired up, but no tour
  currently uses it.
