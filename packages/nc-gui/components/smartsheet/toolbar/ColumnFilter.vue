<script setup lang="ts">
import type { ColumnType, FilterType } from 'nocodb-sdk'
import { PlanLimitTypes, UITypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  AllFiltersInj,
  MetaInj,
  ReloadViewDataHookInj,
  comparisonOpList,
  comparisonSubOpList,
  computed,
  iconMap,
  inject,
  onMounted,
  ref,
  useNuxtApp,
  useViewFilters,
  watch,
} from '#imports'
import type { Filter } from '#imports'

interface Props {
  nestedLevel?: number
  parentId?: string
  autoSave: boolean
  hookId?: string
  showLoading?: boolean
  modelValue?: undefined | Filter[]
  webHook?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nestedLevel: 0,
  autoSave: true,
  showLoading: true,
  parentId: undefined,
  hookId: undefined,
  webHook: false,
})

const emit = defineEmits(['update:filtersLength'])

const { nestedLevel, parentId, autoSave, hookId, modelValue, showLoading, webHook } = toRefs(props)

const nested = computed(() => nestedLevel.value > 0)

const { t } = useI18n()

const logicalOps = [
  { value: 'and', text: t('general.and') },
  { value: 'or', text: t('general.or') },
]

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const isPublic = inject(IsPublicInj, ref(false))

const { $e } = useNuxtApp()

const { nestedFilters } = useSmartsheetStoreOrThrow()
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
} = useViewFilters(
  activeView,
  parentId?.value,
  computed(() => autoSave.value),
  () => reloadDataHook.trigger(showLoading.value),
  modelValue.value || nestedFilters.value,
  !modelValue.value,
  webHook.value,
)

const { getPlanLimit } = useWorkspace()

const localNestedFilters = ref()

const wrapperDomRef = ref<HTMLElement>()
const addFiltersRowDomRef = ref<HTMLElement>()

const columns = computed(() => meta.value?.columns)

const getColumn = (filter: Filter) => {
  // extract looked up column if available
  return btLookupTypesMap.value[filter.fk_column_id] || columns.value?.find((col: ColumnType) => col.id === filter.fk_column_id)
}

const filterPrevComparisonOp = ref<Record<string, string>>({})

const isFilterDraft = (filter: Filter, col: ColumnType) => {
  if (filter.id) return false

  if (
    filter.comparison_op &&
    comparisonSubOpList(filter.comparison_op).find((compOp) => compOp.value === filter.comparison_sub_op)?.ignoreVal
  ) {
    return false
  }

  if (comparisonOpList(col.uidt as UITypes).find((compOp) => compOp.value === filter.comparison_op)?.ignoreVal) {
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
  } else if ([UITypes.Date, UITypes.DateTime].includes(col.uidt as UITypes)) {
    // for date / datetime,
    // the input type could be decimal or datepicker / datetime picker
    // hence remove the previous value
    filter.value = null
    if (
      !comparisonSubOpList(filter.comparison_op!)
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
  })
}

const types = computed(() => {
  if (!meta.value?.columns?.length) {
    return {}
  }

  return meta.value?.columns?.reduce((obj: any, col: any) => {
    obj[col.id] = col.uidt
    return obj
  }, {})
})

watch(
  () => activeView.value?.id,
  (n, o) => {
    // if nested no need to reload since it will get reloaded from parent
    if (!nested.value && n !== o && (hookId?.value || !webHook.value)) loadFilters(hookId?.value)
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

const applyChanges = async (hookId?: string, _nested = false) => {
  await sync(hookId, _nested)

  if (!localNestedFilters.value?.length) return

  for (const nestedFilter of localNestedFilters.value) {
    if (nestedFilter.parentId) {
      await nestedFilter.applyChanges(hookId, true)
    }
  }
}

const selectFilterField = (filter: Filter, index: number) => {
  const col = getColumn(filter)
  if (!col) return
  // when we change the field,
  // the corresponding default filter operator needs to be changed as well
  // since the existing one may not be supported for the new field
  // e.g. `eq` operator is not supported in checkbox field
  // hence, get the first option of the supported operators of the new field
  filter.comparison_op = comparisonOpList(col.uidt as UITypes).find((compOp) => isComparisonOpAllowed(filter, compOp))
    ?.value as FilterType['comparison_op']

  if ([UITypes.Date, UITypes.DateTime].includes(col.uidt as UITypes) && !['blank', 'notblank'].includes(filter.comparison_op!)) {
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
  parentId: parentId?.value,
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

const addFilter = async () => {
  await _addFilter()

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
  if (!filter.comparison_op) return false

  if (filter.comparison_sub_op) {
    return !comparisonSubOpList(filter.comparison_op).find((op) => op.value === filter.comparison_sub_op)?.ignoreVal
  } else {
    return !comparisonOpList(getColumn(filter)?.uidt as UITypes).find((op) => op.value === filter.comparison_op)?.ignoreVal
  }
}

onMounted(() => {
  loadFilters(hookId?.value)
})

onMounted(async () => {
  await loadBtLookupTypes()
})

onBeforeUnmount(() => {
  if (parentId.value) delete allFilters.value[parentId.value]
})
</script>

<template>
  <div
    class="menu-filter-dropdown"
    :class="{
      'max-h-[max(80vh,500px)] min-w-112 py-6 pl-6': !nested,
      'w-full ': nested,
    }"
  >
    <div
      v-if="filters && filters.length"
      ref="wrapperDomRef"
      class="flex flex-col gap-y-3 nc-filter-grid pb-2 w-full"
      :class="{ 'max-h-420px nc-scrollbar-md  pr-3.5 nc-filter-top-wrapper': !nested }"
      @click.stop
    >
      <template v-for="(filter, i) in filters" :key="i">
        <template v-if="filter.status !== 'delete'">
          <template v-if="filter.is_group">
            <div class="flex flex-col w-full gap-y-2">
              <div class="flex flex-row w-full justify-between items-center">
                <span v-if="!i" class="flex items-center ml-2">{{ $t('labels.where') }}</span>
                <div v-else :key="`${i}nested`" class="flex nc-filter-logical-op">
                  <NcSelect
                    v-model:value="filter.logical_op"
                    v-e="['c:filter:logical-op:select']"
                    :dropdown-match-select-width="false"
                    class="min-w-20 capitalize"
                    placeholder="Group op"
                    dropdown-class-name="nc-dropdown-filter-logical-op-group"
                    @click.stop
                    @change="saveOrUpdate(filter, i)"
                  >
                    <a-select-option v-for="op in logicalOps" :key="op.value" :value="op.value">
                      <span class="capitalize">
                        {{ op.value }}
                      </span>
                    </a-select-option>
                  </NcSelect>
                </div>
                <NcButton
                  v-if="!filter.readOnly"
                  :key="i"
                  v-e="['c:filter:delete']"
                  type="text"
                  size="small"
                  class="nc-filter-item-remove-btn cursor-pointer"
                  @click.stop="deleteFilter(filter, i)"
                >
                  <component :is="iconMap.deleteListItem" />
                </NcButton>
              </div>
              <div class="flex border-1 rounded-lg p-2 w-full" :class="nestedLevel % 2 !== 0 ? 'bg-white' : 'bg-gray-100'">
                <LazySmartsheetToolbarColumnFilter
                  v-if="filter.id || filter.children"
                  :key="filter.id ?? i"
                  ref="localNestedFilters"
                  v-model="filter.children"
                  :nested-level="nestedLevel + 1"
                  :parent-id="filter.id"
                  :auto-save="autoSave"
                  :web-hook="webHook"
                />
              </div>
            </div>
          </template>
          <div v-else class="flex flex-row gap-x-2 w-full">
            <span v-if="!i" class="flex items-center ml-2 mr-7.35">{{ $t('labels.where') }}</span>

            <NcSelect
              v-else
              v-model:value="filter.logical_op"
              v-e="['c:filter:logical-op:select']"
              :dropdown-match-select-width="false"
              class="h-full !min-w-20 !max-w-20 capitalize"
              hide-details
              :disabled="filter.readOnly"
              dropdown-class-name="nc-dropdown-filter-logical-op"
              @change="filterUpdateCondition(filter, i)"
              @click.stop
            >
              <a-select-option v-for="op of logicalOps" :key="op.value" :value="op.value">
                <span class="capitalize">
                  {{ op.value }}
                </span>
              </a-select-option>
            </NcSelect>
            <SmartsheetToolbarFieldListAutoCompleteDropdown
              :key="`${i}_6`"
              v-model="filter.fk_column_id"
              class="nc-filter-field-select min-w-32 max-w-32 max-h-8"
              :columns="columns"
              :disabled="filter.readOnly"
              @click.stop
              @change="selectFilterField(filter, i)"
            />
            <NcSelect
              v-model:value="filter.comparison_op"
              v-e="['c:filter:comparison-op:select']"
              :dropdown-match-select-width="false"
              class="caption nc-filter-operation-select !min-w-26.75 !max-w-26.75 max-h-8"
              :placeholder="$t('labels.operation')"
              density="compact"
              variant="solo"
              :disabled="filter.readOnly"
              hide-details
              dropdown-class-name="nc-dropdown-filter-comp-op"
              @change="filterUpdateCondition(filter, i)"
            >
              <template v-for="compOp of comparisonOpList(getColumn(filter)?.uidt)" :key="compOp.value">
                <a-select-option v-if="isComparisonOpAllowed(filter, compOp)" :value="compOp.value">
                  {{ compOp.text }}
                </a-select-option>
              </template>
            </NcSelect>

            <div v-if="['blank', 'notblank'].includes(filter.comparison_op)" class="flex flex-grow"></div>
            <NcSelect
              v-else-if="[UITypes.Date, UITypes.DateTime].includes(getColumn(filter)?.uidt)"
              v-model:value="filter.comparison_sub_op"
              v-e="['c:filter:sub-comparison-op:select']"
              :dropdown-match-select-width="false"
              class="caption nc-filter-sub_operation-select min-w-28"
              :class="{ 'flex-grow w-full': !showFilterInput(filter), 'max-w-28': showFilterInput(filter) }"
              :placeholder="$t('labels.operationSub')"
              density="compact"
              variant="solo"
              :disabled="filter.readOnly"
              hide-details
              dropdown-class-name="nc-dropdown-filter-comp-sub-op"
              @change="filterUpdateCondition(filter, i)"
            >
              <template v-for="compSubOp of comparisonSubOpList(filter.comparison_op)" :key="compSubOp.value">
                <a-select-option v-if="isComparisonSubOpAllowed(filter, compSubOp)" :value="compSubOp.value">
                  {{ compSubOp.text }}
                </a-select-option>
              </template>
            </NcSelect>
            <a-checkbox
              v-if="filter.field && types[filter.field] === 'boolean'"
              v-model:checked="filter.value"
              dense
              :disabled="filter.readOnly"
              @change="saveOrUpdate(filter, i)"
            />

            <SmartsheetToolbarFilterInput
              v-if="showFilterInput(filter)"
              class="nc-filter-value-select rounded-md min-w-34"
              :column="getColumn(filter)"
              :filter="filter"
              @update-filter-value="(value) => updateFilterValue(value, filter, i)"
              @click.stop
            />
            <div v-else-if="![UITypes.Date, UITypes.DateTime].includes(getColumn(filter)?.uidt)" class="flex-grow"></div>

            <NcButton
              v-if="!filter.readOnly"
              v-e="['c:filter:delete']"
              type="text"
              size="small"
              class="nc-filter-item-remove-btn self-center"
              @click.stop="deleteFilter(filter, i)"
            >
              <component :is="iconMap.deleteListItem" />
            </NcButton>
          </div>
        </template>
      </template>
    </div>

    <template v-if="isEeUI && !isPublic">
      <div v-if="filtersCount < getPlanLimit(PlanLimitTypes.FILTER_LIMIT)" ref="addFiltersRowDomRef" class="flex gap-2">
        <NcButton size="small" type="text" class="!text-brand-500" @click.stop="addFilter()">
          <div class="flex items-center gap-1">
            <component :is="iconMap.plus" />
            <!-- Add Filter -->
            {{ $t('activity.addFilter') }}
          </div>
        </NcButton>

        <NcButton v-if="!webHook && nestedLevel < 5" type="text" size="small" @click.stop="addFilterGroup()">
          <div class="flex items-center gap-1">
            <!-- Add Filter Group -->
            <component :is="iconMap.plus" />
            {{ $t('activity.addFilterGroup') }}
          </div>
        </NcButton>
      </div>
    </template>
    <template v-else>
      <div ref="addFiltersRowDomRef" class="flex gap-2">
        <NcButton size="small" type="text" class="!text-brand-500" @click.stop="addFilter()">
          <div class="flex items-center gap-1">
            <component :is="iconMap.plus" />
            <!-- Add Filter -->
            {{ $t('activity.addFilter') }}
          </div>
        </NcButton>

        <NcButton v-if="!webHook && nestedLevel < 5" type="text" size="small" @click.stop="addFilterGroup()">
          <div class="flex items-center gap-1">
            <!-- Add Filter Group -->
            <component :is="iconMap.plus" />
            {{ $t('activity.addFilterGroup') }}
          </div>
        </NcButton>
      </div>
    </template>
    <div
      v-if="!filters.length"
      class="flex flex-row text-gray-400 mt-2"
      :class="{
        'ml-1': nested,
        'ml-0.5': !nested,
      }"
    >
      {{ $t('title.noFiltersAdded') }}
    </div>

    <slot />
  </div>
</template>

<style scoped>
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
  @apply !min-h-8.25;
}
</style>
