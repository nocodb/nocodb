<script lang="ts" setup>
import { computed, h, inject, ref, resolveComponent, watch } from 'vue'
import { UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{ value: any }>()
const emit = defineEmits<{
  (e: 'update:value', v: any): void
}>()

const meta = inject<any>(MetaInj, ref())

// State to track selected columns
const triggerSet = ref<Set<string>>(new Set())

// Load from props -> local state
const loadFromProps = (arr?: string[]) => {
  triggerSet.value = new Set(arr ?? props.value?.colOptions?.triggerColumnIds ?? [])
}

// Commit local state -> emit (only if changed)
const commitIfChanged = () => {
  const next = Array.from(triggerSet.value)
  const prev = props.value?.colOptions?.triggerColumnIds ?? []

  // shallow compare arrays (order-insensitive)
  if (next.length === prev.length && next.every((x) => prev.includes(x))) return

  const nextValue = {
    ...props.value,
    colOptions: {
      ...(props.value?.colOptions ?? {}),
      triggerColumnIds: next,
    },
  }
  emit('update:value', nextValue)
}

// Helpers for checkbox binding
const isSelected = (id: string) => triggerSet.value.has(id)
const setSelected = (id: string, v: boolean) => {
  if (v) triggerSet.value.add(id)
  else triggerSet.value.delete(id)
  commitIfChanged()
}
const toggle = (id: string) => setSelected(id, !isSelected(id))

// Available columns for tracking
const availabletriggerColumnIds = computed(() => {
  const cols = meta.value?.columns ?? []
  return cols.filter(
    (col: any) => col.id !== props.value?.id && !isSystemColumn(col) && !isVirtualCol(col)
  )
})

// Icon
const getIcon = (field: any) =>
  h(isVirtualCol(field) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: field,
  })

// Sync from parent when its triggerColumnIds changes
watch(
  () => props.value?.colOptions?.triggerColumnIds,
  (arr) => loadFromProps(arr),
  { immediate: true },
)
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-gray-50">
    <a-form-item label="Columns to Track">
      <div class="text-xs text-gray-500 mb-2">
        Select which columns should trigger updates to this
        {{ props.value?.uidt === UITypes.LastModifiedTime ? 'timestamp' : 'user' }} field
      </div>

      <div class="border border-gray-200 rounded-md">
        <div class="border-y border-gray-200 min-h-25 py-1 nc-scrollbar-thin" style="scrollbar-gutter: stable">
          <div v-for="field in availabletriggerColumnIds" :key="field.id">
            <div
              :data-testid="`nc-last-modified-trigger-${field.title}`"
              class="px-1 py-1 mx-1 flex items-center rounded-md hover:bg-gray-100 cursor-pointer"
              @click.stop="toggle(field.id)"
            >
              <div class="flex items-center w-full truncate ml-1 py-0.5 pr-2">
                <component :is="getIcon(field)" class="w-3.5 h-3.5 text-gray-500" />
                <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only>
                  <template #title>{{ field.title }}</template>
                  <template #default>{{ field.title }}</template>
                </NcTooltip>

                <!-- Bind directly without a separate selectedFields object -->
                <NcCheckbox
                  :checked="isSelected(field.id)"
                  size="default"
                  @update:checked="(v:boolean) => setSelected(field.id, v)"
                  @click.stop
                />
              </div>
              <div class="flex-1" />
            </div>
          </div>
        </div>
      </div>
    </a-form-item>
  </div>
</template>
