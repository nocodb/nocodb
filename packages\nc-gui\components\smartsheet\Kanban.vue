<script lang="ts" setup>
import type { ColumnType, KanbanType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'
import {
  ActiveViewInj,
  ChangePageInj,
  ExpandRowInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsKanbanInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  computed,
  inject,
  provide,
  ref,
  useApi,
  useGlobal,
  useI18n,
  useKanbanViewStoreOrThrow,
  useMetas,
  useNuxtApp,
  useProvideSmartsheetRowStore,
  useRoles,
  useSmartsheetStoreOrThrow,
  useUIPermission,
  useViewColumns,
  watch,
} from '#imports'

const { t } = useI18n()

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const isPublic = inject(IsPublicInj, ref(false))

const { isMobileMode } = useGlobal()

provide(IsKanbanInj, ref(true))
provide(IsGalleryInj, ref(false))
provide(IsFormInj, ref(false))

const {
  formattedData,
  countByStack,
  groupingField,
  groupingFieldColumn,
  groupingFieldColOptions,
  kanbanMetaData,
  kanbanViewCoverImageColumnId,
  isCompactMode,
  nGroupingFieldsNull,
  loadKanbanMeta,
  loadKanbanData,
  updateKanbanMeta,
  addEmptyRow,
  updateOrSaveRow,
} = useKanbanViewStoreOrThrow()

// ... rest of component
</script>

<template>
  <!-- Kanban board content -->
</template>
