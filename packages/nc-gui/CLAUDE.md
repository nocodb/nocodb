# NocoDB Frontend (Vue 3 + Nuxt 3)

## Architecture

```
packages/nc-gui/
├── components/        # ~700 Vue components across ~32 directories
│   ├── cell/          # Table cell renderers
│   ├── dashboard/     # Dashboard UI
│   ├── dlg/           # Dialogs/modals
│   ├── general/       # Reusable components
│   ├── nc/            # NocoDB design system (Button, Input, DatePicker...)
│   ├── smartsheet/    # Table/view rendering
│   ├── virtual-cell/  # Virtual column cells
│   └── workspace/     # Workspace UI
├── composables/       # ~94 composables
├── store/             # ~22 Pinia stores
├── pages/             # Nuxt route pages
├── layouts/           # Page layouts
├── plugins/           # ~20 Nuxt plugins
├── lib/               # Shared utilities (acl, constants, enums, types)
├── lang/              # i18n (40+ languages)
└── ee/                # Enterprise Edition (mirrors CE structure)
```

Tech: Vue 3.5, Nuxt 3.17, Pinia, Ant Design Vue 3.x, WindiCSS

## CE/EE Overlay System

EE files in `ee/` override CE files with the same path. CE files serve as fallbacks.

```
components/Feature.vue          ← CE version (may be empty placeholder)
ee/components/Feature.vue       ← EE override (full implementation)
```

For EE-only components, create an empty CE placeholder:
```vue
<!-- components/Feature.vue (CE) -->
<template><span /></template>
```

Build with `pnpm dev:ee` / `pnpm build:ee` to activate EE overlays.

## Composable Types

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Simple function | Stateless helpers | `export function useMyHelper() { ... }` |
| `useInjectionState()` | Component tree state (parent provides, children consume) | `const [useProvide, useConsume] = useInjectionState(...)` |
| `createGlobalState()` | App-wide singleton | `export const useGlobal = createGlobalState(() => { ... })` |

Injection state composables export `useProvide{X}` and `use{X}` pairs (e.g., `useProvideSmartsheetStore` / `useSmartsheetStore`).

## Key Composables

| Composable | Purpose |
|------------|---------|
| `useApi()` | API client with loading state |
| `useGlobal()` | App state (user, token, settings) — global singleton |
| `useSmartsheetStore()` | Current smartsheet context (injection state) |
| `useExpandedFormStore()` | Expanded form row context (injection state) |
| `useViewData()` | View data loading and manipulation (injection state) |
| `useI18n()` | Internationalization — `const { t } = useI18n()` (from vue-i18n) |
| `useDialog()` | Dialog/modal management |
| `useRoles()` | Permission checking |
| `useUndoRedo()` | Undo/redo operations |
| `useInjectionState()` | Create provider/consumer composable pairs |

## Pinia Stores

Use `defineStore` with composition API style. Always include HMR support:

```typescript
export const useMyStore = defineStore('myStore', () => { /* ... */ })

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMyStore as any, import.meta.hot))
}
```

## Styling

- WindiCSS utilities via `@apply` in scoped `<style lang="scss">`
- Component class prefix: `nc-` (e.g., `.nc-my-component`)
- Ant Design Vue overrides via `:deep(.ant-*)` selectors
- Dark mode: `@apply bg-white dark:bg-gray-900`

## i18n

```typescript
const { t } = useI18n()
t('labels.save')                          // Simple
t('msg.success.created', { name })        // Interpolation
```

Translation files in `lang/`. English is the source of truth.

## EE Composable Extension

```typescript
// ee/composables/useFeature.ts
import { useFeature as useFeatureCE } from '~/composables/useFeature'

export function useFeature(table) {
  const ceFeature = useFeatureCE(table)
  // Add EE-specific functionality
  return { ...ceFeature, eeData, fetchEEData }
}
```

## Commands

```bash
pnpm dev             # CE dev
pnpm dev:ee          # EE dev (activates ee/ overlays)
pnpm build           # CE production
pnpm build:ee        # EE production
pnpm lint            # Lint + auto-fix
```

## Key Config

- `nuxt.config.ts` — SSR disabled (`ssr: false`), hash-based routing
- `ee/nuxt.config.ts` — Extends base config with `extends: ['../']`
- Types from `nocodb-sdk` — always import from `'nocodb-sdk'`, never duplicate

## Deployment Modes & Feature Gating

Two frontend builds: CE (`pnpm dev`) and EE (`pnpm dev:ee`). The EE frontend serves both On-Prem and Cloud backends — it reads `appInfo` flags at runtime to adapt. See root CLAUDE.md for the full overview.

### Runtime Flags

| Flag | Where defined | CE | On-Prem (unlicensed) | On-Prem (licensed) | Cloud |
|------|---------------|----|----------------------|--------------------|-------|
| `isEeUI` | Auto-imported (`utils/ncUtils.ts` → `false`, `ee/utils/eeUtils.ts` → `true`) | `false` | `true` | `true` | `true` |
| `isEEFeatureBlocked` | `useEeConfig()` — CE stub always `true`; EE: `isOnPrem && !appInfo.ee` | `true` | `true` | `false` | `false` |
| `isPaymentEnabled` | `useEeConfig()` — `appInfo.isCloud && !appInfo.isOnPrem` | `false` | `false` | `false` | `true` |

### Which check to use

| Scenario | Check | Example |
|----------|-------|---------|
| Hide in CE, show in all EE (even unlicensed) | `v-if="isEeUI"` | Workspace count on admin dashboard |
| Show in EE with upgrade badge when unlicensed | `v-if="isEeUI"` + `PaymentUpgradeBadge` with `feature="PlanFeatureTypes.<FeatureName>"` `:feature-enabled-callback="() => !isEEFeatureBlocked"` | SSO tab in admin sidebar |
| Block feature when unlicensed OR not in plan | `block*` computed from `useEeConfig()` | `blockSSO`, `blockSnapshots`, `blockRowColoring` |
| Cloud-only plan gating | `isPaymentEnabled && !getFeature(...)` | Record limits, seat limits |

**Common mistake:** Using `v-if="!isEEFeatureBlocked"` to hide UI on unlicensed On-Prem. Unlicensed features should be **visible but locked with upgrade badges** — not hidden. Only CE should hide EE features entirely (use `isEeUI`).

### Payment & Billing (Cloud only)

`useEeConfig` (shared composable) — reads `workspace.payment.plan.meta`, exposes `block*` computeds, `getLimit()`, `getFeature()`, upgrade nav helpers, limit-exceeded modals. `usePayment` (injection state) — checkout/cancel/invoices/seat count. `useStripe` — lazy Stripe.js loader. Components in `ee/components/payment/` (BillingPage, checkout, plan-usage, invoices, upgrade banners). Pages: `checkout/[planId]`, `pricing/`, `upgrade/`. Middleware: `04.payment.global.ts` (post-checkout redirects).

### Key Files

| File | Purpose |
|------|---------|
| `utils/ncUtils.ts` | CE: `isEeUI=false` |
| `ee/utils/eeUtils.ts` | EE: `isEeUI=true` |
| `composables/useEeConfig.ts` | CE stub — `isEEFeatureBlocked=true`, all `block*=true`, `getFeature()` returns `true` |
| `ee/composables/useEeConfig.ts` | EE implementation — reads `appInfo` flags, plan-based gating, upgrade modals |
| `ee/components/payment/upgrade/badge.vue` | `PaymentUpgradeBadge` — shows plan badge when feature is locked |

## Anti-Patterns

These are frontend-specific — see root CLAUDE.md for universal anti-patterns.

| Don't | Do Instead |
|-------|-----------|
| Duplicate SDK types in frontend code | Import from `'nocodb-sdk'` |
| Skip CE placeholder for EE-only components | Create empty `<template><NcSpanHidden /></template>` CE stub |
| Expose EE-only data to non-owner UI | Audit what's visible in UI, not just API responses |
| Use `activeBaseId.value` in realtime event callbacks to identify which base the event belongs to | Extract `base_id` from `event.payload` — user may have navigated away before the callback fires |
| Use `v-if="!isEEFeatureBlocked"` to hide EE features | Use `v-if="isEeUI"` to hide in CE; show with upgrade badge in EE unlicensed |
