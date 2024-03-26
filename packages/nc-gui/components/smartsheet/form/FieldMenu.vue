<script lang="ts" setup>
import type { ColumnReqType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { computed } from 'vue'
import {
  ActiveViewInj,
  ColumnInj,
  IsLockedInj,
  MetaInj,
  ReloadViewDataHookInj,
  SmartsheetStoreEvents,
  iconMap,
  inject,
  message,
  useI18n,
  useMetas,
  useNuxtApp,
  useSmartsheetStoreOrThrow,
  toRefs,
} from '#imports'

const props = defineProps<{ column: Record<string, any>; isRequired?: boolean; isOpen: boolean }>()

const emit = defineEmits(['edit', 'showOrHideColumn', 'update:isOpen'])

const { column, isRequired } = toRefs(props)

const isOpen = useVModel(props, 'isOpen', emit)

const { eventBus } = useSmartsheetStoreOrThrow()

const reloadDataHook = inject(ReloadViewDataHookInj)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const showDeleteColumnModal = ref(false)

const isDuplicateDlgOpen = ref(false)
const selectedColumnExtra = ref<any>()
const duplicateDialogRef = ref<any>()

const duplicateVirtualColumn = async () => {
  let columnCreatePayload = {}

  // generate duplicate column title
  const duplicateColumnTitle = getUniqueColumnName(`${column!.value.title} copy`, meta!.value!.columns!)

  columnCreatePayload = {
    ...column!.value!,
    ...(column!.value.colOptions ?? {}),
    title: duplicateColumnTitle,
    column_name: duplicateColumnTitle.replace(/\s/g, '_'),
    id: undefined,
    colOptions: undefined,
    order: undefined,
    system: false,
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

const openDuplicateDlg = async () => {
  if (!column?.value) return
  if (
    column.value.uidt &&
    [
      UITypes.Lookup,
      UITypes.Rollup,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ].includes(column.value.uidt as UITypes)
  ) {
    duplicateVirtualColumn()
  } else {
    const gridViewColumnList = (await $api.dbViewColumn.list(view.value?.id as string)).list

    const currentColumnIndex = gridViewColumnList.findIndex((f) => f.fk_column_id === column!.value.id)
    let newColumnOrder
    if (currentColumnIndex === gridViewColumnList.length - 1) {
      newColumnOrder = gridViewColumnList[currentColumnIndex].order! + 1
    } else {
      newColumnOrder = (gridViewColumnList[currentColumnIndex].order! + gridViewColumnList[currentColumnIndex + 1].order!) / 2
    }

    selectedColumnExtra.value = {
      pv: false,
      view_id: view.value!.id as string,
      column_order: {
        order: newColumnOrder,
        view_id: view.value!.id as string,
      },
    }

    if (column.value.uidt === UITypes.Formula) {
      nextTick(() => {
        duplicateDialogRef?.value?.duplicate()
      })
    } else {
      isDuplicateDlgOpen.value = true
    }

    isOpen.value = false
  }
}

// hide the field in view
const hideField = async () => {
  if (isRequired) return
  isOpen.value = false
  emit('showOrHideColumn')
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

const isDeleteAllowed = computed(() => {
  return column?.value && !column.value.system
})
const isDuplicateAllowed = computed(() => {
  return column?.value && !column.value.system
})
</script>

<template>
  <a-dropdown
    v-if="!isLocked"
    v-model:visible="isOpen"
    :trigger="['click']"
    placement="bottomRight"
    overlay-class-name="nc-dropdown-form-column-operations !border-1 rounded-lg !shadow-xl"
    @click.stop="isOpen = !isOpen"
  >
    <div>
      <GeneralIcon icon="arrowDown" class="text-grey h-full text-grey nc-ui-dt-dropdown cursor-pointer outline-0 mr-2" />
    </div>
    <template #overlay>
      <NcMenu class="flex flex-col gap-1 border-gray-200 nc-column-options">
        <NcMenuItem @click="onEditPress">
          <div class="nc-column-edit nc-header-menu-item">
            <component :is="iconMap.ncEdit" class="text-gray-700" />
            <!-- Edit -->
            {{ $t('general.edit') }}
          </div>
        </NcMenuItem>

        <NcMenuItem v-if="false" :disabled="!isDuplicateAllowed" @click="openDuplicateDlg">
          <div v-e="['a:field:duplicate']" class="nc-column-duplicate nc-header-menu-item">
            <component :is="iconMap.duplicate" class="text-gray-700" />
            <!-- Duplicate -->
            {{ t('general.duplicate') }}
          </div>
        </NcMenuItem>

        <NcMenuItem :disabled="isRequired" @click="hideField">
          <div v-e="['a:field:hide']" class="nc-column-insert-before nc-header-menu-item">
            <component :is="iconMap.eye" class="text-gray-700 !w-3.75 !h-3.75" />
            <!-- Hide Field -->
            {{ $t('general.hideField') }}
          </div>
        </NcMenuItem>

        <a-divider v-if="!column?.pv" class="!my-0" />

        <NcMenuItem v-if="!column?.pv" :disabled="!isDeleteAllowed" class="!hover:bg-red-50" @click="handleDelete">
          <div class="nc-column-delete nc-header-menu-item text-red-600">
            <component :is="iconMap.delete" />
            <!-- Delete -->
            {{ $t('general.delete') }}
          </div>
        </NcMenuItem>
      </NcMenu>
    </template>
  </a-dropdown>
  <SmartsheetHeaderDeleteColumnModal v-model:visible="showDeleteColumnModal" />
  <DlgColumnDuplicate
    v-if="column"
    ref="duplicateDialogRef"
    v-model="isDuplicateDlgOpen"
    :column="column"
    :extra="selectedColumnExtra"
  />
</template>

<style scoped>
.nc-header-menu-item {
  @apply text-dropdown flex items-center gap-2;
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
