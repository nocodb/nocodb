# Responsive UI Skill

Guidelines for making NocoDB UI responsive. Follow these conventions for all responsive work.

## Breakpoints

| Name | CSS class prefix | Width range | JS detection |
|------|-----------------|-------------|--------------|
| **Mobile** | `xs:` (max) / default | `< 480px` | `isMobileMode` |
| **Tablet** | `sm:` (min 480px) | `480px – 819px` | `isTabletMode` |
| **Desktop** | `md:` (min 820px) | `≥ 820px` | `!isMobileMode && !isTabletMode` |
| **Large** | `2xl:` / `3xl:` / `4xl:` | `≥ 1780px` / `≥ 1920px` / `≥ 2560px` | — |

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

```ts
MAX_WIDTH_FOR_MOBILE_MODE = 480   // matches xs breakpoint
MAX_WIDTH_FOR_TABLET_MODE = 820   // matches md breakpoint boundary
```

## JS Reactive State

### From `useConfigStore` (Pinia store)

```ts
const configStore = useConfigStore()
const { isMobileMode, isTabletMode } = storeToRefs(configStore)
```

### From `useSidebarStore` (also exposes `isTabletMode`)

```ts
const sidebarStore = useSidebarStore()
const { isMobileMode, isTabletMode } = storeToRefs(sidebarStore)
// isMobileMode comes from useGlobal(), isTabletMode from configStore
```

### From `useGlobal()` (`isMobileMode` + `isTabletMode`)

```ts
const { isMobileMode, isTabletMode } = useGlobal()
```

### State flow

```
useGlobal()          — source of truth (persisted in localStorage)
  ├── isMobileMode   — set by useConfigStore on resize
  └── isTabletMode   — set by useConfigStore on resize

useConfigStore()     — detects viewport changes, syncs to useGlobal, sets body classes
  ├── isMobileMode   — ref, updated on resize (width < 480)
  └── isTabletMode   — ref, updated on resize (!mobile && width < 820)

useSidebarStore()    — re-exports isTabletMode from configStore for sidebar-specific logic
  └── isTabletMode   — storeToRefs(useConfigStore())
```

### Body CSS classes (set by `useConfigStore`)

| Viewport | Body class |
|----------|-----------|
| `< 480px` | `.mobile` |
| `480px – 819px` | `.tablet` |
| `≥ 820px` | `.desktop` |

Use these for global CSS rules when WindiCSS classes aren't sufficient:

```scss
:global(.mobile) & {
  // mobile-only styles
}
:global(.tablet) & {
  // tablet-only styles
}
```

## Prefer WindiCSS Over Pure CSS

**Always prefer WindiCSS utility classes** over writing raw CSS in `<style>` blocks for responsive work.

### Do

```html
<!-- WindiCSS responsive utilities — clean, scannable, consistent -->
<div class="p-2 sm:p-3 md:p-4 text-sm sm:text-base">
  <NcButton class="w-full sm:w-auto" size="small">Save</NcButton>
</div>
```

### Don't

```scss
/* Avoid: raw media queries for things WindiCSS handles */
.my-component {
  padding: 8px;
  @media (min-width: 480px) { padding: 12px; }
  @media (min-width: 820px) { padding: 16px; }
}
```

### When raw CSS is acceptable

- Complex selectors that WindiCSS can't express (`:deep(.ant-*)` overrides, pseudo-elements)
- Animation keyframes
- CSS variables / custom properties
- Styles that depend on body class (`.mobile`, `.tablet`, `.desktop`)

## Responsive Patterns

### Sidebar behavior

| Viewport | Sidebar |
|----------|---------|
| Mobile | Full-screen overlay (0% or 100%) |
| Tablet | Auto-collapsed, overlay on open |
| Desktop | Resizable splitpane (15–60%) |

### Toolbar

- Desktop: full labels + icons
- Tablet/Mobile (`< 768px`): icon-only mode (`isToolbarIconMode`)

### Modals / Dialogs

- Desktop: centered modal with `NcModal size="md"`
- Mobile: full-screen (`size="fullscreen"` or `xs:` overrides)

### Touch targets

Minimum 44px height/width for interactive elements on mobile:

```html
<NcButton class="min-h-11 min-w-11 sm:(min-h-8 min-w-8)">...</NcButton>
```

## Viewport-safe utilities

Use `nc-h-screen` instead of `h-screen` to handle mobile browser chrome:

```html
<div class="nc-h-screen">  <!-- 100svh with dvh/vh fallbacks -->
```

## Template: Responsive Component

```vue
<script setup lang="ts">
const configStore = useConfigStore()
const { isMobileMode, isTabletMode } = storeToRefs(configStore)
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
- [ ] Use `isMobileMode` / `isTabletMode` from `useConfigStore` for JS logic
- [ ] Touch targets ≥ 44px on mobile
- [ ] Test at 375px (mobile), 768px (tablet), 1280px (desktop)
- [ ] Use `nc-h-screen` instead of `h-screen`
- [ ] Modals go full-screen on mobile
- [ ] Sidebar overlays on mobile/tablet, splitpane on desktop
