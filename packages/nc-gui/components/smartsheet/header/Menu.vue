<script lang="ts" setup>
import type { ColumnReqType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  ColumnInj,
  IsLockedInj,
  MetaInj,
  Modal,
  ReloadViewDataHookInj,
  SmartsheetStoreEvents,
  extractSdkResponseErrorMsg,
  getUniqueColumnName,
  iconMap,
  inject,
  message,
  useI18n,
  useMetas,
  useNuxtApp,
  useSmartsheetStoreOrThrow,
  useUndoRedo,
} from '#imports'
import { UndoRedoAction } from '~~/lib';

const { virtual = false } = defineProps<{ virtual?: boolean }>()

const emit = defineEmits(['edit', 'addColumn'])

const { eventBus } = useSmartsheetStoreOrThrow()

const column = inject(ColumnInj)

const reloadDataHook = inject(ReloadViewDataHookInj)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const { addUndo } = useUndoRedo()

const deleteColumn = () =>
  Modal.confirm({
    title: h('div', ['Do you want to delete ', h('span', { class: 'font-weight-bold' }, [column?.value?.title]), ' column ?']),
    wrapClassName: 'nc-modal-column-delete',
    okText: t('general.delete'),
    okType: 'danger',
    cancelText: t('general.cancel'),
    async onOk() {
      try {
        await $api.dbTableColumn.delete(column?.value?.id as string)

        await getMeta(meta?.value?.id as string, true)

        /** force-reload related table meta if deleted column is a LTAR and not linked to same table */
        if (column?.value?.uidt === UITypes.LinkToAnotherRecord && column.value?.colOptions) {
          await getMeta((column.value?.colOptions as LinkToAnotherRecordType).fk_related_model_id!, true)
        }

        $e('a:column:delete')
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })

const setAsDisplayValue = async () => {
  try {
    const currentDisplayValue = meta?.value?.columns?.find((f) => f.pv)

    await $api.dbTableColumn.primaryColumnSet(column?.value?.id as string)

    await getMeta(meta?.value?.id as string, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

    // Successfully updated as primary column
    message.success(t('msg.success.primaryColumnUpdated'))

    $e('a:column:set-primary')

    addUndo({
      redo: {
        fn: async (id: string) => {
          await $api.dbTableColumn.primaryColumnSet(id)

          await getMeta(meta?.value?.id as string, true)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

          // Successfully updated as primary column
          message.success(t('msg.success.primaryColumnUpdated'))
        },
        args: [column?.value?.id as string],
      },
      undo: {
        fn: async (id: string) => {
          await $api.dbTableColumn.primaryColumnSet(id)

          await getMeta(meta?.value?.id as string, true)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

          // Successfully updated as primary column
          message.success(t('msg.success.primaryColumnUpdated'))
        },
        args: [currentDisplayValue?.id],
      },
      scope: meta.value?.id,
    })
  } catch (e) {
    message.error(t('msg.error.primaryColumnUpdateFailed'))
  }
}

const sortByColumn = async (direction: 'asc' | 'desc') => {
  try {
    $e('a:sort:add', { from: 'column-menu' })
    const data: any = await $api.dbTableSort.create(view.value?.id as string, {
      fk_column_id: column!.value.id,
      direction,
      push_to_top: true,
    })

    addUndo({
      redo: {
        fn: async function redo(this: UndoRedoAction) {
          const data: any = await $api.dbTableSort.create(view.value?.id as string, {
            fk_column_id: column!.value.id,
            direction,
            push_to_top: true,
          })
          this.undo.args = [data.id]
          eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
          reloadDataHook?.trigger()
        },
        args: [],
      },
      undo: {
        fn: async function undo(id: string) {
          await $api.dbTableSort.delete(id)
          eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
          reloadDataHook?.trigger()
        },
        args: [data.id],
      },
      scope: view.value?.title,
    })

    eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
    reloadDataHook?.trigger()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const duplicateColumn = async () => {
  let columnCreatePayload = {}

  // generate duplicate column name
  const duplicateColumnName = getUniqueColumnName(`${column!.value.title}_copy`, meta!.value!.columns!)

  // construct column create payload
  switch (column?.value.uidt) {
    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
      return message.info('Not available at the moment')
    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
      columnCreatePayload = {
        ...column!.value!,
        title: duplicateColumnName,
        column_name: duplicateColumnName,
        id: undefined,
        order: undefined,
        colOptions: {
          options:
            column.value.colOptions?.options?.map((option: Record<string, any>) => ({
              ...option,
              id: undefined,
            })) ?? [],
        },
      }
      break
    default:
      columnCreatePayload = {
        ...column!.value!,
        ...(column!.value.colOptions ?? {}),
        title: duplicateColumnName,
        column_name: duplicateColumnName,
        id: undefined,
        colOptions: undefined,
        order: undefined,
      }
      break
  }

  try {
    const gridViewColumnList = (await $api.dbViewColumn.list(view.value?.id as string)).list

    const currentColumnIndex = gridViewColumnList.findIndex((f) => f.fk_column_id === column!.value.id)
    let newColumnOrder
    if (currentColumnIndex === gridViewColumnList.length - 1) {
      newColumnOrder = gridViewColumnList[currentColumnIndex].order! + 1
    } else {
      newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex + 1].order!) / 2
    }

    await $api.dbTableColumn.create(meta!.value!.id!, {
      ...columnCreatePayload,
      pv: false,
      column_order: {
        order: newColumnOrder,
        view_id: view.value?.id as string,
      },
    } as ColumnReqType)
    await getMeta(meta!.value!.id!, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    reloadDataHook?.trigger()

    message.success(t('msg.success.columnDuplicated'))
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// add column before or after current column
const addColumn = async (before = false) => {
  const gridViewColumnList = (await $api.dbViewColumn.list(view.value?.id as string)).list

  const currentColumnIndex = gridViewColumnList.findIndex((f) => f.fk_column_id === column!.value.id)

  let newColumnOrder
  if (before) {
    if (currentColumnIndex === 0) {
      newColumnOrder = gridViewColumnList[currentColumnIndex].order / 2
    } else {
      newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex - 1]?.order) / 2
    }
  } else {
    if (currentColumnIndex === gridViewColumnList.length - 1) {
      newColumnOrder = gridViewColumnList[currentColumnIndex].order + 1
    } else {
      newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex + 1]?.order) / 2
    }
  }

  emit('addColumn', {
    column_order: {
      order: newColumnOrder,
      view_id: view.value?.id as string,
    },
  })
}

// hide the field in view
const hideField = async () => {
  const gridViewColumnList = (await $api.dbViewColumn.list(view.value?.id as string)).list

  const currentColumn = gridViewColumnList.find((f) => f.fk_column_id === column!.value.id)

  await $api.dbViewColumn.update(view.value!.id!, currentColumn!.id!, { show: false })
  eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

  addUndo({
    redo: {
      fn: async function redo(id: string) {
        await $api.dbViewColumn.update(view.value!.id!, id, { show: false })
        eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
      },
      args: [currentColumn!.id],
    },
    undo: {
      fn: async function undo(id: string) {
        await $api.dbViewColumn.update(view.value!.id!, id, { show: true })
        eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
      },
      args: [currentColumn!.id],
    },
    scope: view.value?.title,
  })
}
</script>

<template>
  <a-dropdown v-if="!isLocked" placement="bottomRight" :trigger="['click']" overlay-class-name="nc-dropdown-column-operations">
    <div><GeneralIcon icon="arrowDown" class="text-grey h-full text-grey nc-ui-dt-dropdown cursor-pointer outline-0 mr-2" /></div>
    <template #overlay>
      <a-menu class="shadow bg-white">
        <a-menu-item @click="emit('edit')">
          <div class="nc-column-edit nc-header-menu-item">
            <component :is="iconMap.edit" class="text-primary" />
            <!-- Edit -->
            {{ $t('general.edit') }}
          </div>
        </a-menu-item>
        <template v-if="column.uidt !== UITypes.LinkToAnotherRecord || column.colOptions.type !== RelationTypes.BELONGS_TO">
          <a-divider class="!my-0" />
          <a-menu-item @click="sortByColumn('asc')">
            <div v-e="['a:field:sort', { dir: 'asc' }]" class="nc-column-insert-after nc-header-menu-item">
              <component :is="iconMap.sortAsc" class="text-primary" />
              <!-- Sort Ascending -->
              {{ $t('general.sortAsc') }}
            </div>
          </a-menu-item>
          <a-menu-item @click="sortByColumn('desc')">
            <div v-e="['a:field:sort', { dir: 'desc' }]" class="nc-column-insert-before nc-header-menu-item">
              <component :is="iconMap.sortDesc" class="text-primary" />
              <!-- Sort Descending -->
              {{ $t('general.sortDesc') }}
            </div>
          </a-menu-item>
        </template>
        <a-divider class="!my-0" />
        <a-menu-item v-if="!column?.pv" @click="hideField">
          <div v-e="['a:field:hide']" class="nc-column-insert-before nc-header-menu-item">
            <component :is="iconMap.eye" class="text-primary" />
            <!-- Hide Field -->
            {{ $t('general.hideField') }}
          </div>
        </a-menu-item>

        <a-divider class="!my-0" />

        <a-menu-item
          v-if="column.uidt !== UITypes.LinkToAnotherRecord && column.uidt !== UITypes.Lookup && !column.pk"
          @click="duplicateColumn"
        >
          <div v-e="['a:field:duplicate']" class="nc-column-duplicate nc-header-menu-item">
            <component :is="iconMap.duplicate" class="text-primary" />
            <!-- Duplicate -->
            {{ t('general.duplicate') }}
          </div>
        </a-menu-item>
        <a-menu-item @click="addColumn()">
          <div v-e="['a:field:insert:after']" class="nc-column-insert-after nc-header-menu-item">
            <component :is="iconMap.colInsertAfter" class="text-primary" />
            <!-- Insert After -->
            {{ t('general.insertAfter') }}
          </div>
        </a-menu-item>
        <a-menu-item v-if="!column?.pv" @click="addColumn(true)">
          <div v-e="['a:field:insert:before']" class="nc-column-insert-before nc-header-menu-item">
            <component :is="iconMap.colInsertBefore" class="text-primary" />
            <!-- Insert Before -->
            {{ t('general.insertBefore') }}
          </div>
        </a-menu-item>
        <a-divider class="!my-0" />

        <a-menu-item v-if="(!virtual || column?.uidt === UITypes.Formula) && !column?.pv" @click="setAsDisplayValue">
          <div class="nc-column-set-primary nc-header-menu-item">
            <GeneralIcon icon="star" class="text-primary" />

            <!--       todo : tooltip -->
            <!-- Set as Display value -->
            {{ $t('activity.setDisplay') }}
          </div>
        </a-menu-item>

        <a-menu-item v-if="!column?.pv" @click="deleteColumn">
          <div class="nc-column-delete nc-header-menu-item">
            <component :is="iconMap.delete" class="text-error" />
            <!-- Delete -->
            {{ $t('general.delete') }}
          </div>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-header-menu-item {
  @apply text-xs flex items-center px-1 py-2 gap-1;
}
</style>
