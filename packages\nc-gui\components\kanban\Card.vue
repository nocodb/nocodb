<script lang="ts" setup>
import type { Row as RowType } from '#imports'
import type { ColumnType } from 'nocodb-sdk'

const props = defineProps<{
  row: RowType
  rowIndex: number
}>()

const { row, rowIndex } = toRefs(props)

const fields = inject(FieldsInj, ref([]))

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const expandRow = inject(ExpandRowInj, (_row: RowType) => {})

const meta = inject(MetaInj, ref())

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const { kanbanMetaData, kanbanViewCoverImageColumnId, updateOrSaveRow } = useKanbanViewStoreOrThrow()

const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

const coverImageColumn = computed(() =>
  meta.value?.columns?.find((col: ColumnType) => col.id === kanbanViewCoverImageColumnId.value),
)

const coverImage = computed(() => {
  if (!coverImageColumn.value?.title) return null
  const attachments = row.value.row[coverImageColumn.value.title]
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return null
  return attachments[0]?.signedPath || attachments[0]?.path || null
})
</script>

<template>
  <div
    class="nc-kanban-card group relative flex flex-col w-full cursor-pointer border-1 border-gray-200 rounded-xl overflow-hidden bg-white hover:border-brand-500 transition-all"
    :class="{
      'nc-kanban-card-compact': isCompactMode,
    }"
    @click="expandRow(row)"
  >
    <!-- Cover Image (hidden in compact mode) -->
    <template v-if="!isCompactMode">
      <LazySmartsheetRowExpanderKanbanCoverImage
        v-if="coverImage"
        :cover-image="coverImage"
      />
    </template>

    <div
      class="flex flex-col gap-1 w-full"
      :class="{
        'p-3': !isCompactMode,
        'p-1.5': isCompactMode,
      }"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-kanban-card-compact {
  .nc-cell {
    @apply text-xs py-0;
  }
  
  .nc-cell-field {
    @apply py-0 min-h-0;
  }
}
</style>
