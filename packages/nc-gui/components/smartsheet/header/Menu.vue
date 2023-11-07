<script lang="ts" setup>
import type { ColumnReqType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import {
  ActiveViewInj,
  ColumnInj,
  IsLockedInj,
  MetaInj,
  ReloadViewDataHookInj,
  SmartsheetStoreEvents,
  extractSdkResponseErrorMsg,
  getUniqueColumnName,
  iconMap,
  inject,
  message,
  toRef,
  useI18n,
  useMetas,
  useNuxtApp,
  useSmartsheetStoreOrThrow,
  useUndoRedo,
} from '#imports'

const props = defineProps<{ virtual?: boolean; isOpen: boolean }>()

const emit = defineEmits(['edit', 'addColumn', 'update:isOpen'])

const virtual = toRef(props, 'virtual')

const isOpen = useVModel(props, 'isOpen', emit)

const { eventBus } = useSmartsheetStoreOrThrow()

const column = inject(ColumnInj)

const reloadDataHook = inject(ReloadViewDataHookInj)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { insertSort } = useViewSorts(view, () => reloadDataHook?.trigger())

const isLocked = inject(IsLockedInj)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const { addUndo, defineModelScope, defineViewScope } = useUndoRedo()

const showDeleteColumnModal = ref(false)

const setAsDisplayValue = async () => {
  try {
    const currentDisplayValue = meta?.value?.columns?.find((f) => f.pv)

    isOpen.value = false

    await $api.dbTableColumn.primaryColumnSet(column?.value?.id as string)

    await getMeta(meta?.value?.id as string, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

    // Successfully updated as primary column
    // message.success(t('msg.success.primaryColumnUpdated'))

    $e('a:column:set-primary')

    addUndo({
      redo: {
        fn: async (id: string) => {
          await $api.dbTableColumn.primaryColumnSet(id)

          await getMeta(meta?.value?.id as string, true)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

          // Successfully updated as primary column
          // message.success(t('msg.success.primaryColumnUpdated'))
        },
        args: [column?.value?.id as string],
      },
      undo: {
        fn: async (id: string) => {
          await $api.dbTableColumn.primaryColumnSet(id)

          await getMeta(meta?.value?.id as string, true)

          eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

          // Successfully updated as primary column
          // message.success(t('msg.success.primaryColumnUpdated'))
        },
        args: [currentDisplayValue?.id],
      },
      scope: defineModelScope({ model: meta.value }),
    })
  } catch (e) {
    message.error(t('msg.error.primaryColumnUpdateFailed'))
  }
}

const sortByColumn = async (direction: 'asc' | 'desc') => {
  await insertSort({
    column: column!.value,
    direction,
    reloadDataHook,
  })
}

const duplicateColumn = async () => {
  let columnCreatePayload = {}

  // generate duplicate column name
  const duplicateColumnName = getUniqueColumnName(`${column!.value.title}_copy`, meta!.value!.columns!)

  // construct column create payload
  switch (column?.value.uidt) {
    case UITypes.LinkToAnotherRecord:
    case UITypes.Links:
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
      view_id: view.value!.id as string,
      column_order: {
        order: newColumnOrder,
        view_id: view.value!.id as string,
      },
    } as ColumnReqType)
    await getMeta(meta!.value!.id!, true)

    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    reloadDataHook?.trigger()

    // message.success(t('msg.success.columnDuplicated'))
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  // closing dropdown
  isOpen.value = false
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
    scope: defineViewScope({ view: view.value }),
  })
}

const handleDelete = () => {
  // closing the dropdown
  // when modal opens
  isOpen.value = false
  showDeleteColumnModal.value = true
}

const onEditPress = () => {
  isOpen.value = false
  emit('edit')
}

const onInsertBefore = () => {
  isOpen.value = false
  addColumn(true)
}
const onInsertAfter = () => {
  isOpen.value = false
  addColumn()
}
</script>

<template>
  <a-dropdown
    v-if="!isLocked"
    v-model:visible="isOpen"
    :trigger="['click']"
    placement="bottomRight"
    overlay-class-name="nc-dropdown-column-operations"
    @click.stop="isOpen = !isOpen"
  >
    <div>
      <GeneralIcon icon="arrowDown" class="text-grey h-full text-grey nc-ui-dt-dropdown cursor-pointer outline-0 mr-2" />
    </div>
    <template #overlay>
      <a-menu class="shadow bg-white nc-column-options">
        <a-menu-item @click="onEditPress">
          <div class="nc-column-edit nc-header-menu-item">
            <component :is="iconMap.edit" class="text-gray-700 mx-0.65 my-0.75" />
            <!-- Edit -->
            {{ $t('general.edit') }}
          </div>
        </a-menu-item>
        <a-divider v-if="!column?.pv" class="!my-0" />
        <a-menu-item v-if="!column?.pv" @click="hideField">
          <div v-e="['a:field:hide']" class="nc-column-insert-before nc-header-menu-item my-0.5">
            <component :is="iconMap.eye" class="text-gray-700 mx-0.75 !w-3.75 !h-3.75 ml-0.75 mr-0.5" />
            <!-- Hide Field -->
            {{ $t('general.hideField') }}
          </div>
        </a-menu-item>
        <a-menu-item v-if="(!virtual || column?.uidt === UITypes.Formula) && !column?.pv" @click="setAsDisplayValue">
          <div class="nc-column-set-primary nc-header-menu-item item my-0.5">
            <GeneralIcon icon="star" class="text-gray-700 !w-4.25 !h-4.25 ml-0.5 mr-0.25 -mt-0.5" />

            <!--       todo : tooltip -->
            <!-- Set as Display value -->
            {{ $t('activity.setDisplay') }}
          </div>
        </a-menu-item>

        <a-divider class="!my-0" />

        <template v-if="!isLinksOrLTAR(column) || column.colOptions.type !== RelationTypes.BELONGS_TO">
          <a-menu-item @click="sortByColumn('asc')">
            <div v-e="['a:field:sort', { dir: 'asc' }]" class="nc-column-insert-after nc-header-menu-item">
              <component
                :is="iconMap.sortDesc"
                class="text-gray-700 !rotate-180 !w-4.25 !h-4.25 ml-0.5 mr-0.25"
                :style="{
                  transform: 'rotate(180deg)',
                }"
              />

              <!-- Sort Ascending -->
              {{ $t('general.sortAsc') }}
            </div>
          </a-menu-item>
          <a-menu-item @click="sortByColumn('desc')">
            <div v-e="['a:field:sort', { dir: 'desc' }]" class="nc-column-insert-before nc-header-menu-item">
              <component :is="iconMap.sortDesc" class="text-gray-700 !w-4.25 !h-4.25 ml-0.5 mr-0.25" />
              <!-- Sort Descending -->
              {{ $t('general.sortDesc') }}
            </div>
          </a-menu-item>
        </template>

        <a-divider class="!my-0" />

        <a-menu-item
          v-if="column.uidt !== UITypes.LinkToAnotherRecord && column.uidt !== UITypes.Lookup && !column.pk"
          @click="duplicateColumn"
        >
          <div v-e="['a:field:duplicate']" class="nc-column-duplicate nc-header-menu-item my-0.5">
            <component :is="iconMap.duplicate" class="text-gray-700 mx-0.75" />
            <!-- Duplicate -->
            {{ t('general.duplicate') }}
          </div>
        </a-menu-item>
        <a-menu-item @click="onInsertAfter">
          <div v-e="['a:field:insert:after']" class="nc-column-insert-after nc-header-menu-item">
            <component :is="iconMap.colInsertAfter" class="text-gray-700 !w-4.5 !h-4.5 ml-0.75" />
            <!-- Insert After -->
            {{ t('general.insertAfter') }}
          </div>
        </a-menu-item>
        <a-menu-item v-if="!column?.pv" @click="onInsertBefore">
          <div v-e="['a:field:insert:before']" class="nc-column-insert-before nc-header-menu-item">
            <component :is="iconMap.colInsertBefore" class="text-gray-600 !w-4.5 !h-4.5 mr-1.5 -ml-0.75" />
            <!-- Insert Before -->
            {{ t('general.insertBefore') }}
          </div>
        </a-menu-item>
        <a-divider class="!my-0" />

        <a-menu-item v-if="!column?.pv" class="!hover:bg-red-50" @click="handleDelete">
          <div class="nc-column-delete nc-header-menu-item my-0.75 text-red-600">
            <component :is="iconMap.delete" class="ml-0.75 mr-1" />
            <!-- Delete -->
            {{ $t('general.delete') }}
          </div>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
  <SmartsheetHeaderDeleteColumnModal v-model:visible="showDeleteColumnModal" />
</template>

<style scoped>
.nc-header-menu-item {
  @apply text-dropdown flex items-center px-1 py-2 gap-1;
}

.nc-column-options {
  .nc-icons {
    @apply !w-5 !h-5;
  }
}

:deep(.ant-dropdown-menu-item) {
  @apply !hover:text-black text-gray-700;
}
</style>
