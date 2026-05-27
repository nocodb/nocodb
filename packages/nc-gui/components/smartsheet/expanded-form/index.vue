<script setup lang="ts">
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { ExpandedFormMode, PermissionEntity, PermissionKey, ViewTypes } from 'nocodb-sdk'
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
  templateMode?: boolean
  templateName?: string
  blueprintMode?: boolean
  existingTemplateNames?: string[]
  editingTemplateId?: string
  blueprintParentTableId?: string
  /** Breadcrumb trail showing the parent chain (e.g., ['Project Template', 'Tasks']) */
  breadcrumbs?: string[]
  expandForm?: (row: Row) => void
  maintainDefaultViewOrder?: boolean
  allowNullFieldIds?: string[]
}

const props = defineProps<Props>()

const emits = defineEmits([
  'update:modelValue',
  'cancel',
  'next',
  'prev',
  'createdRecord',
  'deletedRecord',
  'updateRowCommentCount',
])

const viewsStore = useViewsStore()

const { activeView } = storeToRefs(viewsStore)

const key = ref(0)

const wrapper = ref()

const { appInfo, isMobileMode } = useGlobal()

const { t } = useI18n()

const { rowId, row, state, meta, lastRow: isLastRow, firstRow: isFirstRow, maintainDefaultViewOrder } = toRefs(props)

// Template mode: writable meta ref for table selection dropdown
const { getMeta } = useMetas()
const activeMeta = ref(props.meta) as Ref<TableType>

watch(
  () => props.meta,
  (val) => {
    if (val) activeMeta.value = val
  },
)

const router = useRouter()

// to check if a expanded form which is not yet saved exist or not
const isUnsavedFormExist = ref(false)

const isUnsavedDuplicatedRecordExist = ref(false)

const { isUIAllowed } = useRoles()

const expandedFormScrollWrapper = ref()

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const { addOrEditStackRow } = useKanbanViewStoreOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const { withLoading } = useLoadingTrigger()

// override cell click hook to avoid unexpected behavior at form fields
provide(CellClickHookInj, undefined)

const isKanban = inject(IsKanbanInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

provide(MetaInj, activeMeta)

provide(
  IsTemplateModeInj,
  computed(() => !!props.templateMode || !!props.blueprintMode),
)

provide(
  BlueprintParentTableIdInj,
  computed(() => props.blueprintParentTableId),
)

// Provide current breadcrumb trail so nested sub-record forms can extend it
provide(
  TemplateBreadcrumbsInj,
  computed(() => props.breadcrumbs || []),
)

// override cell event hook to avoid unexpected behavior at form fields
// issue happens when opening expanded form from cell (LTAR/Links)
provide(CanvasSelectCellInj, undefined)

const isLoading = ref(true)

// Template mode: editable template name in the header
const editableTemplateName = ref(props.templateName || '')

// Template name duplicate detection
const isDuplicateTemplateName = computed(() => {
  if (!props.templateMode || !props.existingTemplateNames?.length) return false
  const trimmed = editableTemplateName.value.trim().toLowerCase()
  if (!trimmed) return false
  return props.existingTemplateNames.some((name) => name.trim().toLowerCase() === trimmed)
})

const expandedFormStore = useProvideExpandedFormStore(
  activeMeta,
  row,
  maintainDefaultViewOrder,
  !!props.useMetaFields,
  props.allowNullFieldIds,
)

const {
  commentsDrawer,
  changedColumns,
  displayValue,
  state: rowState,
  isNew,
  isSaving,
  loadRow: _loadRow,
  primaryKey,
  row: _row,
  comments,
  save: _save,
  formatSaveError,
  loadComments,
  loadAudits,
  clearColumns,
  baseRoles,
  fields,
  hiddenFields,
  isAllowedAddNewRecord,
} = expandedFormStore

const loadingEmit = (event: 'update:modelValue' | 'cancel' | 'next' | 'prev' | 'createdRecord') => {
  emits(event)
  isLoading.value = true
}

const tableTitle = computed(() => activeMeta.value?.title)

const templateNameInputRef = ref<HTMLInputElement | null>(null)

// Auto-focus and select template name input when it renders
watch(templateNameInputRef, (el) => {
  if (el && props.templateMode) {
    nextTick(() => {
      el.focus()
      el.select()
    })
  }
})

// Handle table change in template mode dropdown
const onTemplateTableChange = async (tableId: string) => {
  if (!activeMeta.value?.base_id || tableId === activeMeta.value?.id) return
  try {
    const newMeta = await getMeta(activeMeta.value.base_id, tableId)
    if (newMeta) {
      activeMeta.value = newMeta as TableType
      // Reset row data for the new table's fields
      _row.value = { row: {}, oldRow: {}, rowMeta: { new: true } }
    }
  } catch (e) {
    console.error('Failed to load table meta:', e)
  }
}

const activeViewMode = ref(
  !isPublic.value && appInfo.value.ee && !isNew.value && !isMobileMode.value
    ? props.view?.expanded_record_mode ?? ExpandedFormMode.FIELD
    : ExpandedFormMode.FIELD,
)

watch(activeViewMode, async (v) => {
  const viewId = props.view?.id
  if (!viewId) return

  if (v === ExpandedFormMode.FIELD || v === ExpandedFormMode.DISCUSSION) {
    await viewsStore.setCurrentViewExpandedFormMode(viewId, v)
  } else if (v === ExpandedFormMode.ATTACHMENT) {
    const firstAttachmentField = fields.value?.find((f) => f.uidt === 'Attachment')

    await viewsStore.setCurrentViewExpandedFormMode(viewId, v, props.view?.attachment_mode_column_id ?? firstAttachmentField?.id)
  }
})

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value?.includes(c)) ?? null)

const reloadViewDataListener = withLoading(async (params) => {
  // Skip loading deleted record again
  if (params?.skipLoadingRowId && params?.skipLoadingRowId === primaryKey.value) {
    return
  }

  const isSameRecordUpdated =
    params?.relatedTableMetaId && params?.rowId && params?.relatedTableMetaId === meta.value?.id && params?.rowId === rowId.value

  // If relatedTableMetaId & rowId is present that means some nested record is updated

  // If same nested record udpated then udpate whole row
  if (isSameRecordUpdated) {
    await _loadRow(rowId.value)
  } else if (params?.relatedTableMetaId && params?.rowId) {
    // If it is not same record updated but it has relatedTableMetaId & rowId then update only virtual columns
    await _loadRow(rowId.value, true)
  } else {
    // Else update only new/duplicated/renamed columns
    await _loadRow(rowId.value, false, true)
  }
})

reloadViewDataTrigger.on(reloadViewDataListener)

onBeforeUnmount(() => {
  reloadViewDataTrigger.off(reloadViewDataListener)
})

const { isSqlView } = useProvideSmartsheetStore(ref({}) as Ref<ViewType>, meta)

// Mobile: toggle between Fields and Discussion (Comments/Activity) view
const mobileDiscussionMode = ref(false)

const showMobileDiscussionToggle = computed(() => {
  return (
    isMobileMode.value &&
    !isNew.value &&
    !props.templateMode &&
    !props.blueprintMode &&
    commentsDrawer.value &&
    isUIAllowed('commentList', baseRoles.value) &&
    !isPublic.value &&
    !isSqlView.value
  )
})

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

// check if the row is new and has some changes on LTAR/Links
// this is to enable save if there are changes on LTAR/Links
const isLTARChanged = computed(() => {
  return isNew.value && row.value?.rowMeta?.ltarState && Object.keys(row.value?.rowMeta?.ltarState).length > 0
})

const isSaveRecordBtnDisabled = computed(() => {
  // In template mode, disable if duplicate name
  if (props.templateMode) return isDuplicateTemplateName.value
  // In blueprint mode, always allow saving
  if (props.blueprintMode) return false
  return changedColumns.value.size === 0 && !isUnsavedFormExist.value && !isLTARChanged.value
})

const onClose = (force = false) => {
  if (force) {
    isExpanded.value = false
  } else if (!isUIAllowed('dataEdit', baseRoles.value)) {
    isExpanded.value = false
  } else if (changedColumns.value.size > 0) {
    isCloseModalOpen.value = true
  } else {
    if (_row.value?.rowMeta?.new) emits('cancel')
    isExpanded.value = false
  }
}

// MoreOptionsMenu fires this when the user clicks Duplicate. The menu handles the row
// rewrite itself; we only need to flip the unsaved-form flags so save() takes the
// duplicate-aware path on next save.
const onDuplicateStart = () => {
  isUnsavedFormExist.value = true
  isUnsavedDuplicatedRecordExist.value = true
  // If the user was sitting on Attachments / Discussion when they hit Duplicate,
  // the duplicated row is invisible (those tabs don't expose the form) and only
  // the Save button is reachable. Force them back to Fields so they can edit
  // before saving.
  activeViewMode.value = ExpandedFormMode.FIELD
}

const save = async () => {
  isSaving.value = true

  try {
    // Template mode: emit row data without creating a real record
    if (props.templateMode) {
      if (!editableTemplateName.value.trim()) {
        message.toast('Template name is required')
        isSaving.value = false
        return
      }
      if (isDuplicateTemplateName.value) {
        message.toast('A template with this name already exists')
        isSaving.value = false
        return
      }
      isUnsavedFormExist.value = false
      isExpanded.value = false
      emits('createdRecord', {
        ..._row.value.row,
        _templateName: editableTemplateName.value.trim(),
        _tableId: activeMeta.value?.id,
        _ltarState: rowState.value,
      })
      isSaving.value = false
      return
    }

    // Blueprint mode: emit row data as a blueprint (used for LTAR "link a new record" inside templates)
    if (props.blueprintMode) {
      isUnsavedFormExist.value = false
      isExpanded.value = false
      const blueprintData: Record<string, any> = {
        ..._row.value.row,
        _isBlueprint: true,
      }
      // Include nested ltarState so sub-blueprints (e.g., Tasks → Sub-tasks) are preserved
      if (rowState.value && Object.keys(rowState.value).length) {
        blueprintData._ltarState = rowState.value
      }
      emits('createdRecord', blueprintData)
      isSaving.value = false
      return
    }

    let kanbanClbk
    if (activeView.value?.type === ViewTypes.KANBAN) {
      kanbanClbk = (row: any, isNewRow: boolean) => {
        addOrEditStackRow(row, isNewRow)
      }
    }

    if (isNew.value) {
      await _save(rowState.value, { kanbanClbk })
    } else {
      await _save(undefined, { kanbanClbk })
      await _loadRow()
    }

    if (!props.skipReload) {
      await reloadTrigger?.trigger()
      await reloadViewDataTrigger?.trigger()
    }

    isUnsavedFormExist.value = false

    // Close expanded form if row is hidden by RLS policy
    if (_row.value?.row?.__nc_rls_hidden) {
      message.info('Record saved successfully but is hidden due to your access permissions.')
      isExpanded.value = false
    } else if (props.closeAfterSave) {
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
    message.error(await formatSaveError(e))
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
  await Promise.allSettled([loadComments(rowId, false), _loadRow(rowId)])
  isLoading.value = false
}

const cellWrapperEl = ref()

onMounted(async () => {
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

  if (activeViewMode.value === ExpandedFormMode.DISCUSSION) {
    await loadAudits(rowId.value, false)
  }

  isLoading.value = false

  if (focusFirstCell && isNew.value) {
    setTimeout(() => {
      cellWrapperEl.value?.$el?.querySelector('input,select,textarea')?.focus()
    }, 300)
  }
})

const addNewRow = () => {
  if (!isAllowedAddNewRecord.value) {
    message.toast(t('objects.permissions.addNewRecordTooltip'))
    return
  }

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
      if (isLastRow.value) return

      onNext()
    }
    // on alt + s save record
    else if (e.code === 'KeyS') {
      // remove focus from the active input if any
      ;(document.activeElement as HTMLElement)?.blur()

      const modalFocusEl = wrapper.value?.closest('.ant-modal-wrap.nc-modal-wrapper, .ant-drawer.nc-drawer-expanded-form')

      // Focus on the modal or drawer if it exists so that onEsc key can close the modal or drawer
      if (modalFocusEl) {
        modalFocusEl.focus?.()
      }

      e.stopPropagation()

      // In template/blueprint mode, use the save() function which handles template/blueprint logic
      if (props.templateMode || props.blueprintMode) {
        await save()
        return
      }

      if (!isAllowedAddNewRecord.value && isNew.value) {
        message.toast(t('objects.permissions.addNewRecordTooltip'))
        return
      }

      if (!isAllowedAddNewRecord.value || isSaveRecordBtnDisabled.value) {
        return
      }

      try {
        if (isNew.value) {
          await _save(rowState.value)
          reloadHook?.trigger(null)
        } else {
          await save()
          reloadHook?.trigger(null)
        }
      } catch (e: any) {
        message.error(await formatSaveError(e))
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

// MoreOptionsMenu handles the delete confirm + API + view reload itself; we just
// emit deletedRecord and force-close the modal afterward.
const onAfterDelete = () => {
  emits('deletedRecord')
  onClose(true)
}

watch(rowId, async (nRow) => {
  mobileDiscussionMode.value = false
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
    isDropdownOpen = isDropdownOpen || el?.checkVisibility?.()
  })

  if (isDropdownOpen) return

  if (changedColumns.value.size === 0 && !isUnsavedFormExist.value) {
    isExpanded.value = v
    if (isKanban.value) {
      emits('cancel')
    }
  } else if (!v && isUIAllowed('dataEdit', baseRoles.value)) {
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

const stopLoading = () => {
  nextTick(() => {
    isLoading.value = false
  })
}

const startY = ref(0)
const translateY = ref(0)

function onTouchStart(e: TouchEvent) {
  startY.value = e.touches[0].clientY
  translateY.value = 0
}

function onTouchMove(e: TouchEvent) {
  const delta = e.touches[0].clientY - startY.value

  // only drag downward
  translateY.value = Math.max(0, delta)

  const drawerContentEl = wrapper.value?.closest('.ant-drawer-content-wrapper')

  // Focus on the modal or drawer if it exists so that onEsc key can close the modal or drawer
  if (drawerContentEl) {
    drawerContentEl.style.transform = `translateY(${translateY.value}px)`
  }
}

const resetDrawerTransform = () => {
  const drawerContentEl = wrapper.value?.closest('.ant-drawer-content-wrapper')
  if (drawerContentEl) {
    drawerContentEl.style.transform = 'none'
  }
}

function onTouchEnd() {
  if (translateY.value > 50) {
    // dragged down enough -> close
    onClose()

    translateY.value = 0

    // wait for the drawer close transition to complete
    setTimeout(() => {
      resetDrawerTransform()
    }, 500)
  } else {
    translateY.value = 0
    resetDrawerTransform()
  }
}

defineExpose({
  stopLoading,
})
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
    :width="
      templateMode || blueprintMode
        ? 'min(65vw,700px)'
        : commentsDrawer && isUIAllowed('commentList', baseRoles)
        ? 'min(80vw,1280px)'
        : 'min(70vw,768px)'
    "
    class="nc-drawer-expanded-form"
    :size="isMobileMode ? 'medium' : 'small'"
    v-bind="modalProps"
    @update:visible="onIsExpandedUpdate"
  >
    <div class="h-[85vh] xs:(max-h-full h-full) max-h-215 flex flex-col" data-testid="nc-expanded-form-modal">
      <div v-if="isMobileMode" class="flex-none h-4 flex items-center justify-center">
        <div
          class="flex-none h-full flex items-center justify-center cursor-pointer"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @click="onClose()"
        >
          <div class="w-[72px] h-[2px] rounded-full bg-nc-bg-gray-dark"></div>
        </div>
      </div>
      <div
        class="flex gap-2 min-h-7 flex-shrink-0 w-full items-center nc-expanded-form-header p-4 xs:(px-2 py-0 min-h-[48px]) border-b-1 border-nc-border-gray-medium"
      >
        <div class="flex gap-2 min-w-0 min-h-8">
          <div class="flex gap-2">
            <NcTooltip v-if="props.showNextPrevIcons" class="flex items-center">
              <template #title> {{ $t('labels.prevRow') }} {{ renderAltOrOptlKey() }} + ←</template>
              <NcButton
                :disabled="isFirstRow || isLoading"
                class="nc-prev-arrow !w-7 !h-7 !text-nc-content-gray-muted !disabled:text-nc-content-brand-hover"
                data-testid="nc-expanded-form-prev"
                type="text"
                size="xsmall"
                @click="onPrev"
              >
                <GeneralIcon icon="chevronDown" class="transform rotate-180" />
              </NcButton>
            </NcTooltip>
            <NcTooltip v-if="props.showNextPrevIcons" class="flex items-center">
              <template #title> {{ $t('labels.nextRow') }} {{ renderAltOrOptlKey() }} + →</template>
              <NcButton
                :disabled="isLastRow || isLoading"
                class="nc-next-arrow !w-7 !h-7 !text-nc-content-gray-muted !disabled:text-nc-content-brand-hover"
                data-testid="nc-expanded-form-next"
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
          <div v-else class="flex-1 flex items-center gap-2 xs:(flex-row-reverse justify-end) min-w-0">
            <!-- Table selector dropdown (template mode) -->
            <NcListTableSelector
              v-if="templateMode && !props.showNextPrevIcons && activeMeta?.base_id"
              :key="activeMeta.base_id"
              :value="activeMeta.id || null"
              :base-id="activeMeta.base_id"
              disable-label
              dropdown-class="max-w-64 min-w-32"
              dropdown-overlay-class-name="max-w-64 min-w-32"
              default-slot-wrapper-class="!px-1.5 !bg-nc-bg-gray-extralight hover:!bg-nc-bg-gray-light"
              @update:value="onTemplateTableChange($event as string)"
            >
            </NcListTableSelector>

            <!-- Static table chip (non-template mode) -->
            <div
              v-else-if="!props.showNextPrevIcons"
              class="hidden md:flex items-center rounded-lg bg-nc-bg-gray-light px-2 py-1 gap-2"
            >
              <GeneralTableIcon size="xsmall" :meta="activeMeta" class="!mx-0 !text-nc-content-inverted-secondary" />
              <span class="nc-expanded-form-table-name whitespace-nowrap">{{ tableTitle }}</span>
            </div>
            <div v-if="templateMode" class="flex flex-col truncate overflow-hidden">
              <input
                ref="templateNameInputRef"
                v-model="editableTemplateName"
                class="bg-transparent border-none outline-none font-bold text-xl w-full placeholder-gray-300"
                :class="isDuplicateTemplateName ? 'text-red-500' : 'text-nc-content-gray'"
                placeholder="Enter template name..."
              />
              <span v-if="isDuplicateTemplateName" class="text-red-500 text-[11px] pl-0.5">
                A template with this name already exists
              </span>
            </div>
            <div v-else-if="row.rowMeta?.new || props.newRecordHeader" class="flex flex-col truncate overflow-hidden">
              <!-- Breadcrumb trail for nested sub-record forms (e.g., Project Template > Tasks) -->
              <div
                v-if="props.breadcrumbs?.length"
                class="flex items-center gap-1 text-[11px] text-nc-content-gray-muted leading-tight"
              >
                <template v-for="(crumb, idx) in props.breadcrumbs" :key="idx">
                  <span class="truncate max-w-[140px]">{{ crumb }}</span>
                  <GeneralIcon icon="chevronRight" class="flex-none h-3 w-3 text-nc-content-gray-muted" />
                </template>
              </div>
              <span class="font-bold text-nc-content-gray text-xl truncate">
                {{ props.newRecordHeader ?? $t('activity.newRecord') }}
              </span>
            </div>
            <div
              v-else-if="displayValue && !row?.rowMeta?.new"
              class="flex items-center font-bold text-nc-content-gray text-2xl overflow-hidden"
            >
              <span class="min-w-[120px] md:min-w-[300px]">
                <SmartsheetPlainCell v-model="displayValue" :column="displayField" show-tooltip />
              </span>
            </div>
          </div>
        </div>
        <div v-if="!templateMode && !blueprintMode" class="ml-auto">
          <SmartsheetExpandedFormViewModeSelector v-model="activeViewMode" :view="view" class="nc-expanded-form-mode-switch" />
        </div>
        <div v-else class="ml-auto" />
        <div class="flex gap-2">
          <NcButton
            v-if="showMobileDiscussionToggle"
            v-e="['c:row-expand:mobile-discussion-toggle']"
            class="!w-7 !h-7"
            type="secondary"
            size="xsmall"
            @click="mobileDiscussionMode = !mobileDiscussionMode"
          >
            <GeneralIcon
              :icon="mobileDiscussionMode ? 'menu' : 'ncMessageSquare1Outline'"
              class="text-md text-nc-content-inverted-secondary"
            />
          </NcButton>
          <PermissionsTooltip
            v-if="isUIAllowed('dataEdit', baseRoles) && !isSqlView"
            :entity="PermissionEntity.TABLE"
            :entity-id="meta?.id"
            :permission="PermissionKey.TABLE_RECORD_ADD"
            :disabled="!isNew"
            arrow
            :default-tooltip="isMobileMode ? '' : `${renderAltOrOptlKey()} + S`"
          >
            <template #default="{ isAllowed }">
              <NcButton
                v-e="['c:row-expand:save']"
                :disabled="!isAllowed || isSaveRecordBtnDisabled"
                :loading="isSaving"
                class="nc-expand-form-save-btn !h-7 !px-2"
                data-testid="nc-expanded-form-save"
                type="primary"
                size="xsmall"
                @click="save"
              >
                <div class="xs:px-1">{{ newRecordSubmitBtnText ?? $t('activity.saveRow') }}</div>
              </NcButton>
            </template>
          </PermissionsTooltip>
          <SmartsheetExpandedFormMoreOptionsMenu
            :is-loading="isLoading"
            :template-mode="props.templateMode"
            :blueprint-mode="props.blueprintMode"
            :view="props.view"
            :row-id="rowId"
            @duplicate-start="onDuplicateStart"
            @after-delete="onAfterDelete"
            @request-close="onClose(true)"
          />

          <NcButton
            v-if="!isMobileMode"
            class="nc-expand-form-close-btn !w-7 !h-7"
            data-testid="nc-expanded-form-close"
            type="text"
            size="xsmall"
            @click="onClose()"
          >
            <GeneralIcon class="text-md text-nc-content-inverted-secondary h-4 w-4" icon="close" />
          </NcButton>
        </div>
      </div>
      <div ref="wrapper" class="flex-grow w-full min-h-0">
        <template v-if="activeViewMode === ExpandedFormMode.FIELD">
          <div v-if="isMobileMode && mobileDiscussionMode && showMobileDiscussionToggle" class="h-full">
            <SmartsheetExpandedFormSidebar />
          </div>
          <SmartsheetExpandedFormPresentorsFields
            v-else
            :row-id="rowId"
            :fields="fields ?? []"
            :hidden-fields="hiddenFields"
            :is-unsaved-duplicated-record-exist="isUnsavedDuplicatedRecordExist"
            :is-unsaved-form-exist="isUnsavedFormExist"
            :is-loading="isLoading"
            :is-saving="isSaving"
            :new-record-submit-btn-text="newRecordSubmitBtnText"
            @update:model-value="emits('update:modelValue', $event)"
            @created-record="emits('createdRecord', $event)"
            @update-row-comment-count="emits('updateRowCommentCount', $event)"
          />
        </template>
        <template v-else-if="activeViewMode === ExpandedFormMode.ATTACHMENT">
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
            @save="save()"
            @update:model-value="emits('update:modelValue', $event)"
            @created-record="emits('createdRecord', $event)"
            @update-row-comment-count="emits('updateRowCommentCount', $event)"
          />
        </template>
        <template v-else-if="activeViewMode === ExpandedFormMode.DISCUSSION">
          <SmartsheetExpandedFormPresentorsDiscussion :is-unsaved-duplicated-record-exist="isUnsavedDuplicatedRecordExist" />
        </template>
      </div>
      <div
        v-if="templateMode || blueprintMode"
        class="nc-expanded-form-template-notice flex items-center justify-center gap-2 px-4 py-1.5 border-t-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight text-nc-content-gray-muted text-[11px] flex-shrink-0"
      >
        <GeneralIcon icon="info" class="flex-none w-3.5 h-3.5" />
        <span v-if="templateMode">You are editing a record template. Changes here define default values for new records.</span>
        <span v-else>You are editing a sub-record. A new record will be created and linked each time the template is used.</span>
      </div>
    </div>
  </component>

  <SmartsheetExpandedFormDiscardChangesModal
    v-model="preventModalStatus"
    :loading="isSaving"
    @discard="discardPreventModal"
    @save-and-continue="saveChanges"
  />
</template>

<style lang="scss">
.nc-drawer-expanded-form {
  @apply xs:my-0;

  .ant-drawer-content-wrapper {
    @apply !h-[90dvh];

    @supports (height: 90dvh) {
      @apply !h-[90dvh];
    }

    @supports (height: 90svh) {
      @apply !h-[90svh];
    }

    .ant-drawer-content {
      @apply rounded-t-2xl;
    }
  }
}

.nc-expanded-cell-header {
  @apply w-full text-nc-content-gray-muted !font-weight-500 xs:(text-nc-content-gray-subtle2 mb-2 !text-small) pr-3;
  font-size: 13px !important;

  svg.nc-cell-icon,
  svg.nc-virtual-cell-icon {
    @apply !w-3.5 !h-3.5;
  }

  .nc-cell-name-wrapper,
  .nc-cell-name-wrapper span,
  .nc-cell-name-wrapper .truncate {
    font-size: 13px !important;
  }
}

.nc-expanded-cell-header > :nth-child(2) {
  font-size: 13px !important;
}

.nc-expanded-cell-header > :first-child {
  font-size: 13px !important;
  @apply pl-2 xs:(pl-0 -ml-0.5);
}

.nc-expanded-cell-header:not(.nc-cell-expanded-form-header) > :first-child {
  @apply pl-0;
}

.nc-drawer-expanded-form .nc-modal {
  @apply !p-0;
}

.nc-drawer-expanded-form .nc-data-cell .nc-cell .nc-cell-field,
.nc-drawer-expanded-form .nc-data-cell .nc-cell .nc-cell-field-link,
.nc-drawer-expanded-form .nc-data-cell .nc-cell input,
.nc-drawer-expanded-form .nc-data-cell .nc-cell textarea,
.nc-drawer-expanded-form .nc-data-cell .nc-cell select,
.nc-drawer-expanded-form .nc-data-cell .nc-virtual-cell .nc-cell-field,
.nc-drawer-expanded-form .nc-data-cell .nc-virtual-cell input {
  font-size: 13px !important;
}
</style>
