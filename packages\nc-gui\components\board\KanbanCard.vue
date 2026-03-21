<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { IsPublicInj, MetaInj, ReloadViewDataHookInj, computed, inject, ref, useKanbanViewStore, useRoles } from '#imports'

interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: Record<string, any>
}

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  coverImageField?: ColumnType
  isCompact?: boolean
}>()

const emits = defineEmits(['expand'])

const { row, fields, coverImageField, isCompact } = toRefs(props)

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

function onExpand() {
  emits('expand')
}
</script>

<template>
  <div
    class="nc-kanban-card group cursor-pointer"
    :class="[isCompact ? 'nc-kanban-card-compact' : 'nc-kanban-card-default']"
    @click="onExpand"
  >
    <!-- Default card layout -->
    <template v-if="!isCompact">
      <div v-if="coverImage" class="nc-kanban-card-cover overflow-hidden rounded-t-lg">
        <img :src="coverImage" class="w-full object-cover" style="max-height: 180px" alt="cover" />
      </div>
      <div class="p-3 flex flex-col gap-2">
        <template v-for="field in fields" :key="field.id">
          <div class="nc-cell-field-wrapper">
            <SmartsheetCell
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

    <!-- Compact card layout -->
    <template v-else>
      <div class="px-2 py-1 flex items-center gap-2 overflow-hidden min-h-[32px]">
        <template v-for="(field, idx) in fields" :key="field.id">
          <div
            class="nc-cell-field-wrapper flex-shrink-0"
            :class="{ 'border-l pl-2': idx > 0, 'border-gray-200': idx > 0 }"
          >
            <SmartsheetCell
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
