<script setup lang="ts">
import type { FilterType, UITypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  MetaInj,
  ReloadViewDataHookInj,
  comparisonOpList,
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
} = useViewFilters(
  activeView,
  parentId,
  computed(() => autoSave),
  () => reloadDataHook.trigger(showLoading),
  modelValue || nestedFilters.value,
  !modelValue,
)

const localNestedFilters = ref()

const filterUpdateCondition = (filter: FilterType, i: number) => {
  saveOrUpdate(filter, i)
  $e('a:filter:update', {
    logical: filter.logical_op,
    comparison: filter.comparison_op,
  })
}

const columns = computed(() => meta.value?.columns)

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
  (length) => {
    emit('update:filtersLength', length ?? 0)
  },
)

const getColumn = (filter: Filter) => {
  return columns.value?.find((col) => col.id === filter.fk_column_id)
}

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
  // when we change the field,
  // the corresponding default filter operator needs to be changed as well
  // since the existing one may not be supported for the new field
  // e.g. `eq` operator is not supported in checkbox field
  // hence, get the first option of the supported operators of the new field
  filter.comparison_op = comparisonOpList(getColumn(filter)!.uidt as UITypes).filter((compOp) =>
    isComparisonOpAllowed(filter, compOp),
  )?.[0].value
  // reset filter value as well
  filter.value = ''
  saveOrUpdate(filter, index)
}

defineExpose({
  applyChanges,
  parentId,
})
</script>

<template>
  <div
    class="p-4 menu-filter-dropdown bg-gray-50 !border mt-4"
    :class="{ 'shadow min-w-[430px] max-h-[max(80vh,500px)] overflow-auto': !nested, 'border-1 w-full': nested }"
  >
    <div v-if="filters && filters.length" class="nc-filter-grid mb-2" @click.stop>
      <template v-for="(filter, i) in filters" :key="i">
        <template v-if="filter.status !== 'delete'">
          <template v-if="filter.is_group">
            <MdiCloseBox
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
            <div class="col-span-5">
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
            <MdiCloseBox
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
              @click.stop
              @change="filterUpdateCondition(filter, i)"
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

            <span
              v-if="
                filter.comparison_op &&
                ['null', 'notnull', 'checked', 'notchecked', 'empty', 'notempty', 'blank', 'notblank'].includes(
                  filter.comparison_op,
                )
              "
              :key="`span${i}`"
            />

            <a-checkbox
              v-else-if="filter.field && types[filter.field] === 'boolean'"
              v-model:checked="filter.value"
              dense
              :disabled="filter.readOnly"
              @change="saveOrUpdate(filter, i)"
            />

            <LazySmartsheetToolbarFilterInput
              v-else
              class="nc-filter-value-select min-w-[120px]"
              :column="getColumn(filter)"
              :filter="filter"
              @update-filter-value="
                (value) => {
                  filter.value = value
                  saveOrUpdateDebounced(filter, i)
                }
              "
              @click.stop
            />
          </template>
        </template>
      </template>
    </div>

    <div class="flex gap-2 mb-2 mt-4">
      <a-button class="elevation-0 text-capitalize" type="primary" ghost @click.stop="addFilter">
        <div class="flex items-center gap-1">
          <MdiPlus />
          <!-- Add Filter -->
          {{ $t('activity.addFilter') }}
        </div>
      </a-button>

      <a-button v-if="!webHook" class="text-capitalize !text-gray-500" @click.stop="addFilterGroup">
        <div class="flex items-center gap-1">
          <!--          Add Filter Group -->
          <MdiPlus />
          {{ $t('activity.addFilterGroup') }}
        </div>
      </a-button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.nc-filter-grid {
  grid-template-columns: auto auto auto auto auto;
  @apply grid gap-[12px] items-center;
}

:deep(.ant-select-item-option) {
  @apply "!min-w-full";
}
</style>
