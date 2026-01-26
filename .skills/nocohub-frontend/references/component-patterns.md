# Component Patterns Reference

Complete Vue 3 component patterns for NocoDB frontend development.

## Basic Component Structure

```vue
<script lang="ts" setup>
import type { TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

// Props with TypeScript interface
const props = withDefaults(
  defineProps<{
    modelValue: string
    table: TableType
    disabled?: boolean
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    disabled: false,
    size: 'medium',
  }
)

// Typed emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string, oldValue: string]
  'submit': []
}>()

// Composables (auto-imported)
const { t } = useI18n()
const { api, isLoading } = useApi()
const { isUIAllowed } = useRoles()

// Refs
const inputRef = ref<HTMLInputElement>()
const localValue = ref(props.modelValue)

// Computed
const isValid = computed(() => localValue.value.length > 0)
const canEdit = computed(() => !props.disabled && isUIAllowed('dataEdit'))

// Methods
const handleSubmit = async () => {
  if (!isValid.value) return

  try {
    await api.dbTableRow.update(props.table.id!, rowId, { field: localValue.value })
    emit('submit')
    message.success(t('msg.success.updated'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Watchers
watch(() => props.modelValue, (newVal) => {
  localValue.value = newVal
})

// Lifecycle
onMounted(() => {
  inputRef.value?.focus()
})

// Expose for parent access (optional)
defineExpose({
  focus: () => inputRef.value?.focus(),
  validate: () => isValid.value,
})
</script>

<template>
  <div class="nc-my-component" :class="{ 'is-disabled': disabled }">
    <a-input
      ref="inputRef"
      v-model:value="localValue"
      :disabled="disabled"
      :placeholder="t('placeholder.enterValue')"
      @pressEnter="handleSubmit"
    />
    <NcButton
      :disabled="!isValid || disabled"
      :loading="isLoading"
      type="primary"
      size="small"
      @click="handleSubmit"
    >
      {{ t('general.save') }}
    </NcButton>
  </div>
</template>

<style lang="scss" scoped>
.nc-my-component {
  @apply flex items-center gap-2;

  &.is-disabled {
    @apply opacity-50 pointer-events-none;
  }
}
</style>
```

## v-model Support Patterns

### Single v-model

```vue
<script lang="ts" setup>
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Using useVModel from VueUse
const localValue = useVModel(props, 'modelValue', emit)
</script>

<template>
  <a-input v-model:value="localValue" />
</template>
```

### Multiple v-models

```vue
<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  title: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:title': [value: string]
}>()

const isVisible = useVModel(props, 'visible', emit)
const localTitle = useVModel(props, 'title', emit)
</script>

<template>
  <a-modal v-model:open="isVisible" :title="localTitle">
    <a-input v-model:value="localTitle" />
  </a-modal>
</template>
```

## Provide/Inject Pattern

### Provider Component

```vue
<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  baseRole: string
}>()

// Convert props to refs for reactivity
const baseRef = toRef(props, 'base')
const baseRoleRef = toRef(props, 'baseRole')

// Provide to descendants
provide(ProjectInj, baseRef)
provide(ProjectRoleInj, baseRoleRef)
</script>

<template>
  <slot />
</template>
```

### Consumer Component

```vue
<script lang="ts" setup>
// Inject with default value
const base = inject(ProjectInj, ref({}))
const baseRole = inject(ProjectRoleInj, ref(''))

// With type assertion
const base = inject(ProjectInj)!
</script>
```

### Injection Keys (define in composables)

```typescript
// composables/injectionKeys.ts
import type { InjectionKey, Ref } from 'vue'
import type { BaseType, TableType, ViewType } from 'nocodb-sdk'

export const ProjectInj: InjectionKey<Ref<BaseType>> = Symbol('project-injection')
export const TableInj: InjectionKey<Ref<TableType>> = Symbol('table-injection')
export const ViewInj: InjectionKey<Ref<ViewType>> = Symbol('view-injection')
```

## Slot Patterns

### Named Slots with Props

```vue
<script lang="ts" setup>
const items = ref([{ id: 1, name: 'Item 1' }])
const selectedId = ref<number | null>(null)

const selectItem = (id: number) => {
  selectedId.value = id
}
</script>

<template>
  <div class="nc-list">
    <slot name="header" :count="items.length">
      <span>{{ items.length }} items</span>
    </slot>

    <div v-for="item in items" :key="item.id">
      <slot name="item" :item="item" :selected="item.id === selectedId" :select="selectItem">
        <span>{{ item.name }}</span>
      </slot>
    </div>

    <slot name="empty" v-if="items.length === 0">
      <span>No items</span>
    </slot>
  </div>
</template>
```

### Using Slots

```vue
<template>
  <MyList>
    <template #header="{ count }">
      <h2>Total: {{ count }}</h2>
    </template>

    <template #item="{ item, selected, select }">
      <div :class="{ selected }" @click="select(item.id)">
        {{ item.name }}
      </div>
    </template>

    <template #empty>
      <EmptyState message="No items found" />
    </template>
  </MyList>
</template>
```

## Dialog/Modal Pattern

```vue
<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  tableId: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'success': [data: any]
}>()

const { t } = useI18n()
const { api } = useApi()

const isVisible = useVModel(props, 'visible', emit)
const formState = ref({ name: '', description: '' })
const isSubmitting = ref(false)

const handleSubmit = async () => {
  isSubmitting.value = true
  try {
    const result = await api.dbTable.update(props.tableId, formState.value)
    emit('success', result)
    isVisible.value = false
    message.success(t('msg.success.updated'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSubmitting.value = false
  }
}

const handleCancel = () => {
  isVisible.value = false
}

// Reset form when dialog opens
watch(isVisible, (visible) => {
  if (visible) {
    formState.value = { name: '', description: '' }
  }
})
</script>

<template>
  <NcModal v-model:visible="isVisible" :title="t('title.editTable')" size="medium">
    <a-form :model="formState" layout="vertical">
      <a-form-item :label="t('labels.name')" name="name">
        <a-input v-model:value="formState.name" />
      </a-form-item>
      <a-form-item :label="t('labels.description')" name="description">
        <a-textarea v-model:value="formState.description" :rows="3" />
      </a-form-item>
    </a-form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <NcButton type="secondary" @click="handleCancel">
          {{ t('general.cancel') }}
        </NcButton>
        <NcButton type="primary" :loading="isSubmitting" @click="handleSubmit">
          {{ t('general.save') }}
        </NcButton>
      </div>
    </template>
  </NcModal>
</template>
```

## Async Component with Suspense

```vue
<script lang="ts" setup>
// Async setup - component will suspend
const { api } = useApi()
const route = useRoute()

const tableId = computed(() => route.params.tableId as string)

// Top-level await in setup
const tableData = await api.dbTable.read(tableId.value)
</script>

<template>
  <div>{{ tableData.title }}</div>
</template>
```

Parent usage:

```vue
<template>
  <Suspense>
    <AsyncComponent />
    <template #fallback>
      <NcLoading />
    </template>
  </Suspense>
</template>
```

## Teleport Pattern

```vue
<template>
  <div>
    <button @click="showPopover = true">Open</button>

    <Teleport to="body">
      <div v-if="showPopover" class="nc-popover">
        <slot />
      </div>
    </Teleport>
  </div>
</template>
```

## Transition Patterns

```vue
<template>
  <Transition name="fade" mode="out-in">
    <component :is="currentComponent" :key="componentKey" />
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

## List Rendering with TransitionGroup

```vue
<template>
  <TransitionGroup name="list" tag="ul">
    <li v-for="item in items" :key="item.id">
      {{ item.name }}
    </li>
  </TransitionGroup>
</template>

<style>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>
```

## EE Component Override Pattern

### CE Placeholder

```vue
<!-- components/feature/EEFeature.vue -->
<template>
  <span></span>
</template>
```

### EE Implementation

```vue
<!-- ee/components/feature/EEFeature.vue -->
<script lang="ts" setup>
import type { Api } from 'nocodb-sdk'

const { isUIAllowed } = useRoles()
const { user } = useGlobal()
const { api } = useApi()

const eeData = ref<any[]>([])

const loadEEData = async () => {
  eeData.value = await (api as Api<any>).ee.getData()
}

onMounted(loadEEData)
</script>

<template>
  <div v-if="isUIAllowed('eeFeature')" class="nc-ee-feature">
    <div v-for="item in eeData" :key="item.id">
      {{ item.name }}
    </div>
  </div>
</template>
```

## Performance Patterns

### Lazy Component Loading

```vue
<script lang="ts" setup>
const HeavyComponent = defineAsyncComponent(() =>
  import('./HeavyComponent.vue')
)
</script>

<template>
  <HeavyComponent v-if="showHeavy" />
</template>
```

### Computed Caching

```typescript
// Good - cached
const filteredItems = computed(() =>
  items.value.filter(item => item.active)
)

// Avoid - recalculates on every access
const getFilteredItems = () =>
  items.value.filter(item => item.active)
```

### watchEffect vs watch

```typescript
// Use watchEffect for side effects based on reactive deps
watchEffect(() => {
  console.log('Count is:', count.value)
})

// Use watch for specific source watching with old/new values
watch(count, (newVal, oldVal) => {
  console.log(`Changed from ${oldVal} to ${newVal}`)
})

// Use watch with immediate for initial run
watch(source, callback, { immediate: true })
```

## Common Component Props Interface

```typescript
// Frequently used prop patterns
interface CommonProps {
  // Loading state
  loading?: boolean

  // Disabled state
  disabled?: boolean

  // Size variants
  size?: 'small' | 'medium' | 'large' | 'xs' | 'xsmall'

  // Type variants
  type?: 'primary' | 'secondary' | 'danger' | 'warning' | 'text'

  // Placement
  placement?: 'top' | 'bottom' | 'left' | 'right'

  // Class passthrough
  class?: string | string[] | Record<string, boolean>
}
```
