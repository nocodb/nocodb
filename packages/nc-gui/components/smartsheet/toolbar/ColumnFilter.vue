<script setup lang="ts">
import { type ColumnType, type FilterType, isCreatedOrLastModifiedTimeCol, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { PlanLimitTypes, UITypes } from 'nocodb-sdk'

interface Props {
  nestedLevel?: number
  parentId?: string
  autoSave: boolean
  hookId?: string
  showLoading?: boolean
  modelValue?: FilterType[] | null
  webHook?: boolean
  link?: boolean
  draftFilter?: Partial<FilterType>
  isOpen?: boolean
  rootMeta?: any
  linkColId?: string
  parentColId?: string
  actionBtnType?: 'text' | 'secondary'
  /** Custom filter function */
  filterOption?: (column: ColumnType) => boolean
  visibilityError?: Record<string, string>
  disableAddNewFilter?: boolean
  isViewFilter?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nestedLevel: 0,
  autoSave: true,
  showLoading: true,
  parentId: undefined,
  hookId: undefined,
  webHook: false,
  link: false,
  linkColId: undefined,
  parentColId: undefined,
  actionBtnType: 'text',
  visibilityError: () => ({}),
  disableAddNewFilter: false,
  isViewFilter: false,
})

const emit = defineEmits(['update:filtersLength', 'update:draftFilter', 'update:modelValue', 'update:isOpen'])

const initialModelValue = props.modelValue

const excludedFilterColUidt = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const draftFilter = useVModel(props, 'draftFilter', emit)

const modelValue = useVModel(props, 'modelValue', emit)

const isOpen = useVModel(props, 'isOpen', emit)

const {
  nestedLevel,
  parentId,
  autoSave,
  hookId,
  showLoading,
  webHook,
  link,
  linkColId,
  parentColId,
  visibilityError,
  disableAddNewFilter,
  isViewFilter,
} = toRefs(props)

const nested = computed(() => nestedLevel.value > 0)

const { t } = useI18n()

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

const { nestedFilters, isForm } = useSmartsheetStoreOrThrow()

const currentFilters = modelValue.value || (!link.value && !webHook.value && nestedFilters.value) || []

const columns = computed(() => meta.value?.columns)

const fieldsToFilter = computed(() =>
  (columns.value || []).filter((c) => {
    if (link.value && isSystemColumn(c) && !c.pk && !isCreatedOrLastModifiedTimeCol(c)) return false

    const customFilter = props.filterOption ? props.filterOption(c) : true

    return !excludedFilterColUidt.includes(c.uidt as UITypes) && customFilter
  }),
)

const {
  filters,
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
    reloadAggregate?.trigger()
  },
  currentFilters,
  props.nestedLevel > 0,
  webHook.value,
  link.value,
  linkColId,
  fieldsToFilter,
  parentColId,
)

const { getPlanLimit } = useWorkspace()

const localNestedFilters = ref()

const wrapperDomRef = ref<HTMLElement>()
const addFiltersRowDomRef = ref<HTMLElement>()

const isMounted = ref(false)

const getColumn = (filter: Filter) => {
  // extract looked up column if available
  return btLookupTypesMap.value[filter.fk_column_id] || columns.value?.find((col: ColumnType) => col.id === filter.fk_column_id)
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
    webHook: !!webHook.value,
  })
}

watch(
  () => activeView.value?.id,
  (n, o) => {
    // if nested no need to reload since it will get reloaded from parent
    if (!nested.value && n !== o && (hookId?.value || !webHook.value) && (linkColId?.value || !link.value))
      loadFilters({
        hookId: hookId.value,
        isWebhook: webHook.value,
        linkColId: unref(linkColId),
        isLink: link.value,
      })
  },
)

const allFilters: Ref<Record<string, FilterType[]>> = inject(AllFiltersInj, ref({}))

watch(
  () => nonDeletedFilters.value.length,
  (length: number) => {
    allFilters.value[parentId?.value ?? 'root'] = [...nonDeletedFilters.value]
    emit('update:filtersLength', length ?? 0)
  },
)

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
  } else {
    await sync({ hookId: hookOrColId, nested })
  }

  if (!localNestedFilters.value?.length) return

  for (const nestedFilter of localNestedFilters.value) {
    if (nestedFilter.parentId) {
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

  // Do not save the filter on field change if its a draft/placeholder filter
  if (!isFilterDraft(filter, col)) {
    saveOrUpdate(filter, index)
  }
}

const updateFilterValue = (value: string, filter: Filter, index: number) => {
  filter.value = value
  saveOrUpdateDebounced(filter, index)
}

defineExpose({
  applyChanges,
  parentId,
})

const scrollToBottom = () => {
  wrapperDomRef.value?.scrollTo({
    top: wrapperDomRef.value.scrollHeight,
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

const addFilter = async (filter?: Partial<FilterType>) => {
  await _addFilter(false, filter)

  if (filter) {
    selectFilterField(filters.value[filters.value.length - 1], filters.value.length - 1)
  }

  if (!nested.value) {
    // if nested, scroll to bottom
    scrollToBottom()
  } else {
    scrollDownIfNeeded()
  }
}

const addFilterGroup = async () => {
  await _addFilterGroup()

  if (!nested.value) {
    // if nested, scroll to bottom
    scrollToBottom()
  } else {
    scrollDownIfNeeded()
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

onMounted(async () => {
  await Promise.all([
    (async () => {
      if (!initialModelValue)
        await loadFilters({
          hookId: hookId?.value,
          isWebhook: webHook.value,
          linkColId: unref(linkColId),
          isLink: link.value,
        })
    })(),
    loadBtLookupTypes(),
  ])
  isMounted.value = true
})

onBeforeUnmount(() => {
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

const visibleFilters = computed(() => filters.value.filter((filter) => filter.status !== 'delete'))

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

const { sqlUis } = storeToRefs(useBase())

const sqlUi = meta.value?.source_id ? sqlUis.value[meta.value?.source_id] : Object.values(sqlUis.value)[0]

const isDynamicFilterAllowed = (filter: FilterType) => {
  const col = getColumn(filter)
  // if virtual column, don't allow dynamic filter
  if (isVirtualCol(col)) return false

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

  const abstractType = sqlUi.getAbstractType(col)

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
    const dynamicColAbstractType = sqlUi.getAbstractType(c)

    const filterColAbstractType = sqlUi.getAbstractType(filterCol)

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
</script>

<template>
  <div
    data-testid="nc-filter"
    class="menu-filter-dropdown w-min"
    :class="{
      'max-h-[max(80vh,500px)] min-w-122 py-2 pl-4': !nested,
      '!min-w-127.5': isForm && !webHook,
      '!min-w-full !w-full !pl-0': !nested && webHook,
      'min-w-full': nested,
    }"
  >
    <div v-if="nested" class="flex min-w-full w-min items-center gap-1 mb-2">
      <div :class="[`nc-filter-logical-op-level-${nestedLevel}`]">
        <slot name="start"></slot>
      </div>
      <div class="flex-grow"></div>
      <NcDropdown
        :trigger="['hover']"
        overlay-class-name="nc-dropdown-filter-group-sub-menu"
        :disabled="disableAddNewFilter || isLockedView"
      >
        <NcButton size="xs" type="text" :disabled="disableAddNewFilter || isLockedView">
          <GeneralIcon icon="plus" class="cursor-pointer" />
        </NcButton>

        <template #overlay>
          <NcMenu>
            <template v-if="!isEeUI && !isPublic">
              <template v-if="filtersCount < getPlanLimit(PlanLimitTypes.FILTER_LIMIT)">
                <NcMenuItem data-testid="add-filter-menu" @click.stop="addFilter">
                  <div class="flex items-center gap-1">
                    <component :is="iconMap.plus" />
                    <!-- Add Filter -->
                    {{ isForm && !webHook ? $t('activity.addCondition') : $t('activity.addFilter') }}
                  </div>
                </NcMenuItem>

                <NcMenuItem v-if="nestedLevel < 5" data-testid="add-filter-group-menu" @click.stop="addFilterGroup">
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
                  <component :is="iconMap.plus" />
                  <!-- Add Filter -->
                  {{ isForm && !webHook ? $t('activity.addCondition') : $t('activity.addFilter') }}
                </div>
              </NcMenuItem>

              <NcMenuItem v-if="!webHook && nestedLevel < 5" data-testid="add-filter-group-menu" @click.stop="addFilterGroup">
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
    <div
      v-if="visibleFilters && visibleFilters.length"
      ref="wrapperDomRef"
      class="flex flex-col gap-y-1.5 nc-filter-grid min-w-full w-min"
      :class="{ 'max-h-420px nc-scrollbar-thin nc-filter-top-wrapper pr-4 my-2 py-1': !nested, '!pr-0': webHook && !nested }"
      @click.stop
    >
      <template v-for="(filter, i) in filters" :key="i">
        <template v-if="filter.status !== 'delete'">
          <template v-if="filter.is_group">
            <div class="flex flex-col min-w-full w-min gap-y-2">
              <div class="flex rounded-lg p-2 min-w-full w-min border-1" :class="[`nc-filter-nested-level-${nestedLevel}`]">
                <LazySmartsheetToolbarColumnFilter
                  v-if="filter.id || filter.children || !autoSave"
                  :key="i"
                  ref="localNestedFilters"
                  v-model="filter.children"
                  :nested-level="nestedLevel + 1"
                  :parent-id="filter.id"
                  :auto-save="autoSave"
                  :web-hook="webHook"
                  :link="link"
                  :show-loading="false"
                  :root-meta="rootMeta"
                  :link-col-id="linkColId"
                  :parent-col-id="parentColId"
                  :filter-option="filterOption"
                  :visibility-error="visibilityError"
                  :disable-add-new-filter="disableAddNewFilter"
                  :is-view-filter="isViewFilter"
                >
                  <template #start>
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
                        :disabled="(i > 1 && !isLogicalOpChangeAllowed) || isLockedView"
                        :class="{
                          'nc-disabled-logical-op': filter.readOnly || (i > 1 && !isLogicalOpChangeAllowed),
                          '!max-w-18': !webHook,
                          '!w-full': webHook,
                        }"
                        @click.stop
                        @change="onLogicalOpUpdate(filter, i)"
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
                    <NcButton
                      v-if="!filter.readOnly"
                      :key="i"
                      v-e="['c:filter:delete', { link: !!link, webHook: !!webHook }]"
                      type="text"
                      size="small"
                      :disabled="isLockedView"
                      class="nc-filter-item-remove-btn cursor-pointer"
                      @click.stop="deleteFilter(filter, i)"
                    >
                      <component :is="iconMap.deleteListItem" />
                    </NcButton>
                  </template>
                </LazySmartsheetToolbarColumnFilter>
              </div>
            </div>
          </template>

          <div v-else class="flex flex-row gap-x-0 w-full nc-filter-wrapper" :class="`nc-filter-wrapper-${filter.fk_column_id}`">
            <div v-if="!visibleFilters.indexOf(filter)" class="flex items-center !min-w-18 !max-w-18 pl-3 nc-filter-where-label">
              {{ $t('labels.where') }}
            </div>

            <NcSelect
              v-else
              v-model:value="filter.logical_op"
              v-e="['c:filter:logical-op:select', { link: !!link, webHook: !!webHook }]"
              :dropdown-match-select-width="false"
              class="h-full !max-w-18 !min-w-18 capitalize"
              hide-details
              :disabled="filter.readOnly || (visibleFilters.indexOf(filter) > 1 && !isLogicalOpChangeAllowed) || isLockedView"
              dropdown-class-name="nc-dropdown-filter-logical-op"
              :class="{
                'nc-disabled-logical-op': filter.readOnly || (visibleFilters.indexOf(filter) > 1 && !isLogicalOpChangeAllowed),
              }"
              @change="onLogicalOpUpdate(filter, i)"
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
              v-if="isForm && !webHook && !fieldsToFilter.find((c) => c?.id === filter.fk_column_id)"
              class="flex-1 flex items-center gap-2 px-2 !text-red-500 cursor-pointer"
              :disabled="!filter.fk_column_id || !visibilityError[filter.fk_column_id]"
            >
              <template #title> {{ visibilityError[filter.fk_column_id!] ?? '' }}</template>
              <GeneralIcon icon="alertTriangle" class="flex-none" />
              {{ $t('title.fieldInaccessible') }}
            </NcTooltip>

            <template v-else>
              <SmartsheetToolbarFieldListAutoCompleteDropdown
                :key="`${i}_6`"
                v-model="filter.fk_column_id"
                :class="{
                  'max-w-32': !webHook,
                  '!w-full': webHook,
                }"
                class="nc-filter-field-select min-w-32 max-h-8"
                :columns="fieldsToFilter"
                :disabled="filter.readOnly || isLockedView"
                :meta="meta"
                @click.stop
                @change="selectFilterField(filter, i)"
              />

              <NcSelect
                v-model:value="filter.comparison_op"
                v-e="['c:filter:comparison-op:select', { link: !!link, webHook: !!webHook }]"
                :dropdown-match-select-width="false"
                class="caption nc-filter-operation-select !min-w-26.75 max-h-8"
                :placeholder="$t('labels.operation')"
                :class="{
                  '!max-w-26.75': !webHook,
                  '!w-full': webHook,
                }"
                density="compact"
                variant="solo"
                :disabled="filter.readOnly || isLockedView"
                hide-details
                dropdown-class-name="nc-dropdown-filter-comp-op !max-w-80"
                @change="filterUpdateCondition(filter, i)"
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

              <div v-if="['blank', 'notblank'].includes(filter.comparison_op)" class="flex flex-grow"></div>

              <NcSelect
                v-else-if="isDateType(types[filter.fk_column_id])"
                v-model:value="filter.comparison_sub_op"
                v-e="['c:filter:sub-comparison-op:select', { link: !!link, webHook: !!webHook }]"
                :dropdown-match-select-width="false"
                class="caption nc-filter-sub_operation-select min-w-28"
                :class="{
                  'flex-grow w-full': !showFilterInput(filter),
                  'max-w-28': showFilterInput(filter) && !webHook,
                }"
                :placeholder="$t('labels.operationSub')"
                density="compact"
                variant="solo"
                :disabled="filter.readOnly || isLockedView"
                hide-details
                dropdown-class-name="nc-dropdown-filter-comp-sub-op"
                @change="filterUpdateCondition(filter, i)"
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
              <div class="flex items-center flex-grow">
                <div v-if="link && (filter.dynamic || filter.fk_value_col_id)" class="flex-grow">
                  <SmartsheetToolbarFieldListAutoCompleteDropdown
                    v-if="showFilterInput(filter)"
                    v-model="filter.fk_value_col_id"
                    class="nc-filter-field-select min-w-32 w-full max-h-8"
                    :columns="dynamicColumns(filter)"
                    :meta="rootMeta"
                    @change="saveOrUpdate(filter, i)"
                  />
                </div>

                <template v-else>
                  <a-checkbox
                    v-if="filter.field && types[filter.field] === 'boolean'"
                    v-model:checked="filter.value"
                    dense
                    :disabled="filter.readOnly || isLockedView"
                    @change="saveOrUpdate(filter, i)"
                  />

                  <SmartsheetToolbarFilterInput
                    v-if="showFilterInput(filter)"
                    class="nc-filter-value-select rounded-md min-w-34"
                    :class="{
                      '!w-full': webHook,
                    }"
                    :column="{ ...getColumn(filter), uidt: types[filter.fk_column_id] }"
                    :filter="filter"
                    :disabled="isLockedView"
                    @update-filter-value="(value) => updateFilterValue(value, filter, i)"
                    @click.stop
                  />

                  <div v-else-if="!isDateType(types[filter.fk_column_id])" class="flex-grow"></div>
                </template>
                <template v-if="link">
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
                          class="absolute -top-21 flex flex-col min-h-34.5 w-70 p-1.5 bg-white rounded-lg border-1 border-gray-200 justify-start overflow-hidden"
                          style="box-shadow: 0px 4px 6px -2px rgba(0, 0, 0, 0.06), 0px -12px 16px -4px rgba(0, 0, 0, 0.1)"
                        >
                          <div
                            class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer rounded-md hover:bg-gray-100 text-gray-600 nc-new-record-with-grid group"
                            @click="resetDynamicField(filter, i)"
                          >
                            <div class="flex flex-row items-center justify-between w-full">
                              <div class="flex flex-row items-center justify-start gap-x-3">Static condition</div>
                              <GeneralIcon
                                v-if="!filter.dynamic && !filter.fk_value_col_id"
                                icon="check"
                                class="w-4 h-4 text-primary"
                              />
                            </div>
                            <div class="flex flex-row text-xs text-gray-400">Filter based on static value</div>
                          </div>
                          <div
                            v-e="['c:filter:dynamic-filter']"
                            class="px-4 py-3 flex flex-col select-none gap-y-2 cursor-pointer rounded-md hover:bg-gray-100 text-gray-600 nc-new-record-with-form group"
                            :class="
                              isDynamicFilterAllowed(filter) && showFilterInput(filter) ? 'cursor-pointer' : 'cursor-not-allowed'
                            "
                            @click="changeToDynamic(filter, i)"
                          >
                            <div class="flex flex-row items-center justify-between w-full">
                              <div class="flex flex-row items-center justify-start gap-x-2.5">Dynamic condition</div>
                              <GeneralIcon
                                v-if="filter.dynamic || filter.fk_value_col_id"
                                icon="check"
                                class="w-4 h-4 text-primary"
                              />
                            </div>
                            <div class="flex flex-row text-xs text-gray-400">Filter based on dynamic value</div>
                          </div>
                        </div>
                      </div>
                    </template>
                  </NcDropdown>
                </template>
              </div>
            </template>
            <NcButton
              v-if="!filter.readOnly"
              v-e="['c:filter:delete', { link: !!link, webHook: !!webHook }]"
              type="text"
              size="small"
              :disabled="isLockedView"
              class="nc-filter-item-remove-btn self-center"
              @click.stop="deleteFilter(filter, i)"
            >
              <component :is="iconMap.deleteListItem" />
            </NcButton>
          </div>
        </template>
      </template>
    </div>

    <template v-if="!nested">
      <template v-if="isEeUI && !isPublic">
        <div
          v-if="filtersCount < getPlanLimit(PlanLimitTypes.FILTER_LIMIT)"
          class="flex gap-2"
          :class="{
            'mt-1 mb-2': filters.length,
          }"
        >
          <NcButton
            size="small"
            :type="actionBtnType"
            :disabled="disableAddNewFilter || isLockedView"
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
            v-if="nestedLevel < 5"
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
        </div>
      </template>

      <template v-else>
        <div
          ref="addFiltersRowDomRef"
          class="flex gap-2"
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
    </template>
    <div
      v-if="!visibleFilters || !visibleFilters.length"
      class="flex flex-row text-gray-400 mt-2"
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
.nc-filter-item-remove-btn {
  @apply text-gray-600 hover:text-gray-800;
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
  @apply bg-white !rounded-lg border-1px border-[#E7E7E9];

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
    border-right: 1px solid #eee !important;
    border-bottom-right-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }

  .nc-settings-dropdown {
    border-left: 1px solid #eee !important;
    border-radius: 0 !important;
  }

  & > :not(:first-child) {
    border-bottom-left-radius: 0 !important;
    border-top-left-radius: 0 !important;
  }

  & > :last-child {
    @apply relative;
    &::after {
      content: '';
      @apply absolute h-full w-1px bg-[#eee] -left-1px top-0;
    }
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
      @apply bg-gray-50;
    }
  }
}

.nc-filter-nested-level-0 {
  @apply bg-[#f9f9fa];
}

.nc-filter-nested-level-1,
.nc-filter-nested-level-3 {
  @apply bg-gray-[#f4f4f5];
}

.nc-filter-nested-level-2,
.nc-filter-nested-level-4 {
  @apply bg-gray-[#e7e7e9];
}

.nc-filter-logical-op-level-3,
.nc-filter-logical-op-level-5 {
  :deep(.nc-select.ant-select .ant-select-selector) {
    @apply border-[#d9d9d9];
  }
}

.nc-filter-where-label {
  @apply text-gray-400;
}

:deep(.ant-select-disabled.ant-select:not(.ant-select-customize-input) .ant-select-selector) {
  @apply bg-transparent text-gray-400;
}

:deep(.nc-filter-logical-op .nc-select.ant-select .ant-select-selector) {
  @apply shadow-none;
}

:deep(.nc-select-expand-btn) {
  @apply text-gray-500;
}

.menu-filter-dropdown {
  input:not(:disabled),
  select:not(:disabled),
  .ant-select:not(.ant-select-disabled) {
    @apply text-[#4A5268];
  }
}

.nc-filter-input-wrapper :deep(input) {
  &:not(.ant-select-selection-search-input) {
    @apply !px-2;
  }
}

.nc-btn-focus:focus {
  @apply !text-brand-500 !shadow-none;
}
</style>
