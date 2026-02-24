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

### i18n (Internationalization)

Translation keys live in `packages/nc-gui/lang/en.json`. **Always reuse an existing key if it matches — only add a new one if no suitable key exists.**

#### Usage

**Inside `<script setup>` or Vue composables:**
```ts
const { t } = useI18n()
t('general.cancel')
```

**In `<template>`:**
```html
{{ $t('general.cancel') }}
```

**Outside `<script setup>` (utilities, non-setup composables):**
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

#### Interpolation (dynamic values)

Use `{varName}` placeholders in the JSON value, then pass an object as the second argument:

```json
"currentlyOnVersion": "Currently on {version}",
"signInWithProvider": "Sign in with {provider}",
"userIdColon": "USER ID: {userId}"
```

```ts
// script
t('msg.currentlyOnVersion', { version: '1.2.3' })

// template
$t('labels.signInWithProvider', { provider: 'Google' })
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
    // state & actions
    return { meta, ... }
  }
)
export { useProvideSmartsheetStore, useSmartsheetStore }

// Optional: throw-variant for children that must be inside a provider
export function useSmartsheetStoreOrThrow() {
  const state = useSmartsheetStore()
  if (!state) throw new Error('Please call `useProvideSmartsheetStore` on the appropriate parent component')
  return state
}
```

- Parent calls `useProvideSmartsheetStore(meta)` to set up the context.
- Children call `useSmartsheetStore()` (returns `undefined` if no provider) or `useSmartsheetStoreOrThrow()`.

#### VueUse utilities used in this codebase

These are imported from `@vueuse/core` — use them instead of reinventing:

| Utility | Purpose |
|---------|---------|
| `createEventHook` | Typed event hooks — used for reload triggers, API hooks |
| `useStorage` | localStorage/sessionStorage with reactivity |
| `useDebounceFn` | Debounce a function |
| `useVModel` | Two-way binding helper for component props |
| `useVirtualList` | Virtualised list rendering for large datasets |
| `useTitle` | Reactively set `document.title` |
| `useEventListener` | Add/remove DOM event listeners with auto-cleanup |
| `onClickOutside` | Detect clicks outside an element |
| `onKeyDown` / `onKeyStroke` / `onKeyUp` | Keyboard event listeners |
| `useMagicKeys` | Declarative keyboard shortcut bindings |
| `useTextareaAutosize` | Auto-grow textarea |
| `breakpointsTailwind` | Tailwind breakpoint constants for `useBreakpoints` |
| `isClient` | `true` only in browser (not SSR) |
| `useTimeoutFn` | `setTimeout` with auto-cleanup |

#### `contextInject` — variables only

Use `contextInject` (or `inject`) to share **read-only reactive variables** down the component tree. Do **not** inject functions — pass them via composables or props instead.

```ts
// ok — injecting a reactive ref
const meta = inject(MetaInj)

// not ok — do not inject functions via context
```

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

Split components by responsibility. Avoid single large `.vue` files.

```
// preferred — each piece is focused
components/nc/Modal/
  index.vue       ← shell + v-model:visible wiring
  Header.vue
  Footer.vue

// avoid — everything in one file
components/nc/BigModal.vue  ← 600 lines
```

Extract repeated template blocks into sub-components. Move non-trivial logic into a composable, not into `<script setup>` directly.

#### Toasts / notifications — use `ncMessage`

Always use `ncMessage` (auto-imported), not `message` from `ant-design-vue` directly. It wraps the ant message with NocoDB's `NcAlert` design.

```ts
ncMessage.success('Saved')
ncMessage.error('Something went wrong')
ncMessage.info({ title: 'Info', content: 'Details here' })
```

#### Confirm / info dialogs — use `useNcConfirmModal`

Use `useNcConfirmModal()` instead of `Modal.confirm()` from ant-design-vue.

```ts
const { showConfirmModal, showInfoModal } = useNcConfirmModal()

showConfirmModal({
  title: 'Delete item?',
  content: 'This cannot be undone.',
  okText: 'Delete',
  okCallback: async () => { await deleteItem() },
})

// also: showInfoModal, showSuccessModal, showWarningModal, showErrorModal
```

#### Programmatic dialogs — use `useDialog`

Mounts a component into the DOM without adding it to the template.

**In `<script setup>`** — use `resolveComponent` (string name, resolved at runtime):
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

**`stroke: 'transparent'` — when to use it:**

`nuxt.config.ts` injects `stroke="currentColor"` on every SVG in `nc-icons` and `nc-icons-v2`. For icons that use **fill** (not stroke) for their colour — logos, solid icons, multi-colour icons — this inherited stroke will corrupt the rendering. Pass `stroke: 'transparent'` to neutralise it:

```ts
'ncMyLogoIcon': h(NcMyLogoIcon, { stroke: 'transparent' }),
```

Rule of thumb: line/outline icons → no extra prop needed. Fill/solid/logo icons → add `{ stroke: 'transparent' }`.

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

## File Naming

- Backend operations module: `{Feature}Get.operations.ts` / `{Feature}Post.operations.ts`
- Backend services: `{feature}.service.ts`
- Backend models: `{Feature}.ts` (PascalCase)
- Backend migrations: `nc_{number}_{description}.ts`
- Frontend components: `{Feature}.vue` in appropriate `components/{category}/` directory
- Frontend composables: `use{Feature}.ts`
- Frontend stores: `{feature}.ts` in `store/`
