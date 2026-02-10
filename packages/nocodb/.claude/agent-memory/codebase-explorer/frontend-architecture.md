# Frontend Architecture (nc-gui - Vue 3 / Nuxt 3)

## Directory Structure

Location: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/`

```
nc-gui/
├── components/              # 217 Vue files across 31 categories
│   ├── account/             # Account/profile components
│   ├── actions/             # Action components
│   ├── ai/                  # AI-related components
│   ├── api-client/          # API client UI
│   ├── auth/                # Authentication components
│   ├── cell/                # Cell renderers (grid/form)
│   ├── cmd-*/               # Command palette variants (cmd-j, cmd-k, cmd-l, cmd-footer)
│   ├── dashboard/           # Dashboard UI components
│   ├── dlg/                 # Dialogs and modals
│   ├── erd/                 # Entity-Relationship Diagram
│   ├── extensions/          # Extension-related UI
│   ├── feed/                # Activity feed components
│   ├── general/             # Reusable generic components
│   ├── monaco/              # Monaco editor integration
│   ├── n/ & nc/             # NocoDB design system components
│   ├── notification/        # Notification components
│   ├── payment/             # Payment/billing components
│   ├── permissions/         # Permissions UI
│   ├── project/             # Project management components
│   ├── roles/               # Role management components
│   ├── shared-view/         # Shared view components
│   ├── smartsheet/          # Table/grid view components
│   ├── tabs/                # Tab components
│   ├── template/            # Template components
│   ├── virtual-cell/        # Virtual column cells
│   ├── webhook/             # Webhook management UI
│   └── workspace/           # Workspace components
│
├── composables/             # 104 files (79 top-level + subdirs)
│   ├── useApi/              # API client wrapper (loading/error state)
│   ├── useCommandPalette/   # Command palette management
│   ├── useDialog/           # Dialog state management
│   ├── useExpandedFormDetached/
│   ├── useFormBuilder/      # Form builder state
│   ├── useGlobal/           # Global app state
│   ├── useInjectionState/   # Custom injection state helper
│   └── [79+ individual composables]
│
├── store/                   # 24 Pinia stores
│   ├── bases.ts             # Bases/projects store
│   ├── base.ts              # Current base state
│   ├── views.ts             # Views management (40KB - largest)
│   ├── tables.ts            # Tables management
│   ├── webhooks.ts          # Webhooks state
│   ├── workspace.ts         # Workspace state
│   ├── sidebar.ts           # Sidebar UI state
│   ├── config.ts            # Configuration store
│   ├── dashboard.ts         # Dashboard state
│   ├── notification.ts      # Notifications state
│   ├── users.ts             # Users management
│   └── ui/                  # UI-specific stores
│
├── pages/                   # Route pages
│   ├── index.vue            # Home/dashboard
│   ├── index/[typeOrId].vue # Dynamic routes
│   ├── projects/            # Projects page
│   ├── account/             # Account page
│   ├── signin.vue
│   ├── signup/
│   └── oauth/
│
├── layouts/                 # 8 layout templates
│   ├── dashboard.vue        # Main dashboard layout
│   ├── shared-view.vue      # Shared view layout
│   ├── base.vue             # Base layout
│   └── [5 more]
│
├── middleware/              # 4 route middleware
│   ├── 01.redirect.global.ts
│   ├── 02.security.global.ts
│   ├── 03.auth.global.ts
│   └── 04.payment.global.ts
│
├── plugins/                 # 20+ Nuxt plugins
│   ├── a.dayjs.ts           # Date/time setup
│   ├── a.i18n.ts            # i18n initialization
│   ├── a.socket.ts          # WebSocket setup
│   ├── ant.ts               # Ant Design Vue
│   ├── api.ts               # API instance setup
│   ├── error-handler.ts
│   ├── error-reporting.ts   # Sentry
│   ├── event-bus.ts
│   ├── state.ts             # Global state initialization
│   └── [more...]
│
├── utils/                   # 66 utility files
│   ├── errorUtils.ts
│   ├── formValidations.ts
│   ├── datetimeUtils.ts
│   ├── urlUtils.ts
│   ├── storageUtils.ts
│   └── [60+ more]
│
├── lib/                     # Shared libraries
│   ├── acl.ts               # Access control logic
│   ├── constants.ts         # App constants
│   ├── enums.ts
│   ├── types.ts
│   └── [more...]
│
├── lang/                    # 42+ language files (i18n)
│   ├── en.json
│   ├── es.json
│   └── [40+ languages]
│
├── ee/                      # Enterprise Edition (mirrors CE)
│   ├── components/          # 17 categories
│   ├── composables/         # EE composable extensions
│   ├── store/               # 10 store extensions
│   ├── pages/               # EE-only pages
│   ├── plugins/
│   └── [mirrors CE structure]
│
├── nuxt.config.ts           # Nuxt 3 configuration
├── package.json
└── tsconfig.json
```

## Component Architecture

### Component Categories

**31 component categories**, ~217 total components:

| Category | Purpose | Example Files |
|----------|---------|---------------|
| `cell/` | Table cell renderers | Email, Checkbox, Rating, Attachment editors |
| `smartsheet/` | Grid/spreadsheet views | Grid, Toolbar, Sidebar |
| `webhook/` | Webhook management | WebhookV2.vue, CallLog/ |
| `dlg/` | Modal dialogs | InviteDlg.vue, WorkspaceDelete.vue |
| `dashboard/` | Dashboard components | TreeView, Sidebar |
| `general/` | Reusable UI elements | DeleteModal, ColorPicker |
| `nc/` & `n/` | Design system | Button, Input, Modal, Spinner |

### Component Naming Convention

- **PascalCase.vue** for components: `MyComponent.vue`
- **index.vue** for directory components: `components/webhook/CallLog/index.vue`

**Example paths**:
- `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/components/webhook/WebhookV2.vue`
- `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/components/dlg/InviteDlg.vue`
- `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/components/smartsheet/Grid.vue`

### Component Pattern

```vue
<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'

interface Props {
  table: TableType
  view?: ViewType
}

const props = withDefaults(defineProps<Props>(), {
  view: undefined
})

interface Emits {
  (e: 'update:view', value: ViewType): void
  (e: 'delete'): void
}

const emit = defineEmits<Emits>()

// Use composables
const { api } = useApi()
const { t } = useI18n()

// Local state
const isLoading = ref(false)

// Methods
async function loadData() {
  isLoading.value = true
  try {
    const data = await api.dbTable.read(props.table.id)
    // Handle data
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="nc-my-component">
    <!-- Component template -->
  </div>
</template>

<style scoped>
.nc-my-component {
  /* Styles with .nc- prefix */
}
</style>
```

## State Management (Pinia)

### Store Organization

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/store/`

**24 Pinia stores**:

| Store | File | Purpose |
|-------|------|---------|
| bases | `bases.ts` | Bases/projects list, active project |
| base | `base.ts` | Current base state and details |
| views | `views.ts` | Views management (40KB - largest store) |
| tables | `tables.ts` | Tables and column management |
| workspace | `workspace.ts` | Workspace context and state |
| sidebar | `sidebar.ts` | Sidebar UI state |
| webhooks | `webhooks.ts` | Webhook configurations |
| notification | `notification.ts` | Notification queue and state |
| users | `users.ts` | User management |
| config | `config.ts` | Global configuration |
| dashboard | `dashboard.ts` | Dashboard state |
| script | `script.ts` | Script/automation state |
| workflow | `workflow.ts` | Workflow state |

### Store Pattern

```typescript
// store/bases.ts
import { defineStore } from 'pinia'
import type { BaseType } from 'nocodb-sdk'

export const useBasesStore = defineStore('basesStore', () => {
  const { api } = useApi()

  // State
  const bases = ref<Map<string, BaseType>>(new Map())
  const activeBaseId = ref<string | null>(null)

  // Getters
  const basesList = computed(() => Array.from(bases.value.values()))
  const activeBase = computed(() =>
    activeBaseId.value ? bases.value.get(activeBaseId.value) : null
  )

  // Actions
  async function loadBases() {
    const list = await api.base.list()
    bases.value = new Map(list.map(b => [b.id, b]))
  }

  async function createBase(data: Partial<BaseType>) {
    const newBase = await api.base.create(data)
    bases.value.set(newBase.id, newBase)
    return newBase
  }

  return {
    bases,
    basesList,
    activeBase,
    loadBases,
    createBase
  }
})
```

### Store Usage in Components

```typescript
// In component
const basesStore = useBasesStore()

// Access state
const bases = computed(() => basesStore.basesList)

// Call actions
await basesStore.loadBases()
await basesStore.createBase({ title: 'New Base' })
```

## Composables

### Composable Organization

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/`

**104 composable files**:
- 79 top-level `.ts` files
- 25+ subdirectories with index.ts

### Key Composables

#### useApi (API Integration)

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/useApi/index.ts`

```typescript
const { api, isLoading, error } = useApi()

// api is typed Api class from nocodb-sdk
const tables = await api.dbTable.list(baseId)
const columns = await api.dbTableColumn.list(tableId)
```

Features:
- Axios-based API client
- Loading state tracking
- Error hooks
- Response hooks
- Token refresh interceptors

#### useGlobal (Global State)

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/useGlobal/index.ts`

```typescript
const {
  user,
  token,
  appInfo,
  signOut,
  signIn,
  theme
} = useGlobal()
```

Global app state using `createGlobalState`.

#### Injection State Pattern

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/useInjectionState/`

Custom helper for tree-scoped state:

```typescript
// Define
const [useProvideSmartsheetStore, useSmartsheetStore] = useInjectionState(
  (table: Ref<TableType>) => {
    const data = ref([])
    const loadData = async () => { ... }
    return { data, loadData }
  }
)

// Provide (in parent)
const smartsheetStore = useProvideSmartsheetStore(tableRef)

// Inject (in children)
const smartsheetStore = useSmartsheetStore() // or useSmartsheetStoreOrThrow()
```

#### Common Composables

| Composable | Purpose |
|------------|---------|
| `useAttachment.ts` | File attachment handling |
| `useColors.ts` | Color utilities |
| `useCopy.ts` | Clipboard operations |
| `useData.ts` | Data loading and transformation |
| `useDialog/` | Dialog state management |
| `useCommandPalette/` | Command palette |
| `useMultiSelect.ts` | Multi-selection logic |
| `useSidebar.ts` | Sidebar state |
| `useRoles.ts` | Permission checking |
| `useUndoRedo.ts` | Undo/redo functionality |

## CE/EE Separation

### EE Directory Structure

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/ee/`

Mirrors CE structure:

```
ee/
├── components/              # 17 categories (component overrides)
│   ├── account/
│   ├── actions/
│   ├── admin/               # EE-specific
│   ├── payment/             # EE-specific
│   ├── scripts/             # EE-specific
│   └── [14 more]
│
├── store/                   # 10 store extensions
│   ├── bases.ts             # Extends CE bases
│   ├── workspace.ts
│   ├── workflow.ts
│   └── [7 more]
│
├── composables/             # Composable extensions
├── pages/                   # EE-only pages
├── helpers/
├── lib/
├── utils/
├── plugins/
└── assets/
```

### EE Extension Pattern

**Store Extension** (`ee/store/bases.ts`):
```typescript
export const useBasesStore = defineStore('basesStore', () => {
  // Include all CE functionality
  const { api } = useApi()

  // Add EE-specific state/methods
  const basesTeams = ref<Map<string, TeamType[]>>(new Map())

  async function loadBasesWithTeams() {
    // EE-specific logic
  }

  return { /* CE exports */, basesTeams, loadBasesWithTeams }
})
```

**Component Override**:
- CE placeholder: `<template><span></span></template>`
- EE implements full component
- Conditional rendering: `v-if="isUIAllowed('eeFeature')"`

### Build Resolution

Nuxt config handles EE/CE resolution:
- EE build: EE files override CE files with same path
- CE build: Only CE files used
- Path aliases: `~/*` and `@/*` resolve correctly

## API Integration Patterns

### Calling Backend APIs

```typescript
// In composable or component
const { api } = useApi()
const { t } = useI18n()

try {
  // Typed API call (from nocodb-sdk)
  const response = await api.dbTable.create(baseId, {
    title: 'My Table',
    table_name: 'my_table'
  })

  message.success(t('msg.success.tableCreated'))
  return response
} catch (e: any) {
  const errorMsg = await extractSdkResponseErrorMsg(e)
  message.error(errorMsg)
}
```

### Type Imports

```typescript
import type {
  BaseType,
  TableType,
  ColumnType,
  ViewType,
  FilterType,
  SortType,
  Api
} from 'nocodb-sdk'
```

All types come from `nocodb-sdk` package.

## Routing & Navigation

### Pages

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/pages/`

Key pages:
- `index.vue` - Home/dashboard
- `index/[typeOrId].vue` - Dynamic routes
- `signin.vue` - Sign in page
- `signup/` - Sign up flow
- `account/` - Account settings
- `projects/` - Projects list

### Middleware

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/middleware/`

**4 global middleware** (run in order):

| File | Purpose |
|------|---------|
| `01.redirect.global.ts` | Route redirection logic |
| `02.security.global.ts` | Security checks |
| `03.auth.global.ts` | Authentication verification |
| `04.payment.global.ts` | Payment/subscription checks |

### Layouts

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/layouts/`

**8 layout templates**:
- `dashboard.vue` - Main dashboard layout
- `shared-view.vue` - Shared view layout
- `base.vue` - Base layout
- `default.vue` - Default layout

## Plugins

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/plugins/`

**20+ Nuxt plugins**:

| Plugin | Purpose |
|--------|---------|
| `a.dayjs.ts` | Date/time library setup |
| `a.i18n.ts` | i18n initialization |
| `a.socket.ts` | WebSocket connections |
| `ant.ts` | Ant Design Vue setup |
| `api.ts` | Global API instance |
| `state.ts` | Global state initialization |
| `error-handler.ts` | Error handling |
| `error-reporting.ts` | Sentry setup |
| `event-bus.ts` | Event bus |
| `tele.ts` | Telemetry |

## Configuration

### Nuxt Config

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/nuxt.config.ts`

Key settings:
- **SSR**: `false` (SPA only)
- **Router**: Hash mode enabled
- **Modules**: VueUse, WindiCSS, Nuxt Image, Pinia, Chatwoot
- **Auto-imports**: Components, composables, stores automatically imported
- **Build**: Vite with plugins (VueI18n, Icons, Ant Design resolver)

## Utilities

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/utils/`

**66 utility files**:

| Utility | Purpose |
|---------|---------|
| `errorUtils.ts` | Error handling helpers |
| `formValidations.ts` | Form validation rules |
| `datetimeUtils.ts` | Date/time formatting |
| `urlUtils.ts` | URL manipulation |
| `storageUtils.ts` | Local storage helpers |
| `colorsUtils.ts` | Color utilities |
| `domUtils.ts` | DOM manipulation |

## Library Files

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/lib/`

Key files:
- `acl.ts` - Access control logic (UI permissions)
- `constants.ts` - App constants
- `enums.ts` - Frontend enums
- `types.ts` - Frontend-specific types
- `form.ts` - Form utilities

## Internationalization

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/lang/`

**42+ language files**: en.json, es.json, fr.json, de.json, ja.json, etc.

Usage:
```typescript
const { t } = useI18n()
const label = t('labels.save')
const message = t('msg.success.created')
```

Key structure:
- `labels.*` - UI labels
- `msg.success.*` - Success messages
- `msg.error.*` - Error messages
- `placeholder.*` - Input placeholders
- `tooltip.*` - Tooltips

## CSS & Styling

### WindiCSS

Utility-first CSS framework (similar to Tailwind).

### Component Styles

Scoped styles with `.nc-` prefix:
```vue
<style scoped>
.nc-my-component {
  /* Component-specific styles */
}
</style>
```

### SCSS

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/assets/scss/`

Global SCSS files for theme and common styles.

## State Flow Example

### Loading and Displaying Bases

```
1. Component mounts
   ↓
2. useBasesStore() (Pinia store)
   ↓
3. loadBases() action
   ↓
4. useApi() composable
   ↓
5. api.base.list() (nocodb-sdk Api class)
   ↓
6. HTTP request to backend /api/v2/meta/bases/
   ↓
7. Backend BasesController → BasesService → Base model
   ↓
8. Response back to frontend
   ↓
9. Store updates bases state
   ↓
10. Component reactively updates (computed properties)
```

## See Also

- [Common Patterns](./common-patterns.md) - Frontend pattern examples
- [SDK & Types](./sdk-and-types.md) - Type system and imports
- [Key File Locations](./key-file-locations.md) - Important file paths
