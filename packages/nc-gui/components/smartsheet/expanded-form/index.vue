<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import { isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import MdiChevronDown from '~icons/mdi/chevron-down'
import TableIcon from '~icons/nc-icons/table'

import {
  CellClickHookInj,
  FieldsInj,
  IsExpandedFormOpenInj,
  IsFormInj,
  IsKanbanInj,
  IsPublicInj,
  MetaInj,
  ReloadRowDataHookInj,
  computedInject,
  createEventHook,
  inject,
  message,
  provide,
  ref,
  toRef,
  useActiveKeyupListener,
  useProvideExpandedFormStore,
  useProvideSmartsheetStore,
  useRoles,
  useRouter,
  useVModel,
  watch,
} from '#imports'
import type { Row } from '#imports'

interface Props {
  modelValue?: boolean
  row: Row
  state?: Record<string, any> | null
  meta: TableType
  loadRow?: boolean
  useMetaFields?: boolean
  rowId?: string
  view?: ViewType
  showNextPrevIcons?: boolean
  firstRow?: boolean
  lastRow?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'cancel', 'next', 'prev'])

const key = ref(0)

const { t } = useI18n()

const row = ref(props.row)

const state = toRef(props, 'state')

const meta = toRef(props, 'meta')

const router = useRouter()

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

// override cell click hook to avoid unexpected behavior at form fields
provide(CellClickHookInj, undefined)

const fields = computedInject(FieldsInj, (_fields) => {
  if (props.useMetaFields) {
    return (meta.value.columns ?? []).filter((col) => !isSystemColumn(col))
  }
  return _fields?.value ?? []
})

const hiddenFields = computed(() => {
  return (meta.value.columns ?? []).filter((col) => !fields.value?.includes(col)).filter((col) => !isSystemColumn(col))
})

const showHiddenFields = ref(false)

const toggleHiddenFields = () => {
  showHiddenFields.value = !showHiddenFields.value
}

const isKanban = inject(IsKanbanInj, ref(false))

provide(MetaInj, meta)

const {
  commentsDrawer,
  changedColumns,
  deleteRowById,
  displayValue,
  state: rowState,
  isNew,
  loadRow: _loadRow,
  primaryKey,
  saveRowAndStay,
  syncLTARRefs,
  save: _save,
} = useProvideExpandedFormStore(meta, row)

const duplicatingRowInProgress = ref(false)

if (props.loadRow) {
  await _loadRow()
}

if (props.rowId) {
  try {
    await _loadRow(props.rowId)
  } catch (e: any) {
    if (e.response?.status === 404) {
      // todo: i18n
      message.error('Record not found')
      router.replace({ query: {} })
    } else throw e
  }
}

useProvideSmartsheetStore(ref({}) as Ref<ViewType>, meta)

watch(
  state,
  () => {
    if (state.value) {
      rowState.value = state.value
    } else {
      rowState.value = {}
    }
  },
  { immediate: true },
)

const isExpanded = useVModel(props, 'modelValue', emits, {
  defaultValue: false,
})

const onClose = () => {
  if (row.value?.rowMeta?.new) emits('cancel')
  isExpanded.value = false
}

const onDuplicateRow = () => {
  duplicatingRowInProgress.value = true
  const oldRow = { ...row.value.row }
  delete oldRow.ncRecordId
  const newRow = Object.assign(
    {},
    {
      row: oldRow,
      oldRow: {},
      rowMeta: { new: true },
    },
  )
  setTimeout(async () => {
    row.value = newRow
    duplicatingRowInProgress.value = false
    message.success(t('msg.success.rowDuplicatedWithoutSavedYet'))
  }, 500)
}

const onNext = async () => {
  if (changedColumns.value.size > 0) {
    await Modal.confirm({
      title: 'Do you want to save the changes?',
      okText: 'Save',
      cancelText: 'Discard',
      onOk: async () => {
        await save()
        emits('next')
      },
      onCancel: () => {
        emits('next')
      },
    })
  } else {
    emits('next')
  }
}

const reloadParentRowHook = inject(ReloadRowDataHookInj, createEventHook())

// override reload trigger and use it to reload grid and the form itself
const reloadHook = createEventHook()

reloadHook.on(() => {
  reloadParentRowHook?.trigger(false)
  if (isNew.value) return
  _loadRow()
})
provide(ReloadRowDataHookInj, reloadHook)

if (isKanban.value) {
  // adding column titles to changedColumns if they are preset
  for (const [k, v] of Object.entries(row.value.row)) {
    if (v) {
      changedColumns.value.add(k)
    }
  }
}

provide(IsExpandedFormOpenInj, isExpanded)

const cellWrapperEl = ref()

onMounted(() => {
  setTimeout(() => {
    cellWrapperEl.value?.$el?.querySelector('input,select,textarea')?.focus()
  }, 300)
})

const addNewRow = () => {
  setTimeout(async () => {
    row.value = {
      row: {},
      oldRow: {},
      rowMeta: { new: true },
    }
    rowState.value = {}
    key.value++
    isExpanded.value = true
  }, 500)
}

const save = async () => {
  if (isNew.value) {
    const data = await _save(rowState.value)
    await syncLTARRefs(data)
    reloadTrigger?.trigger()
  } else {
    await _save()
    reloadTrigger?.trigger()
  }
}

// attach keyboard listeners to switch between rows
// using alt + left/right arrow keys
useActiveKeyupListener(
  isExpanded,
  async (e: KeyboardEvent) => {
    if (!e.altKey) return
    if (e.key === 'ArrowLeft') {
      e.stopPropagation()
      emits('prev')
    } else if (e.key === 'ArrowRight') {
      e.stopPropagation()
      onNext()
    }
    // on alt + s save record
    else if (e.code === 'KeyS') {
      // remove focus from the active input if any
      ;(document.activeElement as HTMLElement)?.blur()

      e.stopPropagation()

      if (isNew.value) {
        const data = await _save(rowState.value)
        await syncLTARRefs(data)
        reloadHook?.trigger(null)
      } else {
        await save()
        reloadHook?.trigger(null)
      }
      if (!saveRowAndStay.value) {
        onClose()
      }
      // on alt + n create new record
    } else if (e.code === 'KeyN') {
      // remove focus from the active input if any to avoid unwanted input
      ;(document.activeElement as HTMLInputElement)?.blur?.()

      if (changedColumns.value.size > 0) {
        await Modal.confirm({
          title: 'Do you want to save the changes?',
          okText: 'Save',
          cancelText: 'Discard',
          onOk: async () => {
            await save()
            reloadHook?.trigger(null)
            addNewRow()
          },
          onCancel: () => {
            addNewRow()
          },
        })
      } else if (isNew.value) {
        await Modal.confirm({
          title: 'Do you want to save the record?',
          okText: 'Save',
          cancelText: 'Discard',
          onOk: async () => {
            const data = await _save(rowState.value)
            await syncLTARRefs(data)
            reloadHook?.trigger(null)
            addNewRow()
          },
          onCancel: () => {
            addNewRow()
          },
        })
      } else {
        addNewRow()
      }
    }
  },
  { immediate: true },
)

const showDeleteRowModal = ref(false)

const onDeleteRowClick = () => {
  showDeleteRowModal.value = true
}

const onConfirmDeleteRowClick = async () => {
  showDeleteRowModal.value = false
  await deleteRowById(primaryKey.value)
  message.success('Row deleted')
  if (!props.lastRow) {
    await onNext()
  } else if (!props.firstRow) {
    emits('prev')
  } else {
    onClose()
  }
}
</script>

<script lang="ts">
export default {
  name: 'ExpandedForm',
}
</script>

<template>
  <NcModal
    :key="key"
    v-model:visible="isExpanded"
    :footer="null"
    :width="commentsDrawer && isUIAllowed('commentList') ? 'min(80vw,1280px)' : 'min(80vw,1280px)'"
    :body-style="{ padding: 0 }"
    :closable="false"
    size="large"
    class="nc-drawer-expanded-form"
    :class="{ active: isExpanded }"
  >
    <div class="h-[80vh] max-h-215 flex flex-col">
      <div class="flex h-8 flex-shrink-0 w-full items-center nc-expanded-form-header relative mb-4 justify-between">
        <div class="flex gap-3">
          <div class="flex gap-2">
            <NcButton v-if="props.showNextPrevIcons" type="secondary" class="nc-prev-arrow !w-10" @click="$emit('prev')">
              <MdiChevronUp class="text-md text-gray-700" />
            </NcButton>
            <NcButton v-if="!props.lastRow" type="secondary" class="nc-next-arrow !w-10" @click="onNext">
              <MdiChevronDown class="text-md text-gray-700" />
            </NcButton>
          </div>
          <div v-if="displayValue" class="flex items-center truncate max-w-32 font-bold text-gray-800 text-xl">
            {{ displayValue }}
          </div>
          <div class="bg-gray-100 px-2 gap-1 flex my-1 items-center rounded-lg text-gray-800 font-medium">
            <TableIcon class="w-6 h-6 text-sm" />
            All {{ meta.title }}
          </div>
        </div>
        <div class="flex gap-2">
          <NcDropdown v-if="!isNew">
            <NcButton type="secondary" class="nc-expand-form-more-actions w-10">
              <GeneralIcon icon="threeDotVertical" class="text-md text-gray-700" />
            </NcButton>
            <template #overlay>
              <NcMenu>
                <NcMenuItem v-if="!isNew" class="text-gray-700" @click="_loadRow()">
                  <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center">
                    <component :is="iconMap.reload" class="cursor-pointer" />
                    {{ $t('general.reload') }}
                  </div>
                </NcMenuItem>
                <NcMenuItem
                  v-if="isUIAllowed('dataEdit') && !isNew"
                  class="text-gray-700"
                  @click="!isNew ? onDuplicateRow() : () => {}"
                >
                  <div v-e="['c:row-expand:duplicate']" class="flex gap-2 items-center">
                    <component :is="iconMap.copy" class="cursor-pointer nc-duplicate-row" />
                    Duplicate record
                  </div>
                </NcMenuItem>
                <a-menu-divider class="my-1" />
                <NcMenuItem
                  v-if="isUIAllowed('dataEdit') && !isNew"
                  v-e="['c:row-expand:delete']"
                  class="!text-red-500"
                  @click="!isNew && onDeleteRowClick()"
                >
                  <component :is="iconMap.delete" class="cursor-pointer nc-delete-row" />
                  Delete record
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
          <NcButton type="secondary" class="nc-expand-form-close-btn w-10" @click="onClose">
            <GeneralIcon icon="close" class="text-md text-gray-700" />
          </NcButton>
        </div>
      </div>
      <div class="flex flex-row h-[calc(100%-6rem)] w-full h-full gap-4">
        <div class="flex w-full h-full flex-col border-1 rounded-xl overflow-hidden border-gray-200">
          <div
            class="flex flex-grow-1 mt-2 h-[calc(100%-3.5rem)] nc-scrollbar-md flex-col !pb-12 items-center w-full bg-white p-4"
          >
            <div
              v-for="(col, i) of fields"
              v-show="isFormula(col) || !isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
              :key="col.title"
              class="mt-2 py-2"
              :class="`nc-expand-col-${col.title}`"
              :data-testid="`nc-expand-col-${col.title}`"
            >
              <div class="flex items-start flex-row">
                <div class="w-[12rem] mt-1.5">
                  <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" class="nc-expanded-cell-header" :column="col" />

                  <LazySmartsheetHeaderCell v-else class="nc-expanded-cell-header" :column="col" />
                </div>

                <LazySmartsheetDivDataCell
                  v-if="col.title"
                  :ref="i ? null : (el: any) => (cellWrapperEl = el)"
                  class="!bg-white rounded-lg !w-[20rem] border-1 border-gray-200 px-1 min-h-[35px] flex items-center relative"
                >
                  <LazySmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :row="row" :column="col" />

                  <LazySmartsheetCell
                    v-else
                    v-model="row.row[col.title]"
                    :column="col"
                    :edit-enabled="true"
                    :active="true"
                    :read-only="isPublic"
                    @update:model-value="changedColumns.add(col.title)"
                  />
                </LazySmartsheetDivDataCell>
              </div>
            </div>
            <div v-if="hiddenFields.length > 0" class="flex w-full px-12 items-center py-3">
              <div class="flex-grow h-px mr-1 bg-gray-100"></div>
              <NcButton type="secondary" size="small" class="flex-shrink-1 !text-sm" @click="toggleHiddenFields">
                {{ showHiddenFields ? `Hide ${hiddenFields.length} hidden` : `Show ${hiddenFields.length} hidden` }}
                {{ hiddenFields.length > 1 ? `fields` : `field` }}
                <MdiChevronDown class="ml-1" :class="showHiddenFields ? 'transform rotate-180' : ''" />
              </NcButton>
              <div class="flex-grow h-px ml-1 bg-gray-100"></div>
            </div>
            <div v-if="hiddenFields.length > 0 && showHiddenFields" class="mb-3">
              <div
                v-for="(col, i) of hiddenFields"
                v-show="isFormula(col) || !isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
                :key="col.title"
                class="mt-2 py-2"
                :class="`nc-expand-col-${col.title}`"
                :data-testid="`nc-expand-col-${col.title}`"
              >
                <div class="flex flex-row items-start">
                  <div class="w-[12rem] scale-110 mt-2.5">
                    <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" />

                    <LazySmartsheetHeaderCell v-else :column="col" />
                  </div>

                  <LazySmartsheetDivDataCell
                    v-if="col.title"
                    :ref="i ? null : (el: any) => (cellWrapperEl = el)"
                    class="!bg-white rounded-lg !w-[20rem] border-1 border-gray-200 px-1 min-h-[35px] flex items-center relative"
                  >
                    <LazySmartsheetVirtualCell v-if="isVirtualCol(col)" v-model="row.row[col.title]" :row="row" :column="col" />

                    <LazySmartsheetCell
                      v-else
                      v-model="row.row[col.title]"
                      :column="col"
                      :edit-enabled="true"
                      :active="true"
                      :read-only="isPublic"
                      @update:model-value="changedColumns.add(col.title)"
                    />
                  </LazySmartsheetDivDataCell>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="isUIAllowed('dataEdit')"
            class="w-full h-14 border-t-1 border-gray-200 bottom-0 z-10 bg-white flex items-center justify-end p-2"
          >
            <NcButton type="primary" size="medium" class="nc-expand-form-save-btn" @click="save"> Save </NcButton>
          </div>
        </div>
        <div
          v-if="!isNew && commentsDrawer && isUIAllowed('commentList')"
          class="nc-comments-drawer border-1 relative border-gray-200 w-[380px] bg-gray-50 rounded-xl min-w-0 overflow-hidden h-full"
          :class="{ active: commentsDrawer && isUIAllowed('commentList') }"
        >
          <LazySmartsheetExpandedFormComments />
        </div>
      </div>
    </div>
  </NcModal>

  <GeneralModal v-model:visible="showDeleteRowModal" class="!w-[25rem]">
    <div class="p-4">
      <div class="prose-xl font-bold self-center">Delete row ?</div>

      <div class="mt-4">Are you sure you want to delete this row?</div>
    </div>
    <div class="flex flex-row gap-x-2 mt-1 pt-1.5 justify-end p-4">
      <NcButton @click="onConfirmDeleteRowClick">{{ $t('general.confirm') }} </NcButton>
    </div>
  </GeneralModal>
</template>

<style lang="scss">
.nc-expanded-cell-header > :nth-child(2) {
  @apply !text-sm;
}
.nc-expanded-cell-header > :first-child {
  @apply !text-xl;
}
</style>
