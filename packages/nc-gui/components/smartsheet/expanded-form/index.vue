<script setup lang="ts">
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes, isSystemColumn } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { Drawer } from 'ant-design-vue'
import NcModal from '../../nc/Modal.vue'

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

const { copy } = useCopy()

const { isMobileMode } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

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

const router = useRouter()

// to check if a expanded form which is not yet saved exist or not
const isUnsavedFormExist = ref(false)

const isUnsavedDuplicatedRecordExist = ref(false)

const isRecordLinkCopied = ref(false)

const { isUIAllowed } = useRoles()

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
        .filter((col) => !isSystemColumn(col) && !!col.meta?.defaultViewColVisibility)
        .sort((a, b) => {
          return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
        })
    }

    return (meta.value.columns ?? []).filter((col) => !isSystemColumn(col) && !!col.meta?.defaultViewColVisibility)
  }
  return _fields?.value ?? []
})

const tableTitle = computed(() => meta.value?.title)

const { setCurrentViewExpandedFormMode } = useSharedView()

const activeViewMode = ref(props.view?.expanded_record_mode ?? 'field')

watch(activeViewMode, async (v) => {
  const viewId = props.view?.id
  if (!viewId) return
  if (v === 'field') {
    await setCurrentViewExpandedFormMode(viewId, v)
  } else if (v === 'attachment') {
    const firstAttachmentField = fields.value?.find((f) => f.uidt === 'Attachment')
    await setCurrentViewExpandedFormMode(viewId, v, props.view?.attachment_mode_column_id ?? firstAttachmentField?.id)
  }
  // else if (v === 'discussion') {
  //   await setCurrentViewExpandedFormMode(viewId, v)
  // }
})

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value?.includes(c)) ?? null)

const hiddenFields = computed(() => {
  // todo: figure out when meta.value is undefined
  const hiddenFields = (meta.value?.columns ?? []).filter(
    (col) =>
      !isSystemColumn(col) &&
      !fields.value?.includes(col) &&
      (isLocalMode.value && col?.id && fieldsMap.value[col.id] ? fieldsMap.value[col.id]?.initialShow : true),
  )
  if (props.useMetaFields) {
    return maintainDefaultViewOrder.value
      ? hiddenFields.sort((a, b) => {
          return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
        })
      : hiddenFields
  }
  // record from same view and same table (not linked)
  else {
    return hiddenFields.sort((a, b) => {
      return (fieldsMap.value[a.id]?.order ?? Infinity) - (fieldsMap.value[b.id]?.order ?? Infinity)
    })
  }
})

const isKanban = inject(IsKanbanInj, ref(false))

provide(MetaInj, meta)

const isLoading = ref(true)

const isSaving = ref(false)

const expandedFormStore = useProvideExpandedFormStore(meta, row)

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
} = expandedFormStore

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
      await _loadRow()
    }

    if (!props.skipReload) {
      await reloadTrigger?.trigger()
      await reloadViewDataTrigger?.trigger()
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
const interruptedDirectionToGo = ref<'next' | 'prev' | undefined>(undefined)

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
    interruptedDirectionToGo.value = 'next'
    return
  }
  loadingEmit('next')
}

const onPrev = async () => {
  if (changedColumns.value.size > 0) {
    isPreventChangeModalOpen.value = true
    interruptedDirectionToGo.value = 'prev'
    return
  }
  loadingEmit('prev')
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

  await ncDelay(5000)

  isRecordLinkCopied.value = false
}

const saveChanges = async () => {
  if (isPreventChangeModalOpen.value) {
    isUnsavedFormExist.value = false
    await save()
    if (interruptedDirectionToGo.value) {
      loadingEmit(interruptedDirectionToGo.value)
    } else {
      loadingEmit('next')
    }
    isPreventChangeModalOpen.value = false
    interruptedDirectionToGo.value = undefined
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
useActiveKeydownListener(
  isExpanded,
  async (e: KeyboardEvent) => {
    if (!e.altKey || isNew.value || !props.showNextPrevIcons || isActiveInputElementExist(e) || isNestedExpandedFormOpenExist()) {
      return
    }

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
  { immediate: true, isGridCell: false },
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

const mentionedCell = ref('')

// Small hack. We need to scroll to the bottom of the form after its mounted and back to top.
// So that tab to next row works properly, as otherwise browser will focus to save button
// when we reach to the bottom of the visual scrollable area, not the actual bottom of the form
// todo: this seems to not be needed anymore. check if we can remove it
watch([expandedFormScrollWrapper, isLoading], () => {
  if (isMobileMode.value) return

  const expandedFormScrollWrapperEl = expandedFormScrollWrapper.value

  if (expandedFormScrollWrapperEl && !isLoading.value) {
    expandedFormScrollWrapperEl.scrollTop = expandedFormScrollWrapperEl.scrollHeight

    setTimeout(() => {
      nextTick(() => {
        const query = router.currentRoute.value.query
        const columnId = query.columnId

        if (columnId) {
          router.push({
            query: {
              rowId: query.rowId,
            },
          })
          mentionedCell.value = columnId as string
          scrollToColumn(columnId as string)
          onClickOutside(document.querySelector(`[col-id="${columnId}"]`)! as HTMLDivElement, () => {
            mentionedCell.value = null
          })
        } else {
          expandedFormScrollWrapperEl.scrollTop = 0
        }
      })
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

watch(
  () => comments.value.length,
  (commentCount) => {
    emits('updateRowCommentCount', commentCount)
  },
)

function scrollToColumn(columnId: string) {
  const columnEl = document.querySelector(`.${columnId}`)
  if (columnEl) {
    columnEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
}
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
        class="flex gap-2 min-h-7 flex-shrink-0 w-full items-center nc-expanded-form-header p-4 xs:(px-2 py-0 min-h-[48px]) border-b-1 border-gray-200"
      >
        <div class="flex gap-2">
          <div class="flex gap-2">
            <NcTooltip v-if="props.showNextPrevIcons">
              <template #title> {{ renderAltOrOptlKey() }} + ← </template>
              <NcButton
                :disabled="isFirstRow || isLoading"
                class="nc-prev-arrow !w-7 !h-7 !text-gray-500 !disabled:text-gray-300"
                type="text"
                size="xsmall"
                @click="onPrev"
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
          <div v-else class="flex-1 flex items-center gap-2 xs:(flex-row-reverse justify-end)">
            <div v-if="!props.showNextPrevIcons" class="hidden md:flex items-center rounded-lg bg-gray-100 px-2 py-1 gap-2">
              <GeneralIcon icon="table" class="text-gray-700" />
              <span class="nc-expanded-form-table-name">
                {{ tableTitle }}
              </span>
            </div>
            <div
              v-if="row.rowMeta?.new || props.newRecordHeader"
              class="flex items-center truncate font-bold text-gray-800 text-xl overflow-hidden"
            >
              {{ props.newRecordHeader ?? $t('activity.newRecord') }}
            </div>
            <div
              v-else-if="displayValue && !row?.rowMeta?.new"
              class="flex items-center font-bold text-gray-800 text-2xl overflow-hidden"
            >
              <span class="truncate w-[120px] md:w-[300px]">
                <LazySmartsheetPlainCell v-model="displayValue" :column="displayField" />
              </span>
            </div>
          </div>
        </div>
        <div class="ml-auto">
          <NcSelectTab
            v-if="
              isEeUI &&
              (isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_FILE_PREVIEW_MODE) ||
                isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_DISCUSSION_MODE))
            "
            v-model="activeViewMode"
            class="nc-expanded-form-mode-switch"
            :disabled="!isUIAllowed('viewCreateOrEdit')"
            :tooltip="!isUIAllowed('viewCreateOrEdit') ? 'You do not have permission to change view mode.' : undefined"
            :items="[
              { icon: 'fields', value: 'field', tooltip: 'Fields' },
              {
                icon: 'file',
                value: 'attachment',
                tooltip: 'File Preview',
                hidden: !isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_FILE_PREVIEW_MODE),
              },
              {
                icon: 'ncMessageSquare',
                value: 'discussion',
                tooltip: 'Discussion',
                hidden: !isFeatureEnabled(FEATURE_FLAG.EXPANDED_FORM_DISCUSSION_MODE),
              },
            ]"
          />
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
              <div class="xs:px-1">{{ newRecordSubmitBtnText ?? $t('activity.saveRow') }}</div>
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
              <div
                v-e="['c:row-expand:copy-url']"
                data-testid="nc-expanded-form-copy-url"
                class="flex items-center relative h-4 w-4"
              >
                <Transition name="icon-fade" :duration="200">
                  <component :is="iconMap.check" v-if="isRecordLinkCopied" class="cursor-pointer nc-duplicate-row h-4 w-4" />
                  <component :is="iconMap.copy" v-else class="cursor-pointer nc-duplicate-row h-4 w-4" />
                </Transition>
              </div>
            </NcButton>
          </NcTooltip>
          <NcDropdown v-if="!isNew && rowId && !isMobileMode" placement="bottomRight">
            <NcButton type="text" size="xsmall" class="nc-expand-form-more-actions !w-7 !h-7" :disabled="isLoading">
              <GeneralIcon icon="threeDotVertical" class="text-md" :class="isLoading ? 'text-gray-300' : 'text-gray-700'" />
            </NcButton>
            <template #overlay>
              <NcMenu variant="small">
                <NcMenuItem @click="_loadRow()">
                  <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center" data-testid="nc-expanded-form-reload">
                    <component :is="iconMap.reload" class="cursor-pointer" />
                    {{ $t('general.reload') }} {{ $t('objects.record') }}
                  </div>
                </NcMenuItem>
                <NcMenuItem
                  v-if="!isNew && rowId"
                  type="secondary"
                  class="!lg:hidden"
                  :disabled="isLoading"
                  @click="copyRecordUrl()"
                >
                  <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex gap-2 items-center">
                    <component :is="iconMap.copy" class="cursor-pointer" />
                    {{ $t('labels.copyRecordURL') }}
                  </div>
                </NcMenuItem>
                <NcMenuItem v-if="isUIAllowed('dataEdit')" @click="!isNew ? onDuplicateRow() : () => {}">
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
      <div ref="wrapper" class="flex-grow h-[calc(100%_-_4rem)] w-full">
        <template v-if="activeViewMode === 'field'">
          <SmartsheetExpandedFormPresentorsFields
            :row-id="rowId"
            :fields="fields ?? []"
            :hidden-fields="hiddenFields"
            :is-unsaved-duplicated-record-exist="isUnsavedDuplicatedRecordExist"
            :is-unsaved-form-exist="isUnsavedFormExist"
            :is-loading="isLoading"
            :is-saving="isSaving"
            :new-record-submit-btn-text="newRecordSubmitBtnText"
            @copy:record-url="copyRecordUrl()"
            @delete:row="onDeleteRowClick()"
            @save="save()"
            @update:model-value="emits('update:modelValue', $event)"
            @created-record="emits('createdRecord', $event)"
            @update-row-comment-count="emits('updateRowCommentCount', $event)"
          />
        </template>
        <template v-else-if="activeViewMode === 'attachment'">
          <SmartsheetExpandedFormPresentorsAttachments
            :row-id="rowId"
            :view="props.view"
            :fields="fields ?? []"
            :hidden-fields="hiddenFields"
            :is-unsaved-duplicated-record-exist="isUnsavedDuplicatedRecordExist"
            :is-unsaved-form-exist="isUnsavedFormExist"
            :is-loading="isLoading"
            :is-saving="isSaving"
            :new-record-submit-btn-text="newRecordSubmitBtnText"
            @copy:record-url="copyRecordUrl()"
            @delete:row="onDeleteRowClick()"
            @save="save()"
            @update:model-value="emits('update:modelValue', $event)"
            @created-record="emits('createdRecord', $event)"
            @update-row-comment-count="emits('updateRowCommentCount', $event)"
          />
        </template>
        <template v-else-if="activeViewMode === 'discussion'">
          <SmartsheetExpandedFormPresentorsDiscussion :is-unsaved-duplicated-record-exist="isUnsavedDuplicatedRecordExist" />
        </template>
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
