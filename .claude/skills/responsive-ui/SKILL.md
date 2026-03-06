# Responsive UI Skill

Guidelines for making NocoDB UI responsive. Follow these conventions for all responsive work.

## Breakpoints

All breakpoints are defined once in `lib/constants.ts` (`NC_BREAKPOINTS` + `NC_SCREEN_BREAKPOINTS`) and shared by both WindiCSS and JS.

| Name              | CSS prefix                        | Width                                             | `activeBreakpoint` | JS shorthand                |
| ----------------- | --------------------------------- | ------------------------------------------------- | ------------------ | --------------------------- |
| **Mobile**        | `xs:` (max) / default             | `< 480px`                                         | `'xs'`             | `isMobileMode`              |
| **Tablet**        | `sm:` (min 480px)                 | `480px – 819px`                                   | `'sm'`             | `activeBreakpoint === 'sm'` |
| **Desktop**       | `md:` (min 820px)                 | `820px – 1023px`                                  | `'md'`             | —                           |
| **Large Desktop** | `lg:` (min 1024px)                | `1024px – 1279px`                                 | `'lg'`             | —                           |
| **XL**            | `xl:` (min 1280px)                | `1280px – 1779px`                                 | `'xl'`             | —                           |
| **2XL+**          | `2xl:` / `3xl:` / `4xl:` / `5xl:` | `≥ 1780px` / `≥ 1920px` / `≥ 2560px` / `≥ 3200px` | `'2xl'` – `'5xl'`  | —                           |

### Mobile-first approach

Write **default styles for mobile**, then layer tablet and desktop overrides:

```html
<!-- Default = mobile, sm: = tablet, md: = desktop -->
<div class="flex flex-col gap-2 sm:(flex-row gap-3) md:(gap-4)">
  <div class="w-full sm:(w-1/2) md:(w-1/3)">...</div>
</div>
```

WindiCSS grouped syntax `sm:(class1 class2)` keeps responsive overrides readable.

### Constants (`lib/constants.ts`)

Single source of truth for all breakpoint values, shared by WindiCSS config and JS:

```ts
// Min-width breakpoints (used by useBreakpoints + WindiCSS screens)
export const NC_BREAKPOINTS = {
  sm: 480,
  md: 820,
  lg: 1024,
  xl: 1280,
  "2xl": 1780,
  "3xl": 1920,
  "4xl": 2560,
  "5xl": 3200,
} as const;

// Type for activeBreakpoint — includes 'xs' (below smallest min-width)
export type NcBreakpoint = "xs" | keyof typeof NC_BREAKPOINTS;

// WindiCSS screen definitions (generated from NC_BREAKPOINTS)
export const NC_SCREEN_BREAKPOINTS = {
  xs: { max: "480px" },
  sm: { min: "480px" },
  md: { min: "820px" },
  // ... etc
};
```

## JS Reactive State

### From `useGlobal()` — source of truth

```ts
const { isMobileMode, activeBreakpoint } = useGlobal();
// isMobileMode: boolean — true when viewport < 480px
// activeBreakpoint: NcBreakpoint — 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
```

### From `useConfigStore` (Pinia store) — detects changes

```ts
const configStore = useConfigStore();
const { isMobileMode, activeBreakpoint } = storeToRefs(configStore);
```

### Compact view pattern (mobile + tablet)

```ts
const { activeBreakpoint } = useGlobal();
const isCompactView = computed(
  () => activeBreakpoint.value === "xs" || activeBreakpoint.value === "sm"
);
```

### State flow

```
useConfigStore()     — uses VueUse useBreakpoints(NC_BREAKPOINTS), syncs to useGlobal
  ├── isMobileMode       — breakpoints.smaller('sm') → true when < 480px
  └── activeBreakpoint   — computed from breakpoints.active() → 'xs'|'sm'|'md'|...

useGlobal()          — receives values from useConfigStore, exposes globally
  ├── isMobileMode       — boolean ref, set by configStore watcher
  └── activeBreakpoint   — NcBreakpoint ref, set by configStore watcher
```

### Body CSS classes (set by `useConfigStore`)

| Viewport        | Body class |
| --------------- | ---------- |
| `< 480px`       | `.mobile`  |
| `480px – 819px` | `.tablet`  |
| `≥ 820px`       | `.desktop` |

Use these for global CSS rules when WindiCSS classes aren't sufficient:

```scss
:global(.mobile) & {
  // mobile-only styles
}
:global(.tablet) & {
  // tablet-only styles
}
```

## WindiCSS Configuration Reference

> **Source:** `windi.config.ts` — imports from `utils/colorsUtils.ts` and custom plugins.

### Screens (breakpoints)

Imported from `NC_SCREEN_BREAKPOINTS` in `lib/constants.ts` (single source of truth):

```ts
'xs':  { max: '480px' },    // mobile-only (max-width)
'sm':  { min: '480px' },    // tablet and up
'md':  { min: '820px' },    // desktop and up
'lg':  { min: '1024px' },   // large desktop
'xl':  { min: '1280px' },   // extra large
'2xl': { min: '1780px' },   // ultra wide
'3xl': { min: '1920px' },
'4xl': { min: '2560px' },
'5xl': { min: '3200px' },
```

### Font sizes (custom)

```ts
tiny: ["11px", "14px"];
small: ["13px", "16px"];
small1: ["13px", "18px"];
```

Usage: `text-tiny`, `text-small`, `text-small1`

### Font weights (adjusted for Inter font)

Inter renders weights heavier than standard, so values are shifted:

| Class                          | Value | Effective |
| ------------------------------ | ----- | --------- |
| `font-thin`                    | 200   | 200       |
| `font-light`                   | 400   | 400       |
| `font-normal` / `font-default` | 500   | 400       |
| `font-medium`                  | 600   | 500       |
| `font-semibold`                | 550   | 550       |
| `font-bold`                    | 700   | 600       |
| `font-black`                   | 800   | 700       |

### Shortcuts (global)

```
color-transition     → transition-colors duration-100 ease-in
nc-scrollbar-thin    → thin scrollbar with gray track
nc-content-max-w     → max-w-[97.5rem]
```

### Dark mode

`darkMode: 'class'` — toggle with `.dark` on root element. Use `dark:` prefix:

```html
<div class="bg-white dark:bg-gray-900">...</div>
```

---

## Internal Plugins

### `ncTypographyPlugin` (`assets/nc-typography-plugin.ts`)

Figma-aligned text presets. Use **instead of** raw `text-sm font-medium` combos. All support responsive variants.

| Class                    | Size | Line-height | Weight |
| ------------------------ | ---- | ----------- | ------ |
| `text-heading1`          | 64px | 92px        | 700    |
| `text-heading2`          | 40px | 64px        | 700    |
| `text-heading3`          | 24px | 36px        | 700    |
| `text-subHeading1`       | 20px | 32px        | 700    |
| `text-subHeading2`       | 16px | 24px        | 700    |
| `text-bodyLg`            | 16px | 28px        | 500    |
| `text-bodyLgBold`        | 16px | 28px        | 700    |
| `text-body`              | 14px | 24px        | 500    |
| `text-bodyBold`          | 14px | 24px        | 700    |
| `text-bodyDefaultSm`     | 13px | 18px        | 500    |
| `text-bodyDefaultSmBold` | 13px | 18px        | 700    |
| `text-bodySm`            | 12px | 18px        | 500    |
| `text-bodySmBold`        | 12px | 18px        | 700    |
| `text-caption`           | 14px | 20px        | 500    |
| `text-captionSm`         | 12px | 14px        | 500    |
| `text-captionXs`         | 10px | 14px        | 500    |
| `text-sidebarDefault`    | 14px | 20px        | 550    |

Responsive example:

```html
<h1 class="text-heading3 sm:text-heading2 md:text-heading1">Title</h1>
```

### `ncWindicssShortcutsPlugin` (`assets/nc-windicss-shortcuts-plugin.ts`)

Viewport-safe screen utilities that handle mobile browser chrome (address bar, bottom nav):

| Class             | Fallback chain                            |
| ----------------- | ----------------------------------------- |
| `nc-h-screen`     | `100svh` → `100dvh` → `100vh`             |
| `nc-min-h-screen` | `min-height: 100svh` → `100dvh` → `100vh` |
| `nc-w-screen`     | `100svw` → `100dvw` → `100vw`             |
| `nc-min-w-screen` | `min-width: 100svw` → `100dvw` → `100vw`  |

**Always use `nc-h-screen` instead of `h-screen`** in layouts and full-height containers.

---

## Color System

> **Source:** `utils/colorsUtils.ts` — defines all color layers. See also `assets/css/variables.css` for CSS custom properties.

### Layer 1: `themeVariables` — Semantic tokens (prefer these)

These map to CSS variables that **change with light/dark theme**. They are the design system's core tokens.

Registered via `ncBuildColorsWithOpacity()` which enables opacity modifiers (e.g., `text-nc-content-gray/50`).

#### Content colors (`text-*`)

| Class                                | Variants                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `text-nc-content-gray`               | `-extreme`, `-emphasis`, (default), `-subtle`, `-subtle2`, `-muted`, `-disabled` |
| `text-nc-content-brand`              | (default), `-disabled`, `-hover`                                                 |
| `text-nc-content-inverted-primary`   | (default), `-hover`, `-disabled`                                                 |
| `text-nc-content-inverted-secondary` | (default), `-hover`, `-disabled`                                                 |
| `text-nc-content-red`                | `-dark`, `-medium`, `-light`                                                     |
| `text-nc-content-green`              | `-dark`, `-medium`, `-light`                                                     |
| `text-nc-content-yellow`             | `-dark`, `-medium`, `-light`                                                     |
| `text-nc-content-blue`               | `-dark`, `-medium`, `-light`                                                     |
| `text-nc-content-purple`             | `-dark`, `-medium`, `-light`                                                     |
| `text-nc-content-pink`               | `-dark`, `-medium`, `-light`                                                     |
| `text-nc-content-orange`             | `-dark`, `-medium`, `-light`                                                     |
| `text-nc-content-maroon`             | `-dark`, `-medium`, `-light`                                                     |

#### Background colors (`bg-*`)

| Class              | Variants                                                                              |
| ------------------ | ------------------------------------------------------------------------------------- |
| `bg-nc-bg-default` | (white)                                                                               |
| `bg-nc-bg-brand`   | (default), `-inverted`                                                                |
| `bg-nc-bg-gray`    | `-extralight`, `-sidebar`, `-minisidebar`, `-light`, `-medium`, `-dark`, `-extradark` |
| `bg-nc-bg-red`     | `-light`, `-dark`                                                                     |
| `bg-nc-bg-green`   | `-light`, `-dark`                                                                     |
| `bg-nc-bg-yellow`  | `-light`, `-dark`                                                                     |
| `bg-nc-bg-blue`    | `-light`, `-dark`                                                                     |
| `bg-nc-bg-purple`  | `-light`, `-dark`                                                                     |
| `bg-nc-bg-pink`    | `-light`, `-dark`                                                                     |
| `bg-nc-bg-orange`  | `-light`, `-dark`                                                                     |
| `bg-nc-bg-maroon`  | `-light`, `-dark`                                                                     |

#### Border colors (`border-*`)

| Class                     | Variants                                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| `border-nc-border-brand`  | (default), `-medium`                                                    |
| `border-nc-border-gray`   | `-extralight`, `-light`, `-medium`, `-dark`, `-extradark`, `-underline` |
| `border-nc-border-red`    | (default)                                                               |
| `border-nc-border-green`  | (default)                                                               |
| `border-nc-border-purple` | (default), `-medium`, `-light`                                          |

#### Fill colors (`bg-*`, `fill-*`, `text-*`)

| Class                  | Variants                                       |
| ---------------------- | ---------------------------------------------- |
| `bg-nc-fill-primary`   | (default), `-hover`, `-disabled`, `-disabled2` |
| `bg-nc-fill-secondary` | (default), `-hover`, `-disabled`               |
| `bg-nc-fill-warning`   | (default), `-hover`, `-disabled`               |
| `bg-nc-fill-success`   | (default), `-hover`, `-disabled`               |
| `bg-nc-fill-red`       | `-dark`, `-medium`, `-light`                   |
| `bg-nc-fill-green`     | `-dark`, `-medium`, `-light`                   |

### Layer 2: `themeV4Colors` with `nc-` prefix — Raw palette shades

V4 palette registered with `nc-` prefix to avoid conflicts with V3 colors. Adapts to dark mode via CSS variables.

Use when no semantic token fits:

```html
<div class="bg-nc-brand-50 text-nc-gray-700 border-nc-purple-200">...</div>
```

Available palettes: `nc-base`, `nc-brand`, `nc-gray`, `nc-red`, `nc-green`, `nc-yellow`, `nc-blue`, `nc-purple`, `nc-pink`, `nc-orange`, `nc-maroon`

Each has shades: `20`, `50`, `100`–`900` (plus `inverted` on some).

### Layer 3: `themeV3Colors` — Static colors (no `nc-` prefix)

Hardcoded hex values — **same in all themes** (no dark mode adaptation). Use for enum chips, data viz, or when you need a fixed color.

```html
<span class="text-brand-500 bg-red-50">...</span>
```

### CSS Variables (`assets/css/variables.css`)

The actual CSS custom property values live in `assets/css/variables.css` (~1037 lines). This is what powers the color system at runtime.

**Structure:**

```
:root {
  /* Spacing tokens */
  --spacing-00: 0px  →  --spacing-13: 160px

  /* Font sizes */
  --font-size-h1: 64px, --font-size-h2: 40px, --font-size-h3: 24px

  /* Reference tokens (raw palette) — used by semantic tokens */
  --color-brand-50: #f0f3ff     --rgb-color-brand-50: 240, 243, 255
  --color-gray-100: #f4f4f5     --rgb-color-gray-100: 244, 244, 245
  /* ... palettes: brand, gray, green, red, maroon, pink, orange, yellow, blue, purple */

  /* Semantic tokens — content */
  --nc-content-gray-extreme: var(--color-base-black)
  --nc-content-gray-emphasis: var(--color-gray-900)
  --nc-content-gray: var(--color-gray-800)
  --nc-content-gray-subtle: var(--color-gray-700)
  --nc-content-gray-subtle2: var(--color-gray-600)
  --nc-content-gray-muted: var(--color-gray-500)
  --nc-content-gray-disabled: var(--color-gray-400)
  --nc-content-brand: var(--color-brand-500)

  /* Semantic tokens — background */
  --nc-bg-default: var(--color-base-white)
  --nc-bg-brand: var(--color-brand-50)
  --nc-bg-gray-extralight: var(--color-gray-50)
  --nc-bg-gray-light: var(--color-gray-100)
  --nc-bg-gray-medium: var(--color-gray-200)
  --nc-bg-gray-dark: var(--color-gray-300)

  /* Semantic tokens — fill */
  --nc-fill-primary: var(--color-brand-500)
  --nc-fill-primary-hover: var(--color-brand-600)
  --nc-fill-warning: var(--color-red-500)
  --nc-fill-success: var(--color-green-500)

  /* Semantic tokens — border */
  --nc-border-brand: var(--color-brand-500)
  --nc-border-gray-light: var(--color-gray-100)
  --nc-border-gray-medium: var(--color-gray-200)
  --nc-border-gray-dark: var(--color-gray-300)
}
```

The `--rgb-color-*` variants enable opacity support via `ncBuildColorsWithOpacity()` — this is why `text-nc-content-gray/50` (50% opacity) works.

**Use CSS variables directly in `<style>` blocks** when WindiCSS classes aren't expressive enough:

```scss
.my-component {
  color: var(--nc-content-brand);
  background: var(--nc-bg-gray-light);
  border: 1px solid var(--nc-border-gray-medium);
}
```

### Which color to use?

1. **Semantic token exists?** → use `themeVariables` class (`text-nc-content-*`, `bg-nc-bg-*`, `border-nc-border-*`, `bg-nc-fill-*`)
2. **Need a raw shade that adapts to dark mode?** → use `nc-` prefixed V4 color (`bg-nc-brand-100`, `text-nc-gray-700`)
3. **Must be same in all themes** (enum chips, data viz) → use V3 color without prefix (`text-brand-500`)
4. **Complex style in `<style>`?** → use CSS variables from `variables.css` (`var(--nc-content-brand)`, `var(--nc-bg-gray-light)`)

---

## Prefer WindiCSS Over Pure CSS

**Always prefer WindiCSS utility classes** over writing raw CSS in `<style>` blocks for responsive work.

### Do

```html
<!-- WindiCSS responsive utilities — clean, scannable, consistent -->
<div class="p-2 sm:p-3 md:p-4 text-bodySm sm:text-body">
  <NcButton class="w-full sm:w-auto" size="small">Save</NcButton>
</div>
```

### Don't

```scss
/* Avoid: raw media queries for things WindiCSS handles */
.my-component {
  padding: 8px;
  @media (min-width: 480px) {
    padding: 12px;
  }
  @media (min-width: 820px) {
    padding: 16px;
  }
}
```

### When raw CSS is acceptable

- Complex selectors that WindiCSS can't express (`:deep(.ant-*)` overrides, pseudo-elements)
- Animation keyframes
- CSS variables / custom properties
- Styles that depend on body class (`.mobile`, `.tablet`, `.desktop`)

## Responsive Patterns

### Sidebar behavior

| Viewport | Sidebar                          |
| -------- | -------------------------------- |
| Mobile   | Full-screen overlay (0% or 100%) |
| Tablet   | Auto-collapsed, overlay on open  |
| Desktop  | Resizable splitpane (15–60%)     |

### Toolbar

- Desktop: full labels + icons
- Tablet/Mobile (`< 768px`): icon-only mode (`isToolbarIconMode`)

### Modals / Dialogs

- `NcModal` sizes are already responsive — **do NOT change modal `size` prop**
- Fix the **content inside** modals to flow properly on small screens (stacking, padding, overflow)

### Touch targets

Minimum 44px height/width for interactive elements on mobile:

```html
<NcButton class="min-h-11 min-w-11 sm:(min-h-8 min-w-8)">...</NcButton>
```

---

## Content-Level Responsive Guidelines

> **Critical:** Making a component responsive is NOT just about max-width/min-width on the outer container. The **content inside** must reflow: inputs stack, labels reposition, grids collapse, overflow scrolls. Desktop layout must remain unchanged.

### Rule: Desktop stays as-is

All responsive changes should only affect mobile (`< 480px`) and tablet (`480–819px`). Desktop (`≥ 820px`) must look identical to the current design. Use `sm:` and `md:` to layer the desktop styles back on top of mobile defaults.

### 1. Multi-column form inputs → Single column on mobile

Desktop commonly has 2-column or side-by-side input layouts. On mobile, these must stack vertically with labels above.

**Pattern: `flex-row` → `flex-col` stacking**

```html
<!-- BEFORE (desktop-only 2-column layout) -->
<div class="flex flex-row gap-4">
  <div class="w-1/2"><label>Name</label><input /></div>
  <div class="w-1/2"><label>Email</label><input /></div>
</div>

<!-- AFTER (mobile-first: stack by default, row on desktop) -->
<div class="flex flex-col gap-3 md:(flex-row gap-4)">
  <div class="w-full md:w-1/2"><label>Name</label><input /></div>
  <div class="w-full md:w-1/2"><label>Email</label><input /></div>
</div>
```

**Pattern: Label-input side-by-side → label above**

```html
<!-- BEFORE (label on left, input on right) -->
<div class="flex items-center gap-3">
  <label class="w-[120px] shrink-0">Field name</label>
  <a-input class="flex-1" />
</div>

<!-- AFTER (stacked on mobile, side-by-side on tablet+) -->
<div class="flex flex-col gap-1 sm:(flex-row items-center gap-3)">
  <label class="sm:w-[120px] sm:shrink-0">Field name</label>
  <a-input class="w-full sm:flex-1" />
</div>
```

### 2. Grid layouts → Fewer columns on mobile

```html
<!-- Card grid: 1 col mobile, 2 col tablet, 3 col desktop -->
<div
  class="grid grid-cols-1 gap-3 sm:(grid-cols-2 gap-4) md:(grid-cols-3 gap-6)"
>
  <Card v-for="item in items" :key="item.id" />
</div>
```

### 3. Overflow and scrollability

When content exceeds the viewport width on mobile:

**Pattern: Horizontal scroll container**

```html
<!-- Wrap wide content (tables, tab bars) in a horizontal scroller -->
<div class="overflow-x-auto -mx-4 px-4">
  <div class="min-w-[600px]">
    <!-- Wide content that won't shrink below 600px -->
  </div>
</div>
```

**Pattern: Vertical scroll in fixed-height containers**

```html
<!-- Modal body / panel with scrollable content -->
<div class="flex-1 overflow-y-auto nc-scrollbar-thin">
  <!-- Content -->
</div>
```

**Rules:**

- Never let content overflow hidden — always add `overflow-x-auto` or `overflow-y-auto`
- For horizontal scrollable areas, add `-mx-4 px-4` to extend scroll edge-to-edge while keeping content padded
- Tables and wide forms should get `overflow-x-auto` wrapper on mobile
- Fixed min-width elements (e.g., `min-w-[540px]`) must be inside a scroll container on mobile: `<div class="overflow-x-auto"><div class="min-w-[540px]">...</div></div>`

### 4. Padding and spacing

Reduce padding and gaps on mobile — content needs more room:

```html
<!-- Smaller padding on mobile, normal on desktop -->
<div class="p-3 sm:p-4 md:p-6">
  <div class="flex flex-col gap-2 sm:gap-3 md:gap-4">...</div>
</div>
```

**Common patterns:**

- Modal content: `px-4 py-3 sm:(px-6 py-4) md:(px-8 py-6)`
- Section gaps: `gap-2 sm:gap-3 md:gap-4`
- Card padding: `p-3 sm:p-4`

### 5. Fixed-width elements

Never use fixed widths that exceed mobile viewport. Always add `max-w-full`:

```html
<!-- BEFORE: breaks on mobile -->
<div class="w-[448px]">...</div>

<!-- AFTER: respects viewport -->
<div class="w-full sm:w-[448px]">...</div>
<!-- or -->
<div class="w-[448px] max-w-full">...</div>
```

For `a-modal` with `:width` prop, also add max-width style:

```html
<a-modal width="600px" :style="{ maxWidth: '95vw' }"></a-modal>
```

### 6. Button layouts

```html
<!-- BEFORE: buttons side by side -->
<div class="flex items-center justify-end gap-2">
  <NcButton type="secondary">Cancel</NcButton>
  <NcButton type="primary">Save</NcButton>
</div>

<!-- AFTER: full-width stacked on mobile, side-by-side on tablet+ -->
<div class="flex flex-col-reverse gap-2 sm:(flex-row items-center justify-end)">
  <NcButton type="secondary" class="w-full sm:w-auto">Cancel</NcButton>
  <NcButton type="primary" class="w-full sm:w-auto">Save</NcButton>
</div>
```

Use `flex-col-reverse` so the primary action is visually first on mobile.

### 7. Header / toolbar layouts

```html
<!-- BEFORE: everything in one row -->
<div class="flex items-center justify-between gap-3">
  <h2>Title</h2>
  <div class="flex gap-2">
    <SearchInput />
    <NcButton>Add</NcButton>
  </div>
</div>

<!-- AFTER: wraps on mobile -->
<div
  class="flex flex-col gap-2 sm:(flex-row items-center justify-between gap-3)"
>
  <h2>text-heading3 sm:text-subHeading1">Title</h2>
  <div class="flex gap-2 w-full sm:w-auto">
    <SearchInput class="flex-1 sm:flex-none sm:w-[200px]" />
    <NcButton>Add</NcButton>
  </div>
</div>
```

### 8. Side-by-side panels → Stacked

```html
<!-- BEFORE: Two panels side by side -->
<div class="flex h-full">
  <div class="w-1/2 border-r">Left panel</div>
  <div class="w-1/2">Right panel</div>
</div>

<!-- AFTER: Stacked on mobile, side-by-side on desktop -->
<div class="flex flex-col md:(flex-row h-full)">
  <div class="w-full md:(w-1/2 border-r)">Left panel</div>
  <div class="w-full md:w-1/2">Right panel</div>
</div>
```

For settings pages with sidebar + content:

```html
<div class="flex flex-col md:flex-row nc-h-screen">
  <nav
    class="w-full md:w-[240px] md:shrink-0 border-b md:(border-b-0 border-r)"
  >
    <!-- Navigation -->
  </nav>
  <main class="flex-1 overflow-y-auto nc-scrollbar-thin">
    <!-- Content -->
  </main>
</div>
```

### 9. Text truncation and wrapping

Long text that truncates on desktop may need to wrap on mobile:

```html
<!-- Truncate on desktop, wrap on mobile -->
<span class="break-words sm:truncate">{{ longText }}</span>

<!-- Or allow multi-line with line clamp -->
<span class="line-clamp-2 sm:line-clamp-1">{{ longText }}</span>
```

### 10. Tables on mobile

Wide data tables should scroll horizontally, not squeeze columns:

```html
<div class="overflow-x-auto nc-scrollbar-thin">
  <table class="min-w-[600px] w-full">
    <!-- Table content -->
  </table>
</div>
```

Alternative: hide less important columns on mobile using `hidden sm:table-cell`:

```html
<th class="hidden sm:table-cell">Created At</th>
<td class="hidden sm:table-cell">{{ row.created_at }}</td>
```

### 11. Images and media

```html
<!-- Responsive image that doesn't overflow -->
<img class="w-full max-w-full h-auto object-cover sm:w-[200px] sm:h-[200px]" />
```

### 12. `NcModal` supported docs sidebar

Modals with `NcModalSupportedDocsSidebar` should hide the sidebar on mobile:

```html
<div class="flex flex-col md:flex-row h-full">
  <div class="flex-1 overflow-y-auto">
    <!-- Main content -->
  </div>
  <!-- Hide docs sidebar on mobile/tablet -->
  <NcModalSupportedDocsSidebar class="hidden md:block">
    <NcModalSupportedDocs :docs="supportedDocs" />
  </NcModalSupportedDocsSidebar>
</div>
```

### 13. Using JS reactive state for layout differences

For drastically different mobile vs desktop layouts that CSS alone can't handle:

```vue
<script setup lang="ts">
const { isMobileMode, activeBreakpoint } = useGlobal();

// Compact view = mobile + tablet
const isCompactView = computed(
  () => activeBreakpoint.value === "xs" || activeBreakpoint.value === "sm"
);
</script>

<template>
  <!-- Different component size prop -->
  <NcButton :size="isMobileMode ? 'medium' : 'small'">Save</NcButton>

  <!-- Different column count -->
  <NcList :columns="isMobileMode ? 1 : 2" />

  <!-- Show/hide sections -->
  <DetailsSidebar v-if="!isMobileMode" />

  <!-- Breakpoint-specific logic (e.g., compact view for mobile + tablet) -->
  <MobileSearch v-if="isCompactView" />
  <DesktopSearch v-else />
</template>
```

**Prefer CSS breakpoints** (`sm:`, `md:`) over `v-if="isMobileMode"` when possible — CSS is more performant and doesn't cause re-renders.

Use `activeBreakpoint` when you need finer control than just mobile/desktop (e.g., tablet-specific behavior).

### 14. Common anti-patterns to avoid

| Don't                                       | Do Instead                                                        |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Only change container `max-w` / `min-w`     | Also fix content layout inside (inputs, labels, buttons)          |
| Use `overflow-hidden` on scrollable content | Use `overflow-x-auto` or `overflow-y-auto`                        |
| Hard-code widths without `max-w-full`       | Add `max-w-full` or use `w-full sm:w-[fixed]`                     |
| Hide content on mobile with `display:none`  | Reorganize layout to fit — only hide non-essential items          |
| Nest many `v-if="isMobileMode"` checks      | Use CSS breakpoints for layout; JS only for props/behavior        |
| Change `NcModal` `size` prop                | Fix content inside modal — modal sizes are already responsive     |
| Add responsive classes to `:deep(.ant-*)`   | Use wrapper divs with responsive classes, or body class selectors |

---

## Viewport-safe utilities

Use `nc-h-screen` instead of `h-screen` to handle mobile browser chrome:

```html
<div class="nc-h-screen"><!-- 100svh with dvh/vh fallbacks --></div>
```

## Template: Responsive Component

```vue
<script setup lang="ts">
const { isMobileMode, activeBreakpoint } = useGlobal();

// Use activeBreakpoint for finer control when needed
const isCompactView = computed(
  () => activeBreakpoint.value === "xs" || activeBreakpoint.value === "sm"
);
</script>

<template>
  <!-- Mobile-first: default styles are for mobile -->
  <div class="flex flex-col gap-2 sm:(flex-row gap-3) md:(flex-row gap-4)">
    <!-- Conditional rendering for drastically different layouts -->
    <MobileLayout v-if="isMobileMode" />
    <template v-else>
      <DesktopLayout />
    </template>
  </div>
</template>
```

## Checklist for responsive work

- [ ] Use WindiCSS breakpoint classes (`sm:`, `md:`) instead of raw media queries
- [ ] Mobile-first: default styles = mobile, then `sm:` for tablet, `md:` for desktop
- [ ] Use `isMobileMode` / `activeBreakpoint` from `useGlobal()` for JS logic
- [ ] Touch targets ≥ 44px on mobile
- [ ] Test at 375px (mobile), 768px (tablet), 1280px (desktop)
- [ ] Use `nc-h-screen` instead of `h-screen`
- [ ] Modals go full-screen on mobile
- [ ] Sidebar overlays on mobile/tablet, splitpane on desktop
- [ ] Multi-column inputs stack to single column on mobile
- [ ] Labels above inputs on mobile (not side-by-side)
- [ ] Buttons full-width on mobile, auto-width on desktop
- [ ] Wide content has horizontal scroll wrapper
- [ ] Padding/gaps reduced on mobile (p-3 vs p-6)
- [ ] Fixed-width elements have `max-w-full` safety
- [ ] Side panels stack vertically on mobile
- [ ] Tables scroll horizontally on mobile

---

## Implementation Plan (Priority Order)

### Phase 1 — Workspace

All workspace-related UI — actions, modals, context menus, inline editing, etc.

- [ ] Workspace create modal
- [ ] Workspace rename / edit inline
- [ ] Workspace context menu / action menu
- [ ] Workspace delete UI (inside ws settings)
- [ ] Workspace invite / share dialog
- [ ] Workspace switcher dropdown

> **Key files:** `components/workspace/`, `components/dlg/`, `components/dashboard/TreeView/`

### Phase 2 — Base

All base-related UI.

- [ ] Base create modal (all variants — empty, from template, import, etc.)
- [ ] Base duplicate modal
- [ ] Base delete modal
- [ ] Base rename / edit inline
- [ ] Base context menu / action menu
- [ ] Base share & collaborate dialog
- [ ] Base color / icon picker
- [ ] Base import (CSV, Excel, Airtable, etc.)

> **Key files:** `components/dlg/Base*`, `components/dashboard/TreeView/Project*`

### Phase 3 — Table

All table-related UI.

- [ ] Table create modal
- [ ] Table duplicate modal
- [ ] Table delete modal
- [ ] Table rename / edit inline
- [ ] Table context menu / action menu
- [ ] Table import dialog
- [ ] Table reorder / drag-and-drop (if applicable on mobile)

> **Key files:** `components/dlg/Table*`, `components/dashboard/TreeView/Table/`

### Phase 4 — Scripts & Dashboards

- [ ] Script create / delete modals
- [ ] Script rename / context menu
- [ ] Dashboard create / delete modals
- [ ] Dashboard rename / context menu

### Phase 5 — Views

All view-related UI.

- [ ] View create modal (all view types: grid, form, gallery, kanban, calendar)
- [ ] View duplicate / delete modals
- [ ] View rename / edit inline
- [ ] View context menu / action menu (ViewActionMenu)
- [ ] View lock / unlock dialog
- [ ] View share dialog
- [ ] View toolbar (filter, sort, group, search, fields, row height)
- [ ] View topbar (breadcrumbs, view switcher)

> **Key files:** `components/dlg/View*`, `components/smartsheet/toolbar/`, `components/dashboard/TreeView/Views/`

### Phase 6 — Workspace & Base List

- [ ] Workspace / base list page — **already done, no changes needed** (verify only)

### Phase 7 — Settings Pages

**7.1 Workspace Settings**

- [ ] Members / collaborators page
- [ ] Integrations page
- [ ] Billing / plan page (EE)
- [ ] Audit log page
- [ ] Settings layout / nav

**7.2 Base Settings**

- [ ] Data sources
- [ ] ERD
- [ ] Misc settings
- [ ] Settings layout / nav

> Some settings pages may already be fixed — check before modifying.

### Phase 8 — In-Base Experience

- [ ] Managed Apps view
- [ ] Sandboxes UI
- [ ] AI Builder interface

### Phase 9 — View Content (Main Data UI)

**9.1 Grid View**

- [ ] Grid horizontal scroll on small screens
- [ ] Column headers / cell sizing
- [ ] Toolbar responsive (already has `isToolbarIconMode` at <768px)
- [ ] Topbar breadcrumbs

**9.2 Form View**

- [ ] Form field stacking
- [ ] Form builder sidebar

**9.3 Gallery View**

- [ ] Card grid: 1-col mobile, 2-col tablet, 3+ desktop

**9.4 Kanban View**

- [ ] Lane horizontal scroll / single-lane mobile

**9.5 Calendar View**

- [ ] Day view default on mobile
- [ ] Compact header

**9.6 Expanded Form (Record Detail)**

- [ ] Full-screen on mobile
- [ ] Field list scrollable
- [ ] Comments / activity panel

### Phase 10 — Shared Views

- [ ] Shared grid view
- [ ] Shared form view
- [ ] Shared gallery view
- [ ] Shared kanban view
- [ ] Shared calendar view
- [ ] Password-protected shared view dialog

> **Out of scope (low priority):**
>
> - Workflows / Automations — no mobile editing support yet
> - Workflow editor canvas — skip entirely for now

> **Pattern:** NcModal sizes are already responsive — only fix the content inside (layout, padding, overflow, stacking).
