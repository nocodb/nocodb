<script lang="ts" setup>
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { computed } from 'vue'

const props = defineProps<{
  column: ColumnType
  formColumn: Record<string, any>
  isRequired?: boolean
  isOpen: boolean
  onDelete: () => void
}>()

const emit = defineEmits(['hideField', 'update:isOpen', 'delete'])

const { column, isRequired } = toRefs(props)

const isOpen = useVModel(props, 'isOpen', emit)

const { eventBus } = useSmartsheetStoreOrThrow()

const reloadDataHook = inject(ReloadViewDataHookInj)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj)

provide(ColumnInj, column)

const { $api } = useNuxtApp()

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
  if (isRequired.value) return
  isOpen.value = false
  emit('hideField')
}

const handleDelete = () => {
  // closing the dropdown
  // when modal opens
  isOpen.value = false
  showDeleteColumnModal.value = true
}

const isDeleteAllowed = computed(() => {
  return column?.value && !column.value.system
})
const isDuplicateAllowed = computed(() => {
  return column?.value && !column.value.system
})
</script>

<template>
  <NcDropdown
    v-if="!isLocked"
    v-model:visible="isOpen"
    :trigger="['click']"
    placement="bottomLeft"
    overlay-class-name="nc-dropdown-form-column-operations !border-1 rounded-lg !shadow-xl"
    @click.stop="isOpen = !isOpen"
  >
    <NcButton
      type="secondary"
      size="small"
      class="nc-form-add-field"
      data-testid="nc-form-add-field"
      @click.stop="showAddColumnDropdown = true"
    >
      <component :is="iconMap.threeDotVertical" class="flex-none w-4 h-4" />
    </NcButton>
    <template #overlay>
      <NcMenu class="nc-column-options" variant="small">
        <!-- Todo: Duplicate column with form column settings -->
        <!-- eslint-disable vue/no-constant-condition -->
        <NcMenuItem v-if="false" :disabled="!isDuplicateAllowed" @click="openDuplicateDlg">
          <div class="nc-column-duplicate nc-form-header-menu-item">
            <component :is="iconMap.duplicate" />
            <!-- Duplicate -->
            {{ t('general.duplicate') }}
          </div>
        </NcMenuItem>

        <NcMenuItem :disabled="isRequired" @click="hideField">
          <div class="nc-column-insert-before nc-form-header-menu-item">
            <component :is="iconMap.eye" class="!w-3.75 !h-3.75" />
            <!-- Hide Field -->
            {{ $t('general.hideField') }}
          </div>
        </NcMenuItem>

        <template v-if="!column?.pv">
          <NcDivider />

          <NcMenuItem
            :disabled="!isDeleteAllowed"
            :class="{
              '!hover:bg-red-50': isDeleteAllowed,
            }"
            @click="handleDelete"
          >
            <div
              class="nc-column-delete nc-form-header-menu-item"
              :class="{
                'text-red-600': isDeleteAllowed,
              }"
            >
              <component :is="iconMap.delete" />
              <!-- Delete -->
              {{ $t('general.delete') }}
            </div>
          </NcMenuItem>
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
  <SmartsheetHeaderDeleteColumnModal
    v-model:visible="showDeleteColumnModal"
    class="nc-form-column-delete-dropdown"
    :on-delete-column="onDelete"
  />
  <DlgColumnDuplicate
    v-if="column"
    ref="duplicateDialogRef"
    v-model="isDuplicateDlgOpen"
    :column="column"
    :extra="selectedColumnExtra"
  />
</template>

<style scoped>
.nc-form-header-menu-item {
  @apply flex items-center gap-2;
}
</style>
