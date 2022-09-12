<script setup lang="ts">
import type { ColumnType, KanbanType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isVirtualCol } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import {
  ActiveViewInj,
  FieldsInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  inject,
  ref,
  useKanbanViewData,
  useNuxtApp,
  useViewColumns,
  watch,
} from '#imports'
import CellIcon from '~/components/smartsheet-header/CellIcon.vue'
import VirtualCellIcon from '~/components/smartsheet-header/VirtualCellIcon.vue'

const meta = inject(MetaInj)!

const activeView = inject(ActiveViewInj)!

const reloadDataHook = inject(ReloadViewDataHookInj)!

const rootFields = inject(FieldsInj)

const isLocked = inject(IsLockedInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const { $api, $e } = useNuxtApp()

const {
  showSystemFields,
  sortedAndFilteredFields,
  fields,
  loadViewColumns,
  filteredFieldList,
  filterQuery,
  showAll,
  hideAll,
  saveOrUpdate,
  metaColumnById,
} = useViewColumns(activeView, meta, () => reloadDataHook.trigger())

const { kanbanMetaData, loadKanbanMeta, loadKanbanData, groupingField } = useKanbanViewData(meta, activeView as any)

watch(
  () => (activeView.value as any)?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? VirtualCellIcon : CellIcon, {
    columnMeta: c,
  })

const groupingFieldColumnId = computed({
  get: () => kanbanMetaData?.value?.grp_column_id,
  set: async (val) => {
    if (val) {
      await $api.dbView.kanbanUpdate(activeView.value.id, {
        ...kanbanMetaData.value,
        grp_column_id: val,
      })
      ;(activeView.value?.view as KanbanType).grp_column_id = val
      await loadKanbanMeta()
    }
  },
})

const singleSelectFieldOptions = computed<SelectProps['options']>(() => {
  return fields.value
    ?.filter((el) => el.fk_column_id && metaColumnById.value[el.fk_column_id].uidt === UITypes.SingleSelect)
    .map((field) => {
      return {
        value: field.fk_column_id,
        label: field.title,
      }
    })
})
</script>

<template>
  <a-dropdown :trigger="['click']">
    <div>
      <a-button v-t="['c:stacked-by']" class="nc-fields-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-1">
          <mdi-arrow-down-drop-circle-outline />
          <!-- TODO: i18n -->
          <span class="text-capitalize !text-sm font-weight-normal">Stacked By {{ groupingField }}</span>

          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
        class="p-3 min-w-[280px] bg-gray-50 shadow-lg nc-table-toolbar-menu max-h-[max(80vh,500px)] overflow-auto !border"
        @click.stop
      >
        <div>
          <!-- TODO: i18n -->
          <span class="font-bold">Choose a grouping field</span>
          <a-divider class="!my-2" />
        </div>
        <div class="nc-fields-list py-1">
          <div class="grouping-field">
            <a-select
              v-model:value="groupingFieldColumnId"
              class="w-full"
              :options="singleSelectFieldOptions"
              placeholder="Select a Grouping Field"
              @click.stop
            ></a-select>
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
