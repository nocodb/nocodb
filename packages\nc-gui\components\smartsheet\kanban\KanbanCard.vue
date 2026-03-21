<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  coverImageField?: ColumnType
  isCompact?: boolean
  readOnly?: boolean
}>()

const emits = defineEmits<{
  (event: 'expand', row: Row): void
  (event: 'edit', row: Row): void
}>()

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())

const { row, fields, coverImageField, isCompact, readOnly } = toRefs(props)

const { isMobileMode } = useGlobal()

const rowData = computed(() => row.value?.row ?? {})

const coverImage = computed(() => {
  if (!coverImageField?.value) return undefined
  const val = rowData.value?.[coverImageField.value.title!]
  if (!val) return undefined
  try {
    const attachments = typeof val === 'string' ? JSON.parse(val) : val
    if (Array.isArray(attachments) && attachments.length > 0) {
      return attachments[0]?.signedPath || attachments[0]?.url
    }
  } catch {}
  return undefined
})

const visibleFields = computed(() => fields.value?.filter((f) => !f.hidden) ?? [])

function onExpand() {
  emits('expand', row.value)
}
</script>

<template>
  <div
    class="nc-kanban-card group relative cursor-pointer border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-bg shadow-sm hover:shadow-md transition-shadow duration-200"
    :class="{
      'nc-kanban-card-compact': isCompact,
      'nc-kanban-card-default': !isCompact,
    }"
    @click="onExpand"
  >
    <!-- Default (expanded) card view -->
    <template v-if="!isCompact">
      <!-- Cover Image -->
      <div v-if="coverImage" class="nc-kanban-card-cover overflow-hidden rounded-t-lg">
        <img
          :src="coverImage"
          class="w-full object-cover"
          style="max-height: 180px"
          alt="cover"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
      </div>

      <!-- Card Fields -->
      <div class="p-3 flex flex-col gap-2">
        <template v-for="field in visibleFields" :key="field.id">
          <div class="nc-kanban-cell flex flex-col gap-0.5">
            <span
              v-if="!field.pv && visibleFields.length > 1"
              class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide"
            >
              {{ field.title }}
            </span>
            <div class="nc-cell-wrapper">
              <LazySmartsheetCell
                :model-value="rowData[field.title!]"
                :column="field"
                :edit-enabled="false"
                :read-only="true"
                class="pointer-events-none"
              />
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Compact card view -->
    <template v-else>
      <div class="px-2 py-1 flex items-center gap-2 overflow-hidden min-h-[32px] max-h-[40px]">
        <template v-for="(field, idx) in visibleFields" :key="field.id">
          <div
            class="nc-cell-wrapper flex-shrink-0 overflow-hidden"
            :class="{
              'flex-grow': field.pv,
              'max-w-[120px]': !field.pv,
            }"
          >
            <LazySmartsheetCell
              :model-value="rowData[field.title!]"
              :column="field"
              :edit-enabled="false"
              :read-only="true"
              class="pointer-events-none !text-sm leading-tight truncate"
            />
          </div>
          <div
            v-if="idx < visibleFields.length - 1"
            class="flex-shrink-0 h-4 w-px bg-gray-200 dark:bg-gray-700"
          />
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nc-kanban-card-compact {
  @apply min-h-0;
}

.nc-kanban-card-default {
  @apply min-h-[60px];
}

.nc-kanban-cell :deep(.cell) {
  @apply !px-0;
}
</style>
