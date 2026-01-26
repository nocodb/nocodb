---
name: nocohub-frontend
description: |
  NocoDB Enterprise frontend development for Vue 3 + Nuxt 3 applications.
  MANDATORY TRIGGERS: frontend, component, vue, nuxt, composable, store, pinia, ui, page, widget, modal, dialog, sidebar
  Use when: (1) Creating new Vue components, (2) Building composables, (3) Working with Pinia stores, (4) Creating pages/layouts, (5) Working with EE frontend extensions, (6) UI/UX features
---

# NocoDB Frontend Development

## Architecture Overview

NocoDB's frontend is a **Nuxt 3 + Vue 3** application in `packages/nc-gui/`:

```
packages/nc-gui/
├── components/          # 33 component directories (~500+ components)
├── composables/         # 79 composables (state, API, utilities)
├── store/              # 24 Pinia stores
├── pages/              # Route pages
├── layouts/            # Page layouts
├── plugins/            # Nuxt plugins
├── utils/              # Utility functions
├── lang/               # i18n (42+ languages)
├── assets/             # Static assets, SCSS
├── lib/                # Shared libraries
└── ee/                 # Enterprise Edition extensions (mirrors CE structure)
```

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vue** | 3.5.13 | Composition API |
| **Nuxt** | 3.17.4 | Meta-framework |
| **TypeScript** | 5.8.3 | Type safety |
| **Pinia** | Latest | State management |
| **Ant Design Vue** | 4.x | UI component library |
| **WindiCSS** | - | Utility-first CSS |
| **VueUse** | - | Composable utilities |
| **nocodb-sdk** | workspace | API types & client |

## CE/EE Separation

Enterprise code lives in `packages/nc-gui/ee/` which **mirrors the CE structure**:

```
nc-gui/
├── components/SomeComponent.vue    # CE version (may be empty placeholder)
├── composables/useFeature.ts       # CE version
└── ee/
    ├── nuxt.config.ts              # extends: ['../']
    ├── components/SomeComponent.vue # EE override (full implementation)
    └── composables/useFeature.ts    # EE override with extra features
```

**Resolution Rules:**
- EE files override CE files with same path
- CE files serve as fallbacks
- Build with `pnpm build:ee` or `pnpm dev:ee`

## Development Workflows

### Workflow 1: Create a Component

1. **Determine component location**
   ```
   components/
   ├── cell/           # Cell renderers (grid, form)
   ├── dashboard/      # Dashboard UI
   ├── dlg/            # Dialog/modals
   ├── general/        # Reusable components
   ├── nc/             # NocoDB design system
   ├── smartsheet/     # Table views
   ├── tabs/           # Tab components
   ├── virtual-cell/   # Virtual column cells
   └── workspace/      # Workspace UI
   ```

2. **Create component file** (`components/{category}/MyComponent.vue`)
   ```vue
   <script lang="ts" setup>
   import type { SomeType } from 'nocodb-sdk'

   const props = withDefaults(
     defineProps<{
       modelValue: string
       disabled?: boolean
     }>(),
     { disabled: false }
   )

   const emit = defineEmits<{
     'update:modelValue': [value: string]
     'change': [value: string]
   }>()

   // Composables
   const { t } = useI18n()
   const { api } = useApi()

   // State
   const localValue = ref(props.modelValue)

   // Computed
   const isValid = computed(() => localValue.value.length > 0)

   // Methods
   const handleChange = (value: string) => {
     localValue.value = value
     emit('update:modelValue', value)
     emit('change', value)
   }

   // Lifecycle
   onMounted(() => {
     // initialization
   })
   </script>

   <template>
     <div class="nc-my-component">
       <a-input
         v-model:value="localValue"
         :disabled="disabled"
         :placeholder="t('placeholder.enterValue')"
         @change="handleChange"
       />
     </div>
   </template>

   <style lang="scss" scoped>
   .nc-my-component {
     @apply flex items-center gap-2;
   }
   </style>
   ```

3. **For EE-only component**, create placeholder in CE:
   ```vue
   <!-- components/dashboard/MyEEFeature.vue (CE) -->
   <template>
     <span></span>
   </template>
   ```

   Then implement in EE:
   ```vue
   <!-- ee/components/dashboard/MyEEFeature.vue -->
   <script lang="ts" setup>
   // Full EE implementation
   </script>

   <template>
     <!-- EE UI -->
   </template>
   ```

### Workflow 2: Create a Composable

1. **Choose composable type**

   | Type | Pattern | Use Case |
   |------|---------|----------|
   | Simple utility | Regular export | Stateless helpers |
   | Injection state | `useInjectionState` | Component tree state |
   | Global state | `createGlobalState` | App-wide singleton |

2. **Simple composable** (`composables/useMyFeature.ts`)
   ```typescript
   import type { ComputedRef, Ref } from 'vue'
   import type { TableType } from 'nocodb-sdk'

   export function useMyFeature(table: Ref<TableType | undefined>) {
     const { api } = useApi()
     const { t } = useI18n()

     const isLoading = ref(false)
     const error = ref<string | null>(null)
     const data = ref<any[]>([])

     const isEmpty = computed(() => data.value.length === 0)

     const fetchData = async () => {
       if (!table.value?.id) return

       isLoading.value = true
       error.value = null

       try {
         data.value = await api.dbTable.list(table.value.id)
       } catch (e: any) {
         error.value = e.message
         message.error(t('msg.error.fetchFailed'))
       } finally {
         isLoading.value = false
       }
     }

     const reset = () => {
       data.value = []
       error.value = null
     }

     // Auto-fetch when table changes
     watch(table, fetchData, { immediate: true })

     return {
       isLoading: readonly(isLoading),
       error: readonly(error),
       data: readonly(data),
       isEmpty,
       fetchData,
       reset,
     }
   }
   ```

3. **Injection state composable** (`composables/useMyStore/index.ts`)
   ```typescript
   import type { Ref } from 'vue'
   import type { TableType, ViewType } from 'nocodb-sdk'

   const [useProvideMyStore, useMyStore] = useInjectionState(
     (
       table: Ref<TableType | undefined>,
       view: Ref<ViewType | undefined>,
     ) => {
       const { api } = useApi()

       // State
       const items = ref<any[]>([])
       const selectedId = ref<string | null>(null)

       // Computed
       const selectedItem = computed(() =>
         items.value.find(item => item.id === selectedId.value)
       )

       // Actions
       const loadItems = async () => {
         if (!table.value?.id) return
         items.value = await api.dbTableRow.list(table.value.id)
       }

       const selectItem = (id: string) => {
         selectedId.value = id
       }

       // Watch for table changes
       watch(table, loadItems, { immediate: true })

       return {
         items: readonly(items),
         selectedId,
         selectedItem,
         loadItems,
         selectItem,
       }
     },
     'my-store',
   )

   export { useProvideMyStore }

   export function useMyStoreOrThrow() {
     const store = useMyStore()
     if (!store) {
       throw new Error('Please call `useProvideMyStore` on the appropriate parent component')
     }
     return store
   }
   ```

4. **Global state composable** (`composables/useGlobalFeature.ts`)
   ```typescript
   export const useGlobalFeature = createGlobalState(() => {
     const storage = useStorage('nc-feature-settings', {
       enabled: false,
       theme: 'light',
     })

     const enabled = toRef(storage.value, 'enabled')
     const theme = toRef(storage.value, 'theme')

     const toggle = () => {
       enabled.value = !enabled.value
     }

     return {
       enabled,
       theme,
       toggle,
     }
   })
   ```

### Workflow 3: Create a Pinia Store

1. **Create store file** (`store/myFeature.ts`)
   ```typescript
   import type { BaseType, TableType } from 'nocodb-sdk'
   import { acceptHMRUpdate, defineStore } from 'pinia'

   export const useMyFeatureStore = defineStore('myFeatureStore', () => {
     const { api } = useApi()
     const router = useRouter()
     const route = router.currentRoute

     // State
     const items = ref<TableType[]>([])
     const isLoading = ref(false)
     const currentId = ref<string | null>(null)

     // Computed
     const currentItem = computed(() =>
       items.value.find(item => item.id === currentId.value)
     )

     const itemCount = computed(() => items.value.length)

     const sortedItems = computed(() =>
       [...items.value].sort((a, b) => a.title.localeCompare(b.title))
     )

     // Actions
     async function loadItems(baseId: string) {
       isLoading.value = true
       try {
         const response = await api.dbTable.list(baseId)
         items.value = response.list || []
       } catch (e) {
         console.error('Failed to load items:', e)
         message.error('Failed to load items')
       } finally {
         isLoading.value = false
       }
     }

     async function createItem(baseId: string, data: Partial<TableType>) {
       const newItem = await api.dbTable.create(baseId, data)
       items.value.push(newItem)
       return newItem
     }

     async function updateItem(tableId: string, data: Partial<TableType>) {
       const updated = await api.dbTable.update(tableId, data)
       const index = items.value.findIndex(item => item.id === tableId)
       if (index !== -1) {
         items.value[index] = { ...items.value[index], ...updated }
       }
       return updated
     }

     async function deleteItem(tableId: string) {
       await api.dbTable.delete(tableId)
       items.value = items.value.filter(item => item.id !== tableId)
     }

     function setCurrentId(id: string | null) {
       currentId.value = id
     }

     function reset() {
       items.value = []
       currentId.value = null
       isLoading.value = false
     }

     // Watchers
     watch(
       () => route.value.params.baseId,
       (baseId) => {
         if (baseId && typeof baseId === 'string') {
           loadItems(baseId)
         } else {
           reset()
         }
       },
       { immediate: true }
     )

     return {
       // State
       items: readonly(items),
       isLoading: readonly(isLoading),
       currentId,

       // Computed
       currentItem,
       itemCount,
       sortedItems,

       // Actions
       loadItems,
       createItem,
       updateItem,
       deleteItem,
       setCurrentId,
       reset,
     }
   })

   // HMR support
   if (import.meta.hot) {
     import.meta.hot.accept(acceptHMRUpdate(useMyFeatureStore as any, import.meta.hot))
   }
   ```

2. **Use store in component**
   ```vue
   <script lang="ts" setup>
   const store = useMyFeatureStore()
   const { items, isLoading, currentItem } = storeToRefs(store)

   const handleSelect = (id: string) => {
     store.setCurrentId(id)
   }
   </script>
   ```

### Workflow 4: Create a Page

1. **Create page file** (`pages/myFeature/index.vue`)
   ```vue
   <script lang="ts" setup>
   definePageMeta({
     layout: 'dashboard',
     middleware: ['auth'],
   })

   const route = useRoute()
   const { t } = useI18n()

   const featureId = computed(() => route.params.featureId as string)

   // Provide state for child components
   useProvideMyStore(featureId)
   </script>

   <template>
     <div class="nc-my-feature-page">
       <NcPageHeader :title="t('title.myFeature')" />

       <div class="nc-my-feature-content">
         <MyFeatureSidebar />
         <MyFeatureMain />
       </div>
     </div>
   </template>

   <style lang="scss" scoped>
   .nc-my-feature-page {
     @apply h-full flex flex-col;
   }

   .nc-my-feature-content {
     @apply flex-1 flex overflow-hidden;
   }
   </style>
   ```

2. **For EE pages**, add to `ee/pages/`

### Workflow 5: Create EE Extension

1. **Identify CE file to extend**
2. **Create mirrored path in `ee/`**
3. **Import CE utilities, extend functionality**

Example - Extending a composable:

```typescript
// ee/composables/useMyFeature.ts
import { useMyFeature as useMyFeatureCE } from '~/composables/useMyFeature'

export function useMyFeature(table: Ref<TableType | undefined>) {
  // Get CE functionality
  const ceFeature = useMyFeatureCE(table)

  // Add EE functionality
  const { api } = useApi()

  const eeData = ref<any[]>([])

  const fetchEEData = async () => {
    eeData.value = await api.ee.getData(table.value?.id)
  }

  return {
    ...ceFeature,
    // EE additions
    eeData: readonly(eeData),
    fetchEEData,
  }
}
```

## Key Patterns

### Component Patterns

```vue
<!-- Typed props with defaults -->
<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    value: string
    disabled?: boolean
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    disabled: false,
    size: 'medium',
  }
)
</script>

<!-- v-model support -->
<script lang="ts" setup>
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const localValue = useVModel(props, 'modelValue', emit)
</script>

<!-- Provide/Inject -->
<script lang="ts" setup>
// Provider
const data = ref({ ... })
provide(MyDataInjectionKey, data)

// Consumer
const data = inject(MyDataInjectionKey, ref(defaultValue))
</script>
```

### API Integration

```typescript
// Using useApi composable
const { api, isLoading } = useApi()

// API calls with nocodb-sdk types
const tables = await api.dbTable.list(baseId)
const row = await api.dbTableRow.read(tableId, rowId)
await api.dbTableRow.create(tableId, { ...data })
await api.dbTableRow.update(tableId, rowId, { ...updates })
await api.dbTableRow.delete(tableId, rowId)
```

### Styling Patterns

```vue
<style lang="scss" scoped>
// WindiCSS utilities via @apply
.nc-component {
  @apply flex items-center gap-2 p-4;
  @apply bg-white dark:bg-gray-900;
  @apply border border-gray-200 rounded-lg;
  @apply hover:shadow-md transition-shadow;
}

// Ant Design overrides
:deep(.ant-btn) {
  @apply rounded-md;
}

// Theme-aware colors
.nc-text {
  @apply text-gray-700 dark:text-gray-300;
}
</style>
```

### i18n Usage

```typescript
const { t } = useI18n()

// Simple translation
t('labels.save')

// With interpolation
t('msg.success.created', { name: item.name })

// Plural
t('labels.items', { count: items.length })
```

## Common Composables

| Composable | Purpose |
|------------|---------|
| `useApi()` | API client with loading state |
| `useGlobal()` | Global app state (user, token, settings) |
| `useBase()` | Current base/project context |
| `useTable()` | Current table context |
| `useView()` | Current view context |
| `useI18n()` | Internationalization |
| `useDialog()` | Dialog/modal management |
| `useRoles()` | Permission checking |
| `useUndoRedo()` | Undo/redo functionality |
| `useClipboard()` | Clipboard operations |

## Build & Development

```bash
# Development
cd packages/nc-gui
pnpm dev           # CE development
pnpm dev:ee        # EE development

# Build
pnpm build         # CE build
pnpm build:ee      # EE build

# Type check
pnpm typecheck

# Lint
pnpm lint
pnpm lint:fix
```

## Reference Files

- **Component Patterns**: See [references/component-patterns.md](references/component-patterns.md)
- **Composable Patterns**: See [references/composable-patterns.md](references/composable-patterns.md)
- **Store Patterns**: See [references/store-patterns.md](references/store-patterns.md)

## Quick Scaffolding

```bash
# Use the scaffolder
python .skills/nocohub-frontend/scripts/scaffold-component.py MyComponent --category dashboard
python .skills/nocohub-frontend/scripts/scaffold-component.py MyEEFeature --category dashboard --ee
python .skills/nocohub-frontend/scripts/scaffold-composable.py useMyFeature --type injection
python .skills/nocohub-frontend/scripts/scaffold-store.py myFeature
```
