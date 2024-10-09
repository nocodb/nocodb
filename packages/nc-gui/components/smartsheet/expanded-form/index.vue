<script setup lang="ts">
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import {
  ViewTypes,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'
import type { Ref } from 'vue'
import { Drawer } from 'ant-design-vue'
import NcModal from '../../nc/Modal.vue'
import MdiChevronDown from '~icons/mdi/chevron-down'

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
  closeAfterSave?: boolean
  newRecordHeader?: string
  skipReload?: boolean
  newRecordSubmitBtnText?: string
  expandForm?: (row: Row) => void
  maintainDefaultViewOrder?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'cancel', 'next', 'prev', 'createdRecord', 'updateRowCommentCount'])

const { activeView } = storeToRefs(useViewsStore())

const key = ref(0)

const wrapper = ref()

const { dashboardUrl } = useDashboard()

const { copy } = useClipboard()

const { isMobileMode } = useGlobal()

const { fieldsMap, isLocalMode } = useViewColumnsOrThrow()

const { t } = useI18n()

const rowId = toRef(props, 'rowId')

const row = toRef(props, 'row')

const state = toRef(props, 'state')

const meta = toRef(props, 'meta')

const islastRow = toRef(props, 'lastRow')

const isFirstRow = toRef(props, 'firstRow')

const maintainDefaultViewOrder = toRef(props, 'maintainDefaultViewOrder')

const route = useRoute()

const isPublic = inject(IsPublicInj, ref(false))

// to check if a expanded form which is not yet saved exist or not
const isUnsavedFormExist = ref(false)

const isUnsavedDuplicatedRecordExist = ref(false)

const isRecordLinkCopied = ref(false)

const { isUIAllowed } = useRoles()

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value)

const expandedFormScrollWrapper = ref()

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const { addOrEditStackRow } = useKanbanViewStoreOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

// override cell click hook to avoid unexpected behavior at form fields
provide(CellClickHookInj, undefined)

const loadingEmit = (event: 'update:modelValue' | 'cancel' | 'next' | 'prev' | 'createdRecord') => {
  emits(event)
  isLoading.value = true
}

const fields = computedInject(FieldsInj, (_fields) => {
  if (props.useMetaFields) {
    if (maintainDefaultViewOrder.value) {
      return (meta.value.columns ?? [])
        .filter((col) => !isSystemColumn(col))
        .sort((a, b) => {
          return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
        })
    }

    return (meta.value.columns ?? []).filter((col) => !isSystemColumn(col))
  }
  return _fields?.value ?? []
})

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value?.includes(c)) ?? null)

const hiddenFields = computed(() => {
  // todo: figure out when meta.value is undefined
  return (meta.value?.columns ?? [])
    .filter(
      (col) =>
        !fields.value?.includes(col) &&
        (isLocalMode.value && col?.id && fieldsMap.value[col.id] ? fieldsMap.value[col.id]?.initialShow : true),
    )
    .filter((col) => !isSystemColumn(col))
})

const showHiddenFields = ref(false)

const toggleHiddenFields = () => {
  showHiddenFields.value = !showHiddenFields.value
}

const isKanban = inject(IsKanbanInj, ref(false))

provide(MetaInj, meta)

const isLoading = ref(true)

const isSaving = ref(false)

const {
  commentsDrawer,
  changedColumns,
  deleteRowById,
  displayValue,
  state: rowState,
  isNew,
  loadRow: _loadRow,
  primaryKey,
  row: _row,
  comments,
  save: _save,
  loadComments,
  loadAudits,
  clearColumns,
} = useProvideExpandedFormStore(meta, row)

reloadViewDataTrigger.on(async () => {
  await _loadRow(rowId.value, false, true)
})

const duplicatingRowInProgress = ref(false)

useProvideSmartsheetStore(ref({}) as Ref<ViewType>, meta)

useProvideSmartsheetLtarHelpers(meta)

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
  if (!isUIAllowed('dataEdit')) {
    isExpanded.value = false
  } else if (changedColumns.value.size > 0) {
    isCloseModalOpen.value = true
  } else {
    if (_row.value?.rowMeta?.new) emits('cancel')
    isExpanded.value = false
  }
}

const onDuplicateRow = () => {
  duplicatingRowInProgress.value = true
  isUnsavedFormExist.value = true
  isUnsavedDuplicatedRecordExist.value = true
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
  isSaving.value = true

  try {
    let kanbanClbk
    if (activeView.value?.type === ViewTypes.KANBAN) {
      kanbanClbk = (row: any, isNewRow: boolean) => {
        addOrEditStackRow(row, isNewRow)
      }
    }

    if (isNew.value) {
      await _save(rowState.value, undefined, {
        kanbanClbk,
      })
    } else {
      await _save(undefined, undefined, {
        kanbanClbk,
      })
      _loadRow()
    }

    if (!props.skipReload) {
      reloadTrigger?.trigger()
      reloadViewDataTrigger?.trigger()
    }

    isUnsavedFormExist.value = false

    if (props.closeAfterSave) {
      isExpanded.value = false
    } else {
      if (isUnsavedDuplicatedRecordExist.value) {
        const newRowId = extractPkFromRow(_row.value.row, meta.value.columns as ColumnType[])
        if (newRowId !== rowId.value) {
          props?.expandForm?.(_row.value)
        }

        setTimeout(() => {
          isUnsavedDuplicatedRecordExist.value = false
        }, 500)
      }
    }

    emits('createdRecord', _row.value.row)
  } catch (e: any) {
    if (isNew.value) {
      message.error(`Add row failed: ${await extractSdkResponseErrorMsg(e)}`)
    } else {
      message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  isSaving.value = false
}

const isPreventChangeModalOpen = ref(false)
const isCloseModalOpen = ref(false)

const discardPreventModal = () => {
  // when user click on next or previous button
  if (isPreventChangeModalOpen.value) {
    loadingEmit('next')
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
  loadingEmit('next')
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
    loadingEmit('next')
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
  reloadParentRowHook?.trigger({ shouldShowLoading: false })
  if (isNew.value) return

  _loadRow(undefined, true)
  loadAudits(rowId.value, false)
})
provide(ReloadRowDataHookInj, reloadHook)

if (isKanban.value) {
  // adding column titles to changedColumns if they are preset
  if (_row.value.rowMeta.new) {
    for (const [k, v] of Object.entries(_row.value.row)) {
      if (v) {
        changedColumns.value.add(k)
      }
    }
  }
}
provide(IsExpandedFormOpenInj, isExpanded)

const triggerRowLoad = async (rowId?: string) => {
  await Promise.allSettled([loadComments(rowId, false), loadAudits(rowId), _loadRow(rowId)])
  isLoading.value = false
}

const cellWrapperEl = ref()

onMounted(async () => {
  isRecordLinkCopied.value = false
  isLoading.value = true

  const focusFirstCell = !isExpandedFormCommentMode.value
  let isTriggered = false

  if (props.loadRow && !props.rowId) {
    await triggerRowLoad()
    isTriggered = true
  } else if (props.rowId && props.loadRow && !isTriggered) {
    await triggerRowLoad(props.rowId)
  } else {
    _row.value = props.row
  }

  isLoading.value = false

  if (focusFirstCell && isNew.value) {
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
      if (isFirstRow.value) return

      loadingEmit('prev')
    } else if (e.key === 'ArrowRight') {
      e.stopPropagation()
      if (islastRow.value) return

      onNext()
    }
    // on alt + s save record
    else if (e.code === 'KeyS') {
      // remove focus from the active input if any
      ;(document.activeElement as HTMLElement)?.blur()

      e.stopPropagation()

      try {
        if (isNew.value) {
          await _save(rowState.value)
          reloadHook?.trigger(null)
        } else {
          await save()
          reloadHook?.trigger(null)
        }
      } catch (e: any) {
        if (isNew.value) {
          message.error(`Add row failed: ${await extractSdkResponseErrorMsg(e)}`)
        } else {
          message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
        }
      }
      // on alt + n create new record
    } else if (e.code === 'KeyN') {
      // remove focus from the active input if any to avoid unwanted input
      ;(document.activeElement as HTMLInputElement)?.blur?.()

      if (changedColumns.value.size > 0) {
        Modal.confirm({
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
        Modal.confirm({
          title: 'Do you want to save the record?',
          okText: t('general.save'),
          cancelText: t('labels.discard'),
          onOk: async () => {
            try {
              await _save(rowState.value)
              reloadHook?.trigger(null)
              addNewRow()
            } catch (e: any) {
              message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
            }
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
  // Close expanded form
  isExpanded.value = false

  await deleteRowById(primaryKey.value || undefined)
  message.success(t('msg.rowDeleted'))
  await reloadViewDataTrigger.trigger({
    shouldShowLoading: false,
  })
  onClose()
  showDeleteRowModal.value = false
}

watch(rowId, async (nRow) => {
  await triggerRowLoad(nRow)
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
  let isDropdownOpen = false
  document.querySelectorAll('.ant-select-dropdown').forEach((el) => {
    isDropdownOpen = isDropdownOpen || el.checkVisibility()
  })

  if (isDropdownOpen) return

  if (changedColumns.value.size === 0 && !isUnsavedFormExist.value) {
    isExpanded.value = v
    if (isKanban.value) {
      emits('cancel')
    }
  } else if (!v && isUIAllowed('dataEdit')) {
    preventModalStatus.value = true
  } else {
    isExpanded.value = v
  }
}

const isReadOnlyVirtualCell = (column: ColumnType) => {
  return (
    isRollup(column) ||
    isFormula(column) ||
    isBarcode(column) ||
    isLookup(column) ||
    isQrCode(column) ||
    isSystemColumn(column) ||
    isCreatedOrLastModifiedTimeCol(column) ||
    isCreatedOrLastModifiedByCol(column)
  )
}

// Small hack. We need to scroll to the bottom of the form after its mounted and back to top.
// So that tab to next row works properly, as otherwise browser will focus to save button
// when we reach to the bottom of the visual scrollable area, not the actual bottom of the form
watch([expandedFormScrollWrapper, isLoading], () => {
  if (isMobileMode.value) return

  const expandedFormScrollWrapperEl = expandedFormScrollWrapper.value

  if (expandedFormScrollWrapperEl && !isLoading.value) {
    expandedFormScrollWrapperEl.scrollTop = expandedFormScrollWrapperEl.scrollHeight

    setTimeout(() => {
      expandedFormScrollWrapperEl.scrollTop = 0
    }, 125)
  }
})

const modalProps = computed(() => {
  if (isMobileMode.value) {
    return {
      placement: 'bottom',
    }
  }
  return {}
})

const renderAltOrOptlKey = () => {
  return isMac() ? '⌥' : 'ALT'
}

watch(
  () => comments.value.length,
  (commentCount) => {
    emits('updateRowCommentCount', commentCount)
  },
)
</script>

<script lang="ts">
export default {
  name: 'ExpandedForm',
}
</script>

<template>
  <component
    :is="isMobileMode ? Drawer : NcModal"
    :body-style="{ padding: 0 }"
    :class="{ active: isExpanded }"
    :closable="false"
    :footer="null"
    :visible="isExpanded"
    :width="commentsDrawer && isUIAllowed('commentList') ? 'min(80vw,1280px)' : 'min(70vw,768px)'"
    class="nc-drawer-expanded-form"
    :size="isMobileMode ? 'medium' : 'small'"
    v-bind="modalProps"
    @update:visible="onIsExpandedUpdate"
  >
    <div class="h-[85vh] xs:(max-h-full h-full) max-h-215 flex flex-col">
      <div v-if="isMobileMode" class="flex-none h-4 flex items-center justify-center">
        <div class="flex-none h-full flex items-center justify-center cursor-pointer" @click="onClose">
          <div class="w-[72px] h-[2px] rounded-full bg-[#49494a]"></div>
        </div>
      </div>
      <div
        class="flex min-h-7 flex-shrink-0 w-full items-center nc-expanded-form-header relative p-4 xs:(px-2 py-0 min-h-[48px]) justify-between"
      >
        <div class="flex-1 flex gap-4 lg:w-100 <lg:max-w-[calc(100%_-_178px)] xs:(max-w-[calc(100%_-_44px)])">
          <div class="flex gap-2">
            <NcTooltip v-if="props.showNextPrevIcons">
              <template #title> {{ renderAltOrOptlKey() }} + ← </template>
              <NcButton
                :disabled="isFirstRow || isLoading"
                class="nc-prev-arrow !w-7 !h-7 !text-gray-500 !disabled:text-gray-300"
                type="text"
                size="xsmall"
                @click="loadingEmit('prev')"
              >
                <GeneralIcon icon="chevronDown" class="transform rotate-180" />
              </NcButton>
            </NcTooltip>
            <NcTooltip v-if="props.showNextPrevIcons">
              <template #title> {{ renderAltOrOptlKey() }} + → </template>
              <NcButton
                :disabled="islastRow || isLoading"
                class="nc-next-arrow !w-7 !h-7 !text-gray-500 !disabled:text-gray-300"
                type="text"
                size="xsmall"
                @click="onNext"
              >
                <GeneralIcon icon="chevronDown" />
              </NcButton>
            </NcTooltip>
          </div>
          <div v-if="isLoading" class="flex items-center">
            <a-skeleton-input active class="!h-6 !sm:mr-14 !w-52 !rounded-md !overflow-hidden" size="small" />
          </div>
          <div
            v-else
            class="flex-1 flex items-center gap-3 max-w-[calc(100%_-_108px)] xs:(flex-row-reverse justify-end)"
            :class="{
              'xs:max-w-[calc(100%_-_52px)]': isNew,
              'xs:max-w-[calc(100%_-_82px)]': !isNew,
            }"
          >
            <div
              v-if="row.rowMeta?.new || props.newRecordHeader"
              class="flex items-center truncate font-bold text-gray-800 text-base overflow-hidden"
            >
              {{ props.newRecordHeader ?? $t('activity.newRecord') }}
            </div>
            <div
              v-else-if="displayValue && !row?.rowMeta?.new"
              class="flex items-center font-bold text-gray-800 text-base max-w-[300px] xs:(w-auto max-w-[calc(100%_-_82px)]) overflow-hidden"
            >
              <span class="truncate">
                <LazySmartsheetPlainCell v-model="displayValue" :column="displayField" />
              </span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <NcTooltip v-if="!isMobileMode && isUIAllowed('dataEdit')">
            <template #title> {{ renderAltOrOptlKey() }} + S </template>
            <NcButton
              v-e="['c:row-expand:save']"
              :disabled="changedColumns.size === 0 && !isUnsavedFormExist"
              :loading="isSaving"
              class="nc-expand-form-save-btn !xs:(text-base) !h-7 !px-2"
              data-testid="nc-expanded-form-save"
              type="primary"
              size="xsmall"
              @click="save"
            >
              <div class="xs:px-1">{{ newRecordSubmitBtnText ?? 'Save Record' }}</div>
            </NcButton>
          </NcTooltip>
          <NcTooltip>
            <template #title> {{ isRecordLinkCopied ? $t('labels.copiedRecordURL') : $t('labels.copyRecordURL') }} </template>
            <NcButton
              v-if="!isNew && rowId && !isMobileMode"
              :disabled="isLoading"
              class="!<lg:hidden text-gray-700 !h-7 !w-7"
              type="text"
              size="xsmall"
              @click="copyRecordUrl()"
            >
              <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex items-center">
                <component :is="iconMap.check" v-if="isRecordLinkCopied" class="cursor-pointer nc-duplicate-row h-4 w-4" />
                <component :is="iconMap.copy" v-else class="cursor-pointer nc-duplicate-row h-4 w-4" />
              </div>
            </NcButton>
          </NcTooltip>
          <NcDropdown v-if="!isNew && rowId && !isMobileMode" placement="bottomRight">
            <NcButton type="text" size="xsmall" class="nc-expand-form-more-actions !w-7 !h-7" :disabled="isLoading">
              <GeneralIcon icon="threeDotVertical" class="text-md" :class="isLoading ? 'text-gray-300' : 'text-gray-700'" />
            </NcButton>
            <template #overlay>
              <NcMenu>
                <NcMenuItem class="text-gray-700" @click="_loadRow()">
                  <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center" data-testid="nc-expanded-form-reload">
                    <component :is="iconMap.reload" class="cursor-pointer" />
                    {{ $t('general.reload') }} {{ $t('objects.record') }}
                  </div>
                </NcMenuItem>
                <NcMenuItem
                  v-if="!isNew && rowId"
                  type="secondary"
                  class="!lg:hidden text-gray-700"
                  :disabled="isLoading"
                  @click="copyRecordUrl()"
                >
                  <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex gap-2 items-center">
                    <component :is="iconMap.copy" class="cursor-pointer" />
                    {{ $t('labels.copyRecordURL') }}
                  </div>
                </NcMenuItem>
                <NcMenuItem v-if="isUIAllowed('dataEdit')" class="text-gray-700" @click="!isNew ? onDuplicateRow() : () => {}">
                  <div v-e="['c:row-expand:duplicate']" class="flex gap-2 items-center" data-testid="nc-expanded-form-duplicate">
                    <component :is="iconMap.duplicate" class="cursor-pointer nc-duplicate-row" />
                    <span class="-ml-0.25">
                      {{ $t('labels.duplicateRecord') }}
                    </span>
                  </div>
                </NcMenuItem>
                <NcDivider v-if="isUIAllowed('dataEdit')" />
                <NcMenuItem
                  v-if="isUIAllowed('dataEdit')"
                  class="!text-red-500 !hover:bg-red-50"
                  @click="!isNew && onDeleteRowClick()"
                >
                  <div v-e="['c:row-expand:delete']" class="flex gap-2 items-center" data-testid="nc-expanded-form-delete">
                    <component :is="iconMap.delete" class="cursor-pointer nc-delete-row" />
                    <span class="-ml-0.25">
                      {{
                        $t('general.deleteEntity', {
                          entity: $t('objects.record').toLowerCase(),
                        })
                      }}
                    </span>
                  </div>
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>

          <NcButton
            class="nc-expand-form-close-btn !w-7 !h-7"
            data-testid="nc-expanded-form-close"
            type="text"
            size="xsmall"
            @click="onClose"
          >
            <GeneralIcon class="text-md text-gray-700 h-4 w-4" icon="close" />
          </NcButton>
        </div>
      </div>
      <div ref="wrapper" class="flex flex-grow flex-row h-[calc(100%_-_4rem)] w-full border-t-1 border-gray-200">
        <div
          :class="{
            'w-full': !showRightSections,
            'flex-1': showRightSections,
          }"
          class="h-full flex xs:w-full flex-col overflow-hidden"
        >
          <div
            ref="expandedFormScrollWrapper"
            class="flex flex-col flex-grow gap-6 h-full max-h-full nc-scrollbar-thin items-center w-full p-4 xs:(px-4 pt-4 pb-2 gap-6) children:max-w-[588px] <lg:(children:max-w-[450px])"
          >
            <div
              v-for="(col, i) of fields"
              v-show="!isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
              :key="col.title"
              :class="`nc-expand-col-${col.title}`"
              :col-id="col.id"
              :data-testid="`nc-expand-col-${col.title}`"
              class="nc-expanded-form-row w-full"
            >
              <div class="flex items-start flex-row sm:(gap-x-2) <lg:(flex-col w-full) nc-expanded-cell min-h-[37px]">
                <div class="w-45 <lg:(w-full px-0 mb-1) h-[37px] xs:(h-auto) flex items-center rounded-lg overflow-hidden">
                  <LazySmartsheetHeaderVirtualCell
                    v-if="isVirtualCol(col)"
                    :column="col"
                    class="nc-expanded-cell-header h-full flex-none"
                  />

                  <LazySmartsheetHeaderCell v-else :column="col" class="nc-expanded-cell-header flex-none" />
                </div>

                <template v-if="isLoading">
                  <a-skeleton-input
                    active
                    class="h-[37px] flex-none <lg:!w-full lg:flex-1 !rounded-lg !overflow-hidden"
                    size="small"
                  />
                </template>
                <template v-else>
                  <SmartsheetDivDataCell
                    v-if="col.title"
                    :ref="i ? null : (el: any) => (cellWrapperEl = el)"
                    class="bg-white flex-1 <lg:w-full px-1 min-h-[37px] flex items-center relative"
                    :class="{
                      '!select-text nc-system-field': isReadOnlyVirtualCell(col),
                      '!select-text nc-readonly-div-data-cell': readOnly,
                    }"
                  >
                    <LazySmartsheetVirtualCell
                      v-if="isVirtualCol(col)"
                      v-model="_row.row[col.title]"
                      :class="{
                        'px-1': isReadOnlyVirtualCell(col),
                      }"
                      :column="col"
                      :read-only="readOnly"
                      :row="_row"
                    />

                    <LazySmartsheetCell
                      v-else
                      v-model="_row.row[col.title]"
                      :active="true"
                      :column="col"
                      :edit-enabled="true"
                      :read-only="readOnly"
                      @update:model-value="changedColumns.add(col.title)"
                    />
                  </SmartsheetDivDataCell>
                </template>
              </div>
            </div>
            <div v-if="hiddenFields.length > 0" class="flex w-full <lg:(px-1) items-center py-6">
              <div class="flex-grow h-px mr-1 bg-gray-100"></div>
              <NcButton
                :size="isMobileMode ? 'medium' : 'small'"
                class="flex-shrink !text-sm overflow-hidden !text-gray-500 !font-weight-500"
                type="secondary"
                @click="toggleHiddenFields"
              >
                {{ showHiddenFields ? `Hide ${hiddenFields.length} hidden` : `Show ${hiddenFields.length} hidden` }}
                {{ hiddenFields.length > 1 ? `fields` : `field` }}
                <MdiChevronDown :class="showHiddenFields ? 'transform rotate-180' : ''" class="ml-1" />
              </NcButton>
              <div class="flex-grow h-px ml-1 bg-gray-100"></div>
            </div>
            <template v-if="hiddenFields.length > 0 && showHiddenFields">
              <div
                v-for="(col, i) of hiddenFields"
                v-show="isFormula(col) || !isVirtualCol(col) || !isNew || isLinksOrLTAR(col)"
                :key="`${col.id}-${col.title}`"
                :class="`nc-expand-col-${col.title}`"
                :data-testid="`nc-expand-col-${col.title}`"
                class="nc-expanded-form-row w-full"
              >
                <div class="flex items-start flex-row sm:(gap-x-2) <lg:(flex-col w-full) nc-expanded-cell min-h-[37px]">
                  <div class="w-45 <lg:(w-full px-0) h-[37px] xs:(h-auto) flex items-center rounded-lg overflow-hidden">
                    <LazySmartsheetHeaderVirtualCell
                      v-if="isVirtualCol(col)"
                      :column="col"
                      is-hidden-col
                      class="nc-expanded-cell-header flex-none"
                    />

                    <LazySmartsheetHeaderCell v-else :column="col" is-hidden-col class="nc-expanded-cell-header flex-none" />
                  </div>

                  <template v-if="isLoading">
                    <a-skeleton-input
                      active
                      class="h-[37px] flex-none <lg:!w-full lg:flex-1 !rounded-lg !overflow-hidden"
                      size="small"
                    />
                  </template>
                  <template v-else>
                    <LazySmartsheetDivDataCell
                      v-if="col.title"
                      :ref="i ? null : (el: any) => (cellWrapperEl = el)"
                      class="bg-white flex-1 <lg:w-full px-1 min-h-[37px] flex items-center relative"
                      :class="{
                        '!select-text nc-system-field': isReadOnlyVirtualCell(col),
                        '!bg-gray-50 !select-text nc-readonly-div-data-cell': readOnly,
                      }"
                    >
                      <LazySmartsheetVirtualCell
                        v-if="isVirtualCol(col)"
                        v-model="_row.row[col.title]"
                        :column="col"
                        :read-only="readOnly"
                        :row="_row"
                      />

                      <LazySmartsheetCell
                        v-else
                        v-model="_row.row[col.title]"
                        :active="true"
                        :column="col"
                        :edit-enabled="true"
                        :read-only="readOnly"
                        @update:model-value="changedColumns.add(col.title)"
                      />
                    </LazySmartsheetDivDataCell>
                  </template>
                </div>
              </div>
            </template>
          </div>

          <div
            v-if="isUIAllowed('dataEdit')"
            class="w-full flex items-center justify-end px-2 xs:(p-0 gap-x-4 justify-between)"
            :class="{
              'xs(border-t-1 border-gray-200)': !isNew,
            }"
          >
            <div v-if="!isNew && isMobileMode" class="p-2">
              <NcDropdown placement="bottomRight" class="p-2">
                <NcButton :disabled="isLoading" class="nc-expand-form-more-actions" type="secondary" size="small">
                  <GeneralIcon :class="isLoading ? 'text-gray-300' : 'text-gray-700'" class="text-md" icon="threeDotVertical" />
                </NcButton>

                <template #overlay>
                  <NcMenu>
                    <NcMenuItem class="text-gray-700" @click="_loadRow()">
                      <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center" data-testid="nc-expanded-form-reload">
                        <component :is="iconMap.reload" class="cursor-pointer" />
                        {{ $t('general.reload') }}
                      </div>
                    </NcMenuItem>
                    <NcMenuItem v-if="rowId" class="text-gray-700" @click="!isNew ? copyRecordUrl() : () => {}">
                      <div
                        v-e="['c:row-expand:copy-url']"
                        class="flex gap-2 items-center"
                        data-testid="nc-expanded-form-copy-url"
                      >
                        <component :is="iconMap.copy" class="cursor-pointer nc-duplicate-row" />
                        {{ $t('labels.copyRecordURL') }}
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
            </div>
            <div v-if="isNew && isMobileMode"></div>
            <div v-if="isMobileMode" class="p-2">
              <NcButton
                v-e="['c:row-expand:save']"
                :disabled="changedColumns.size === 0 && !isUnsavedFormExist"
                :loading="isSaving"
                class="nc-expand-form-save-btn !xs:(text-sm) !px-2"
                :class="{
                  '!h-7': !isMobileMode,
                }"
                data-testid="nc-expanded-form-save"
                type="primary"
                :size="isMobileMode ? 'small' : 'xsmall'"
                @click="save"
              >
                <div class="xs:px-1">{{ newRecordSubmitBtnText ?? isNew ? 'Create Record' : 'Save Record' }}</div>
              </NcButton>
            </div>
          </div>
          <div v-else class="p-2"></div>
        </div>
        <div
          v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
          :class="{ active: commentsDrawer && isUIAllowed('commentList') }"
          class="nc-comments-drawer border-l-1 relative border-gray-200 bg-gray-50 w-1/3 max-w-[340px] min-w-0 h-full xs:hidden rounded-br-2xl"
        >
          <SmartsheetExpandedFormSidebar />
        </div>
      </div>
    </div>
  </component>

  <GeneralDeleteModal v-model:visible="showDeleteRowModal" entity-name="Record" :on-delete="() => onConfirmDeleteRowClick()">
    <template #entity-preview>
      <span>
        <div class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700">
          <div class="text-ellipsis overflow-hidden select-none w-full pl-1.75 break-keep whitespace-nowrap">
            <LazySmartsheetPlainCell v-model="displayValue" :column="displayField" />
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
        <NcButton type="secondary" size="small" @click="discardPreventModal">{{ $t('labels.discard') }}</NcButton>

        <NcButton key="submit" type="primary" size="small" :loading="isSaving" @click="saveChanges">
          {{ $t('tooltip.saveChanges') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-drawer-expanded-form {
  @apply xs:my-0;

  .ant-drawer-content-wrapper {
    @apply !h-[90vh];
    .ant-drawer-content {
      @apply rounded-t-2xl;
    }
  }
}

.nc-expanded-cell-header {
  @apply w-full text-gray-500 !font-weight-500 !text-sm xs:(text-gray-600 mb-2 !text-small) pr-3;

  svg.nc-cell-icon,
  svg.nc-virtual-cell-icon {
    @apply !w-3.5 !h-3.5;
  }
}

.nc-expanded-cell-header > :nth-child(2) {
  @apply !text-sm xs:!text-small;
}
.nc-expanded-cell-header > :first-child {
  @apply !text-md pl-2 xs:(pl-0 -ml-0.5);
}
.nc-expanded-cell-header:not(.nc-cell-expanded-form-header) > :first-child {
  @apply pl-0;
}

.nc-drawer-expanded-form .nc-modal {
  @apply !p-0;
}
</style>

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !xs:(h-full);
}

.nc-data-cell {
  @apply !rounded-lg;
  transition: all 0.3s;

  &:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }
  &:not(:focus-within):hover:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-virtual-cell-button) {
    @apply !border-1;
    &:not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
      box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
    }
  }

  &.nc-readonly-div-data-cell,
  &.nc-system-field {
    @apply !border-gray-200;

    .nc-cell,
    .nc-virtual-cell {
      @apply text-gray-400;
    }
  }
  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-gray-200;
  }

  &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
    @apply !shadow-selected;
  }

  &:has(.nc-virtual-cell-qrcode .nc-qrcode-container),
  &:has(.nc-virtual-cell-barcode .nc-barcode-container) {
    @apply !border-none px-0 !rounded-none;
    :deep(.nc-virtual-cell-qrcode),
    :deep(.nc-virtual-cell-barcode) {
      @apply px-0;
      & > div {
        @apply !px-0;
      }
      .barcode-wrapper {
        @apply ml-0;
      }
    }
    :deep(.nc-virtual-cell-qrcode) {
      img {
        @apply !h-[84px] border-1 border-solid border-gray-200 rounded;
      }
    }
    :deep(.nc-virtual-cell-barcode) {
      .nc-barcode-container {
        @apply border-1 rounded-lg border-gray-200 h-[64px] max-w-full p-2;
        svg {
          @apply !h-full;
        }
      }
    }
  }
}
.nc-data-cell:focus-within {
  @apply !border-1 !border-brand-500;
}

:deep(.nc-system-field input) {
  @apply bg-transparent;
}
:deep(.nc-data-cell .nc-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-virtual-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-cell-field.nc-lookup-cell .nc-cell-field) {
  @apply px-0;
}
</style>
