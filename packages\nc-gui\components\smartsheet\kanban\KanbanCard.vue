<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  coverImageField?: ColumnType | null
  isCompact?: boolean
  readOnly?: boolean
}>()

const emits = defineEmits<{
  (event: 'expand', row: Row): void
}>()

const { row, fields, coverImageField, isCompact, readOnly } = toRefs(props)

const { isMobileMode } = useGlobal()

const rowData = computed(() => row.value?.row ?? {})

const visibleFields = computed(() => {
  return (fields.value ?? []).filter((f) => !f.hidden)
})

const coverImageAttachments = computed(() => {
  if (!coverImageField?.value?.title) return []
  const val = rowData.value?.[coverImageField.value.title]
  if (!val) return []
  try {
    const attachments = typeof val === 'string' ? JSON.parse(val) : val
    return Array.isArray(attachments) ? attachments : []
  } catch {
    return []
  }
})

const coverImageUrl = computed(() => {
  if (!coverImageAttachments.value.length) return null
  const att = coverImageAttachments.value[0]
  return att?.signedPath || att?.url || null
})

function onExpand() {
  if (!readOnly?.value) {
    emits('expand', row.value)
  }
}
</script>

<template>
  <div
    class="nc-kanban-card group relative cursor-pointer border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-sm transition-all duration-150"
    :class="{
      'nc-kanban-card-compact hover:border-gray-400': isCompact,
      'nc-kanban-card-default hover:shadow-md': !isCompact,
    }"
    @click="onExpand"
  >
    <!-- Default view: stacked fields with cover image -->
    <template v-if="!isCompact">
      <!-- Cover image -->
      <div v-if="coverImageUrl" class="nc-kanban-card-cover overflow-hidden rounded-t-lg">
        <img
          :src="coverImageUrl"
          class="w-full object-cover rounded-t-lg"
          style="max-height: 180px"
          alt=""
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
      </div>

      <!-- Fields -->
      <div class="p-3 flex flex-col gap-2">
        <template v-for="field in visibleFields" :key="field.id">
          <div class="nc-kanban-field">
            <LazySmartsheetCell
              :model-value="rowData[field.title!]"
              :column="field"
              :edit-enabled="false"
              :read-only="true"
              class="pointer-events-none"
            />
          </div>
        </template>
      </div>
    </template>

    <!-- Compact view: all fields in a single row -->
    <template v-else>
      <div class="px-2 py-1.5 flex items-center gap-2 overflow-hidden" style="min-height: 36px">
        <template v-for="(field, fieldIdx) in visibleFields" :key="field.id">
          <!-- Divider between fields -->
          <div
            v-if="fieldIdx > 0"
            class="flex-shrink-0 self-stretch w-px bg-gray-200 dark:bg-gray-700 my-0.5"
          />
          <!-- Field cell -->
          <div
            class="nc-kanban-field flex-shrink-0 overflow-hidden text-sm leading-tight"
            :class="{
              'flex-grow min-w-0': field.pv,
              'max-w-[120px]': !field.pv,
            }"
          >
            <LazySmartsheetCell
              :model-value="rowData[field.title!]"
              :column="field"
              :edit-enabled="false"
              :read-only="true"
              class="pointer-events-none !text-sm"
            />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nc-kanban-card-compact .nc-kanban-field :deep(*) {
  line-height: 1.25 !important;
  font-size: 0.875rem !important;
}

.nc-kanban-field :deep(.cell) {
  @apply !px-0 !py-0;
}

.nc-kanban-field :deep(.cell-field) {
  @apply !py-0;
}
</style>
