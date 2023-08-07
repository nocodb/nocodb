<script lang="ts" setup>
import type { BaseType, DataSourceInternal, FilterType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import useWidgetFilters from './useWidgetFilters'
import type { Filter } from '~~/lib/types'

interface Props {
  nested?: boolean
  parentId?: string
  hookId?: string
  showLoading?: boolean
  modelValue?: Filter[]
  webHook?: boolean
}

const { nested = false, webHook, parentId } = defineProps<Props>()

const logicalOps = [
  { value: 'and', text: 'AND' },
  { value: 'or', text: 'OR' },
]

const dashboardStore = useDashboardStore()
const { availableColumnsOfSelectedView, focusedWidget } = storeToRefs(dashboardStore)

const {
  filters,
  addFilter,
  addFilterGroup,
  isComparisonOpAllowed,
  isComparisonSubOpAllowed,
  deleteFilter,
  saveOrUpdate,
  loadFilters,
} = useWidgetFilters(focusedWidget, parentId)

const updateFilterValue = (value: string, filter: Filter, index: number) => {
  filter.value = value
  saveOrUpdate(filter, index)
}

watch(
  () => focusedWidget?.value?.id,
  async (focusedWidgetId) => {
    if (focusedWidgetId) {
      await loadFilters()
    }
  },
  { immediate: true },
)

const getColumn = (filter: Filter) => {
  return availableColumnsOfSelectedView.value?.find((col) => col.id === filter.fk_column_id)
}

const types = computed(() => {
  if (!availableColumnsOfSelectedView.value?.length) {
    return {}
  }
  return availableColumnsOfSelectedView.value?.reduce((obj, col) => {
    obj[col.id!] = col.uidt
    return obj
  }, {} as Record<string, any>)
})

const { $api, $e } = useNuxtApp()

const baseType = ref<BaseType>()

watch(
  () => (focusedWidget.value?.data_source as DataSourceInternal)?.tableId,
  async (widget) => {
    if (!widget) return
    const tableIdOfWidget = (focusedWidget.value?.data_source as DataSourceInternal).tableId
    const table = await $api.dbTable.read(tableIdOfWidget!)
    const base = await $api.base.read(table.project_id!, table.base_id!)
    baseType.value = base.type! as BaseType
  },
  { immediate: true },
)

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
  saveOrUpdate(filter, index)
}

const filterPrevComparisonOp = ref<Record<string, string>>({})

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
  saveOrUpdate(filter, i)
  filterPrevComparisonOp.value[filter.id!] = filter.comparison_op!
  $e('a:filter:update', {
    logical: filter.logical_op,
    comparison: filter.comparison_op,
    comparison_sub_op: filter.comparison_sub_op,
  })
}
</script>

<template>
  <div
    class="p-4 bg-white shadow-lg rounded-md overflow-auto border-1 border-gray-50 menu-filter-dropdown"
    :class="{
      'min-w-[430px]': filters.length,
      'shadow max-h-[max(80vh,500px)] overflow-auto': !nested,
      'border-1 w-full': nested,
    }"
  >
    <div
      v-if="filters && filters.length"
      class="nc-filter-grid mb-2"
      :class="{ 'max-h-420px overflow-y-auto': !nested }"
      @click.stop
    >
      <template v-for="(filter, i) in filters" :key="i">
        <template v-if="filter.status !== 'delete'">
          <template v-if="filter.is_group">
            <component
              :is="iconMap.closeBox"
              v-if="!filter.readOnly"
              :key="i"
              small
              class="nc-filter-item-remove-btn cursor-pointer text-grey"
              @click.stop="deleteFilter(filter, i)"
            />
            <span v-else :key="`${i}dummy`" />

            <div :key="`${i}nested`" class="flex">
              <NcSelect
                v-model:value="filter.logical_op"
                :dropdown-match-select-width="false"
                class="shrink grow-0"
                placeholder="Group op"
                dropdown-class-name="nc-dropdown-filter-logical-op-group"
                @click.stop
                @change="saveOrUpdate(filter, i)"
              >
                <a-select-option v-for="op in logicalOps" :key="op.value" :value="op.value" class="">
                  {{ op.text }}
                </a-select-option>
              </NcSelect>
            </div>
            <span class="col-span-3" />
            <div class="col-span-6">
              <LayoutsWidgetsPropertiesPanelDataConfigSectionsFilter
                v-if="filter.id || filter.children"
                :key="filter.id ?? i"
                v-model="filter.children"
                :parent-id="filter.id"
              />

              <!-- <LazySmartsheetToolbarColumnFilter
                    v-if="filter.id || filter.children"
                    :key="filter.id ?? i"
                    ref="localNestedFilters"
                    v-model="filter.children"
                    :parent-id="filter.id"
                    nested
                    :web-hook="webHook"
                  /> -->
            </div>
          </template>
          <template v-else>
            <component
              :is="iconMap.closeBox"
              v-if="!filter.readOnly"
              class="nc-filter-item-remove-btn text-grey self-center"
              @click.stop="deleteFilter(filter, i)"
            />

            <span v-else />

            <span v-if="!i" class="flex items-center">{{ $t('labels.where') }}</span>

            <NcSelect
              v-else
              v-model:value="filter.logical_op"
              :dropdown-match-select-width="false"
              class="h-full"
              hide-details
              :disabled="filter.readOnly"
              dropdown-class-name="nc-dropdown-filter-logical-op"
              @click.stop
              @change="filterUpdateCondition(filter, i)"
            >
              <a-select-option v-for="op of logicalOps" :key="op.value" :value="op.value">
                {{ op.text }}
              </a-select-option>
            </NcSelect>
            <LazyLayoutsWidgetsPropertiesPanelDataConfigSectionsFieldListAutoCompleteDropdown
              :key="`${i}_6`"
              v-model="filter.fk_column_id"
              class="nc-filter-field-select"
              :columns="availableColumnsOfSelectedView!"
              :disabled="filter.readOnly"
              @click.stop
              @change="selectFilterField(filter, i)"
            />

            <!-- START COMPARISON OPERATOR -->
            <a-select
              v-model:value="filter.comparison_op"
              :dropdown-match-select-width="false"
              class="caption nc-filter-operation-select"
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
            </a-select>
            <!-- END COMPARISON OPERATOR -->

            <a-select
              v-if="
                [UITypes.Date, UITypes.DateTime].includes(getColumn(filter)?.uidt) &&
                !['blank', 'notblank'].includes(filter.comparison_op)
              "
              v-model:value="filter.comparison_sub_op"
              :dropdown-match-select-width="false"
              class="caption nc-filter-sub_operation-select"
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
            </a-select>

            <span v-else />
            <div v-if="filter.field && types[filter.field] === 'boolean'">
              <a-checkbox v-model:checked="filter.value" dense :disabled="filter.readOnly" />
            </div>
            <!-- @change="saveOrUpdate(filter, i)" -->

            <!-- <span
              v-else-if="
                filter.comparison_sub_op
                  ? comparisonSubOpList(filter.comparison_op).find((op) => op.value === filter.comparison_sub_op)?.ignoreVal ??
                    false
                  : comparisonOpList(getColumn(filter)?.uidt).find((op) => op.value === filter.comparison_op)?.ignoreVal ?? false
              "
              :key="`span${i}`"
            /> -->

            <LazyLayoutsWidgetsPropertiesPanelDataConfigSectionsFilterInput
              v-else
              class="nc-filter-value-select min-w-[120px]"
              :column="getColumn(filter)"
              :base-type="baseType!"
              :filter="filter"
              @click.stop
              @update-filter-value="(value) => updateFilterValue(value, filter, i)"
            />
          </template>
        </template>
      </template>
    </div>
    <div class="flex flex-wrap">
      <a-button class="elevation-0 text-capitalize p-0 m-0 pr-2" type="text" @click.stop="addFilter()">
        <div class="flex items-center gap-1">
          <component :is="iconMap.plus" />
          <!-- Add Filter -->
          {{ $t('activity.addFilter') }}
        </div>
      </a-button>

      <a-button v-if="!webHook" class="text-capitalize !text-gray-500" @click.stop="addFilterGroup()">
        <div class="flex items-center gap-1">
          <!-- Add Filter Group -->
          <component :is="iconMap.plus" />
          {{ $t('activity.addFilterGroup') }}
        </div>
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.nc-filter-grid {
  grid-template-columns: auto auto auto auto auto auto;
  @apply grid gap-[12px] items-center;
}

:deep(.ant-select-item-option) {
  @apply "!min-w-full";
}
</style>
