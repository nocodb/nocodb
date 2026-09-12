---
name: design
description: The craft of building a screen — page shape, layout and spacing, responsive/mobile, the type scale, colour and status tints, surfaces (radius/shadow), icons, the four states, tables and forms, the words in the UI, and the accessibility floors. Read before laying out or restyling any screen.
---

# Design

Aim for the way a well-made internal tool looks: confident hierarchy, generous space, colour that
carries meaning, words that don't waste the reader. "Restrained" is not "flat and grey" — a screen
where everything is the same size and the same neutral reads as unfinished, not tasteful.

**You compose from primitives.** There are no pre-built page shapes: build this app's screens out of
the vendored `ui/*` parts, and give them their look through the theme tokens — never by restyling a
primitive. Writing the same table/tile/form markup twice means extracting a component.

For animation, read the `motion` skill — starting with its first question, whether to animate at all.

---

## 1. The page shape

```tsx
<div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">   {/* decide ONCE, reuse */}
  <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <p className="text-sm text-muted-foreground">Operations</p>        {/* where am I */}
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>  {/* what is this */}
      <p className="mt-1 text-sm text-muted-foreground">                 {/* why care */}
        Track every order and surface shipments delayed more than 3 days.
      </p>
    </div>
    <Button>New order</Button>                                          {/* the ONE primary action */}
  </div>
</div>
```

The vertical rhythm of a screen, in order:

```
page header        title + subtitle + one primary action
summary row        2–4 stat cards — only if there are facts worth knowing before the rows
toolbar            search + the 2–3 filters that matter
the thing itself   table / board / list — the reason the screen exists
```

- **The header earns its space.** Eyebrow + title + one-line subtitle orients in three words each; a
  bare `<h1>` over a table is the top reason a screen looks generated. Skip the subtitle only if it
  would restate the title.
- **Stat cards**: label `text-sm text-muted-foreground`, value `text-2xl font-semibold tabular-nums`,
  a `lucide` icon in `text-muted-foreground`. Never invent a metric the data can't answer.

## 2. Layout and spacing

- **One content column, decided once** — a wrapper component or a layout route rendering `<Outlet/>`.
  Re-deciding `mx-auto max-w-… px-…` per screen is why pages come out at different widths.
  `max-w-6xl` suits a table-heavy tool; if a board needs wider, *every* screen goes wider.
- **Space first, then a `Card`, then a `Separator`** — a line only when space can't carry it.
- **The gap between groups is ≥2× the gap within one**: `gap-2/3` inside, `gap-6/8` between. Equal
  gaps everywhere is what "unstructured" looks like.
- Stay on the 4-based scale (`gap-2/3/4/6/8`, `p-4/6`); `gap-[13px]` reads as generated.
- **Align to shared edges** and hold them — a form whose labels start at three x-positions looks
  broken even when nothing is.
- **Order by importance**: what the user came for sits top and leading-edge. Filters come after the
  thing they filter.
- ~12px between adjacent bordered controls, ~24px around borderless icon buttons.
- **A page file over ~250 lines** gets split: sections become components in `src/components/`
  (`TasksTable.tsx`, `WorkloadCards.tsx`), the page composes them and owns the data fetching. A
  four-figure-line page is a bug.

### Don't re-pad a primitive

Use each primitive through its own parts; stacking your own padding on its built-in rhythm is the top
cause of lopsided gaps. `Card` bites most — it's a flex stack (`flex flex-col gap-6 py-6`), 24px
between children and top/bottom, with its parts adding only horizontal `px-6`:

- Build from `<CardHeader>` / `<CardContent>` / `<CardFooter>`; don't give them `py-*`/`pt-*` and don't
  wrap contents in a padded `<div>` — it doubles the spacing.
- A rule under the header → `border-b` on `<CardHeader>`, not a standalone `<Separator/>` (which
  floats in a 24px band on both sides).
- Full-bleed content (an edge-to-edge table) → opt out deliberately:
  `<Card className="gap-0 py-0">` + `<CardContent className="p-0">`, then set spacing yourself.

### A badge on a card edge gets clipped

The recurring bug: a "Most popular" pill hung over a card's top edge is sliced in half, because the
card (or an ancestor) clips its overflow. Pick one of two shapes and commit to it:

- **Inside the card** (safest): the pill is the first child of `<CardHeader>`, on its own row above
  the plan name. Nothing clips, and the cards in the row stay the same height.
- **Straddling the edge**: the card needs `relative overflow-visible`, its grid needs `pt-4` so the
  pill has room above the cards, and the pill needs `absolute -top-3 left-1/2 -translate-x-1/2`.
  `left-1/2` on its own centres the pill's left edge, not the pill.

Same rule for any decoration that leaves its box: an avatar over a cover image, a count bubble on a
tab, a "New" flag on a tile.

### Scroll the right box

The page scrolls vertically; nothing else does unless it owns its axis.

- A wide table scrolls inside an `overflow-x-auto` wrapper — the **page** never scrolls sideways.
- A kanban column scrolls inside itself (`overflow-y-auto` + a max height) and the board scrolls
  horizontally; page height must not grow with the longest column.
- If something scrolls or collapses, show it: let the next item peek past the edge, or show the
  disclosure. Content hidden with no cue may as well not exist.

### Responsive — from the start

**If a page has fewer `sm:`/`md:`/`lg:` prefixes than it has sections, it isn't responsive.** Hold the
desktop layout until it stops fitting, then collapse:

| Piece | Mobile |
|---|---|
| Any grid / stat cards | `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` — one-up first |
| Header row | `flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between` |
| Toolbar | Wraps; search full-width, filters below |
| Wide table | `overflow-x-auto`, **plus** a stacked card list under `sm` when the table *is* the screen (`hidden sm:block` on the table, `sm:hidden` on the cards) |
| Kanban | Horizontal scroll, columns at a fixed min-width — never three columns squashed into 320px |
| Sidebar / header nav | Collapses into a `Sheet` behind a menu button under `md`; current page stays identifiable |
| Long form dialog | `Sheet` from the bottom |

`useIsMobile()` from `@/hooks/use-mobile` only when the *structure* differs (table vs cards); styling
is breakpoints. Never fix a height on anything containing text. **Check 320, 768, 1280** before
calling it done.

## 3. Type

| Role | Class | Line-height | Weight |
|---|---|---|---|
| Page title | `text-2xl` | 1.2 | 600 |
| Section heading | `text-lg` | 1.3 | 600 |
| Sub-heading | `text-base` | 1.4 | 600 |
| Body | `text-sm` | 1.5 | 400 |
| Caption / meta / table header | `text-xs text-muted-foreground` | 1.4 | 400 |

Inter is already the `font-sans` token — never load another typeface or set `font-family`.

- `text-sm` is the body size for a tool. `text-base` only for prose read in paragraphs.
- **A child heading never outweighs its parent**; a heading is never smaller than body text (except
  the eyebrow). Skip the marketing headline — no `text-4xl` anywhere.
- Below 18px stay at weight 400+. `font-semibold` for headings and the one number that matters;
  never bold a whole row to make it stand out.
- **`tabular-nums` on every number that changes or lines up** — currency, counts, durations, dates in
  a column. Right-align numeric columns, left-align text; never centre either.
- Format once in a helper (`Intl.NumberFormat`, `date-fns`). Two date formats on one screen is a bug.
- **Cap prose at 60–75 characters** (`max-w-prose` / `max-w-2xl`). `text-balance` on a two-line
  heading, `text-pretty` on a description, `break-words` where user data could escape,
  `whitespace-nowrap` on badges.
- **Truncate only when the value stays reachable** (tooltip or detail route); `truncate` needs a
  `min-w-0` parent inside flex. `line-clamp-2` for multi-line.
- Sentence case, consistently. Never type `UPPERCASE` — use `uppercase tracking-wide`. Real
  punctuation: `–` ranges, `—` asides, `…` one character.
- Nothing below `text-xs`. Muted text on a tinted row or coloured badge often fails contrast — check
  it. Body needs ≈APCA Lc 75 (WCAG 4.5:1), labels Lc 60.

## 4. Colour

- **Style through the tokens.** No `border-2`, `border-black`, `rounded-3xl` on a primitive, no
  hard-coded hex. Want a different look? Change the tokens in `index.css`.
- **`primary` is scarce** — the one main action per screen and active states. Everything structural is
  `foreground` / `muted-foreground` / `border` / `secondary`.
- **Status colour is required, not decoration.** A status column in flat grey destroys the scan. One
  meaning per colour: `delivered/paid/active` green, `pending/queued` amber, `failed/overdue/blocked`
  red, `draft/archived` neutral. Soft tint (`bg-green-100 text-green-700 dark:bg-green-950/50
  dark:text-green-400`) or a `Badge`; saturated fills only for the state that demands attention.
- **Never colour alone** — pair it with the label, add an icon when the state means "act on this".
- **Let the row carry the signal**: tint the rows that need attention
  (`bg-red-50/50 dark:bg-red-950/20`), don't rely on a pill in the last column.
- Charts take `var(--chart-1)`…`var(--chart-5)` only.

## 5. Surfaces and icons

- **Concentric radius**: outer radius = inner radius + the padding between. `rounded-2xl p-2` outside
  → `rounded-lg` inside. Equal radii on closely nested boxes is the most common thing that makes an
  interface feel subtly off. Past ~24px padding, treat them as separate surfaces.
- **Shadows for elevation, borders for structure.** A card in the page has a border; a thing floating
  above it (popover, dialog, dragged card) has a shadow. Never a border to fake depth.
- All radii derive from one `--radius` token — change that to rescale the app.
- **Optical over geometric alignment**: an icon beside text, a play triangle, any asymmetric glyph gets
  nudged until it *looks* centred.
- Icons: `lucide-react` only, one stroke weight per surface (1.5px beside regular text, 2px beside
  semibold), colour from `currentColor`. Icon-only button needs `aria-label`; decorative icon gets
  `aria-hidden="true"`.

## 6. States — all four, every time

- **Loading = skeletons, never spinners.** Mirror the final layout: skeleton rows for a table,
  skeleton blocks for cards. (`Spinner` belongs inside a button mid-submit.)
- **Empty states point forward** — the `Empty` primitive: what belongs here, one line on why it's
  useful, the primary action. Never a bare "No data".
- **Filtered-to-nothing is its own state**: name the query, offer the exit ("No orders match
  'delayed'. Clear filters").
- **Errors say what to do next**, beside the thing that failed.

## 7. Controls, tables, forms

- **Interactive things must look interactive** — a background, a border, or a consistent placement
  zone. Never style a control exactly like adjacent static text.
- **Tables**: the vendored `Table` parts cover most lists; `@tanstack/react-table` only when you need
  sorting + filtering + pagination together. Header `text-xs` muted, numerics right-aligned with
  `tabular-nums`, rows navigate to the detail route.
  For a clickable row, keep the row's own click free of "is this interactive?" guards — a row marked
  `role="button"` matches such a guard *itself* and silently kills every click. Stop propagation on
  the controls inside instead, and give mouse and keyboard one handler.
- **Forms**: `react-hook-form` + a `zod` resolver composed with the `Field` primitives — `<Field>`
  wrapping `<FieldLabel htmlFor>`, the control, `<FieldDescription>`,
  `<FieldError errors={[errors.x]} />`. Use `Input`/`Textarea`/`Select`/`Checkbox`/`Switch`; **never
  raw `<input>`/`<select>`/`<textarea>`/`<label>`**, and **never `<input type="date">`** (use
  `Calendar` in a `Popover`). Visible label always; placeholder shows format only. Keep submit enabled
  until pressed, then show the in-flight state on the button. Short form → `Dialog`; long → `Sheet`
  or its own route.

## 8. The words

Plain, specific, short, second person, no exclamation marks.

- **Buttons are verb + object**: `New order`, `Save changes`, `Delete project`. Never `OK`, `Submit`,
  `Yes`/`No`. A confirmation repeats the verb: "Delete this project?" → `Delete project` / `Cancel`.
- **Titles are the noun the user came for**: `Orders`, `Team workload` — not "Order Management
  Dashboard". Table headers are short nouns. A field label says what the value *is* (`Due date`).
- **Toggles are labelled for the ON state** (`Email me on assignment`), never the negative.
- **Errors are instructions**: "Couldn't save the task. Check your connection and try again." Never
  "Something went wrong", never "oops", never a raw platform message or code.
- **Toasts**: one line, past tense — `Task assigned to Priya`. Anything with an action or an error
  stays until dismissed.
- Pluralise properly (`1 task` / `2 tasks`, never `task(s)`). Absent value is `—`, not `0`. Say the
  unit (`$12,450`, `4 days late`).
- **Never leak the machinery**: bundle, build, deploy, sandbox, action, routine, API, endpoint,
  schema, migration, token. The user has a project tracker, not a system. Drop filler like *simply,
  just, please note*.
- **No em dashes in a sentence.** They are the clearest tell that copy was generated. Use a full
  stop or a comma. Never label a thing with a dash either (`Waitlist - count`): name it (`Count
  waitlist rows`). A lone dash as an empty-value placeholder is fine.
- **Avoid the generated-copy register**: *seamlessly, effortless, powerful, unlock, leverage,
  elevate, at your fingertips*, three adjectives in a row, and a rhetorical question as a heading.

## 9. Accessibility floors

Ships with the screen, not as a later pass.

- Everything reachable by mouse is reachable by `Tab`; **never remove a focus ring** — the primitives
  ship `:focus-visible`, leave it. If you must customise, keep a 2px indicator with
  `outline-offset: 2px`. `Escape` closes overlays.
- **Hit targets**: 24×24px hard floor, ~40px comfortable on desktop, 44px on touch. Expand a small
  control with padding or a pseudo-element rather than shrinking the clickable area; never let
  expanded targets overlap.
- Every input has a real `<label htmlFor>`; label and control share one hit target. Add
  `autocomplete` and the right `type`/`inputmode`. Never block paste.
- On a failed field: `aria-invalid="true"` plus `aria-describedby` pointing at the inline error, and
  focus the first invalid field on submit.
- Announce what isn't tied to a control: `role="status"` for a toast or result count, `role="alert"`
  only for urgent errors. Keep a stable empty region and change its text rather than inserting one.
- Headings describe their sections and nest properly; one `<h1>` per page.
- Works at 200% zoom and reflows at 320px with no horizontal page scroll.
- Never rely on colour alone; every animated state change has a static cue too.
