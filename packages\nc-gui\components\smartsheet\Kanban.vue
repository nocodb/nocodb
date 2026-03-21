<script lang="ts" setup>
import { UITypes, ViewTypes } from 'nocodb-sdk'
import type { ColumnType, KanbanType } from 'nocodb-sdk'
import {
  ActiveViewInj,
  FieldsInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  inject,
  provide,
  ref,
  useI18n,
  useKanbanViewStore,
  useProvideKanbanViewStore,
  useRoles,
} from '#imports'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const reloadViewDataHook = inject(ReloadViewDataHookInj)
const isPublic = inject(IsPublicInj, ref(false))

const { t } = useI18n()

const {
  loadKanbanData,
  loadKanbanMeta,
  kanbanMetaData,
  formattedData,
  countByStack,
  groupingField,
  groupingFieldColumn,
  groupingFieldValue,
  updateKanbanStackMeta,
  stackMetaObj,
  fields,
  coverImageField,
  hiddenFields,
  addEmptyRow,
  deleteStack,
  isPaginationLoading,
  isCompact,
  toggleCompact,
} = useKanbanViewStore()

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

onMounted(async () => {
  await loadKanbanMeta()
  await loadKanbanData()
})
</script>

<template>
  <div class="nc-kanban-wrapper h-full overflow-x-auto">
    <!-- Kanban content -->
    <div class="flex h-full gap-4 p-4">
      <!-- Stacks -->
      <template v-if="groupingFieldColumn">
        <LazySmartsheetKanbanStack
          v-for="(stack, stackIdx) in formattedData"
          :key="stackIdx"
          :stack="stack"
          :stack-idx="stackIdx"
          :is-compact="isCompact"
        />
      </template>
    </div>
  </div>
</template>
