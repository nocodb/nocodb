<script lang="ts" setup>
import type { Row as RowType } from '#imports'
import {
  IsPublicInj,
  ReloadViewDataHookInj,
  computed,
  inject,
  ref,
  useKanbanViewStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
  useViewColumnsOrThrow,
} from '#imports'

const props = defineProps<{
  row: RowType
  rowIndex: number
  compact?: boolean
}>()

const emit = defineEmits(['expandRow', 'updateRowProperty'])

const { row, rowIndex } = toRefs(props)

const expandRow = inject('expandRow', (_row: RowType) => {})

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const isPublic = inject(IsPublicInj, ref(false))

const { fields, coverImageField, displayField } = useViewColumnsOrThrow()

const {
  kanbanMetaData,
  updateOrSaveRow,
  kanbanViewCoverImageColumnId,
} = useKanbanViewStoreOrThrow()

const { isRowExpanded } = useSmartsheetRowStoreOrThrow()

const compactMode = computed(() => kanbanMetaData.value?.compact_mode ?? false)

const coverImageUrl = computed(() => {
  if (!kanbanViewCoverImageColumnId.value || !coverImageField.value) return null
  const attachments = row.value.row[coverImageField.value.title]
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return null
  return attachments[0]?.signedPath || attachments[0]?.path || null
})

const displayValue = computed(() => {
  if (!displayField.value) return ''
  return row.value.row[displayField.value.title] ?? ''
})

const visibleFields = computed(() => {
  if (!fields.value) return []
  return fields.value.filter(
    (f) =>
      f.id !== kanbanViewCoverImageColumnId.value &&
      f.show &&
      f.title !== displayField.value?.title,
  )
})
</script>

<template>
  <div
    class="nc-kanban-card"
    :class="{
      'nc-kanban-card-compact': compactMode,
    }"
    @click="expandRow(row)"
  >
    <!-- Cover Image (hidden in compact mode) -->
    <template v-if="!compactMode && coverImageUrl">
      <div class="nc-kanban-cover-image-wrapper">
        <img
          :src="coverImageUrl"
          class="nc-kanban-cover-image"
          alt="cover"
        />
      </div>
    </template>

    <div
      class="nc-kanban-card-body"
      :class="{
        'compact': compactMode,
      }"
    >
      <!-- Display/Title Field -->
      <div class="nc-kanban-card-title" :class="{ 'compact': compactMode }">
        {{ displayValue }}
      </div>

      <!-- Other fields (hidden in compact mode) -->
      <template v-if="!compactMode">
        <template v-for="field in visibleFields" :key="field.id">
          <div class="nc-kanban-card-field">
            <span class="nc-kanban-card-field-label">{{ field.title }}</span>
            <span class="nc-kanban-card-field-value">
              {{ row.row[field.title] }}
            </span>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
