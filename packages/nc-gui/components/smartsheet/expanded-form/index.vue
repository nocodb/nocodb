<script setup lang="ts">
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import MdiChevronDown from '~icons/mdi/chevron-down'

import {
  CellClickHookInj,
  FieldsInj,
  IsExpandedFormOpenInj,
  IsKanbanInj,
  IsPublicInj,
  MetaInj,
  ReloadRowDataHookInj,
  computedInject,
  createEventHook,
  iconMap,
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

interface Props {
  modelValue?: boolean
  state?: Record<string, any> | null
  meta: TableType
  loadRow?: boolean
  useMetaFields?: boolean
  row?: Row
  rowId?: string
  view?: ViewType
  showNextPrevIcons?: boolean
  firstRow?: boolean
  lastRow?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'cancel', 'next', 'prev'])

const { activeView } = storeToRefs(useViewsStore())

const key = ref(0)

const wrapper = ref()

const { dashboardUrl } = useDashboard()

const { copy } = useClipboard()

const { isMobileMode } = useGlobal()

const { t } = useI18n()

const rowId = toRef(props, 'rowId')

const row = toRef(props, 'row')

const state = toRef(props, 'state')

const meta = toRef(props, 'meta')

const islastRow = toRef(props, 'lastRow')

const isFirstRow = toRef(props, 'firstRow')

const route = useRoute()

const router = useRouter()

const isPublic = inject(IsPublicInj, ref(false))

// to check if a expanded form which is not yet saved exist or not
const isUnsavedFormExist = ref(false)

const isRecordLinkCopied = ref(false)

const { isUIAllowed } = useRoles()

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const { addOrEditStackRow } = useKanbanViewStoreOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

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

const isLoading = ref(true)

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
  row: _row,
  save: _save,
  loadCommentsAndLogs,
  clearColumns,
} = useProvideExpandedFormStore(meta, row)

const duplicatingRowInProgress = ref(false)

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
  if (changedColumns.value.size > 0) {
    isCloseModalOpen.value = true
  } else {
    if (_row.value?.rowMeta?.new) emits('cancel')
    isExpanded.value = false
  }
}

const onDuplicateRow = () => {
  duplicatingRowInProgress.value = true
  isUnsavedFormExist.value = true
  const oldRow = { ..._row.value.row }
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
    _row.value = newRow
    duplicatingRowInProgress.value = false
    message.success(t('msg.success.rowDuplicatedWithoutSavedYet'))
  }, 500)
}

const save = async () => {
  if (isNew.value) {
    const data = await _save(rowState.value)
    reloadTrigger?.trigger()
  } else {
    let kanbanClbk
    if (activeView.value?.type === ViewTypes.KANBAN) {
      kanbanClbk = (row: any, isNewRow: boolean) => {
        addOrEditStackRow(row, isNewRow)
      }
    }

    await _save(undefined, undefined, {
      kanbanClbk,
    })
    reloadTrigger?.trigger()
  }
  isUnsavedFormExist.value = false
}

const isPreventChangeModalOpen = ref(false)
const isCloseModalOpen = ref(false)

const discardPreventModal = () => {
  // when user click on next or previous button
  if (isPreventChangeModalOpen.value) {
    emits('next')
    if (_row.value?.rowMeta?.new) emits('cancel')
    isPreventChangeModalOpen.value = false
  }
  // when user click on close button
  if (isCloseModalOpen.value) {
    isCloseModalOpen.value = false
    if (_row.value?.rowMeta?.new) emits('cancel')
    isExpanded.value = false
  }
  // clearing all new modifed change on close
  clearColumns()
}

const onNext = async () => {
  if (changedColumns.value.size > 0) {
    isPreventChangeModalOpen.value = true
    return
  }
  emits('next')
}

const copyRecordUrl = async () => {
  await copy(
    encodeURI(
      `${dashboardUrl?.value}#/${route.params.typeOrId}/${route.params.baseId}/${meta.value?.id}${
        props.view ? `/${props.view.title}` : ''
      }?rowId=${primaryKey.value}`,
    ),
  )

  isRecordLinkCopied.value = true
}

const saveChanges = async () => {
  if (isPreventChangeModalOpen.value) {
    isUnsavedFormExist.value = false
    await save()
    emits('next')
    isPreventChangeModalOpen.value = false
  }
  if (isCloseModalOpen.value) {
    isCloseModalOpen.value = false
    await save()
    isExpanded.value = false
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
  for (const [k, v] of Object.entries(_row.value.row)) {
    if (v) {
      changedColumns.value.add(k)
    }
  }
}
provide(IsExpandedFormOpenInj, isExpanded)

const cellWrapperEl = ref()

onMounted(async () => {
  isRecordLinkCopied.value = false
  isLoading.value = true

  const focusFirstCell = !isExpandedFormCommentMode.value

  if (props.loadRow) {
    await _loadRow()
    await loadCommentsAndLogs()
  }

  if (props.rowId) {
    try {
      await _loadRow(props.rowId)
      await loadCommentsAndLogs()
    } catch (e: any) {
      if (e.response?.status === 404) {
        message.error(t('msg.noRecordFound'))
        router.replace({ query: {} })
      } else throw e
    }
  }

  isLoading.value = false

  if (focusFirstCell) {
    setTimeout(() => {
      cellWrapperEl.value?.$el?.querySelector('input,select,textarea')?.focus()
    }, 300)
  }
})

const addNewRow = () => {
  setTimeout(async () => {
    _row.value = {
      row: {},
      oldRow: {},
      rowMeta: { new: true },
    }
    rowState.value = {}
    key.value++
    isExpanded.value = true
  }, 500)
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
        await _save(rowState.value)
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
          title: t('msg.saveChanges'),
          okText: t('general.save'),
          cancelText: t('labels.discard'),
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
          okText: t('general.save'),
          cancelText: t('labels.discard'),
          onOk: async () => {
            await _save(rowState.value)
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
  message.success(t('msg.rowDeleted'))
  reloadTrigger.trigger()
  onClose()
  showDeleteRowModal.value = false
}

watch(rowId, async (nRow) => {
  await _loadRow(nRow)
  await loadCommentsAndLogs()
})

const showRightSections = computed(() => {
  return !isNew.value && commentsDrawer.value && isUIAllowed('commentList')
})

const preventModalStatus = computed({
  get: () => isCloseModalOpen.value || isPreventChangeModalOpen.value,
  set: (v) => {
    isCloseModalOpen.value = v
  },
})

const onIsExpandedUpdate = (v: boolean) => {
  if (changedColumns.value.size === 0 && !isUnsavedFormExist.value) {
    isExpanded.value = v
  } else if (!v) {
    preventModalStatus.value = true
  } else {
    isExpanded.value = v
  }
}

const isReadOnlyVirtualCell = (column: ColumnType) => {
  return isRollup(column) || isFormula(column) || isBarcode(column) || isLookup(column) || isQrCode(column)
}
</script>

<script lang="ts">
export default {
  name: 'ExpandedForm',
}
</script>

<template>
  <NcModal
    :visible="isExpanded"
    :footer="null"
    :width="commentsDrawer && isUIAllowed('commentList') ? 'min(80vw,1280px)' : 'min(80vw,1280px)'"
    :body-style="{ padding: 0 }"
    :closable="false"
    size="small"
    class="nc-drawer-expanded-form"
    :class="{ active: isExpanded }"
    @update:visible="onIsExpandedUpdate"
  >
    <div class="h-[85vh] xs:(max-h-full) max-h-215 flex flex-col p-6">
      <div class="flex h-9.5 flex-shrink-0 w-full items-center nc-expanded-form-header relative mb-4 justify-between">
        <template v-if="!isMobileMode">
          <div class="flex gap-3 w-100">
            <div class="flex gap-2">
              <NcButton
                v-if="props.showNextPrevIcons"
                :disabled="isFirstRow"
                type="secondary"
                class="nc-prev-arrow !w-10"
                @click="$emit('prev')"
              >
                <MdiChevronUp class="text-md" />
              </NcButton>
              <NcButton
                v-if="props.showNextPrevIcons"
                :disabled="islastRow"
                type="secondary"
                class="nc-next-arrow !w-10"
                @click="onNext"
              >
                <MdiChevronDown class="text-md" />
              </NcButton>
            </div>
            <div v-if="isLoading">
              <a-skeleton-input class="!h-8 !sm:mr-14 !w-52 mt-1 !rounded-md !overflow-hidden" active size="small" />
            </div>
            <div v-else-if="displayValue && !row.rowMeta?.new" class="flex items-center font-bold text-gray-800 text-xl w-64">
              <span class="truncate">
                {{ displayValue }}
              </span>
            </div>
            <div v-if="row.rowMeta?.new" class="flex items-center truncate font-bold text-gray-800 text-xl">New Record</div>
          </div>
          <div class="flex gap-2">
            <NcButton
              v-if="!isNew"
              type="secondary"
              class="!xs:hidden text-gray-700"
              @click="!isNew ? copyRecordUrl() : () => {}"
            >
              <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex gap-2 items-center">
                <component :is="iconMap.check" v-if="isRecordLinkCopied" class="cursor-pointer nc-duplicate-row" />
                <component :is="iconMap.link" v-else class="cursor-pointer nc-duplicate-row" />
                {{ isRecordLinkCopied ? $t('labels.copiedRecordURL') : $t('labels.copyRecordURL') }}
              </div>
            </NcButton>
            <NcDropdown v-if="!isNew" placement="bottomRight">
              <NcButton type="secondary" class="nc-expand-form-more-actions w-10">
                <GeneralIcon icon="threeDotVertical" class="text-md text-gray-700" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem v-if="!isNew" class="text-gray-700" @click="_loadRow()">
                    <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center" data-testid="nc-expanded-form-reload">
                      <component :is="iconMap.reload" class="cursor-pointer" />
                      {{ $t('general.reload') }}
                    </div>
                  </NcMenuItem>
                  <NcMenuItem v-if="!isNew && isMobileMode" class="text-gray-700" @click="!isNew ? copyRecordUrl() : () => {}">
                    <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex gap-2 items-center">
                      <component :is="iconMap.link" class="cursor-pointer nc-duplicate-row" />
                      {{ $t('labels.copyRecordURL') }}
                    </div>
                  </NcMenuItem>
                  <NcMenuItem
                    v-if="isUIAllowed('dataEdit') && !isNew"
                    class="text-gray-700"
                    @click="!isNew ? onDuplicateRow() : () => {}"
                  >
                    <div
                      v-e="['c:row-expand:duplicate']"
                      data-testid="nc-expanded-form-duplicate"
                      class="flex gap-2 items-center"
                    >
                      <component :is="iconMap.copy" class="cursor-pointer nc-duplicate-row" />
                      <span class="-ml-0.25">
                        {{ $t('labels.duplicateRecord') }}
                      </span>
                    </div>
                  </NcMenuItem>
                  <NcDivider v-if="isUIAllowed('dataEdit') && !isNew" />
                  <NcMenuItem
                    v-if="isUIAllowed('dataEdit') && !isNew"
                    v-e="['c:row-expand:delete']"
                    class="!text-red-500 !hover:bg-red-50"
                    @click="!isNew && onDeleteRowClick()"
                  >
                    <component :is="iconMap.delete" data-testid="nc-expanded-form-delete" class="cursor-pointer nc-delete-row" />
                    <span class="-ml-0.5">
                      {{ $t('activity.deleteRecord') }}
                    </span>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
            <NcButton
              type="secondary"
              class="nc-expand-form-close-btn w-10"
              data-testid="nc-expanded-form-close"
              @click="onClose"
            >
              <GeneralIcon icon="close" class="text-md text-gray-700" />
            </NcButton>
          </div>
        </template>
        <template v-else>
          <div class="flex flex-row w-full">
            <NcButton
              v-if="props.showNextPrevIcons && !isFirstRow"
              v-e="['c:row-expand:prev']"
              type="secondary"
              class="nc-prev-arrow !w-10"
              @click="$emit('prev')"
            >
              <GeneralIcon icon="arrowLeft" class="text-lg text-gray-700" />
            </NcButton>
            <div v-else class="min-w-10.5"></div>
            <div class="flex flex-grow justify-center items-center font-semibold text-lg">
              <div>{{ meta.title }}</div>
            </div>
            <NcButton
              v-if="props.showNextPrevIcons && !islastRow"
              v-e="['c:row-expand:next']"
              type="secondary"
              class="nc-next-arrow !w-10"
              @click="onNext"
            >
              <GeneralIcon icon="arrowRight" class="text-lg text-gray-700" />
            </NcButton>
            <div v-else class="min-w-10.5"></div>
          </div>
        </template>
      </div>
      <div ref="wrapper" class="flex flex-grow flex-row h-[calc(100%-4rem)] w-full gap-4">
        <div
          class="flex xs:w-full flex-col border-1 rounded-xl overflow-hidden border-gray-200 xs:(border-0 rounded-none)"
          :class="{
            'w-full': !showRightSections,
            'w-2/3': showRightSections,
          }"
        >
          <div
            class="flex flex-col flex-grow mt-2 h-full max-h-full nc-scrollbar-md pb-6 items-center w-full bg-white p-4 xs:p-0"
          >
            <div
              v-for="(col, i) of fields"
              v-show="isFormula(col) || !isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
              :key="col.title"
              class="nc-expanded-form-row mt-2 py-2 xs:w-full"
              :class="`nc-expand-col-${col.title}`"
              :col-id="col.id"
              :data-testid="`nc-expand-col-${col.title}`"
            >
              <div class="flex items-start flex-row sm:(gap-x-6) xs:(flex-col w-full) nc-expanded-cell min-h-10">
                <div class="w-48 xs:(w-full) mt-0.25 !h-[35px]">
                  <LazySmartsheetHeaderVirtualCell
                    v-if="isVirtualCol(col)"
                    class="nc-expanded-cell-header h-full"
                    :column="col"
                  />

                  <LazySmartsheetHeaderCell v-else class="nc-expanded-cell-header" :column="col" />
                </div>

                <template v-if="isLoading">
                  <div
                    v-if="isMobileMode"
                    class="!h-8.5 !xs:h-12 !xs:bg-white !sm:mr-21 !w-60 mt-0.75 !rounded-lg !overflow-hidden"
                  ></div>
                  <a-skeleton-input
                    v-else
                    class="!h-8.5 !xs:h-9.5 !xs:bg-white !sm:mr-21 !w-60 mt-0.75 !rounded-lg !overflow-hidden"
                    active
                    size="small"
                  />
                </template>
                <template v-else>
                  <SmartsheetDivDataCell
                    v-if="col.title"
                    :ref="i ? null : (el: any) => (cellWrapperEl = el)"
                    class="bg-white rounded-lg !w-[20rem] !xs:w-full border-1 border-gray-200 overflow-hidden px-1 sm:min-h-[35px] xs:min-h-13 flex items-center relative"
                    :class="{
                      '!bg-gray-50 !px-0 !select-text': isReadOnlyVirtualCell(col),
                    }"
                  >
                    <LazySmartsheetVirtualCell
                      v-if="isVirtualCol(col)"
                      v-model="_row.row[col.title]"
                      :row="_row"
                      :column="col"
                      :class="{
                        'px-1': isReadOnlyVirtualCell(col),
                      }"
                    />

                    <LazySmartsheetCell
                      v-else
                      v-model="_row.row[col.title]"
                      :column="col"
                      :edit-enabled="true"
                      :active="true"
                      :read-only="isPublic"
                      @update:model-value="changedColumns.add(col.title)"
                    />
                  </SmartsheetDivDataCell>
                </template>
              </div>
            </div>
            <div v-if="hiddenFields.length > 0" class="flex w-full sm:px-12 xs:(px-1 mt-2) items-center py-3">
              <div class="flex-grow h-px mr-1 bg-gray-100"></div>
              <NcButton
                type="secondary"
                :size="isMobileMode ? 'medium' : 'small'"
                class="flex-shrink-1 !text-sm"
                @click="toggleHiddenFields"
              >
                {{ showHiddenFields ? `Hide ${hiddenFields.length} hidden` : `Show ${hiddenFields.length} hidden` }}
                {{ hiddenFields.length > 1 ? `fields` : `field` }}
                <MdiChevronDown class="ml-1" :class="showHiddenFields ? 'transform rotate-180' : ''" />
              </NcButton>
              <div class="flex-grow h-px ml-1 bg-gray-100"></div>
            </div>
            <div v-if="hiddenFields.length > 0 && showHiddenFields" class="flex flex-col w-full mb-3 items-center">
              <div
                v-for="(col, i) of hiddenFields"
                v-show="isFormula(col) || !isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
                :key="col.title"
                class="sm:(mt-2) py-2 xs:w-full"
                :class="`nc-expand-col-${col.title}`"
                :data-testid="`nc-expand-col-${col.title}`"
              >
                <div class="sm:gap-x-6 flex sm:flex-row xs:(flex-col) items-start min-h-10">
                  <div class="sm:w-48 xs:w-full scale-110 !h-[35px]">
                    <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" class="nc-expanded-cell-header" />

                    <LazySmartsheetHeaderCell v-else class="nc-expanded-cell-header" :column="col" />
                  </div>

                  <template v-if="isLoading">
                    <div
                      v-if="isMobileMode"
                      class="!h-8.5 !xs:h-9.5 !xs:bg-white !sm:mr-21 !w-60 mt-0.75 !rounded-lg !overflow-hidden"
                    ></div>
                    <a-skeleton-input
                      v-else
                      class="!h-8.5 !xs:h-12 !xs:bg-white !sm:mr-21 !w-60 mt-0.75 !rounded-lg !overflow-hidden"
                      active
                      size="small"
                    />
                  </template>
                  <template v-else>
                    <LazySmartsheetDivDataCell
                      v-if="col.title"
                      :ref="i ? null : (el: any) => (cellWrapperEl = el)"
                      class="!bg-white rounded-lg !w-[20rem] border-1 overflow-hidden border-gray-200 px-1 sm:min-h-[35px] xs:min-h-13 flex items-center relative"
                    >
                      <LazySmartsheetVirtualCell
                        v-if="isVirtualCol(col)"
                        v-model="_row.row[col.title]"
                        :row="_row"
                        :column="col"
                      />

                      <LazySmartsheetCell
                        v-else
                        v-model="_row.row[col.title]"
                        :column="col"
                        :edit-enabled="true"
                        :active="true"
                        :read-only="isPublic"
                        @update:model-value="changedColumns.add(col.title)"
                      />
                    </LazySmartsheetDivDataCell>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="isUIAllowed('dataEdit')"
            class="w-full h-16 border-t-1 border-gray-200 bg-white flex items-center justify-end p-3 xs:(p-0 mt-4 border-t-0 gap-x-4 justify-between)"
          >
            <NcDropdown v-if="!isNew && isMobileMode" placement="bottomRight">
              <NcButton type="secondary" class="nc-expand-form-more-actions w-10">
                <GeneralIcon icon="threeDotVertical" class="text-md text-gray-700" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem v-if="!isNew" class="text-gray-700" @click="_loadRow()">
                    <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center" data-testid="nc-expanded-form-reload">
                      <component :is="iconMap.reload" class="cursor-pointer" />
                      {{ $t('general.reload') }}
                    </div>
                  </NcMenuItem>
                  <NcDivider />
                  <NcMenuItem
                    v-if="isUIAllowed('dataEdit') && !isNew"
                    v-e="['c:row-expand:delete']"
                    class="!text-red-500 !hover:bg-red-50"
                    @click="!isNew && onDeleteRowClick()"
                  >
                    <div data-testid="nc-expanded-form-delete">
                      <component :is="iconMap.delete" class="cursor-pointer nc-delete-row" />
                      Delete record
                    </div>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>

            <div class="flex flex-row gap-x-3">
              <NcButton
                v-if="isMobileMode"
                type="secondary"
                size="medium"
                data-testid="nc-expanded-form-save"
                class="nc-expand-form-save-btn !xs:(text-base)"
                @click="onClose"
              >
                <div class="px-1">Close</div>
              </NcButton>
              <NcButton
                v-e="['c:row-expand:save']"
                data-testid="nc-expanded-form-save"
                type="primary"
                size="medium"
                class="nc-expand-form-save-btn !xs:(text-base)"
                :disabled="changedColumns.size === 0 && !isUnsavedFormExist"
                @click="save"
              >
                <div class="xs:px-1">Save</div>
              </NcButton>
            </div>
          </div>
        </div>
        <div
          v-if="showRightSections"
          class="nc-comments-drawer border-1 relative border-gray-200 w-1/3 max-w-125 bg-gray-50 rounded-xl min-w-0 overflow-hidden h-full xs:hidden"
          :class="{ active: commentsDrawer && isUIAllowed('commentList') }"
        >
          <SmartsheetExpandedFormComments :loading="isLoading" />
        </div>
      </div>
    </div>
  </NcModal>

  <GeneralDeleteModal v-model:visible="showDeleteRowModal" entity-name="Record" :on-delete="() => onConfirmDeleteRowClick()">
    <template #entity-preview>
      <span>
        <div class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700 mb-4">
          <div class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75 break-keep whitespace-nowrap">
            {{ displayValue }}
          </div>
        </div>
      </span>
    </template>
  </GeneralDeleteModal>

  <!-- Prevent unsaved change modal -->
  <NcModal v-model:visible="preventModalStatus" size="small">
    <div class="">
      <div class="flex flex-row items-center gap-x-2 text-base font-bold">
        {{ $t('tooltip.saveChanges') }}
      </div>
      <div class="flex font-medium mt-2">
        {{ $t('activity.doYouWantToSaveTheChanges') }}
      </div>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" @click="discardPreventModal">{{ $t('labels.discard') }}</NcButton>

        <NcButton key="submit" type="primary" label="Rename Table" loading-label="Renaming Table" @click="saveChanges">
          {{ $t('tooltip.saveChanges') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-drawer-expanded-form {
  @apply xs:my-0;
}

.nc-expanded-cell {
  input {
    @apply xs:(h-12 text-base);
  }
}

.nc-expanded-cell-header {
  @apply w-full text-gray-500 xs:(text-gray-600 mb-2);
}

.nc-expanded-cell-header > :nth-child(2) {
  @apply !text-sm !xs:text-base;
}
.nc-expanded-cell-header > :first-child {
  @apply !text-xl;
}

.nc-drawer-expanded-form .nc-modal {
  @apply !p-0;
}
</style>

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !xs:(h-full);
}

:deep(.ant-select-selection-item) {
  @apply !xs:(mt-1.75 ml-1);
}
</style>
