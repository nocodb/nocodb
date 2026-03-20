<script setup lang="ts">
import {
  type ColumnType,
  type FilterType,
  ViewSettingOverrideOptions,
  isCreatedOrLastModifiedTimeCol,
  isHiddenCol,
  isSystemColumn,
  isVirtualCol,
} from 'nocodb-sdk'
import { PlanLimitTypes, UITypes } from 'nocodb-sdk'
import Draggable from 'vuedraggable'

interface Props {
  nestedLevel?: number
  parentId?: string
  autoSave: boolean
  hookId?: string
  rlsPolicyId?: string
  widgetId?: string
  showLoading?: boolean
  modelValue?: FilterType[] | null
  webHook?: boolean
  link?: boolean
  showDynamicCondition?: boolean
  widget?: boolean
  workflow?: boolean
  draftFilter?: Partial<FilterType>
  isOpen?: boolean
  rootMeta?: any
  linkColId?: string
  buttonColId?: string
  isButton?: boolean
  parentColId?: string
  actionBtnType?: 'text' | 'secondary'
  /** Custom filter function */
  filterOption?: (column: ColumnType) => boolean
  visibilityError?: Record<string, string>
  disableAddNewFilter?: boolean
  hiddenAddNewFilter?: boolean
  isViewFilter?: boolean
  readOnly?: boolean
  queryFilter?: boolean
  isColourFilter?: boolean
  isTempFilters?: boolean
  hideCheckbox?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nestedLevel: 0,
  autoSave: true,
  showLoading: true,
  parentId: undefined,
  hookId: undefined,
  rlsPolicyId: undefined,
  widgetId: undefined,
  widget: false,
  webHook: false,
  link: false,
  workflow: false,
  showDynamicCondition: true,
  linkColId: undefined,
  buttonColId: undefined,
  isButton: false,
  parentColId: undefined,
  actionBtnType: 'text',
  visibilityError: () => ({}),
  disableAddNewFilter: false,
  hiddenAddNewFilter: false,
  isViewFilter: false,
  readOnly: false,
  isColourFilter: false,
  isTempFilters: false,
  hideCheckbox: false,
})

const emit = defineEmits([
  'update:filtersLength',
  'update:draftFilter',
  'update:modelValue',
  'update:isOpen',
  'addFilter',
  'addFilterGroup',
])

const initialModelValue = props.modelValue

const excludedFilterColUidt = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const draftFilter = useVModel(props, 'draftFilter', emit)

const modelValue = useVModel(props, 'modelValue', emit)

const isOpen = useVModel(props, 'isOpen', emit)

provide(IsInFilterInj, ref(true))

const {
  nestedLevel,
  parentId,
  autoSave,
  hookId,
  rlsPolicyId,
  widgetId,
  showLoading,
  webHook,
  link,
  widget,
  linkColId,
  buttonColId,
  isButton,
  workflow,
  parentColId,
  visibilityError,
  disableAddNewFilter,
  isViewFilter,
} = toRefs(props)

const nested = computed(() => nestedLevel.value > 0)

const { t } = useI18n()

const { appInfo, isMobileMode } = useGlobal()

const { clone } = useUndoRedo()

const logicalOps = [
  { value: 'and', text: t('general.and') },
  { value: 'or', text: t('general.or') },
]

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const reloadAggregate = inject(ReloadAggregateHookInj)

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const isLockedView = computed(() => isLocked.value && isViewFilter.value)

const { $e } = useNuxtApp()

const { blockToggleFilter, showUpgradeToUseToggleFilter, blockPinnedFilter, showUpgradeToUsePinnedFilter, showEEFeatures } =
  useEeConfig()

const {
  nestedFilters,
  isForm,
  eventBus,
  allFilters: smartsheetAllFilters,
  isList,
} = widget.value || workflow.value || rlsPolicyId?.value
  ? {
      nestedFilters: ref([]),
      isForm: ref(false),
      eventBus: null,
      allFilters: ref([]),
      isList: ref(false),
    }
  : useSmartsheetStoreOrThrow()

const listViewStore = isList.value ? useListViewStoreOrThrow() : undefined
const isListConfigured = computed(
  () => (listViewStore?.isConfigured.value ?? false) && (listViewStore?.levels.value?.length ?? 0) > 1,
)

const levelId = computed(() => (isList.value && isListConfigured.value ? listViewStore?.selectedLevelId.value : undefined))

const { getMetaByKey } = useMetas()

const currentFilters = modelValue.value || (!link.value && !webHook.value && !workflow.value && nestedFilters.value) || []

const columns = computed(() => {
  if (isList.value && isListConfigured.value && listViewStore?.selectedLevel.value) {
    const level = listViewStore.selectedLevel.value
    if (level.fk_model_id && level.fk_model_id !== meta.value?.id) {
      const tableMeta = getMetaByKey(meta.value?.base_id, level.fk_model_id)
      return tableMeta?.columns || []
    }
  }
  return meta.value?.columns || []
})

const { showSystemFields } =
  widget.value || workflow.value || rlsPolicyId?.value ? { showSystemFields: ref(false) } : useViewColumnsOrThrow()

const fieldsToFilter = computed(() =>
  columns.value.filter((c) => {
    if ((link.value || workflow.value) && isSystemColumn(c) && !c.pk && !isCreatedOrLastModifiedTimeCol(c)) return false

    if (!link.value && !webHook.value && !workflow.value && isSystemColumn(c)) {
      if (isHiddenCol(c, meta.value)) return false
      if (!showSystemFields.value) return false
    }

    const customFilter = props.filterOption ? props.filterOption(c) : true

    return !excludedFilterColUidt.includes(c.uidt as UITypes) && customFilter
  }),
)

const {
  filters,
  lastFilters,
  nonDeletedFilters,
  deleteFilter,
  saveOrUpdate,
  loadFilters,
  addFilter: _addFilter,
  addFilterGroup: _addFilterGroup,
  sync,
  saveOrUpdateDebounced,
  isComparisonOpAllowed,
  isComparisonSubOpAllowed,
  loadBtLookupTypes,
  btLookupTypesMap,
  types,
  isFilterUpdated: _isFilterUpdated,
} = useViewFilters(
  activeView,
  parentId,
  computed(() => autoSave.value),
  () => {
    reloadDataHook.trigger({
      shouldShowLoading: showLoading.value,
      offset: 0,
      isFormFieldFilters: isForm.value && !webHook.value,
    })
    reloadAggregate?.trigger({ path: [] })
  },
  currentFilters,
  props.nestedLevel > 0,
  webHook.value,
  link.value,
  workflow.value,
  widget.value,
  widgetId,
  linkColId,
  fieldsToFilter,
  parentColId,
  props.isTempFilters,
  !!rlsPolicyId?.value,
  buttonColId,
)

// Sync internal filter changes to v-model for consumers that bind it (e.g. webhooks,
// buttons). Rollup/Lookup/LTAR column editors intentionally omit v-model — their filter
// state is preserved by the keep-alive component approach, not via vModel.filters.
// Skip for queryFilter (URL filters) — those are read-only parsed from URL params and
// must not be overwritten by internal filter state from useViewFilters.
if (!autoSave.value && !props.queryFilter) {
  watch(
    filters,
    (newFilters) => {
      modelValue.value = [...newFilters]
    },
    { deep: true },
  )
}

const { getPlanLimit } = useWorkspace()

const localNestedFilters = ref([])

const wrapperDomRef = ref<HTMLElement>()
const addFiltersRowDomRef = ref<HTMLElement>()

const isMounted = ref(false)

const isFilterUpdated = computed(() => {
  return _isFilterUpdated.value || localNestedFilters.value.some((filter) => filter?.isFilterUpdated)
})

const isReorderEnabled = computed(() => {
  return appInfo.value.ee && isViewFilter.value && !isMobileMode.value
})

const getColumn = (filter: Filter) => {
  // extract looked up column if available
  return btLookupTypesMap.value[filter.fk_column_id] || columns.value.find((col: ColumnType) => col.id === filter.fk_column_id)
}

const filterPrevComparisonOp = ref<Record<string, string>>({})

const isFilterDraft = (filter: Filter, col: ColumnType) => {
  if (filter.id) return false

  if (
    filter.comparison_op &&
    comparisonSubOpList(filter.comparison_op, col?.meta?.date_format).find((compOp) => compOp.value === filter.comparison_sub_op)
      ?.ignoreVal
  ) {
    return false
  }

  if (
    comparisonOpList(types.value[col.id] as UITypes, col?.meta?.date_format).find(
      (compOp) => compOp.value === filter.comparison_op,
    )?.ignoreVal
  ) {
    return false
  }

  if (filter.value) {
    return false
  }

  return true
}

const filterUpdateCondition = (filter: FilterType, i: number) => {
  const col = getColumn(filter)
  if (!col) return
  if (
    col.uidt === UITypes.SingleSelect &&
    ['anyof', 'nanyof'].includes(filterPrevComparisonOp.value[filter.id!]) &&
    ['eq', 'neq'].includes(filter.comparison_op!)
  ) {
    // anyof and nanyof can allow multiple selections,
    // while `eq` and `neq` only allow one selection
    filter.value = null
  } else if (['blank', 'notblank', 'empty', 'notempty', 'null', 'notnull'].includes(filter.comparison_op!)) {
    // since `blank`, `empty`, `null` doesn't require value,
    // hence remove the previous value
    filter.value = null
    filter.comparison_sub_op = null
  } else if (isDateType(types.value[col.id] as UITypes)) {
    // for date / datetime,
    // the input type could be decimal or datepicker / datetime picker
    // hence remove the previous value
    filter.value = null
    if (
      !comparisonSubOpList(filter.comparison_op!, col?.meta?.date_format)
        .map((op) => op.value)
        .includes(filter.comparison_sub_op!)
    ) {
      if (filter.comparison_op === 'isWithin') {
        filter.comparison_sub_op = 'pastNumberOfDays'
      } else {
        filter.comparison_sub_op = 'exactDate'
      }
    }

    // Initialize filter.meta if it doesn't exist
    if (!filter.meta) {
      filter.meta = {}
    }
    if (!filter.meta.timezone) {
      filter.meta.timezone = getTimezoneFromColumn(col)
    }
  }

  if (!isFilterDraft(filter, col)) {
    saveOrUpdate(filter, i)
  }

  filterPrevComparisonOp.value[filter.id!] = filter.comparison_op!
  $e('a:filter:update', {
    logical: filter.logical_op,
    comparison: filter.comparison_op,
    comparison_sub_op: filter.comparison_sub_op,
    link: !!link.value,
    workflow: !!workflow.value,
    webHook: !!webHook.value,
  })
}

// Track whether the initial load has been performed to avoid overwriting
// pre-populated modelValue (e.g. restored pending filters in field editor)
let hasPerformedInitialLoad = false

watch(
  () => activeView.value?.id,
  (viewId, oldViewId) => {
    // if nested no need to reload since it will get reloaded from parent
    // if isViewFilter (toolbar), rely on ColumnFilterMenu to load filters
    if (
      !nested.value &&
      !isViewFilter.value &&
      !props.queryFilter &&
      viewId &&
      viewId !== oldViewId &&
      (hookId?.value || !webHook.value) &&
      (linkColId?.value || !link.value) &&
      (widgetId.value || !widget.value) &&
      (buttonColId?.value || !isButton.value)
    ) {
      // On the first fire (immediate), skip loading if initialModelValue has data —
      // matches the onMounted guard that also skips loadFilters when initialModelValue exists
      if (!hasPerformedInitialLoad && initialModelValue?.length) {
        hasPerformedInitialLoad = true
        return
      }
      hasPerformedInitialLoad = true
      loadFilters({
        hookId: hookId.value,
        rlsPolicyId: rlsPolicyId?.value,
        isWebhook: webHook.value,
        widgetId: widgetId.value,
        isWidget: widget.value,
        linkColId: unref(linkColId),
        isLink: link.value,
        isButton: isButton.value,
      })
    }
  },
  { immediate: true },
)

const allFilters: Ref<Record<string, FilterType[]>> = inject(AllFiltersInj, ref({}))

watch(
  () => nonDeletedFilters.value.length,
  (length: number) => {
    allFilters.value[parentId?.value ?? 'root'] = [...nonDeletedFilters.value]
    emit('update:filtersLength', length ?? 0)
  },
)

// EE only: Watch the smartsheet store's allFilters for external changes (e.g. from PinnedFilters)
// and sync them back to the local filters so the filter menu stays in sync
if (isEeUI) {
  watch(
    smartsheetAllFilters,
    (storeFilters) => {
      if (!storeFilters?.length) return
      for (const storeFilter of storeFilters) {
        if (!storeFilter.id) continue
        const localFilter = filters.value.find((f) => f.id === storeFilter.id)
        if (!localFilter) continue

        // Sync value, enabled, and meta if they differ
        if (localFilter.value !== storeFilter.value) {
          localFilter.value = storeFilter.value
        }
        if (localFilter.enabled !== storeFilter.enabled) {
          localFilter.enabled = storeFilter.enabled
        }
        const localMeta = parseProp(localFilter.meta)
        const storeMeta = parseProp(storeFilter.meta)
        if (localMeta?.pinned !== storeMeta?.pinned) {
          localFilter.meta = storeFilter.meta
        }
      }
    },
    { deep: true },
  )
}

const filtersCount = computed(() => {
  return Object.values(allFilters.value).reduce((acc, filters) => {
    return acc + filters.filter((el) => !el.is_group).length
  }, 0)
})

const applyChanges = async (hookOrColId?: string, nested = false, isConditionSupported = true) => {
  // if condition is not supported, delete all filters present
  // it's used for bulk webhooks with filters since bulk webhooks don't support conditions at the moment
  if (!isConditionSupported) {
    // iterate in reverse order and delete all filters, reverse order is for getting the correct index
    for (let i = filters.value.length - 1; i >= 0; i--) {
      await deleteFilter(filters.value[i], i)
    }
  }
  if (link.value) {
    if (!hookOrColId && !props.nestedLevel) return
    await sync({ linkId: hookOrColId, nested })
  } else if (isButton.value || buttonColId?.value) {
    if (!hookOrColId && !props.nestedLevel) return
    await sync({ buttonId: hookOrColId, nested })
  } else if (rlsPolicyId?.value) {
    await sync({ rlsPolicyId: rlsPolicyId.value, nested })
  } else {
    await sync({ hookId: hookOrColId, nested })
  }
  if (!localNestedFilters.value?.length) return

  for (const nestedFilter of localNestedFilters.value) {
    if (nestedFilter?.parentId) {
      await nestedFilter.applyChanges(hookOrColId, true, undefined)
    }
  }
}

const selectFilterField = (filter: Filter, index: number) => {
  const col = getColumn(filter)

  if (!col) return

  // reset dynamic field if the field is changed to virtual column
  if (isVirtualCol(col)) {
    resetDynamicField(filter, index).catch(() => {
      // do nothing
    })
  } else {
    filter.fk_value_col_id = null
  }

  // when we change the field,
  // the corresponding default filter operator needs to be changed as well
  // since the existing one may not be supported for the new field
  // e.g. `eq` operator is not supported in checkbox field
  // hence, get the first option of the supported operators of the new field
  filter.comparison_op = comparisonOpList(types.value[col.id] as UITypes, col?.meta?.date_format).find((compOp) =>
    isComparisonOpAllowed(filter, compOp),
  )?.value as FilterType['comparison_op']

  if (isDateType(types.value[col.id] as UITypes) && !['blank', 'notblank'].includes(filter.comparison_op!)) {
    if (filter.comparison_op === 'isWithin') {
      filter.comparison_sub_op = 'pastNumberOfDays'
    } else {
      filter.comparison_sub_op = 'exactDate'
    }
  } else {
    // reset
    filter.comparison_sub_op = null
  }

  // reset filter value as well
  filter.value = null

  // Check if dynamic filter is still allowed for the new column
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  if (filter.dynamic && !isDynamicFilterAllowed(filter)) {
    filter.dynamic = false
    filter.fk_value_col_id = null // Also reset the dynamic value column if it was set
  }

  // Do not save the filter on field change if its a draft/placeholder filter
  if (!isFilterDraft(filter, col)) {
    saveOrUpdate(filter, index)
  }
}

const updateFilterValue = (value: string, filter: Filter, index: number) => {
  filter.value = value
  saveOrUpdateDebounced(filter, index)
}

const scrollToBottom = () => {
  const wrapperDomRefEl = wrapperDomRef.value?.$el as HTMLDivElement
  wrapperDomRefEl?.scrollTo({
    top: wrapperDomRefEl?.scrollHeight,
    behavior: 'smooth',
  })
}

const scrollDownIfNeeded = () => {
  if (nested.value) {
    addFiltersRowDomRef?.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
      inline: 'nearest',
    })
  }
}

/**
 * Add a filter to the list.
 * @param filter - Optional draft filter with pre-populated fields (e.g. from copy or AI).
 * @param isCopyFilter - When true, skips `selectFilterField()` which resets comparison_op
 *   to the column's default and clears value to null. Set to true for programmatic filter
 *   creation where the draft already contains the correct operator, value, and logical_op
 *   (e.g. AI-generated filters, copy-paste filters).
 */
const addFilter = async (filter?: Partial<FilterType>, isCopyFilter = false) => {
  const draft = levelId.value && !nested.value ? { ...(filter ?? {}), fk_level_id: levelId.value } : filter
  await _addFilter(false, draft)

  if (filter && !isCopyFilter) {
    selectFilterField(filters.value[filters.value.length - 1], filters.value.length - 1)
  }

  if (!nested.value) {
    // if nested, scroll to bottom
    scrollToBottom()
  } else {
    scrollDownIfNeeded()
  }

  emit('addFilter', nested.value)
}

const addFilterGroup = async (filter?: Partial<FilterType>) => {
  const draft = levelId.value && !nested.value ? { ...(filter ?? {}), fk_level_id: levelId.value } : filter
  await _addFilterGroup(draft)

  if (!nested.value) {
    // if nested, scroll to bottom
    scrollToBottom()
  } else {
    scrollDownIfNeeded()
  }

  emit('addFilterGroup', nested.value)
}

const copyFilter = (filter: Filter, isGroup = false) => {
  const filterToCopy = clone(filter)

  // EE only: Strip pinned state from copied filter (pinned filters are EE feature)
  if (isEeUI && filterToCopy.meta) {
    const meta = parseProp(filterToCopy.meta)
    if (meta?.pinned) {
      delete meta.pinned
      filterToCopy.meta = meta
    }
  }

  if (isGroup) {
    addFilterGroup(filterToCopy)
  } else {
    addFilter(filterToCopy, true)
  }
}

const showFilterInput = (filter: Filter) => {
  const col = getColumn(filter)
  if (!filter.comparison_op) return false

  if (filter.comparison_sub_op) {
    return !comparisonSubOpList(filter.comparison_op, getColumn(filter)?.meta?.date_format).find(
      (op) => op.value === filter.comparison_sub_op,
    )?.ignoreVal
  } else {
    return !comparisonOpList(types.value[col?.id] as UITypes, col?.meta?.date_format).find(
      (op) => op.value === filter.comparison_op,
    )?.ignoreVal
  }
}

const eventBusHandler = async (event) => {
  // reload filters only for views
  if (isViewFilter.value && event === SmartsheetStoreEvents.FIELD_UPDATE) {
    await loadFilters({
      loadAllFilters: true,
    })
  }
}

onMounted(async () => {
  eventBus?.on?.(eventBusHandler)

  await Promise.all([
    (async () => {
      if (!props.queryFilter && !props.isTempFilters && !initialModelValue?.length)
        await loadFilters({
          hookId: hookId?.value,
          rlsPolicyId: rlsPolicyId?.value,
          isWebhook: webHook.value,
          isWidget: widget.value,
          widgetId: widgetId.value,
          linkColId: unref(linkColId),
          isLink: link.value,
          isButton: isButton.value,
        })
    })(),
    loadBtLookupTypes(),
  ])
  isMounted.value = true
})

onBeforeUnmount(() => {
  eventBus?.off?.(eventBusHandler)
  if (parentId.value) delete allFilters.value[parentId.value]
})

function isDateType(uidt: UITypes) {
  return [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(uidt)
}

watch(
  [draftFilter, isMounted],
  async () => {
    if (!isMounted.value || !draftFilter.value?.fk_column_id) return

    await addFilter(draftFilter.value)

    await nextTick()

    scrollToBottom()

    const filterWrapper = document.querySelectorAll(`.nc-filter-wrapper-${draftFilter.value.fk_column_id}`)

    draftFilter.value = {}
    if (!filterWrapper.length) return

    const filterInputElement =
      filterWrapper[filterWrapper.length - 1]?.querySelector<HTMLInputElement>('.nc-filter-value-select input')
    if (filterInputElement) {
      setTimeout(() => {
        filterInputElement?.focus?.()
        filterInputElement?.click?.()
      }, 100)
    }
  },
  {
    deep: true,
    immediate: true,
  },
)

const visibleFilters = computed(() =>
  filters.value.filter((filter) => {
    if (filter.status === 'delete') return false
    if (levelId.value && !nested.value) return filter.fk_level_id === levelId.value
    return true
  }),
)

// Resolve the real index in filters.value from a visibleFilters element.
// Needed because Draggable iterates visibleFilters (level-filtered) but
// useViewFilters operations use indices into the full filters array.
const getFilterIndex = (filter: ColumnFilterType) => filters.value.findIndex((f) => f === filter)

const isLogicalOpChangeAllowed = computed(() => {
  return new Set(visibleFilters.value.slice(1).map((filter) => filter.logical_op)).size > 1
})

// when logical operation is updated, update all the siblings with the same logical operation only if it's in locked state
const onLogicalOpUpdate = async (filter: Filter, index: number) => {
  if (index === 1 && visibleFilters.value.slice(2).every((siblingFilter) => siblingFilter.logical_op !== filter.logical_op)) {
    await Promise.all(
      visibleFilters.value.slice(2).map(async (siblingFilter, i) => {
        siblingFilter.logical_op = filter.logical_op
        await saveOrUpdate(siblingFilter, i + 2, false, false, true)
      }),
    )
  }
  await saveOrUpdate(filter, index)
}

const onEnabledChange = async (filter: ColumnFilterType, index: number) => {
  const newEnabled = filter.enabled === false
  $e('a:filter:toggle-enabled', { enabled: newEnabled, isGroup: !!filter.is_group })
  filter.enabled = newEnabled
  await saveOrUpdate(filter, index)

  if (isEeUI) {
    // EE only: Refresh allFilters so ColumnFilterMenu can reactively update the enabled count
    allFilters.value[parentId?.value ?? 'root'] = [...nonDeletedFilters.value]

    // EE only: Sync enabled state to smartsheet store so PinnedFilters.vue reflects it
    const storeFilter = smartsheetAllFilters.value.find((f) => f.id === filter.id)
    if (storeFilter) {
      storeFilter.enabled = filter.enabled
    }
  }
}

const onToggleFilterChange = (filter: ColumnFilterType, index: number) => {
  if (blockToggleFilter.value) {
    showUpgradeToUseToggleFilter()
    return
  }
  onEnabledChange(filter, index)
}

const MAX_PINNED_FILTERS = 3

const pinnedFilterCount = computed(() => {
  return visibleFilters.value.filter((f) => !f.is_group && parseProp(f.meta)?.pinned === true).length
})

const PINNABLE_TYPES = [UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy]

const isPinnableType = (filter: ColumnFilterType): boolean => {
  const col = getColumn(filter)
  return !!col && PINNABLE_TYPES.includes(col.uidt as UITypes)
}

const isFieldAlreadyPinned = (filter: ColumnFilterType): boolean => {
  if (!filter.fk_column_id) return false
  const isPinned = parseProp(filter.meta)?.pinned
  if (isPinned) return false // this filter itself is the pinned one
  return smartsheetAllFilters.value.some(
    (f) => f.id !== filter.id && f.fk_column_id === filter.fk_column_id && !f.is_group && parseProp(f.meta)?.pinned === true,
  )
}

const canPinFilter = (filter: ColumnFilterType): boolean => {
  if (filter.is_group) return false
  if (!isPinnableType(filter)) return false
  if (isFieldAlreadyPinned(filter)) return false
  const meta = parseProp(filter.meta)
  return meta?.pinned || pinnedFilterCount.value < MAX_PINNED_FILTERS
}

const togglePinFilter = async (filter: ColumnFilterType, index: number) => {
  const meta = parseProp(filter.meta) || {}
  const newPinned = !meta.pinned
  $e('a:filter:toggle-pin', { pinned: newPinned })
  meta.pinned = newPinned
  filter.meta = meta
  await saveOrUpdate(filter, index)

  // Sync pin state to smartsheet store's allFilters so PinnedFilters.vue updates immediately
  const storeFilter = smartsheetAllFilters.value.find((f) => f.id === filter.id)
  if (storeFilter) {
    storeFilter.meta = { ...meta }
  }
}

/** Tooltip text for the pin/unpin button — extracted from template for readability */
const getPinTooltip = (filter: ColumnFilterType): string => {
  if (!isPinnableType(filter)) return t('labels.pinNotSupported')
  if (parseProp(filter.meta)?.pinned) return t('labels.unpinFromToolbar')
  if (isFieldAlreadyPinned(filter)) return t('labels.fieldAlreadyPinned')
  if (canPinFilter(filter)) return t('labels.pinToToolbar')
  return t('labels.maxPinnedFilters', { count: MAX_PINNED_FILTERS })
}

function onMoveCallback(event: any) {
  // disable nested drag drop for now
  if (event.from !== event.to) {
    return false
  }
}

const onMove = async (event: { moved: { newIndex: number; oldIndex: number; element: ColumnFilterType } }) => {
  // For now add reorder support only in view filter
  if (!isReorderEnabled.value) return

  /**
   * If event has moved property that means reorder is on same level
   */
  if (event.moved) {
    const {
      moved: { newIndex = 0, oldIndex = 0, element },
    } = event

    if (!element || (!element.id && !element.tmp_id) || visibleFilters.value.length === 1) return

    let nextOrder: number
    let changedLogicalOperatorEl: ColumnFilterType | undefined
    let changedLogicalOperatorElIndex: number = -1

    /**
     * In all case the old first position filter might have different logical operator
     * as we allow to change operator of second position filter and all next position filter logical operator will be same as second
     */

    // set new order value based on the new order of the items
    if (visibleFilters.value.length - 1 === newIndex) {
      // If moving to the end, set nextOrder greater than the maximum order in the list
      nextOrder = Math.max(...visibleFilters.value.map((item) => item?.order ?? 0)) + 1

      // This is when we drag first position filter and logical operator is different that others
      if (
        visibleFilters.value[newIndex] &&
        visibleFilters.value[newIndex - 1] &&
        element.logical_op !== visibleFilters.value[newIndex - 1]?.logical_op
      ) {
        element.logical_op = visibleFilters.value[newIndex - 1]?.logical_op
      }
    } else if (newIndex === 0) {
      // If moving to the beginning, set nextOrder smaller than the minimum order in the list
      nextOrder = Math.min(...visibleFilters.value.map((item) => item?.order ?? 0)) / 2

      if (visibleFilters.value[1] && element.logical_op !== visibleFilters.value[1].logical_op) {
        changedLogicalOperatorEl = visibleFilters.value[1]
        changedLogicalOperatorEl.logical_op = element.logical_op
        changedLogicalOperatorElIndex = 1
      }
    } else {
      nextOrder =
        (parseFloat(String(visibleFilters.value[newIndex - 1]?.order ?? 0)) +
          parseFloat(String(visibleFilters.value[newIndex + 1]?.order ?? 0))) /
        2

      // This is when we drag first position filter and logical operator is different that others
      if (visibleFilters.value[newIndex + 1] && element.logical_op !== visibleFilters.value[newIndex + 1]!.logical_op) {
        element.logical_op = visibleFilters.value[newIndex + 1]?.logical_op
      }
    }

    const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

    element.order = _nextOrder

    const elementIndex =
      visibleFilters.value.findIndex((item) => item?.id === element?.id) ||
      visibleFilters.value.findIndex((item) => item?.tmp_id === element?.tmp_id)

    const lastFilterElIndex =
      lastFilters.value.findIndex((item) => item.id === element.id) ||
      lastFilters.value.findIndex((item) => item.tmp_id === element.tmp_id)

    const lastFilterChangedLogicalOperatorElIndex = changedLogicalOperatorEl
      ? lastFilters.value.findIndex((item) => item.id === changedLogicalOperatorEl?.id) ||
        lastFilters.value.findIndex((item) => item.tmp_id === changedLogicalOperatorEl?.tmp_id)
      : -1

    await saveOrUpdate(element, elementIndex, false, false, false, lastFilterElIndex)

    if (changedLogicalOperatorEl) {
      await saveOrUpdate(
        changedLogicalOperatorEl,
        changedLogicalOperatorElIndex,
        false,
        false,
        false,
        lastFilterChangedLogicalOperatorElIndex,
      )
    }
  }
}

// watch for changes in filters and update the modelValue
watch(
  filters,
  (value) => {
    if (value && value !== modelValue.value) {
      modelValue.value = value
    }
  },
  {
    immediate: true,
  },
)

async function resetDynamicField(filter: any, i) {
  filter.dynamic = false
  filter.fk_value_col_id = null
  await saveOrUpdate(filter, i)
}

const { sqlUis, baseId } = storeToRefs(useBase())

const sqlUi = computed(() => {
  return meta.value?.source_id && meta.value?.base_id === baseId.value && sqlUis.value[meta.value?.source_id]
    ? sqlUis.value[meta.value?.source_id]
    : Object.values(sqlUis.value)[0]
})

const isDynamicFilterAllowed = (filter: FilterType) => {
  const col = getColumn(filter)
  // if virtual column, don't allow dynamic filter
  if (!col || isVirtualCol(col)) return false

  // disable dynamic filter for certain fields like rating, attachment, etc
  if (
    [
      UITypes.Attachment,
      UITypes.Rating,
      UITypes.Checkbox,
      UITypes.QrCode,
      UITypes.Barcode,
      UITypes.Collaborator,
      UITypes.GeoData,
      UITypes.SpecificDBType,
    ].includes(col.uidt as UITypes)
  )
    return false

  const abstractType = sqlUi.value?.getAbstractType(col)

  if (!['integer', 'float', 'text', 'string'].includes(abstractType)) return false

  return !filter.comparison_op || ['eq', 'lt', 'gt', 'lte', 'gte', 'like', 'nlike', 'neq'].includes(filter.comparison_op)
}

const dynamicColumns = (filter: FilterType) => {
  const filterCol = getColumn(filter)

  if (!filterCol) return []

  return props.rootMeta?.columns?.filter((c: ColumnType) => {
    if (excludedFilterColUidt.includes(c.uidt as UITypes) || isVirtualCol(c) || (isSystemColumn(c) && !c.pk)) {
      return false
    }
    const dynamicColAbstractType = sqlUi.value?.getAbstractType(c)

    const filterColAbstractType = sqlUi.value?.getAbstractType(filterCol)

    // treat float and integer as number
    if ([dynamicColAbstractType, filterColAbstractType].every((type) => ['float', 'integer'].includes(type))) {
      return true
    }

    // treat text and string as string
    if ([dynamicColAbstractType, filterColAbstractType].every((type) => ['text', 'string'].includes(type))) {
      return true
    }

    return filterColAbstractType === dynamicColAbstractType
  })
}

const changeToDynamic = async (filter, i) => {
  filter.dynamic = isDynamicFilterAllowed(filter) && showFilterInput(filter)
  await saveOrUpdate(filter, i)
}

const isFormFieldInaccessible = (filter: FilterType) => {
  return isForm.value && !webHook.value && !fieldsToFilter.value.find((c) => c?.id === filter.fk_column_id)
}

const mobileActionMenuItems = (filter: FilterType) => {
  if (filter.value?.readOnly || props.readOnly) return []

  return [
    appInfo.value.ee && {
      title: t('general.copy'),
      onClick: () => {
        $e('c:filter:copy', {
          link: !!link.value,
          webHook: !!webHook.value,
        })

        copyFilter(filter)
      },
    },
    {
      title: t('general.delete'),
      onClick: () => {
        $e('c:filter:delete')

        deleteFilter(filter, getFilterIndex(filter))
      },
      danger: true,
    },
  ].filter(Boolean)
}

const isTimezoneAbbreviationAvailable = (filter, column) => {
  if (!column || !isDateType(column.uidt)) return false

  return !!getTimeZoneFromName(filter?.meta?.timezone)?.abbreviation
}

// Expose internal state and methods for parent components.
// `deleteFilter` and `filters` are exposed for EE AI filter management
// (ColumnFilterMenu.vue uses them to clear/replace filters programmatically).
defineExpose({
  applyChanges,
  parentId,
  addFilterGroup,
  addFilter,
  deleteFilter,
  filters,
  isFilterUpdated,
})
</script>

<template>
  <div
    data-testid="nc-filter"
    class="menu-filter-dropdown"
    :class="{
      'w-min': !isMobileMode,
      'w-full': isMobileMode,
      'min-w-122 py-2 pl-4': !nested && !widget && !isMobileMode,
      'py-2 pl-4': !nested && !widget && isMobileMode,
      'xs:(h-full max-h-full flex flex-col) max-h-[max(80vh,500px)]': !nested && !link,
      'xs:(max-h-full) max-h-[max(50vh,400px)]': !nested && link,
      '!min-w-127.5': isForm && !webHook && !isMobileMode,
      '!min-w-full !w-full !pl-0': !nested && (webHook || widget),
      'min-w-full': nested,
    }"
  >
    <div v-if="nested" class="flex min-w-full w-min items-center gap-1 mb-2">
      <div class="flex items-center gap-2" :class="[`nc-filter-logical-op-level-${nestedLevel}`]">
        <slot name="start"></slot>
      </div>
      <div class="flex-grow"></div>
      <NcDropdown
        :trigger="['hover']"
        overlay-class-name="nc-dropdown-filter-group-sub-menu"
        :disabled="disableAddNewFilter || isLockedView || readOnly"
      >
        <NcButton size="xs" type="text" :disabled="disableAddNewFilter || isLockedView || readOnly">
          <GeneralIcon icon="plus" class="cursor-pointer" data-testid="filter-add-icon" />
        </NcButton>

        <template #overlay>
          <NcMenu>
            <template v-if="!isEeUI && !isPublic">
              <template v-if="filtersCount < getPlanLimit(PlanLimitTypes.LIMIT_FILTER_PER_VIEW)">
                <NcMenuItem data-testid="add-filter-menu" @click.stop="addFilter">
                  <div class="flex items-center gap-1">
                    <component :is="iconMap.plus" data-testid="filter-add-icon" />
                    <!-- Add Filter -->
                    {{ isForm && !webHook ? $t('activity.addCondition') : $t('activity.addFilter') }}
                  </div>
                </NcMenuItem>

                <NcMenuItem v-if="nestedLevel < 5" data-testid="add-filter-group-menu" @click.stop="() => addFilterGroup()">
                  <div class="flex items-center gap-1">
                    <!-- Add Filter Group -->
                    <component :is="iconMap.plusSquare" />
                    {{ isForm && !webHook ? $t('activity.addConditionGroup') : $t('activity.addFilterGroup') }}
                  </div>
                </NcMenuItem>
              </template>
            </template>
            <template v-else>
              <NcMenuItem data-testid="add-filter-menu" @click.stop="addFilter">
                <div class="flex items-center gap-1">
                  <component :is="iconMap.plus" data-testid="filter-add-icon" />
                  <!-- Add Filter -->
                  {{ isForm && !webHook ? $t('activity.addCondition') : $t('activity.addFilter') }}
                </div>
              </NcMenuItem>

              <NcMenuItem
                v-if="!webHook && nestedLevel < 5"
                data-testid="add-filter-group-menu"
                @click.stop="() => addFilterGroup()"
              >
                <div class="flex items-center gap-1">
                  <!-- Add Filter Group -->
                  <component :is="iconMap.plusSquare" />
                  {{ isForm && !webHook ? $t('activity.addConditionGroup') : $t('activity.addFilterGroup') }}
                </div>
              </NcMenuItem>
            </template>
          </NcMenu>
        </template>
      </NcDropdown>
      <div>
        <slot name="end"></slot>
      </div>
    </div>

    <Draggable
      v-if="visibleFilters && visibleFilters.length"
      ref="wrapperDomRef"
      v-bind="getDraggableAutoScrollOptions({ scrollSensitivity: 100 })"
      :list="visibleFilters"
      :disabled="!isReorderEnabled"
      group="nc-column-filters"
      ghost-class="bg-nc-bg-gray-extralight"
      draggable=".nc-column-filter-item"
      handle=".nc-column-filter-drag-handler"
      class="flex flex-col gap-y-1.5 nc-filter-grid min-w-full w-min"
      :class="{
        'nc-scrollbar-thin nc-filter-top-wrapper pr-4 mt-1 mb-2 py-1': !nested,
        'xs:(max-h-full) max-h-420px': !nested && !link,
        'xs:(max-h-full) max-h-320px': !nested && link,
        '!pr-0': (webHook || widget) && !nested,
      }"
      :move="onMoveCallback"
      @change="onMove($event)"
      @click.stop
    >
      <template #item="{ element: filter, index: i }">
        <div v-if="filter.status !== 'delete'" :key="i" class="nc-column-filter-item min-w-full w-min max-w-full">
          <template v-if="filter.is_group">
            <div
              class="flex flex-col min-w-full w-min max-w-full gap-y-2"
              :class="{ 'nc-filter-disabled-group': isEeUI && filter.enabled === false }"
            >
              <div
                class="flex rounded-lg p-2 min-w-full w-min max-w-full border-1"
                :class="[`nc-filter-nested-level-${nestedLevel}`]"
              >
                <LazySmartsheetToolbarColumnFilter
                  v-if="filter.id || filter.children || !autoSave"
                  :key="i"
                  :ref="(el) => (localNestedFilters[i] = el)"
                  v-model="filter.children"
                  v-model:is-open="isOpen"
                  :nested-level="nestedLevel + 1"
                  :parent-id="filter.id"
                  :auto-save="autoSave"
                  :web-hook="webHook"
                  :link="link"
                  :show-dynamic-condition="showDynamicCondition"
                  :show-loading="false"
                  :root-meta="rootMeta"
                  :link-col-id="linkColId"
                  :button-col-id="buttonColId"
                  :is-button="isButton"
                  :widget-id="widgetId"
                  :workflow="workflow"
                  :widget="widget"
                  :parent-col-id="parentColId"
                  :filter-option="filterOption"
                  :visibility-error="visibilityError"
                  :disable-add-new-filter="disableAddNewFilter"
                  :is-view-filter="isViewFilter"
                  :read-only="readOnly"
                  :is-temp-filters="isTempFilters"
                  :hide-checkbox="hideCheckbox"
                >
                  <template #start>
                    <NcCheckbox
                      v-if="appInfo.ee && !hideCheckbox"
                      :checked="filter.enabled !== false"
                      size="default"
                      :disabled="isLockedView || readOnly"
                      class="nc-filter-enabled-checkbox"
                      @change="onToggleFilterChange(filter, getFilterIndex(filter))"
                    />
                    <span v-if="!visibleFilters.indexOf(filter)" class="flex items-center nc-filter-where-label ml-1">{{
                      $t('labels.where')
                    }}</span>
                    <div v-else :key="`${i}nested`" class="flex nc-filter-logical-op">
                      <NcSelect
                        v-model:value="filter.logical_op"
                        v-e="['c:filter:logical-op:select']"
                        :dropdown-match-select-width="false"
                        class="min-w-18 capitalize"
                        placeholder="Group op"
                        dropdown-class-name="nc-dropdown-filter-logical-op-group"
                        :disabled="(i > 1 && !isLogicalOpChangeAllowed) || isLockedView || readOnly"
                        :class="{
                          'nc-disabled-logical-op': filter.readOnly || (i > 1 && !isLogicalOpChangeAllowed),
                          '!max-w-18': !webHook,
                          '!w-full': webHook,
                        }"
                        @click.stop
                        @change="onLogicalOpUpdate(filter, getFilterIndex(filter))"
                      >
                        <a-select-option v-for="op in logicalOps" :key="op.value" :value="op.value">
                          <div class="flex items-center w-full justify-between w-full gap-2">
                            <div class="truncate flex-1 capitalize">{{ op.text }}</div>
                            <component
                              :is="iconMap.check"
                              v-if="filter.logical_op === op.value"
                              id="nc-selected-item-icon"
                              class="text-primary w-4 h-4"
                            />
                          </div>
                        </a-select-option>
                      </NcSelect>
                    </div>
                  </template>
                  <template #end>
                    <template v-if="isMobileMode">
                      <SmartsheetToolbarColumnFilterMobileActionMenu
                        v-if="mobileActionMenuItems(filter).length"
                        :items="mobileActionMenuItems(filter)"
                      />
                    </template>

                    <template v-else>
                      <NcButton
                        v-if="!filter.readOnly && !readOnly"
                        :key="i"
                        v-e="['c:filter:delete', { link: !!link, webHook: !!webHook }]"
                        type="text"
                        size="small"
                        :disabled="isLockedView"
                        class="nc-filter-item-remove-btn cursor-pointer"
                        @click.stop="deleteFilter(filter, getFilterIndex(filter))"
                      >
                        <GeneralIcon icon="deleteListItem" />
                      </NcButton>
                      <NcButton
                        v-if="!filter.readOnly && !readOnly && appInfo.ee"
                        v-e="['c:filter:copy', { link: !!link, webHook: !!webHook }]"
                        type="text"
                        size="small"
                        :disabled="isLockedView"
                        class="nc-filter-item-copy-btn"
                        @click.stop="copyFilter(filter, true)"
                      >
                        <GeneralIcon icon="copy" />
                      </NcButton>
                      <NcButton
                        v-if="!filter.readOnly && !readOnly && isReorderEnabled"
                        v-e="['c:filter:reorder', { link: !!link, webHook: !!webHook }]"
                        type="text"
                        size="small"
                        class="nc-filter-item-reorder-btn nc-column-filter-drag-handler self-center"
                        :shadow="false"
                        :disabled="visibleFilters.length === 1"
                      >
                        <GeneralIcon icon="drag" class="flex-none h-4 w-4" />
                      </NcButton>
                    </template>
                  </template>
                </LazySmartsheetToolbarColumnFilter>
              </div>
            </div>
          </template>

          <div v-else class="flex xs:(items-start) items-center gap-2 w-full">
            <NcCheckbox
              v-if="appInfo.ee && !hideCheckbox"
              :checked="filter.enabled !== false"
              size="default"
              :disabled="isLockedView || readOnly"
              class="nc-filter-enabled-checkbox xs:(flex min-h-8)"
              @change="onToggleFilterChange(filter, getFilterIndex(filter))"
            />
            <div
              class="flex flex-col gap-y-2 sm:gap-y-0 sm:flex-row gap-x-0 flex-1"
              :class="[
                `nc-filter-wrapper-${filter.fk_column_id}`,
                { 'nc-filter-disabled-row': isEeUI && filter.enabled === false, 'nc-filter-wrapper': !isMobileMode },
              ]"
            >
              <NcWrap :wrap="!!isMobileMode" class="grid grid-cols-12 gap-x-0 flex-1 nc-filter-wrapper">
                <div
                  v-if="!visibleFilters.indexOf(filter)"
                  class="xs:col-span-3 flex items-center sm:(!min-w-18 !max-w-18) pl-3 nc-filter-where-label"
                >
                  {{ $t('labels.where') }}
                </div>

                <NcSelect
                  v-else
                  v-model:value="filter.logical_op"
                  v-e="['c:filter:logical-op:select', { link: !!link, webHook: !!webHook }]"
                  :dropdown-match-select-width="false"
                  class="xs:(col-span-3 !max-w-none !min-w-0) h-full !max-w-18 !min-w-18 capitalize"
                  hide-details
                  :disabled="
                    filter.readOnly ||
                    (visibleFilters.indexOf(filter) > 1 && !isLogicalOpChangeAllowed) ||
                    isLockedView ||
                    readOnly
                  "
                  dropdown-class-name="nc-dropdown-filter-logical-op"
                  :class="{
                    'nc-disabled-logical-op':
                      filter.readOnly || (visibleFilters.indexOf(filter) > 1 && !isLogicalOpChangeAllowed) || readOnly,
                  }"
                  @change="onLogicalOpUpdate(filter, getFilterIndex(filter))"
                  @click.stop
                >
                  <a-select-option v-for="op of logicalOps" :key="op.value" :value="op.value">
                    <div class="flex items-center w-full justify-between w-full gap-2">
                      <div class="truncate flex-1 capitalize">{{ op.text }}</div>
                      <component
                        :is="iconMap.check"
                        v-if="filter.logical_op === op.value"
                        id="nc-selected-item-icon"
                        class="text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>

                <NcTooltip
                  v-if="isFormFieldInaccessible(filter)"
                  class="xs:col-span-9 flex-1 flex items-center gap-2 px-2 !text-nc-content-red-medium cursor-pointer"
                  :disabled="!filter.fk_column_id || !visibilityError[filter.fk_column_id]"
                >
                  <template #title> {{ visibilityError[filter.fk_column_id!] ?? '' }}</template>
                  <GeneralIcon icon="alertTriangle" class="flex-none" />
                  {{ $t('title.fieldInaccessible') }}
                </NcTooltip>

                <SmartsheetToolbarFieldListAutoCompleteDropdown
                  v-if="!isFormFieldInaccessible(filter)"
                  :key="`${i}_6`"
                  v-model="filter.fk_column_id"
                  :class="{
                    'xs:(!max-w-none) !max-w-32': !webHook,
                  }"
                  class="xs:(col-span-6 min-w-0) nc-filter-field-select min-w-32 max-h-8"
                  :columns="fieldsToFilter"
                  :disable-smartsheet="!!widget || !!workflow || !!rlsPolicyId"
                  :disabled="filter.readOnly || isLockedView || readOnly"
                  :meta="meta"
                  :show-all-columns="filter.readOnly || isLockedView || readOnly"
                  @click.stop
                  @change="selectFilterField(filter, getFilterIndex(filter))"
                />

                <NcSelect
                  v-if="!isFormFieldInaccessible(filter)"
                  v-model:value="filter.comparison_op"
                  v-e="['c:filter:comparison-op:select', { link: !!link, webHook: !!webHook }]"
                  :dropdown-match-select-width="false"
                  class="xs:(col-span-3 !min-w-0) caption nc-filter-operation-select !min-w-26.75 max-h-8"
                  :placeholder="$t('labels.operation')"
                  :class="{
                    '!max-w-26.75': !webHook,
                  }"
                  density="compact"
                  variant="solo"
                  :disabled="filter.readOnly || isLockedView || readOnly"
                  hide-details
                  dropdown-class-name="nc-dropdown-filter-comp-op !max-w-80"
                  @change="filterUpdateCondition(filter, getFilterIndex(filter))"
                >
                  <template
                    v-for="compOp of comparisonOpList(types[filter.fk_column_id], getColumn(filter)?.meta?.date_format)"
                    :key="compOp.value"
                  >
                    <a-select-option v-if="isComparisonOpAllowed(filter, compOp)" :value="compOp.value">
                      <div class="flex items-center w-full justify-between w-full gap-2">
                        <div class="truncate flex-1">{{ compOp.text }}</div>
                        <component
                          :is="iconMap.check"
                          v-if="filter.comparison_op === compOp.value"
                          id="nc-selected-item-icon"
                          class="text-primary w-4 h-4"
                        />
                      </div>
                    </a-select-option>
                  </template>
                </NcSelect>
              </NcWrap>

              <NcWrap :wrap="!!isMobileMode" class="grid grid-cols-12 gap-x-0 flex-1 min-h-8 nc-filter-wrapper">
                <div
                  v-if="!isFormFieldInaccessible(filter) && ['blank', 'notblank'].includes(filter.comparison_op)"
                  class="xs:col-span-3 sm:(flex flex-grow)"
                ></div>

                <NcSelect
                  v-else-if="!isFormFieldInaccessible(filter) && isDateType(types[filter.fk_column_id])"
                  v-model:value="filter.comparison_sub_op"
                  v-e="['c:filter:sub-comparison-op:select', { link: !!link, webHook: !!webHook }]"
                  :dropdown-match-select-width="false"
                  class="xs:(col-span-3 !min-w-0) caption nc-filter-sub_operation-select !min-w-28"
                  :class="{
                    'flex-grow w-full': !showFilterInput(filter),
                    'max-w-28': showFilterInput(filter) && !webHook,
                  }"
                  :placeholder="$t('labels.operationSub')"
                  density="compact"
                  variant="solo"
                  :disabled="filter.readOnly || isLockedView || readOnly"
                  hide-details
                  dropdown-class-name="nc-dropdown-filter-comp-sub-op"
                  @change="filterUpdateCondition(filter, getFilterIndex(filter))"
                >
                  <template
                    v-for="compSubOp of comparisonSubOpList(filter.comparison_op, getColumn(filter)?.meta?.date_format)"
                    :key="compSubOp.value"
                  >
                    <a-select-option v-if="isComparisonSubOpAllowed(filter, compSubOp)" :value="compSubOp.value">
                      <div class="flex items-center w-full justify-between w-full gap-2 max-w-40">
                        <NcTooltip show-on-truncate-only class="truncate flex-1">
                          <template #title>{{ compSubOp.text }}</template>
                          {{ compSubOp.text }}
                        </NcTooltip>
                        <component
                          :is="iconMap.check"
                          v-if="filter.comparison_sub_op === compSubOp.value"
                          id="nc-selected-item-icon"
                          class="text-primary w-4 h-4"
                        />
                      </div>
                    </a-select-option>
                  </template>
                </NcSelect>
                <div
                  class="flex items-center flex-grow min-w-0 empty:!hidden"
                  :class="{
                    'xs:(col-span-6)':
                      isTimezoneAbbreviationAvailable(filter, getColumn(filter)) &&
                      (['blank', 'notblank'].includes(filter.comparison_op) || isDateType(types[filter.fk_column_id])),
                    'xs:(col-span-9)':
                      !isTimezoneAbbreviationAvailable(filter, getColumn(filter)) &&
                      (['blank', 'notblank'].includes(filter.comparison_op) || isDateType(types[filter.fk_column_id])),
                    'xs:(col-span-full)':
                      !isTimezoneAbbreviationAvailable(filter, getColumn(filter)) &&
                      !(['blank', 'notblank'].includes(filter.comparison_op) || isDateType(types[filter.fk_column_id])),
                  }"
                >
                  <div v-if="link && (filter.dynamic || filter.fk_value_col_id)" class="flex-grow">
                    <SmartsheetToolbarFieldListAutoCompleteDropdown
                      v-if="showFilterInput(filter)"
                      v-model="filter.fk_value_col_id"
                      :disable-smartsheet="!!widget"
                      class="nc-filter-field-select min-w-32 w-full max-h-8"
                      :columns="dynamicColumns(filter)"
                      :meta="rootMeta"
                      @change="saveOrUpdate(filter, getFilterIndex(filter))"
                    />
                  </div>
                  <template v-else-if="workflow && filter.dynamic">
                    <slot
                      name="dynamic-filter"
                      :filter="filter"
                      @update-filter-value="(value) => updateFilterValue(value, filter, getFilterIndex(filter))"
                    />
                  </template>

                  <template v-else>
                    <a-checkbox
                      v-if="filter.field && types[filter.field] === 'boolean'"
                      v-model:checked="filter.value"
                      dense
                      :disabled="filter.readOnly || isLockedView || readOnly"
                      @change="saveOrUpdate(filter, getFilterIndex(filter))"
                    />

                    <SmartsheetToolbarFilterInput
                      v-if="showFilterInput(filter) && (isViewFilter ? isOpen : true)"
                      class="nc-filter-value-select rounded-md min-w-34"
                      :class="{
                        '!w-full': webHook,
                      }"
                      :column="{ ...getColumn(filter), uidt: types[filter.fk_column_id] }"
                      :filter="filter"
                      :disabled="isLockedView || readOnly"
                      @update-filter-value="(value) => updateFilterValue(value, filter, getFilterIndex(filter))"
                      @click.stop
                    />

                    <div v-else-if="!isDateType(types[filter.fk_column_id])" class="flex-grow"></div>
                  </template>
                  <template v-if="workflow && showDynamicCondition">
                    <NcDropdown
                      class="nc-settings-dropdown h-full flex items-center min-w-0 rounded-lg"
                      :trigger="['click']"
                      placement="left"
                    >
                      <NcButton type="text" size="small">
                        <GeneralIcon icon="settings" />
                      </NcButton>

                      <template #overlay>
                        <div class="relative overflow-visible min-h-17 w-10">
                          <div
                            class="absolute -top-21 flex flex-col min-h-34.5 w-70 p-1.5 bg-nc-bg-default rounded-lg border-1 border-nc-border-gray-medium justify-start overflow-hidden"
                            style="box-shadow: 0px 4px 6px -2px rgba(0, 0, 0, 0.06), 0px -12px 16px -4px rgba(0, 0, 0, 0.1)"
                          >
                            <div
                              class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer rounded-md hover:bg-nc-bg-gray-light text-nc-content-gray-subtle2 nc-new-record-with-grid group"
                              @click="resetDynamicField(filter, getFilterIndex(filter))"
                            >
                              <div class="flex flex-row items-center justify-between w-full">
                                <div class="flex flex-row items-center justify-start gap-x-3">Static condition</div>
                                <GeneralIcon
                                  v-if="!filter.dynamic && !filter.fk_value_col_id"
                                  icon="check"
                                  class="w-4 h-4 text-primary"
                                />
                              </div>
                              <div class="flex flex-row text-xs text-nc-content-gray-disabled">Filter based on static value</div>
                            </div>
                            <div
                              v-e="['c:filter:dynamic-filter']"
                              class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer cursor-pointer rounded-md hover:bg-nc-bg-gray-light text-nc-content-gray-subtle2 nc-new-record-with-form group"
                              @click="changeToDynamic(filter, getFilterIndex(filter))"
                            >
                              <div class="flex flex-row items-center justify-between w-full">
                                <div class="flex flex-row items-center justify-start gap-x-2.5">Dynamic condition</div>
                                <GeneralIcon
                                  v-if="filter.dynamic || filter.fk_value_col_id"
                                  icon="check"
                                  class="w-4 h-4 text-primary"
                                />
                              </div>
                              <div class="flex flex-row text-xs text-nc-content-gray-disabled">Filter based on dynamic value</div>
                            </div>
                          </div>
                        </div>
                      </template>
                    </NcDropdown>
                  </template>
                  <template v-if="link && showDynamicCondition">
                    <NcDropdown
                      class="nc-settings-dropdown h-full flex items-center min-w-0 rounded-lg"
                      :trigger="['click']"
                      placement="bottom"
                      :disabled="isLockedView"
                    >
                      <NcButton type="text" size="small">
                        <GeneralIcon icon="settings" />
                      </NcButton>

                      <template #overlay>
                        <div class="relative overflow-visible min-h-17 w-10">
                          <div
                            class="absolute -top-21 flex flex-col min-h-34.5 w-70 p-1.5 bg-nc-bg-default rounded-lg border-1 border-nc-border-gray-medium justify-start overflow-hidden"
                            style="box-shadow: 0px 4px 6px -2px rgba(0, 0, 0, 0.06), 0px -12px 16px -4px rgba(0, 0, 0, 0.1)"
                          >
                            <div
                              class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer rounded-md hover:bg-nc-bg-gray-light text-nc-content-gray-subtle2 nc-new-record-with-grid group"
                              @click="resetDynamicField(filter, getFilterIndex(filter))"
                            >
                              <div class="flex flex-row items-center justify-between w-full">
                                <div class="flex flex-row items-center justify-start gap-x-3">Static condition</div>
                                <GeneralIcon
                                  v-if="!filter.dynamic && !filter.fk_value_col_id"
                                  icon="check"
                                  class="w-4 h-4 text-primary"
                                />
                              </div>
                              <div class="flex flex-row text-xs text-nc-content-gray-disabled">Filter based on static value</div>
                            </div>
                            <div
                              v-e="['c:filter:dynamic-filter']"
                              class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer rounded-md hover:bg-nc-bg-gray-light text-nc-content-gray-subtle2 nc-new-record-with-form group"
                              :class="
                                isDynamicFilterAllowed(filter) && showFilterInput(filter)
                                  ? 'cursor-pointer'
                                  : 'cursor-not-allowed'
                              "
                              @click="changeToDynamic(filter, getFilterIndex(filter))"
                            >
                              <div class="flex flex-row items-center justify-between w-full">
                                <div class="flex flex-row items-center justify-start gap-x-2.5">Dynamic condition</div>
                                <GeneralIcon
                                  v-if="filter.dynamic || filter.fk_value_col_id"
                                  icon="check"
                                  class="w-4 h-4 text-primary"
                                />
                              </div>
                              <div class="flex flex-row text-xs text-nc-content-gray-disabled">Filter based on dynamic value</div>
                            </div>
                          </div>
                        </div>
                      </template>
                    </NcDropdown>
                  </template>
                </div>
                <SmartsheetToolbarFilterTimezoneAbbreviation
                  v-if="!isFormFieldInaccessible(filter)"
                  :column="getColumn(filter)"
                  :filter="filter"
                  class="xs:(rounded-r-lg col-span-3)"
                />
              </NcWrap>

              <template v-if="!isMobileMode">
                <NcButton
                  v-if="!filter.readOnly && !readOnly"
                  v-e="['c:filter:delete', { link: !!link, webHook: !!webHook }]"
                  type="text"
                  size="small"
                  :disabled="isLockedView"
                  class="nc-filter-item-remove-btn self-center"
                  @click.stop="deleteFilter(filter, getFilterIndex(filter))"
                >
                  <GeneralIcon icon="deleteListItem" />
                </NcButton>
                <NcButton
                  v-if="!filter.readOnly && !readOnly && appInfo.ee"
                  v-e="['c:filter:copy', { link: !!link, webHook: !!webHook }]"
                  type="text"
                  size="small"
                  :disabled="isLockedView"
                  class="nc-filter-item-copy-btn self-center"
                  @click.stop="copyFilter(filter)"
                >
                  <GeneralIcon icon="copy" />
                </NcButton>

                <NcTooltip
                  v-if="
                    !filter.readOnly &&
                    !readOnly &&
                    appInfo.ee &&
                    isViewFilter &&
                    !filter.is_group &&
                    !webHook &&
                    !link &&
                    !widget &&
                    !isList
                  "
                >
                  <template #title>
                    {{ getPinTooltip(filter) }}
                  </template>
                  <NcButton
                    v-if="showEEFeatures"
                    v-e="['c:filter:pin']"
                    type="text"
                    size="small"
                    :disabled="!canPinFilter(filter) || isLockedView"
                    class="nc-filter-item-pin-btn self-center"
                    @click.stop="
                      blockPinnedFilter ? showUpgradeToUsePinnedFilter() : togglePinFilter(filter, getFilterIndex(filter))
                    "
                  >
                    <GeneralIcon
                      :icon="parseProp(filter.meta)?.pinned ? 'ncPinOff' : 'ncPin'"
                      class="h-3.5 w-3.5"
                      :class="
                        (!canPinFilter(filter) && !parseProp(filter.meta)?.pinned) || isLockedView
                          ? 'text-nc-content-gray-muted'
                          : parseProp(filter.meta)?.pinned
                          ? 'text-primary'
                          : 'text-nc-content-gray-subtle2'
                      "
                    />
                  </NcButton>
                </NcTooltip>

                <NcButton
                  v-if="!filter.readOnly && !readOnly && isReorderEnabled"
                  v-e="['c:filter:reorder', { link: !!link, webHook: !!webHook }]"
                  type="text"
                  size="small"
                  class="nc-filter-item-reorder-btn nc-column-filter-drag-handler self-center"
                  :shadow="false"
                  :disabled="visibleFilters.length === 1"
                >
                  <GeneralIcon icon="drag" class="flex-none h-4 w-4" />
                </NcButton>
              </template>
            </div>
            <div v-if="isMobileMode && mobileActionMenuItems(filter).length" class="h-8 flex items-center">
              <SmartsheetToolbarColumnFilterMobileActionMenu :items="mobileActionMenuItems(filter)" />
            </div>
          </div>
        </div>
      </template>
    </Draggable>

    <template v-if="!nested">
      <div class="flex">
        <template v-if="appInfo.ee && !isPublic">
          <div
            v-if="!readOnly && filtersCount < getPlanLimit(PlanLimitTypes.LIMIT_FILTER_PER_VIEW) && !hiddenAddNewFilter"
            class="flex gap-2 xs:(justify-between items-start) w-full pr-4"
            :class="{
              'mt-1 mb-2': filters.length,
            }"
          >
            <NcWrap :wrap="!!isMobileMode" class="flex flex-col items-start gap-y-2">
              <NcButton
                v-if="!hiddenAddNewFilter"
                size="small"
                :type="actionBtnType"
                :disabled="disableAddNewFilter || isLockedView || readOnly"
                class="nc-btn-focus"
                data-testid="add-filter"
                @click.stop="addFilter()"
              >
                <div class="flex items-center gap-1">
                  <component :is="iconMap.plus" />
                  <!-- Add Filter -->
                  {{ isForm && !webHook ? $t('activity.addCondition') : $t('activity.addFilter') }}
                </div>
              </NcButton>

              <NcButton
                v-if="nestedLevel < 5 && !readOnly"
                class="nc-btn-focus"
                :disabled="disableAddNewFilter || isLockedView"
                :type="actionBtnType"
                size="small"
                data-testid="add-filter-group"
                @click.stop="addFilterGroup()"
              >
                <div class="flex items-center gap-1">
                  <!-- Add Filter Group -->
                  <component :is="iconMap.plus" />
                  {{ isForm && !webHook ? $t('activity.addConditionGroup') : $t('activity.addFilterGroup') }}
                </div>
              </NcButton>
            </NcWrap>

            <LazyGeneralCopyFromAnotherViewActionBtn
              v-if="activeView && isViewFilter"
              :view="activeView"
              :default-options="[ViewSettingOverrideOptions.FILTER_CONDITION]"
              @open="isOpen = false"
            />
          </div>
        </template>

        <template v-else-if="!readOnly && !hiddenAddNewFilter">
          <div
            ref="addFiltersRowDomRef"
            class="flex gap-2 xs:(flex-col items-start)"
            :class="{
              'mt-1 mb-2': filters.length,
            }"
          >
            <NcButton
              class="nc-btn-focus"
              size="small"
              :type="actionBtnType"
              data-testid="add-filter"
              :disabled="isLockedView"
              @click.stop="addFilter()"
            >
              <div class="flex items-center gap-1">
                <component :is="iconMap.plus" />
                <!-- Add Filter -->
                {{ isForm && !webHook ? $t('activity.addCondition') : $t('activity.addFilter') }}
              </div>
            </NcButton>

            <NcButton
              v-if="!link && !webHook && nestedLevel < 5"
              class="nc-btn-focus"
              :type="actionBtnType"
              size="small"
              :disabled="isLockedView"
              data-testid="add-filter-group"
              @click.stop="addFilterGroup()"
            >
              <div class="flex items-center gap-1">
                <!-- Add Filter Group -->
                <component :is="iconMap.plus" />
                {{ isForm && !webHook ? $t('activity.addConditionGroup') : $t('activity.addFilterGroup') }}
              </div>
            </NcButton>
          </div>
        </template>
      </div>
    </template>
    <div
      v-if="!visibleFilters || !visibleFilters.length"
      class="flex flex-row text-nc-content-gray-disabled mt-2"
      :class="{
        'ml-1': nested,
        'ml-0.5': !nested,
      }"
    >
      {{ isForm && !webHook ? $t('title.noConditionsAdded') : $t('title.noFiltersAdded') }}
    </div>

    <slot />

    <GeneralLockedViewFooter
      v-if="isLockedView && !nested"
      class="-mb-2 -ml-4"
      :class="{
        'mt-2': !visibleFilters || !visibleFilters.length,
      }"
      @on-open="isOpen = false"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-filter-item-remove-btn,
.nc-filter-item-reorder-btn,
.nc-filter-item-copy-btn,
.nc-filter-item-pin-btn {
  @apply text-nc-content-gray-subtle2 hover:text-nc-content-gray;
}

.nc-filter-grid {
  @apply items-center w-full;
}

:deep(.ant-select-item-option) {
  @apply "!min-w-full";
}

:deep(.ant-select-selector) {
  @apply !min-h-8;
}

.nc-disabled-logical-op :deep(.ant-select-arrow) {
  @apply hidden;
}

.nc-filter-wrapper {
  @apply bg-nc-bg-default !rounded-lg border-1px border-nc-border-gray-medium;

  & > *,
  .nc-filter-value-select {
    @apply !border-none;
  }

  & > div > :deep(.ant-select-selector),
  :deep(.nc-filter-field-select) > div {
    border: none !important;
    box-shadow: none !important;
  }

  & > :not(:last-child):not(:empty) {
    border-right: 1px solid var(--nc-border-gray-medium) !important;
    border-bottom-right-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }

  .nc-settings-dropdown {
    border-left: 1px solid var(--nc-border-gray-medium) !important;
    border-radius: 0 !important;
  }

  & > :not(:first-child) {
    border-bottom-left-radius: 0 !important;
    border-top-left-radius: 0 !important;
  }

  & > :last-child {
    @apply relative sm:(after:(content-[''] absolute h-full w-1px bg-[var(--nc-bg-gray-medium)] -left-1px top-0));
  }

  :deep(::placeholder) {
    @apply text-sm tracking-normal;
  }

  :deep(::-ms-input-placeholder) {
    @apply text-sm tracking-normal;
  }

  :deep(input) {
    @apply text-sm;
  }

  :deep(.nc-select:not(.nc-disabled-logical-op):not(.ant-select-disabled):hover) {
    &,
    .ant-select-selector {
      @apply bg-nc-bg-gray-extralight;
    }
  }
}
.nc-filter-nested-level-0 {
  @apply bg-nc-bg-gray-extralight;
}

.nc-filter-nested-level-1,
.nc-filter-nested-level-3 {
  @apply bg-nc-bg-gray-light;
}

.nc-filter-nested-level-2,
.nc-filter-nested-level-4 {
  @apply bg-nc-bg-gray-medium;
}

.nc-filter-logical-op-level-3,
.nc-filter-logical-op-level-5 {
  :deep(.nc-select.ant-select .ant-select-selector) {
    @apply border-[#d9d9d9];
  }
}

.nc-filter-where-label {
  @apply text-nc-content-gray-disabled;
}

:deep(.ant-select-disabled.ant-select:not(.ant-select-customize-input) .ant-select-selector) {
  @apply bg-transparent text-nc-content-gray-disabled;
}

:deep(.nc-filter-logical-op .nc-select.ant-select .ant-select-selector) {
  @apply shadow-none;
}

:deep(.nc-select-expand-btn) {
  @apply text-nc-content-gray-muted;
}

.menu-filter-dropdown {
  input:not(:disabled),
  select:not(:disabled),
  .ant-select:not(.ant-select-disabled) {
    @apply text-nc-content-gray-subtle2;
  }
}

.nc-filter-input-wrapper :deep(input) {
  &:not(.ant-select-selection-search-input) {
    @apply !px-2;
  }
}

.nc-btn-focus:focus {
  @apply !text-nc-content-brand !shadow-none;
}

.nc-filter-disabled-row {
  @apply opacity-40;

  // keep action buttons (delete, copy, reorder) fully interactive
  .nc-filter-item-remove-btn,
  .nc-filter-item-copy-btn,
  .nc-filter-item-reorder-btn {
    @apply opacity-100 pointer-events-auto;
  }
}

// group disabled state — dim the entire group container but keep action buttons and checkbox interactive
.nc-filter-disabled-group {
  & > * {
    @apply opacity-40;
  }
  :deep(.nc-filter-enabled-checkbox) {
    @apply opacity-100 pointer-events-auto;
  }
  :deep(.nc-filter-item-remove-btn),
  :deep(.nc-filter-item-copy-btn),
  :deep(.nc-filter-item-reorder-btn) {
    @apply opacity-100 pointer-events-auto;
  }
}
</style>

<style lang="scss">
.nc-filter-field-select {
  .ant-select-selector {
    .field-selection-tooltip-wrapper {
      @apply !max-w-20;
    }
  }
}
</style>
