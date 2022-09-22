<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import type { KanbanType } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import {
  ActiveViewInj,
  IsLockedInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  inject,
  ref,
  useKanbanViewData,
  useViewColumns,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const isLocked = inject(IsLockedInj, ref(false))

const { fields, loadViewColumns, metaColumnById } = useViewColumns(activeView, meta, () => reloadDataHook.trigger())

const { kanbanMetaData, loadKanbanMeta, loadKanbanData, updateKanbanMeta, groupingField } = useKanbanViewData(meta, activeView)

const stackedByDropdown = ref(false)

watch(
  () => activeView.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

const groupingFieldColumnId = computed({
  get: () => kanbanMetaData.value.grp_column_id,
  set: async (val) => {
    if (val) {
      await updateKanbanMeta({
        grp_column_id: val,
      })
      await loadKanbanMeta()
      await loadKanbanData()
      ;(activeView.value?.view as KanbanType).grp_column_id = val
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

const handleChange = () => {
  stackedByDropdown.value = false
}
</script>

<template>
  <a-dropdown v-model:visible="stackedByDropdown" :trigger="['click']" overlay-class-name="nc-dropdown-kanban-stacked-by-menu">
    <div class="nc-kanban-btn">
      <a-button v-e="['c:stacked-by']" class="nc-kanban-stacked-by-menu-btn nc-toolbar-btn" :disabled="isLocked">
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
        v-if="stackedByDropdown"
        class="p-3 min-w-[280px] bg-gray-50 shadow-lg nc-table-toolbar-menu max-h-[max(80vh,500px)] overflow-auto !border"
        @click.stop
      >
        <div>
          <!-- TODO: i18n -->
          <span class="font-bold">Choose a Grouping Field</span>
          <a-divider class="!my-2" />
        </div>
        <div class="nc-fields-list py-1">
          <div class="grouping-field">
            <a-select
              v-model:value="groupingFieldColumnId"
              class="w-full nc-kanban-grouping-field-select"
              :options="singleSelectFieldOptions"
              placeholder="Select a Grouping Field"
              @change="handleChange"
              @click.stop
            ></a-select>
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
