<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import type { KanbanType } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import {
  ActiveViewInj,
  IsKanbanInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  computed,
  inject,
  provide,
  ref,
  useKanbanViewStoreOrThrow,
  useMenuCloseOnEsc,
  useUndoRedo,
  useViewColumnsOrThrow,
  watch,
} from '#imports'

provide(IsKanbanInj, ref(true))

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const IsPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { fields, loadViewColumns, metaColumnById } = useViewColumnsOrThrow(activeView, meta)

const { kanbanMetaData, loadKanbanMeta, loadKanbanData, updateKanbanMeta, groupingField, groupingFieldColumn } =
  useKanbanViewStoreOrThrow()

const { addUndo, defineViewScope } = useUndoRedo()

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
        scope: defineViewScope({ view: activeView.value }),
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

const onSubmit = async () => {
  open.value = false

  await loadKanbanMeta()
  await loadKanbanData()
}

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
    class="!xs:hidden"
  >
    <div class="nc-kanban-btn">
      <a-button
        v-e="['c:kanban:change-grouping-field']"
        class="nc-kanban-stacked-by-menu-btn nc-toolbar-btn"
        :disabled="isLocked"
      >
        <div class="flex items-center gap-1">
          <GeneralIcon icon="layers" class="mr-0.5" />
          <span class="text-capitalize !text-sm">
            {{ $t('activity.kanban.stackedBy') }}
            <span class="font-bold ml-0.25">{{ groupingField }}</span>
          </span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div v-if="open" class="p-6 w-90 bg-white shadow-lg nc-table-toolbar-menu !border-1 border-gray-50 rounded-2xl" @click.stop>
        <div>Select a field to stack records by</div>
        <div class="nc-fields-list py-2">
          <div class="grouping-field">
            <a-select
              v-model:value="groupingFieldColumnId"
              class="w-full nc-kanban-grouping-field-select"
              :options="singleSelectFieldOptions"
              placeholder="Select a Grouping Field"
              @change="handleChange"
              @click.stop
            >
              <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template
            ></a-select>
          </div>
        </div>
        <div class="mt-4 border-1 px-4 pt-4 pb-3 border-gray-50 rounded-2xl">
          <div class="text-base font-medium mb-2">Options</div>
          <LazySmartsheetColumnEditOrAddProvider
            v-if="open"
            :column="groupingFieldColumn"
            embed-mode
            :column-label="$t('general.changes')"
            hide-title
            hide-type
            hide-additional-options
            @cancel="open = false"
            @submit="onSubmit"
            @click.stop
            @keydown.stop
          />
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
