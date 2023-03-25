<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import type { KanbanType } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import {
  ActiveViewInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  iconMap,
  inject,
  ref,
  useKanbanViewStoreOrThrow,
  useMenuCloseOnEsc,
  useUndoRedo,
  useViewColumns,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const IsPublic = inject(IsPublicInj, ref(false))

const reloadDataHook = inject(ReloadViewDataHookInj)!

const isLocked = inject(IsLockedInj, ref(false))

const { fields, loadViewColumns, metaColumnById } = useViewColumns(activeView, meta, () => reloadDataHook.trigger())

const { kanbanMetaData, loadKanbanMeta, loadKanbanData, updateKanbanMeta, groupingField } = useKanbanViewStoreOrThrow()

const { addUndo } = useUndoRedo()

const open = ref(false)

useMenuCloseOnEsc(open)

watch(
  () => activeView.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

const updateGroupingField = async (v: string) => {
  await updateKanbanMeta({
    fk_grp_col_id: v,
  })
  await loadKanbanMeta()
  await loadKanbanData()
  ;(activeView.value?.view as KanbanType).fk_grp_col_id = v
}

const groupingFieldColumnId = computed({
  get: () => kanbanMetaData.value.fk_grp_col_id,
  set: async (val) => {
    if (val) {
      addUndo({
        undo: {
          fn: await updateGroupingField,
          args: [kanbanMetaData.value.fk_grp_col_id],
        },
        redo: {
          fn: await updateGroupingField,
          args: [val],
        },
      })

      await updateGroupingField(val)
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
  open.value = false
}
</script>

<template>
  <a-dropdown
    v-if="!IsPublic"
    v-model:visible="open"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-kanban-stacked-by-menu"
  >
    <div class="nc-kanban-btn">
      <a-button
        v-e="['c:kanban:change-grouping-field']"
        class="nc-kanban-stacked-by-menu-btn nc-toolbar-btn"
        :disabled="isLocked"
      >
        <div class="flex items-center gap-1">
          <mdi-arrow-down-drop-circle-outline />
          <span class="text-capitalize !text-sm font-weight-normal">
            {{ $t('activity.kanban.stackedBy') }}
            <span class="font-bold">{{ groupingField }}</span>
          </span>
          <component :is="iconMap.arrowDown" class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
        v-if="open"
        class="p-3 min-w-[280px] bg-gray-50 shadow-lg nc-table-toolbar-menu max-h-[max(80vh,500px)] overflow-auto !border"
        @click.stop
      >
        <div>
          <span class="font-bold"> {{ $t('activity.kanban.chooseGroupingField') }}</span>
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
            />
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
