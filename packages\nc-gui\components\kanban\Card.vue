<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const props = defineProps<{
  row: RowType
  rowIndex: number
}>()

const emit = defineEmits(['expand-row', 'update-row-property'])

const { row, rowIndex } = toRefs(props)

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const fields = inject(FieldsInj, ref([]))

const expandRow = inject(ExpandRowInj, (_row: RowType) => {})

const meta = inject(MetaInj, ref())

const { kanbanMetaData, kanbanViewCoverImageColumnId, updateOrSaveRow } = useKanbanViewStoreOrThrow()

const { isMobileMode } = useGlobal()

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

const coverImageColumn = computed(
  () => meta.value?.columns?.find((col: ColumnType) => col.id === kanbanViewCoverImageColumnId.value),
)

const coverImage = computed(() => {
  if (!coverImageColumn.value?.title) return null
  const attachments = row.value.row[coverImageColumn.value.title]
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return null
  return attachments[0]?.signedPath || attachments[0]?.path || null
})

const fieldsWithoutCover = computed(() =>
  fields.value.filter((f) => f.id !== kanbanViewCoverImageColumnId.value),
)
</script>

<template>
  <div
    data-testid="nc-kanban-card"
    class="nc-kanban-card nc-row-expand relative flex flex-col w-full cursor-pointer select-none overflow-hidden rounded-xl border-1 border-gray-200 bg-white shadow-sm hover:border-brand-500 hover:shadow-md transition-all"
    :class="{
      'nc-kanban-card-compact': isCompactMode,
    }"
    @click="expandRow(row)"
  >
    <!-- Cover Image: only shown when NOT in compact mode -->
    <div v-if="!isCompactMode && coverImage" class="nc-kanban-cover h-32 w-full overflow-hidden">
      <img
        class="w-full h-full object-cover"
        :src="coverImage"
        alt="cover"
      />
    </div>

    <!-- Card body -->
    <div
      class="flex flex-col"
      :class="{
        'gap-2 p-3': !isCompactMode,
        'gap-0.5 p-1.5': isCompactMode,
      }"
    >
      <template v-for="(field, i) in fieldsWithoutCover" :key="field.id">
        <div
          v-if="field.show"
          class="nc-cell-field-wrapper"
          :class="{
            'flex items-start gap-2': !isCompactMode,
            'flex items-center gap-1 min-h-5 max-h-5 overflow-hidden': isCompactMode,
          }"
        >
          <LazySmartsheetCell
            :model-value="row.row[field.title!]"
            :column="field"
            :read-only="true"
            :row-index="rowIndex"
            :active="false"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-kanban-card-compact {
  :deep(.cell) {
    padding: 0 !important;
    min-height: unset !important;
    font-size: 0.75rem;
    line-height: 1rem;
  }

  :deep(.nc-cell-field) {
    padding: 0 !important;
    min-height: unset !important;
    font-size: 0.75rem;
    line-height: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
