# Responsive UI Skill

## Context

NocoDB UI is built for desktop. On mobile and tablet screens, layouts break — content overflows, inputs don't stack, modals exceed viewport, text doesn't truncate. The goal is to make every view adapt to the screen size without changing the desktop experience.

**Approach:** Mobile-first CSS. Default styles target mobile, then `sm:` (tablet) and `md:` (desktop) layer overrides. Desktop must remain identical to current design.

---

## Breakpoints

Single source of truth: `lib/constants.ts` (`NC_BREAKPOINTS` + `NC_SCREEN_BREAKPOINTS`), shared by WindiCSS and JS.

| Name | CSS prefix | Width | `activeBreakpoint` |
|---|---|---|---|
| Mobile | default / `xs:` (max) | < 480px | `'xs'` |
| Tablet | `sm:` | 480px – 819px | `'sm'` |
| Desktop | `md:` | 820px – 1023px | `'md'` |
| Large | `lg:` | 1024px+ | `'lg'` |
| XL+ | `xl:` / `2xl:` etc. | 1280px+ | `'xl'`+ |

---

## JS Reactive State

```ts
const { isMobileMode, activeBreakpoint } = useGlobal()
// isMobileMode: true when < 480px
// activeBreakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | ...
```

Body CSS classes (auto-applied by `useConfigStore`): `.mobile` (<480), `.tablet` (480-819), `.desktop` (820+).

**Prefer CSS breakpoints** (`sm:`, `md:`) over `v-if="isMobileMode"`. Use JS only when you need different props, component swaps, or logic that CSS can't express.

---

## WindiCSS

### Responsive classes

Write default for mobile, layer up:

```html
<div class="flex flex-col gap-2 sm:(flex-row gap-3) md:(gap-4)">
  <div class="w-full sm:w-1/2 md:w-1/3">...</div>
</div>
```

Grouped syntax `sm:(class1 class2)` keeps responsive overrides readable.

### Typography (`ncTypographyPlugin`)

Figma-aligned presets. Use instead of raw `text-sm font-medium`:

| Class | Size / Weight |
|---|---|
| `text-heading1` | 64px / 700 |
| `text-heading3` | 24px / 700 |
| `text-subHeading1` | 20px / 700 |
| `text-subHeading2` | 16px / 700 |
| `text-bodyLg` | 16px / 500 |
| `text-body` | 14px / 500 |
| `text-bodyDefaultSm` | 13px / 500 |
| `text-bodySm` | 12px / 500 |
| `text-captionSm` | 12px / 500 |

Responsive example: `class="text-heading3 sm:text-subHeading1 md:text-heading3"`

### Font weights (Inter-adjusted)

| Class | Value | Effective look |
|---|---|---|
| `font-light` | 400 | 400 |
| `font-normal` | 500 | 400 |
| `font-medium` | 600 | 500 |
| `font-semibold` | 550 | 550 |
| `font-bold` | 700 | 600 |

### Viewport-safe utilities (`ncWindicssShortcutsPlugin`)

Always use these instead of raw `h-screen` / `w-screen`:

| Class | Fallback chain |
|---|---|
| `nc-h-screen` | 100svh -> 100dvh -> 100vh |
| `nc-min-h-screen` | min-height: 100svh -> 100dvh -> 100vh |
| `nc-w-screen` | 100svw -> 100dvw -> 100vw |

### Shortcuts

| Class | Effect |
|---|---|
| `color-transition` | `transition-colors duration-100 ease-in` |
| `nc-scrollbar-thin` | Thin scrollbar with gray track |
| `nc-content-max-w` | `max-w-[97.5rem]` |

---

## Color System

### Layer 1: Semantic tokens (always prefer these)

These change with light/dark theme. Support opacity: `text-nc-content-gray/50`.

**Content** (`text-*`):
`text-nc-content-gray` + `-extreme`, `-emphasis`, `-subtle`, `-subtle2`, `-muted`, `-disabled`
`text-nc-content-brand` + `-hover`, `-disabled`
`text-nc-content-red-dark`, `text-nc-content-green-dark`, etc.

**Background** (`bg-*`):
`bg-nc-bg-default`, `bg-nc-bg-brand`, `bg-nc-bg-gray-extralight`, `-light`, `-medium`, `-dark`
`bg-nc-bg-red-light`, `bg-nc-bg-green-light`, etc.

**Border** (`border-*`):
`border-nc-border-gray-light`, `-medium`, `-dark`
`border-nc-border-brand`, `border-nc-border-red`

**Fill** (`bg-*`):
`bg-nc-fill-primary` + `-hover`, `-disabled`
`bg-nc-fill-secondary`, `bg-nc-fill-warning`, `bg-nc-fill-success`

### Layer 2: V4 palette with `nc-` prefix (dark-mode aware)

Raw shades when no semantic token fits: `bg-nc-brand-50`, `text-nc-gray-700`, `border-nc-purple-200`

Palettes: `nc-brand`, `nc-gray`, `nc-red`, `nc-green`, `nc-blue`, `nc-purple`, `nc-pink`, `nc-orange`, `nc-maroon`
Shades: `20`, `50`, `100`-`900`

### Layer 3: V3 static (no `nc-` prefix)

Same in all themes — for enum chips, data viz: `text-brand-500`, `bg-red-50`

### CSS variables (in `<style>` blocks)

```scss
color: var(--nc-content-brand);
background: var(--nc-bg-gray-light);
border: 1px solid var(--nc-border-gray-medium);
```

---

## How to Make a Component Responsive

### Step 1: Identify what breaks

Resize browser to 375px (mobile) and 768px (tablet). Look for:
- Content overflow / horizontal scrollbar
- Inputs side-by-side that should stack
- Fixed widths exceeding viewport
- Buttons/actions too small to tap
- Text not truncating
- Modals exceeding screen

### Step 2: Fix with mobile-first CSS

Apply default styles for mobile, add `sm:` / `md:` for larger screens.

### Common fixes

**Multi-column -> single column on mobile:**
```html
<div class="flex flex-col gap-3 md:(flex-row gap-4)">
  <div class="w-full md:w-1/2">...</div>
  <div class="w-full md:w-1/2">...</div>
</div>
```

**Label above input on mobile, beside on desktop:**
```html
<div class="flex flex-col gap-1 sm:(flex-row items-center gap-3)">
  <label class="sm:w-[120px] sm:shrink-0">Field</label>
  <a-input class="w-full sm:flex-1" />
</div>
```

**Card grid responsive columns:**
```html
<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
  <Card v-for="item in items" :key="item.id" />
</div>
```

**Buttons full-width on mobile:**
```html
<div class="flex flex-col-reverse gap-2 sm:(flex-row justify-end)">
  <NcButton class="w-full sm:w-auto">Cancel</NcButton>
  <NcButton type="primary" class="w-full sm:w-auto">Save</NcButton>
</div>
```

**Padding/spacing reduced on mobile:**
```html
<div class="p-3 sm:p-4 md:p-6">
  <div class="flex flex-col gap-2 sm:gap-3 md:gap-4">...</div>
</div>
```

**Side panels stack on mobile:**
```html
<div class="flex flex-col md:(flex-row h-full)">
  <div class="w-full md:(w-1/2 border-r)">Left</div>
  <div class="w-full md:w-1/2">Right</div>
</div>
```

**Wide content scrolls horizontally:**
```html
<div class="overflow-x-auto nc-scrollbar-thin">
  <div class="min-w-[600px]"><!-- wide content --></div>
</div>
```

**Fixed width respects viewport:**
```html
<!-- Before: breaks on mobile -->
<div class="w-[448px]">...</div>
<!-- After -->
<div class="w-full sm:w-[448px]">...</div>
```

**Touch targets (min 44px on mobile):**
```html
<NcButton class="min-h-11 min-w-11 sm:(min-h-8 min-w-8)">...</NcButton>
```

**Show/hide elements by breakpoint:**
```html
<div class="hidden md:block">Desktop only</div>
<div class="md:hidden">Mobile/tablet only</div>
```

**Text truncation in flex containers:**
```html
<div class="flex items-center gap-2 min-w-0">
  <span class="flex-shrink-0">Label</span>
  <span class="truncate min-w-0">{{ longText }}</span>
</div>
```

---

## Key Gotchas

1. **`truncate` on flex container doesn't work** — put it on the flex child with `min-w-0`
2. **Ant Design overrides at 575px** — at `max-width: 575px`, Ant forces `flex-wrap: wrap` on `.ant-form-item`. Override in `theme-overrides.scss` (BOTH `assets/` and `ee/assets/`)
3. **CSS in `assets/` must mirror in `ee/assets/`** — they are separate files, not inherited
4. **Don't change `NcModal` `size` prop** — modal sizes already have mobile variants. Fix the content inside
5. **Form builder `span: 12` breaks on mobile** — use `span: [24, 12]` (array = `[mobile, tablet, desktop]`, inherits from smaller)
6. **`span: 0` hides the field** — use for fields that should only appear on larger screens: `span: [0, 12]`
7. **`h-screen` ignores mobile browser chrome** — always use `nc-h-screen` (100svh with fallbacks)
8. **`isEeUI` not `!isEEFeatureBlocked`** — to hide in CE, use `v-if="isEeUI"`. Unlicensed EE should show with upgrade badge, not hide

---

## Anti-Patterns

| Don't | Do Instead |
|---|---|
| Only fix container width/padding | Fix content inside too (inputs, labels, buttons) |
| `truncate` on flex container | `truncate` + `min-w-0` on the flex child |
| Fixed width without `max-w-full` | `w-full sm:w-[fixed]` or add `max-w-full` |
| Change `NcModal` `size` prop | Fix content inside modal |
| CSS override only in `assets/` | Mirror in `ee/assets/` too |
| Raw `@media` queries for layout | WindiCSS `sm:`, `md:` prefixes |
| `span: 12` in form builder | `span: [24, 12]` for responsive |
| `overflow-hidden` on scrollable content | `overflow-x-auto` or `overflow-y-auto` |
| Many `v-if="isMobileMode"` | CSS breakpoints for layout; JS only for props/behavior |
| `h-screen` | `nc-h-screen` |
