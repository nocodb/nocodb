<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import {
  ColumnInj,
  IsLockedInj,
  MetaInj,
  Modal,
  ReloadViewDataHookInj,
  extractSdkResponseErrorMsg,
  inject,
  message,
  useI18n,
  useMetas,
  useNuxtApp,
} from '#imports'
import { useSmartsheetStoreOrThrow } from '~/composables/useSmartsheetStore'
import { ActiveViewInj } from '~/context'
import { SmartsheetStoreEvents } from '~/lib'

const { virtual = false } = defineProps<{ virtual?: boolean }>()

const emit = defineEmits(['edit', 'addColumn'])

const { eventBus } = useSmartsheetStoreOrThrow()

const column = inject(ColumnInj)

const reloadDataHook = inject(ReloadViewDataHookInj)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj)

const fields = inject(FieldsInj, ref([]))

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

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

const setAsPrimaryValue = async () => {
  try {
    await $api.dbTableColumn.primaryColumnSet(column?.value?.id as string)

    await getMeta(meta?.value?.id as string, true)

    // Successfully updated as primary column
    message.success(t('msg.success.primaryColumnUpdated'))

    $e('a:column:set-primary')
  } catch (e) {
    message.error(t('msg.error.primaryColumnUpdateFailed'))
  }
}

const sortByColumn = async (direction: 'asc' | 'desc') => {
  try {
    $e('a:sort:add', { from: 'column-menu' })
    await $api.dbTableSort.create(view.value?.id as string, { fk_column_id: column!.value.id, direction })
    eventBus.emit(SmartsheetStoreEvents.SORT_RELOAD)
    reloadDataHook?.trigger()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const getUniqueColumnName = (initName: string, columns: ColumnType[]) => {
  let name = initName
  let i = 1
  while (columns.find((c) => c.title === name)) {
    name = `${initName}_${i}`
    i++
  }
  return name
}

const duplicateColumn = async () => {
  let columnCreatePayload = {}

  const duplicateColumnName = getUniqueColumnName(`${column!.value.title}_copy`, meta!.value!.columns!)

  switch (column.value.uidt) {
    // LTAR
    // Formula
    // Lookup
    // Rollup

    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
      return message.info('Not available at the moment')
    default:
      columnCreatePayload = {
        ...column!.value!,
        ...column!.value.colOptions,
        title: duplicateColumnName,
        column_name: duplicateColumnName,
        id: undefined,
        colOptions: undefined,
      }
      break
  }

  try {
    const gridViewColumnList = await $api.dbViewColumn.list(view.value?.id as string)

    const currentColumnIndex = gridViewColumnList.findIndex((f) => f.fk_column_id === column!.value.id)

    if (currentColumnIndex === gridViewColumnList.length - 2) {
      return
    }

    const newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex + 1]?.order) / 2

    await $api.dbTableColumn.create(meta!.value!.id!, {
      ...columnCreatePayload,
      columnOrder: {
        order: newColumnOrder,
        viewId: view.value?.id as string,
      },
    })
    await getMeta(meta!.value!.id!, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const addColumn = async (before = false) => {
  const gridViewColumnList = await $api.dbViewColumn.list(view.value?.id as string)

  const currentColumnIndex = gridViewColumnList.findIndex((f) => f.fk_column_id === column!.value.id)

  // if (currentColumnIndex === gridViewColumnList.length - 2) {
  //   return
  // }

  let newColumnOrder
  if (before) {
    newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex - 1]?.order) / 2
  } else {
    newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex + 1]?.order) / 2
  }
  // eventBus.emit(SmartsheetStoreEvents.FIELD_ADD, {
  //   columnOrder: {
  //     order: newColumnOrder,
  //     viewId: view.value?.id as string,
  //   },
  // })
  emit('addColumn',  {
    columnOrder: {
      order: newColumnOrder,
      viewId: view.value?.id as string,
    },
  })
}

const hideField = async () => {
  const gridViewColumnList = await $api.dbViewColumn.list(view.value?.id as string)

  const currentColumn = gridViewColumnList.find((f) => f.fk_column_id === column!.value.id)

  await $api.dbViewColumn.update(view.value.id, currentColumn.id, { show: false })
  eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
}
</script>

<template>
  <a-dropdown v-if="!isLocked" placement="bottomRight" :trigger="['click']"
              overlay-class-name="nc-dropdown-column-operations">
    <MdiMenuDown class="h-full text-grey nc-ui-dt-dropdown cursor-pointer outline-0" />

    <template #overlay>
      <a-menu class="shadow bg-white">
        <a-menu-item @click="emit('edit')">
          <div class="nc-column-edit nc-header-menu-item">
            <MdiPencil class="text-primary" />
            <!-- Edit -->
            {{ $t('general.edit') }}
          </div>
        </a-menu-item>
        <a-divider class="!my-0" />
        <a-menu-item @click="sortByColumn('asc')">
          <div class="nc-column-insert-after nc-header-menu-item">
            <MdiSortAscending class="text-primary" />
            Sort Ascending
          </div>
        </a-menu-item>
        <a-menu-item @click="sortByColumn('desc')">
          <div class="nc-column-insert-before nc-header-menu-item">
            <MdiSortDescending class="text-primary" />
            Sort Descending
          </div>
        </a-menu-item>

        <a-divider class="!my-0" />
        <a-menu-item @click="hideField">
          <div class="nc-column-insert-before nc-header-menu-item">
            <MdiEyeOffOutline class="text-primary" />
            Hide Field
          </div>
        </a-menu-item>

        <a-divider class="!my-0" />

        <a-menu-item @click="duplicateColumn">
          <div class="nc-column-duplicate nc-header-menu-item">
            <MdiFileReplaceOutline class="text-primary" />
            Duplicate
          </div>
        </a-menu-item>
        <a-menu-item @click="addColumn()">
          <div class="nc-column-insert-after nc-header-menu-item">
            <MdiTableColumnPlusAfter class="text-primary" />
            Insert After
          </div>
        </a-menu-item>
        <a-menu-item @click="addColumn(true)">
          <div class="nc-column-insert-before nc-header-menu-item">
            <MdiTableColumnPlusBefore class="text-primary" />
            Insert before
          </div>
        </a-menu-item>
        <a-divider class="!my-0" />

        <a-menu-item v-if="!virtual" @click="setAsPrimaryValue">
          <div class="nc-column-set-primary nc-header-menu-item">
            <MdiStar class="text-primary" />

            <!--       todo : tooltip -->
            <!-- Set as Primary value -->
            {{ $t('activity.setPrimary') }}
          </div>
        </a-menu-item>

        <a-menu-item @click="deleteColumn">
          <div class="nc-column-delete nc-header-menu-item">
            <MdiDeleteOutline class="text-error" />
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
