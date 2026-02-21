# NocoDB Enterprise (nocohub)

> This is `nocohub` (NocoDB Enterprise/Hub), NOT the open-source `nocodb` repo. All work is proprietary.

## Session Start

If on a non-`develop` branch and `.claude/branches/{branch}/index.md` exists, **read it FIRST** before doing anything else. It tells you what this branch is about, current progress, and what to read next.

## Repository Structure

```
nocohub/
├── packages/
│   ├── nocodb-sdk/              # TypeScript types + auto-generated API client
│   ├── nocodb/                  # Backend (NestJS + Knex)
│   ├── nc-gui/                  # Frontend (Vue 3 + Nuxt 3)
│   ├── noco-integrations/       # 60+ SaaS integration packages
│   ├── nc-integration-scaffolder/ # Integration scaffolding tool
│   ├── nc-sql-executor/         # SQL execution engine
│   ├── nc-secret-mgr/           # Secret management
│   └── nc-knex-dialects/        # Custom Knex dialects
├── tests/
│   └── playwright/              # E2E tests (Playwright)
├── scripts/                     # Build + SDK generation scripts
├── docker-compose/              # Docker configurations
└── .claude/
    └── skills/                  # Claude skills (automations, sync, nc-pr)
```

## Build Order

```
nocodb-sdk  →  nocodb (backend)  →  nc-gui (frontend)
   types        NestJS API :8080     Vue 3/Nuxt 3 :3000
```

Start with migration or SDK type changes when a feature needs them. If schema evolves during the PR, update the same migration file — **1 migration per PR max**.

The format of migration file is `nc_YYYYMMDDHHmm_{title}`, where `nc_` is the prefix, followed by date timestamp, followed by title. Use bash command `echo nc_$(date +%Y%m%d%H%M)_` to generate the prefix for migration file, `touch packages/nocodb/src/meta/migrations/v0/nc_$(date +%Y%m%d%H%M)_add_my_feature.ts` for example will create a migration file titled `add_my_feature`.

After SDK changes, rebuild SDK before backend or frontend: `cd packages/nocodb-sdk && pnpm run build:ee`

## Commands

```bash
# Bootstrap
pnpm run bootstrap          # Full EE setup (installs deps + builds SDK + builds integrations)

# SDK (always rebuild after type changes)
cd packages/nocodb-sdk && pnpm run build:ee

# Backend
cd packages/nocodb && pnpm run watch:run:pg:ee     # EE dev with hot reload

# Frontend
cd packages/nc-gui && pnpm run dev:ee              # EE dev with hot reload

# Tests
cd packages/nocodb && pnpm test:unit               # Unit tests (Mocha + Chai, NOT Jest)
cd packages/nocodb && pnpm test:unit:pg:ee          # PostgreSQL + EE
cd tests/playwright && pnpm test                    # E2E (Playwright)
```

## CE/EE Separation

EE code lives in `ee/` subdirectories that mirror CE structure. This applies across all packages.

- EE extends CE through class inheritance — never the other way
- CE code must work standalone without EE code
- Never import from `ee/` in CE code
- Backend has three EE tiers: `ee/` (shared), `ee-cloud/` (cloud-specific), `ee-on-prem/` (on-prem-specific)

CRITICAL: EE `globals.ts` completely overrides CE — it does NOT inherit. When adding MetaTable/CacheScope entries in CE, you MUST also add them in `src/ee/utils/globals.ts` or values resolve to `undefined` at runtime.

## Type Safety Flow

1. Define types in `nocodb-sdk` first (in `src/lib/` — do NOT manually edit `Api.ts`, it's auto-generated from swagger)
2. Import types from `'nocodb-sdk'` in both backend and frontend
3. Backend validates against swagger schemas: `validatePayload('swagger.json#/components/schemas/Name', body)`
4. Never use `any` without justification

To regenerate SDK from swagger: `cd packages/nocodb-sdk && pnpm run build:ee`

## Import Aliases

- Backend: `~/` → `src/` (tsconfig alias), `src/` used for CE imports in EE files
- Frontend: `~/` or relative paths
- SDK types: always import from `'nocodb-sdk'`
- Do not use `~/ee/*` — `~/*` will automatically resolve based on edition

## Cross-Package Feature Checklist

When building features that span SDK → Backend → Frontend:

1. **SDK**: Add types to `src/lib/`, add events to `enums.ts`, rebuild with `pnpm run build:ee`
2. **Backend**: Create model + service, register in internal controllers + ACL + noco.module, create migration
3. **Frontend**: Create composable/store, build components, import types from `nocodb-sdk`
4. **Verify**: Run typechecks across all three packages

## Branch Memory

Claude maintains working memory in `.claude/branches/{branch}/` (gitignored) for every feature branch (not `develop`). This is maintained automatically — not just via `/nc-pr`.

```
.claude/branches/{branch}/
├── index.md      # 10-second orientation: current focus, progress count
├── plan.md       # Phased task list with [S]/[M]/[L] sizing and checkboxes
├── context.md    # Why this feature exists, key decisions, discovery answers
├── log.md        # Reverse-chronological log of each session's work
└── test.py       # API test script (if applicable) — single self-contained file
```

### Maintenance Protocol

On **every session**, regardless of whether `/nc-pr` was used:

- **Session start**: Read `index.md` to orient. If it doesn't exist, offer to set up branch memory.
- **After completing a task**: Check it off directly in `plan.md` (`- [ ]` → `- [x]`). One Edit call, no delegation.
- **Session end**: Delegate to `nc-memory` agent — it writes the log entry, updates progress count in index.md, and catches any missed plan.md updates.

### Log Entry Format

Each entry in `log.md` uses this structure:

```markdown
## {YYYY-MM-DD HH:MM} — {Type}: {Title}
{Details}
```

Entry types:

| Type | When |
|------|------|
| `action` | Code written, file created, commit made |
| `decision` | Non-obvious choice — include options considered + rationale |
| `investigation` | Explored something — findings, even dead ends |
| `blocker` | Something is stuck — what, why, possible unblocks |
| `resolved` | A blocker was cleared |
| `scope-change` | Plan was updated — what changed and why |

## Payment / Billing System

Stripe per-seat SaaS billing. **EE-only** — CE has zero payment awareness. No `NC_STRIPE_SECRET_KEY` = legacy unlimited plan.

- **Plans** → `PlanFeatureTypes` (boolean flags) + `PlanLimitTypes` (numeric limits) in `meta` field
- **Subscriptions** → link workspace/org to plan with Stripe state
- **`Workspace.payment`** → eagerly loaded on every fetch (plan + subscription)
- **Feature gating** → backend: `checkLimit()`/`checkForFeature()` in `paymentHelpers.ts`; frontend: `useEeConfig` `block*` computeds
- **Seat counting** → `NON_SEAT_ROLES` (viewer, commenter) are free. Reseat batched 10-min debounce for increases, immediate for decreases

Key files: SDK `src/lib/payment/index.ts` · Backend `src/ee/models/Plan.ts`, `Subscription.ts` · `src/ee/modules/payment/payment.service.ts` · `src/ee/helpers/paymentHelpers.ts` · Frontend `ee/composables/useEeConfig.ts`, `usePayment.ts` · `ee/components/payment/`

## Design Decisions

For significant architectural or design decisions (not small implementation details):

1. Present 2-3 options with trade-offs before implementing
2. Wait for user direction — the user acts as architect
3. When the user points to existing code (e.g., "see commandPaletteHelpers.ts"), follow that pattern exactly
4. Don't add unnecessary abstractions — always check for existing patterns first

## PR Guidelines

- Follow existing patterns — consistency > cleverness
- Test across packages — changes often have cross-package impact
- Don't commit directly to `main` or `develop` without PR
- Don't skip SDK rebuild after type changes

## Anti-Patterns

| Don't | Do Instead |
|-------|-----------|
| Cast with `as unknown` or `as any` to work around type errors | Fix the type system properly (update the interface/type definition) |
| Create new abstractions when similar ones exist | Search for existing patterns first, ask if unsure |
| Use `console.log` / `console.error` in production code | Use `Logger` (backend) or remove (frontend) |
| Add `TODO` without a linked issue | Include issue reference or remove before PR |

## Frontend Patterns

### Telemetry — `v-e` and `$e()`

Add `v-e` on interactive elements. `c:` = UI action, `a:` = API call. Format: `c:feature:sub-feature:action`.

```html
<NcButton v-e="['c:table:create']">Create</NcButton>
<a-switch v-e="['c:share:enable:toggle', { enabled: isPublic }]" />
```

In script: `const { $e } = useNuxtApp()` → `$e('a:table:import', { type: 'csv' })`

### Type guards from `nocodb-sdk`

Auto-imported — prefer over `typeof` / `Array.isArray`:
`ncIsString`, `ncIsArray`, `ncIsFunction`, `ncIsObject`, `ncIsEmptyObject`, `ncIsNumber`, `ncIsBoolean`, `isPrimitiveValue`

### `computedAsync` for async-resolved values

Use instead of `watch` + separate `ref` for async-derived state (auto-imported from `@vueuse/core`):

```ts
const currentWorkspace = computedAsync(async () => {
  if (!props.workspaceId) return activeWorkspace.value
  return workspacesList.value.find((w) => w.id === props.workspaceId)
    ?? await loadWorkspace(props.workspaceId)
})
```

### `inject()` — always provide a fallback

Always pass a default to `inject()` so children don't crash when used outside a provider:

```ts
const isPublic = inject(IsPublicInj, ref(false))
const activeView = inject(ActiveViewInj, ref())
const isForm = inject(IsFormInj, ref(false))
```

### `data-testid` and `nc-*` CSS class naming

- Add `data-testid` on interactive/important elements for Playwright tests. Use kebab-case with a feature prefix:
  ```html
  <input data-testid="nc-create-table-input" />
  <NcButton data-testid="nc-create-table-btn-confirm" />
  ```
  Dynamic IDs: `:data-testid="\`nc-field-${col.title}\`"`.
- Add `nc-*` CSS classes on elements that tests or users might need to target: `class="nc-table-row"`, `class="nc-sidebar-item"`.

### `NcTooltip` vs `title` attribute

Use `<NcTooltip>` instead of the native `title` attribute — it follows the design system and supports rich content.

For text that may overflow/truncate, use `show-on-truncate-only` to only show the tooltip when text is actually clipped:
```html
<NcTooltip show-on-truncate-only class="truncate max-w-40">
  {{ longText }}
</NcTooltip>
```

For always-visible tooltips:
```html
<NcTooltip :title="$t('tooltip.myTip')" placement="right" :arrow="false">
  <NcButton>...</NcButton>
</NcTooltip>
```

### i18n (Internationalization)

Translation keys live in `packages/nc-gui/lang/en.json`. **Always reuse an existing key if it matches — only add a new one if no suitable key exists.**

#### Usage

**Inside `<script setup lang="ts">` or Vue composables:**
```ts
const { t } = useI18n()
t('general.cancel')
```

**In `<template>`:**
```html
{{ $t('general.cancel') }}
```

**Outside `<script setup lang="ts">` (utilities, non-setup composables):**
```ts
import { getI18n } from '~/plugins/a.i18n'

const { t } = getI18n().global
```

#### Key Structure

Keys are nested under top-level semantic groups. Add new keys to the most appropriate group:

| Group | Purpose |
|-------|---------|
| `general` | Common words: Save, Cancel, Delete, Loading… |
| `title` | Page / section headings |
| `labels` | Field labels, form labels |
| `objects` | Nouns: user, table, view, field… |
| `placeholder` | Input placeholder text |
| `tooltip` | Tooltip copy |
| `msg` | Success / error / info messages |
| `activity` | Activity feed strings |
| `upgrade` | Upgrade / upsell prompts |

Keys can be nested as deeply as needed:
```json
"labels": {
  "auth": {
    "signIn": "Sign in"
  }
}
```
Used as: `t('labels.auth.signIn')`

#### Interpolation

Use `{varName}` placeholders, then pass an object as the second argument:

```json
"signInWithProvider": "Sign in with {provider}"
```
```ts
t('labels.signInWithProvider', { provider: 'Google' })
```

#### Things to watch out for

- **Never hardcode user-visible strings** — always go through `t()` / `$t()`.
- **Don't duplicate keys** — search `en.json` before adding a new one.
- **Pluralisation** — vue-i18n supports `{count} item | {count} items` syntax if needed.
- **`en.json` is the source of truth** — other locale files are translations of it; only edit `en.json` in PRs.

### Composable Patterns

#### Scoping composables

| Utility | When to use |
|---------|------------|
| `createGlobalState()` | True singleton — shared across the entire app (e.g. `useGlobal`) |
| `createSharedComposable()` | Singleton per Vue app instance — preferred for most shared composables (e.g. `useEeConfig`, `useRealtime`, `useJobs`) |
| `useInjectionState()` | Component-tree scoped state — provider/consumer pair for contextual state (e.g. `useSmartsheetStore`, `useKanbanViewStore`) |

**`createSharedComposable` example:**
```ts
export const useEeConfig = createSharedComposable(() => {
  // runs once; all callers share the same state
  return { ... }
})
```

**`useInjectionState` example — always export as a pair:**
```ts
const [useProvideSmartsheetStore, useSmartsheetStore] = useInjectionState(
  (meta: Ref<TableType>) => {
    return { meta, ... }
  }
)
export { useProvideSmartsheetStore, useSmartsheetStore }
```

Parent calls `useProvideSmartsheetStore(meta)`. Children call `useSmartsheetStore()` (returns `undefined` if no provider).

#### VueUse utilities used in this codebase

Imported from `@vueuse/core`:

| Utility | Purpose |
|---------|---------|
| `createEventHook` | Typed event hooks |
| `useStorage` | localStorage/sessionStorage with reactivity |
| `useDebounceFn` | Debounce a function |
| `useVModel` | Two-way binding for component props |
| `useVirtualList` | Virtualised list for large datasets |
| `useEventListener` | DOM event listeners with auto-cleanup |
| `onClickOutside` | Clicks outside an element |
| `onKeyDown` / `useMagicKeys` | Keyboard listeners / shortcuts |
| `useTextareaAutosize` | Auto-grow textarea |
| `isClient` | `true` only in browser (not SSR) |
| `useTimeoutFn` | `setTimeout` with auto-cleanup |

#### `contextInject` — variables only

Use `inject()` to share **read-only reactive refs** down the tree. Do **not** inject functions — pass them via composables or props.

#### Pinia stores vs composables

Pinia stores (`store/*.ts`, defined with `defineStore`) are used for **global, persistent UI state** that multiple unrelated parts of the app need simultaneously — e.g. `useBases`, `useViewsStore`, `useTables`. They are accessed anywhere without a provider.

Prefer a **`createSharedComposable`** instead when the state is transient or feature-specific. Use a **`useInjectionState` pair** when the state belongs to a subtree (e.g. a smartsheet view).

```ts
// Pinia store pattern (store/*.ts)
export const useBases = defineStore('basesStore', () => {
  const bases = ref<Map<string, NcProject>>(new Map())
  // ... actions
  return { bases, ... }
})
// Always add HMR support at the bottom of the file:
if (import.meta.hot) acceptHMRUpdate(useBases, import.meta.hot)
```

### Components

#### Use existing components first

Before creating anything new, check these folders for an existing component:

- **`components/nc/`** — NocoDB design system components (Button, Modal, Dropdown, Select, Tooltip, Input, Badge, Icon, etc.)
- **`components/general/`** — App-level shared components (Loader, Spinner, ColorPicker, DeleteModal, CopyButton, Overlay, etc.)

Examples of what already exists in `components/nc/`:
`NcButton`, `NcModal`, `NcModalConfirm`, `NcDropdown`, `NcSelect`, `NcTooltip`, `NcSwitch`, `NcCheckbox`, `NcBadge`, `NcIcon`, `NcAlert`, `NcTabs`, `NcTable`, `NcPagination`, `NcDivider`, `NcPopover`, `NcMenu`, `NcDatePicker`, `NcEmptyPlaceholder`, `NcListWithSearch`

#### NcModal — prefer `modalSizes` sizes

`NcModal` accepts a `size` prop. Prefer the **`modalSizes`** keys (`xs`, `sm`, `md`, `lg`, `xl`, `fullscreen`) — these are the newer, responsive sizes. The legacy string sizes (`small`, `medium`, `large`) still work but are older.

| Size | Width | Height |
|------|-------|--------|
| `xs` | max 448px | max 448px |
| `sm` | max 640px | max 424px |
| `md` | max 900px | max 540px |
| `lg` | max 1280px | max 864px |
| `xl` | max 1280px (90vw) | max 864px |
| `fullscreen` | 100vw | 100vh |

```html
<NcModal v-model:visible="isOpen" size="md">
  <!-- content -->
</NcModal>
```

Use `small` / `medium` / `large` only when matching an existing modal that already uses them.

#### Adding new reusable components

If you build a component that could be used in more than one place, put it in **`components/nc/`** — not inline in a feature component.

#### Keep components small and composable

Split by responsibility — extract repeated template blocks into sub-components, move non-trivial logic into a composable. Avoid single large `.vue` files.

#### Toasts / notifications — use `message`

Use `message` from `ant-design-vue`. `plugins/ant.ts` patches it to point directly to `ncMessage`, so they are equivalent.

```ts
message.success('Saved')
message.error('Something went wrong')
```

#### Confirm / info dialogs — use `useNcConfirmModal`

Use `useNcConfirmModal()` instead of `Modal.confirm()` from ant-design-vue.

```ts
const { showConfirmModal } = useNcConfirmModal()
showConfirmModal({ title: 'Delete item?', content: 'This cannot be undone.', okCallback: async () => { await deleteItem() } })
// also: showInfoModal, showSuccessModal, showWarningModal, showErrorModal
```

#### Programmatic dialogs — use `useDialog`

Mounts a component into the DOM without adding it to the template.

**In `<script setup lang="ts">`** — use `resolveComponent` (string name, resolved at runtime):
```ts
const { close } = useDialog(resolveComponent('DlgMCPDelete'), {
  'modelValue': isOpen,
  'onUpdate:modelValue': () => { isOpen.value = false; close(300) },
})
```

**In a composable** — `resolveComponent` doesn't work outside setup; import the component directly:
```ts
import { DlgBaseErd } from '#components'

const { close } = useDialog(DlgBaseErd, {
  'modelValue': isOpen,
  'onUpdate:modelValue': () => { isOpen.value = false; close(300) },
})
```

`close(delayMs?)` destroys the mounted component; pass ~300ms to let the modal close animation finish first.

### Icons

**To add a new icon:**

1. Add the SVG (16px viewBox) to **both**:
   - `packages/nc-gui/assets/nc-icons-v2/<name>.svg`
   - `packages/nc-gui/ee/assets/nc-icons-v2/<name>.svg`

2. Import it in `utils/iconUtils.ts` with `Nc` prefix:
   ```ts
   import NcMyIcon from '~icons/nc-icons-v2/my-icon.svg'
   ```

3. Add to `iconMap`:
   ```ts
   'ncMyIcon': NcMyIcon,
   ```

4. If it should appear in the icon picker, also add to `searchableMap`:
   ```ts
   ncMyIcon: { icon: NcMyIcon, keywords: ['...'] },
   ```

**`stroke: 'transparent'`** — `nuxt.config.ts` injects `stroke="currentColor"` on all SVGs. For fill/solid/logo icons this corrupts rendering — neutralise it:

```ts
'ncMyLogoIcon': h(NcMyLogoIcon, { stroke: 'transparent' }),
```

Outline icons → no prop needed. Fill/solid/logo icons → add `{ stroke: 'transparent' }`.

## Payment Feature Gating

### Adding a new paid feature — full checklist

**1. SDK** (`packages/nocodb-sdk/src/lib/payment/index.ts`)

```ts
// Add to PlanFeatureTypes enum
FEATURE_MY_THING = 'feature_my_thing',

// Add to PlanFeatureUpgradeMessages
[PlanFeatureTypes.FEATURE_MY_THING]: 'to use my thing.',
```

**2. Backend default** (`packages/nocodb/src/ee/models/Plan.ts`)

Add the feature with its default value (usually `false` for paid-only):
```ts
[PlanFeatureTypes.FEATURE_MY_THING]: false,
```

**3. Backend guard** — call at service/controller level:
```ts
import { checkForFeature } from '~/ee/helpers/paymentHelpers'
import { PlanFeatureTypes } from 'nocodb-sdk'

await checkForFeature(context, PlanFeatureTypes.FEATURE_MY_THING)
// throws featureNotSupported if plan doesn't have it
```

**4. Frontend — CE stub** (`packages/nc-gui/composables/useEeConfig.ts`)

CE always returns blocked/no-op — preserves CE/EE separation:
```ts
const blockMyThing = computed(() => true)
const showUpgradeToUseMyThing = (..._args: any[]) => {}

// add both to the return object
```

**5. Frontend — EE implementation** (`packages/nc-gui/ee/composables/useEeConfig.ts`)

```ts
const blockMyThing = computed(() => {
  return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_MY_THING)
})

const showUpgradeToUseMyThing = () => {
  handleUpgradePlan({ limitOrFeature: PlanFeatureTypes.FEATURE_MY_THING })
}

// add both to the return object
```

**6. Frontend — guard usage**

```ts
// In script
const { blockMyThing, showUpgradeToUseMyThing } = useEeConfig()
if (blockMyThing.value) return showUpgradeToUseMyThing()
```

**Badge-only** — upgrade modal triggered only when user clicks the badge itself:
```html
<div>
  <MyControl />
  <PaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_MY_THING" />
</div>
```

**Badge + Provider** — upgrade modal triggered when user clicks the whole control (not just the badge). Provider exposes a `click` slot prop that intercepts the action:
```html
<PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_MY_THING">
  <template #default="{ click }">
    <NcButton
      @click="click(PlanFeatureTypes.FEATURE_MY_THING, () => doAction())"
    >
      My Action
    </NcButton>
    <PaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_MY_THING" />
  </template>
</PaymentUpgradeBadgeProvider>
```

`click(feature, successCallback)` — if feature is locked it shows the upgrade modal and returns `true`; if available it calls `successCallback`. The badge is auto-hidden when the feature is available.

## Code Style & Organization

### Script / composable internal order

Keep declarations in this order with a **blank line between each group**:

```ts
// 1. Imports

// 2. Props / emits
const props = defineProps<{ ... }>()

const emits = defineEmits<{ ... }>()

// 3. Stores & composables
const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const { $api } = useNuxtApp()

const { t } = useI18n()

// 4. inject()
const meta = inject(MetaInj)

const isPublic = inject(IsPublicInj, ref(false))

// 5. Reactive state
const isLoading = ref(false)

// 6. Computed
const isValid = computed(() => !!form.title)

// 7. Functions
async function save() { ... }

// 8. Watchers
watch(isLoading, () => { ... })

// 9. Lifecycle
onMounted(() => { ... })
```

### Lint & hoisting rules

- **`const` before use** — unlike `function` declarations, `const`/`let` are not hoisted. A computed or watcher that references a `ref` must come *after* that `ref` is declared.
- **No unused variables** — lint will fail on declared-but-unused vars; remove them or prefix with `_` if intentionally unused (e.g. `_args`).
- **No `console.log`** — remove before committing; use `Logger` in backend.
- **Avoid `as any` / `as unknown as T`** — fix the type instead.

### Spacing & readability

- One blank line between each logical group (state, computed, functions, watchers).
- One blank line between functions inside a block.
- Keep lines under ~120 chars; break long chains onto new lines.

### Reactivity tips

- Prefer `computed` over `watch` + `ref` for derived state — it's lazy and cached.
- Use `watchEffect` when the dependencies aren't known upfront; use `watch` when you need the old value or want explicit control.
- Always `storeToRefs()` when destructuring Pinia store to keep reactivity: `const { bases } = storeToRefs(useBases())`.
- Avoid mutating props directly — emit or use a local copy.

### General best practices

- **Early return** — guard at the top, write the happy path flat.

- **Name booleans positively** — `isLoading`, `isOpen`, `hasError`.

- **Async error handling** — always wrap API calls in try/catch, use `extractSdkResponseErrorMsg(e)`:
  ```ts
  try {
    await $api.something.do()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  ```

- **Don't call composables inside conditionals or loops** — Vue composable rules apply; call them at the top level of setup/composable only.

- **Avoid deep optional chaining chains** in templates (`a?.b?.c?.d`) — derive a computed that handles the nullability and use that instead.

- **Type your refs** explicitly when the initial value doesn't convey the type:
  ```ts
  const items = ref<TableType[]>([])   // clear
  const items = ref([])                // unclear
  ```

## Styling

### Color System

The frontend has a layered color system. Always prefer semantic tokens over raw palette values.

#### `themeVariables` — semantic tokens (prefer these)

Defined in [utils/colorsUtils.ts](packages/nc-gui/utils/colorsUtils.ts). These map to CSS variables that **change with light/dark theme**. Four categories:

| Category | Windi prefix | Example classes |
|----------|-------------|----------------|
| `content` | `text-` | `text-nc-content-gray`, `text-nc-content-brand`, `text-nc-content-red-dark` |
| `background` | `bg-` | `bg-nc-bg-default`, `bg-nc-bg-brand`, `bg-nc-bg-gray-light` |
| `border` | `border-` | `border-nc-border-gray-medium`, `border-nc-border-brand` |
| `fill` | `fill-` / `bg-` / `text-` | `fill-nc-fill-primary`, `bg-nc-fill-warning`, `text-nc-fill-red-dark` |

Examples: `text-nc-content-gray-subtle`, `bg-nc-bg-gray-light`, `border-nc-border-gray-medium`, `bg-nc-fill-primary`, `bg-nc-fill-primary-hover`

#### `themeV4Colors` — palette with `nc-` prefix

Raw shades registered with `nc-` prefix (`themeV4ColorsWithNcPrefix`) — still adapt to theme. Use when no semantic token fits: `bg-nc-brand-50`, `text-nc-gray-700`.

#### Static colors — `themeV3Colors` (no `nc-` prefix)

Hardcoded hex — same in all themes. Use for enum chips, data viz: `text-brand-500`, `bg-red-50`.

#### `variables.css` — CSS custom properties

[assets/css/variables.css](packages/nc-gui/assets/css/variables.css) defines the actual CSS variable values for both `:root` (light) and `.dark` (dark). The `--rgb-color-*` variants are used by `ncBuildColorsWithOpacity` to support opacity utilities.

Prefer using CSS variables directly in `<style>` blocks when Windi classes aren't expressive enough:
```css
color: var(--nc-content-brand);
background: var(--nc-bg-brand);
border: 1px solid var(--nc-border-gray-medium);
```

### Windi Plugins

**`ncTypographyPlugin`** — Figma-aligned text utilities. Use instead of raw `text-sm`/`font-medium` combos:

`text-heading1` (64px/700), `text-heading3` (24px/700), `text-body` (14px/500), `text-bodyDefaultSm` (13px/500), `text-bodySm` (12px/500), `text-caption` (14px/500), `text-captionSm` (12px/500), `text-sidebarDefault` (14px/550)

**`ncWindicssShortcutsPlugin`** ([assets/nc-windicss-shortcuts-plugin.ts](packages/nc-gui/assets/nc-windicss-shortcuts-plugin.ts)) — adds viewport-safe screen utilities:

```html
<div class="nc-h-screen">   <!-- 100svh with 100dvh/100vh fallbacks -->
<div class="nc-min-h-screen">
<div class="nc-w-screen">
<div class="nc-min-w-screen">
```

Use `nc-h-screen` instead of `h-screen` everywhere to handle mobile browser chrome correctly.

### Summary: Which color to use?

1. **Semantic token exists?** → use `themeVariables` class (`text-nc-content-*`, `bg-nc-bg-*`, etc.)
2. **Need a raw shade that adapts to dark mode?** → use `nc-` prefixed V4 color (`bg-nc-brand-100`)
3. **Must be same in all themes** (enum chips, data viz) → use V3 color without prefix (`text-brand-500`)
4. **Complex style in `<style>`?** → use `var(--nc-content-brand)` CSS variables directly

## Vue File Template

Standard boilerplate for new `.vue` components:

```vue
<script setup lang="ts">
interface Props {
}

const props = withDefaults(defineProps<Props>(), {
})

const {  } = toRefs(props)
</script>

<template>

</template>

<style lang="scss" scoped>

</style>
```

## File Naming

- Backend operations module: `{Feature}Get.operations.ts` / `{Feature}Post.operations.ts`
- Backend services: `{feature}.service.ts`
- Backend models: `{Feature}.ts` (PascalCase)
- Backend migrations: `nc_{number}_{description}.ts`
- Frontend components: `{Feature}.vue` in appropriate `components/{category}/` directory
- Frontend composables: `use{Feature}.ts`
- Frontend stores: `{feature}.ts` in `store/`
