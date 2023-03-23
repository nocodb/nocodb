<script setup lang="ts">
import type { ColumnType, FilterType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import {
  iconMap,
  ActiveViewInj,
  MetaInj,
  ReloadViewDataHookInj,
  comparisonOpList,
  comparisonSubOpList,
  computed,
  inject,
  ref,
  useNuxtApp,
  useViewFilters,
  watch,
} from '#imports'
import type { Filter } from '~/lib'

interface Props {
  nested?: boolean
  parentId?: string
  autoSave: boolean
  hookId?: string
  showLoading?: boolean
  modelValue?: Filter[]
  webHook?: boolean
}

const { nested = false, parentId, autoSave = true, hookId = null, modelValue, showLoading = true, webHook } = defineProps<Props>()

const emit = defineEmits(['update:filtersLength'])

const logicalOps = [
  { value: 'and', text: 'AND' },
  { value: 'or', text: 'OR' },
]

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const { $e } = useNuxtApp()

const { nestedFilters } = useSmartsheetStoreOrThrow()
const {
  filters,
  nonDeletedFilters,
  deleteFilter,
  saveOrUpdate,
  loadFilters,
  addFilter,
  addFilterGroup,
  sync,
  saveOrUpdateDebounced,
  isComparisonOpAllowed,
  isComparisonSubOpAllowed,
} = useViewFilters(
  activeView,
  parentId,
  computed(() => autoSave),
  () => reloadDataHook.trigger(showLoading),
  modelValue || nestedFilters.value,
  !modelValue,
)

const localNestedFilters = ref()

const columns = computed(() => meta.value?.columns)

const getColumn = (filter: Filter) => {
  return columns.value?.find((col: ColumnType) => col.id === filter.fk_column_id)
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
    if (!nested && n !== o && (hookId || !webHook)) loadFilters(hookId as string)
  },
)

loadFilters(hookId as string)

watch(
  () => nonDeletedFilters.value.length,
  (length: number) => {
    emit('update:filtersLength', length ?? 0)
  },
)

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
  saveOrUpdate(filter, index)
}

const updateFilterValue = (value: string, filter: Filter, index: number) => {
  filter.value = value
  saveOrUpdateDebounced(filter, index)
}

defineExpose({
  applyChanges,
  parentId,
})
</script>

<template>
  <div
    class="p-4 menu-filter-dropdown bg-gray-50 !border"
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
            <component :is="iconMap.closeBox"
              v-if="!filter.readOnly"
              :key="i"
              small
              class="nc-filter-item-remove-btn cursor-pointer text-grey"
              @click.stop="deleteFilter(filter, i)"
            />
            <span v-else :key="`${i}dummy`" />

            <div :key="`${i}nested`" class="flex">
              <a-select
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
              </a-select>
            </div>
            <span class="col-span-3" />
            <div class="col-span-6">
              <LazySmartsheetToolbarColumnFilter
                v-if="filter.id || filter.children"
                :key="filter.id ?? i"
                ref="localNestedFilters"
                v-model="filter.children"
                :parent-id="filter.id"
                nested
                :auto-save="autoSave"
              />
            </div>
          </template>
          <template v-else>
            <component :is="iconMap.closeBox"
              v-if="!filter.readOnly"
              class="nc-filter-item-remove-btn text-grey self-center"
              @click.stop="deleteFilter(filter, i)"
            />

            <span v-else />

            <span v-if="!i" class="flex items-center">{{ $t('labels.where') }}</span>

            <a-select
              v-else
              v-model:value="filter.logical_op"
              :dropdown-match-select-width="false"
              class="h-full"
              hide-details
              :disabled="filter.readOnly"
              dropdown-class-name="nc-dropdown-filter-logical-op"
              @change="filterUpdateCondition(filter, i)"
              @click.stop
            >
              <a-select-option v-for="op of logicalOps" :key="op.value" :value="op.value">
                {{ op.text }}
              </a-select-option>
            </a-select>
            <LazySmartsheetToolbarFieldListAutoCompleteDropdown
              :key="`${i}_6`"
              v-model="filter.fk_column_id"
              class="nc-filter-field-select"
              :columns="columns"
              :disabled="filter.readOnly"
              @click.stop
              @change="selectFilterField(filter, i)"
            />
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

            <a-checkbox
              v-if="filter.field && types[filter.field] === 'boolean'"
              v-model:checked="filter.value"
              dense
              :disabled="filter.readOnly"
              @change="saveOrUpdate(filter, i)"
            />

            <span
              v-else-if="
                filter.comparison_sub_op
                  ? comparisonSubOpList(filter.comparison_op).find((op) => op.value === filter.comparison_sub_op)?.ignoreVal ??
                    false
                  : comparisonOpList(getColumn(filter)?.uidt).find((op) => op.value === filter.comparison_op)?.ignoreVal ?? false
              "
              :key="`span${i}`"
            />

            <LazySmartsheetToolbarFilterInput
              v-else
              class="nc-filter-value-select min-w-[120px]"
              :column="getColumn(filter)"
              :filter="filter"
              @update-filter-value="(value) => updateFilterValue(value, filter, i)"
              @click.stop
            />
          </template>
        </template>
      </template>
    </div>

    <div class="flex gap-2 mb-2 mt-4">
      <a-button class="elevation-0 text-capitalize" type="primary" ghost @click.stop="addFilter">
        <div class="flex items-center gap-1">
          <component :is="iconMap.plus" />
          <!-- Add Filter -->
          {{ $t('activity.addFilter') }}
        </div>
      </a-button>

      <a-button v-if="!webHook" class="text-capitalize !text-gray-500" @click.stop="addFilterGroup">
        <div class="flex items-center gap-1">
          <!-- Add Filter Group -->
          <component :is="iconMap.plus" />
          {{ $t('activity.addFilterGroup') }}
        </div>
      </a-button>
    </div>
    <slot />
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
