<script lang="ts" setup>
import type { ColumnType, KanbanType } from 'nocodb-sdk'
import { computed, inject, ref, useKanbanViewStore, useViewsStore } from '#imports'

const props = defineProps<{
  row: Row
  rowIndex: number
  stack?: Record<string, any>
  stackIndex?: number
}>()

const { isUIAllowed } = useRoles()

const { row, rowIndex, stack, stackIndex } = toRefs(props)

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const isPublic = inject(IsPublicInj, ref(false))

const { fields, coverImageField, hiddenFields, kanbanMetaData, updateKanbanStackMeta } = useKanbanViewStore()
const { isCompact } = useKanbanViewStore()

const { openExpandedForm } = useExpandedFormStoreOrThrow()

const { isMobileMode } = useGlobal()

const isCompactMode = computed(() => isCompact?.value ?? false)

const rowData = computed(() => row.value?.row)

const coverImage = computed(() => {
  if (!coverImageField?.value) return undefined
  const field = coverImageField.value
  const val = rowData.value?.[field.title!]
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
  openExpandedForm(row.value)
}
</script>

<template>
  <div
    class="nc-kanban-card group"
    :class="[isCompactMode ? 'nc-kanban-card-compact' : 'nc-kanban-card-default']"
    @click="onExpand"
  >
    <template v-if="!isCompactMode">
      <!-- Default card view -->
      <div v-if="coverImage" class="nc-kanban-card-cover">
        <img :src="coverImage" class="w-full object-cover" style="max-height: 180px" />
      </div>
      <div class="p-3 flex flex-col gap-2">
        <template v-for="field in fields" :key="field.id">
          <div v-if="!field.hidden" class="nc-cell-field-wrapper">
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
    <template v-else>
      <!-- Compact card view -->
      <div class="px-2 py-1 flex items-center gap-1 overflow-hidden">
        <template v-for="field in fields" :key="field.id">
          <div v-if="!field.hidden" class="nc-cell-field-wrapper flex-shrink-0 max-w-full">
            <SmartsheetCell
              :model-value="rowData[field.title!]"
              :column="field"
              :edit-enabled="false"
              :read-only="true"
              class="pointer-events-none text-sm"
            />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
