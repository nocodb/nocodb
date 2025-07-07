<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import type { ClientType } from 'nocodb-sdk'
import type { RowHandler } from './types'

interface Props {
  modelValue: ColumnFilterType
  index: number
  columns: ColumnTypeForFilter[]
  handler?: RowHandler
  dbClientType?: ClientType
  showNullAndEmptyInFilter?: boolean

  webHook?: boolean
  link?: boolean
  widget?: boolean
  disabled?: boolean
  // some view is different when locked view but not disabled
  isLockedView?: boolean
  isLogicalOpChangeAllowed?: boolean
  containerProps?: any
  logicalOpsProps?: any
  columnSelectProps?: any
  comparisonOpsProps?: any
  comparisonSubOpsProps?: any
  inputValueProps?: any
  deleteButtonProps?: any
  isColourFilter?: boolean
  isLoadingFilter?: boolean
}
interface Emits {
  (event: 'update:modelValue', model: string): void
  (event: 'change', model: FilterRowChangeEvent): void
  (
    event: 'delete',
    model: {
      filter: ColumnFilterType
      index: number
    },
  ): void
}
const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const meta = inject(MetaInj, ref())

// t is a standalone dependency, so not need to abstract it
const { t } = useI18n()

const logicalOps = [
  { value: 'and', text: t('general.and') },
  { value: 'or', text: t('general.or') },
]

// #region utils & computed
const slots = useSlots()
const filterPrevComparisonOp = ref('')

const isFilterSaving = ref(false)

const localFilterValue = ref('')

/**
 * We are using debounce to save filter value so we have to sync the value from localFilterValue to vModel.value.value
 */
watch(
  () => vModel.value.value,
  () => {
    if (localFilterValue.value && vModel.value.value !== localFilterValue.value) {
      vModel.value.value = localFilterValue.value
    }
  },
  {
    deep: true,
  },
)

const slotHasChildren = (name?: string) => {
  return (slots[name ?? 'default']?.()?.length ?? 0) > 0
}

const isDisabled = computed(() => {
  return vModel.value.readOnly || props.disabled || props.isLockedView
})

const column = computed(() => {
  const fk_column_id = vModel.value.fk_column_id
  if (!vModel.value.fk_column_id) {
    return undefined
  }
  return props.columns.find((col) => col.id === fk_column_id)
})

const dynamicColumns = computed(() => {
  if (!vModel.value?.dynamic) {
    return []
  }
  return getDynamicColumns(meta.value?.columns, column.value, props.dbClientType)
})

const comparisonOps = computed(() => {
  const evalColumn = column.value
  if (!evalColumn) {
    return []
  }
  const evalUidt = (evalColumn?.filterUidt ?? evalColumn?.uidt) as UITypes
  const list = comparisonOpList(evalUidt, parseProp(evalColumn?.meta)?.date_format).filter((compOp) =>
    isComparisonOpAllowed(vModel.value, compOp, evalUidt, props.showNullAndEmptyInFilter),
  )
  return list
})

const comparisonSubOps = computed(() => {
  const evalColumn = column.value
  const evalUidt = (evalColumn?.filterUidt ?? evalColumn?.uidt) as UITypes
  return comparisonSubOpList(vModel.value.comparison_op!, parseProp(evalColumn?.meta)?.date_format).filter((compSubOp) =>
    isComparisonSubOpAllowed(vModel.value, compSubOp, evalUidt),
  )
})

const showFilterInput = computed(() => {
  const filter = vModel.value
  if (!filter.comparison_op) return false

  if (filter.comparison_sub_op) {
    return !comparisonSubOpList(filter.comparison_op, parseProp(column.value?.meta)?.date_format).find(
      (op) => op.value === filter.comparison_sub_op,
    )?.ignoreVal
  } else {
    return !comparisonOpList(
      (column.value?.filterUidt ?? column.value?.uidt) as UITypes,
      parseProp(column.value?.meta)?.date_format,
    ).find((op) => op.value === filter.comparison_op)?.ignoreVal
  }
})
// #endregion

// #region event handling
const onColumnChange = (fk_column_id: string) => {
  const prevValue = vModel.value.fk_column_id
  if (props.handler?.rowChange) {
    props.handler?.rowChange({
      filter: vModel.value,
      type: 'fk_column_id',
      prevValue,
      value: fk_column_id,
      index: props.index,
    })
  } else {
    vModel.value.fk_column_id = fk_column_id
    // adjust comparison ops and sub ops
    const evalColumn = props.columns.find((col) => col.id === fk_column_id)
    if (evalColumn) {
      adjustFilterWhenColumnChange({
        column: evalColumn,
        filter: vModel.value,
        showNullAndEmptyInFilter: props.showNullAndEmptyInFilter,
      })
    }

    emits('change', {
      filter: { ...vModel.value },
      type: 'fk_column_id',
      prevValue,
      value: fk_column_id,
      index: props.index,
    })
  }
}
const onLogicalOpChange = (logical_op: string) => {
  const prevValue = vModel.value.logical_op
  if (props.handler?.rowChange) {
    props.handler?.rowChange({
      filter: vModel.value,
      type: 'logical_op',
      prevValue,
      value: logical_op,
      index: props.index,
    })
  } else {
    vModel.value.logical_op = logical_op as any
    emits('change', {
      filter: { ...vModel.value },
      type: 'logical_op',
      prevValue,
      value: logical_op,
      index: props.index,
    })
  }
}
const onComparisonOpChange = (comparison_op: string) => {
  const prevValue = vModel.value.comparison_op
  if (props.handler?.rowChange) {
    props.handler?.rowChange({
      filter: vModel.value,
      type: 'comparison_op',
      prevValue,
      value: comparison_op,
      index: props.index,
    })
  } else {
    vModel.value.comparison_op = comparison_op as any
    const filter = vModel.value

    const col = column.value
    if (col) {
      // adjust value and sub op
      if (
        col.uidt === UITypes.SingleSelect &&
        ['anyof', 'nanyof'].includes(filterPrevComparisonOp.value) &&
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
      } else if (isDateType((col.filterUidt ?? col.uidt) as UITypes)) {
        // for date / datetime,
        // the input type could be decimal or datepicker / datetime picker
        // hence remove the previous value
        filter.value = null
        if (
          !comparisonSubOpList(filter.comparison_op!, parseProp(col?.meta)?.date_format)
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
    }
    filterPrevComparisonOp.value = vModel.value.comparison_op!

    emits('change', {
      filter: { ...vModel.value },
      type: 'comparison_op',
      prevValue,
      value: comparison_op,
      index: props.index,
    })
  }
}
const onComparisonSubOpChange = (comparison_sub_op: string) => {
  const prevValue = vModel.value.comparison_sub_op
  if (props.handler?.rowChange) {
    props.handler?.rowChange({
      filter: vModel.value,
      type: 'comparison_sub_op',
      prevValue,
      value: comparison_sub_op,
      index: props.index,
    })
  } else {
    vModel.value.comparison_sub_op = comparison_sub_op as any
    emits('change', {
      filter: { ...vModel.value },
      type: 'comparison_sub_op',
      prevValue,
      value: comparison_sub_op,
      index: props.index,
    })
  }
}
const onFkValueColIdChanged = (fk_value_col_id: string) => {
  const prevValue = vModel.value.fk_value_col_id
  if (props.handler?.rowChange) {
    props.handler?.rowChange({
      filter: vModel.value,
      type: 'fk_value_col_id',
      prevValue,
      value: fk_value_col_id,
      index: props.index,
    })
  } else {
    vModel.value.fk_value_col_id = fk_value_col_id as any
    emits('change', {
      filter: { ...vModel.value },
      type: 'fk_value_col_id',
      prevValue,
      value: fk_value_col_id,
      index: props.index,
    })
  }
}

const saveOrUpdateDebounced = useDebounceFn(onValueChange, 500)

function onValueChange(value: any, prevValue: any, index: number) {
  if (!vModel.value.id && isFilterSaving.value) {
    saveOrUpdateDebounced(value, prevValue, index)
    return
  }

  if (!vModel.value.id) {
    isFilterSaving.value = true
  } else {
    isFilterSaving.value = false
  }

  vModel.value.value = value as any

  if (props.handler?.rowChange) {
    props.handler?.rowChange({
      filter: vModel.value,
      type: 'value',
      prevValue,
      value,
      index,
    })
  } else {
    emits('change', {
      filter: { ...vModel.value },
      type: 'value',
      prevValue,
      value,
      index,
    })
  }

  localFilterValue.value = ''
}

const updateFilterValue = (value: string) => {
  const prevValue = vModel.value.value
  const currentValue = value
  localFilterValue.value = value
  vModel.value.value = value as any

  saveOrUpdateDebounced(currentValue, prevValue, props.index)
}

const onDelete = () => {
  emits('delete', {
    filter: { ...vModel.value },
    index: props.index,
  })
}
async function onResetDynamicField() {
  const prevValue = vModel.value.dynamic
  vModel.value.dynamic = false
  vModel.value.fk_value_col_id = null
  emits('change', {
    filter: { ...vModel.value },
    type: 'dynamic',
    prevValue,
    value: false,
    index: props.index,
  })
}
const onChangeToDynamic = async () => {
  const prevValue = vModel.value.dynamic
  vModel.value.dynamic = isDynamicFilterAllowed(vModel.value, column.value, props.dbClientType) && showFilterInput.value

  emits('change', {
    filter: { ...vModel.value },
    type: 'dynamic',
    prevValue,
    value: vModel.value.dynamic,
    index: props.index,
  })
}
// #endregion
</script>

<template>
  <div
    class="flex flex-row gap-x-0 w-full nc-filter-wrapper bg-white"
    :class="`nc-filter-wrapper-${vModel.fk_column_id}`"
    v-bind="containerProps"
  >
    <!-- #region logical op -->
    <template v-if="index === 0">
      <div class="flex items-center !min-w-18 !max-w-18 pl-3 nc-filter-where-label" v-bind="logicalOpsProps">
        {{ $t('labels.where') }}
      </div>
    </template>
    <template v-else>
      <NcSelect
        v-e="['c:filter:logical-op:select', { link: !!link, webHook: !!webHook, widget: !!widget }]"
        v-bind="logicalOpsProps"
        :value="vModel.logical_op"
        :dropdown-match-select-width="false"
        class="h-full !max-w-18 !min-w-18 capitalize"
        hide-details
        :disabled="isDisabled || (index > 1 && !isLogicalOpChangeAllowed)"
        dropdown-class-name="nc-dropdown-filter-logical-op"
        :class="{
          'nc-disabled-logical-op': isDisabled || (index > 1 && !isLogicalOpChangeAllowed),
        }"
        @change="onLogicalOpChange($event)"
        @click.stop
      >
        <a-select-option v-for="op of logicalOps" :key="op.value" :value="op.value">
          <div class="flex items-center w-full justify-between w-full gap-2">
            <div class="truncate flex-1 capitalize">{{ op.text }}</div>
            <component
              :is="iconMap.check"
              v-if="vModel.logical_op === op.value"
              id="nc-selected-item-icon"
              class="text-primary w-4 h-4"
            />
          </div>
        </a-select-option>
      </NcSelect>
    </template>
    <!-- #endregion logical op -->

    <slot name="fieldInaccessibleError"></slot>
    <template v-if="!slotHasChildren('fieldInaccessibleError')">
      <SmartsheetToolbarFieldListAutoCompleteDropdown
        :value="vModel.fk_column_id"
        :disable-smartsheet="!!widget"
        v-bind="columnSelectProps"
        class="nc-filter-field-select min-w-32 max-h-8"
        :class="{
          'max-w-32': !webHook,
          '!w-full': webHook,
        }"
        :disabled="isDisabled"
        :db-client-type="dbClientType"
        :meta="meta"
        @click.stop
        @change="onColumnChange($event)"
      />
      <NcSelect
        v-if="comparisonOps && comparisonOps.length > 0"
        v-e="['c:filter:comparison-op:select', { link: !!link, webHook: !!webHook, widget: !!widget }]"
        v-bind="comparisonOpsProps"
        :value="vModel.comparison_op"
        :dropdown-match-select-width="false"
        class="caption nc-filter-operation-select !min-w-26.75 max-h-8"
        :placeholder="$t('labels.operation')"
        :class="{
          '!max-w-26.75': !webHook,
          '!w-full': webHook,
        }"
        density="compact"
        variant="solo"
        :disabled="isDisabled"
        hide-details
        dropdown-class-name="nc-dropdown-filter-comp-op !max-w-80"
        @change="onComparisonOpChange($event)"
      >
        <template v-for="compOp of comparisonOps" :key="compOp.value">
          <a-select-option :value="compOp.value">
            <div class="flex items-center w-full justify-between w-full gap-2">
              <div class="truncate flex-1">{{ compOp.text }}</div>
              <component
                :is="iconMap.check"
                v-if="vModel.comparison_op === compOp.value"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </template>
      </NcSelect>

      <template v-if="['blank', 'notblank'].includes(vModel.comparison_op)">
        <div class="flex flex-grow"></div>
      </template>
      <template v-else>
        <template v-if="comparisonSubOps && comparisonSubOps.length > 0">
          <NcSelect
            v-e="['c:filter:sub-comparison-op:select', { link: !!link, webHook: !!webHook, widget: !!widget }]"
            :value="vModel.comparison_sub_op"
            v-bind="comparisonSubOpsProps"
            :dropdown-match-select-width="false"
            class="caption nc-filter-sub_operation-select min-w-28"
            :class="{
              'flex-grow w-full': !showFilterInput,
              'max-w-28': showFilterInput && !webHook,
            }"
            :placeholder="$t('labels.operationSub')"
            density="compact"
            variant="solo"
            :disabled="isDisabled"
            hide-details
            dropdown-class-name="nc-dropdown-filter-comp-sub-op"
            @change="onComparisonSubOpChange($event)"
          >
            <template v-for="compSubOp of comparisonSubOps" :key="compSubOp.value">
              <a-select-option :value="compSubOp.value">
                <div class="flex items-center w-full justify-between w-full gap-2 max-w-40">
                  <NcTooltip show-on-truncate-only class="truncate flex-1">
                    <template #title>{{ compSubOp.text }}</template>
                    {{ compSubOp.text }}
                  </NcTooltip>
                  <component
                    :is="iconMap.check"
                    v-if="vModel.comparison_sub_op === compSubOp.value"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </template>
          </NcSelect>
        </template>
        <div class="flex items-center flex-grow">
          <template v-if="showFilterInput">
            <div v-if="link && (vModel.dynamic || vModel.fk_value_col_id)" class="flex-grow">
              <SmartsheetToolbarFieldListAutoCompleteDropdown
                v-if="showFilterInput"
                v-model="vModel.fk_value_col_id"
                :disable-smartsheet="widget"
                class="nc-filter-field-select min-w-32 w-full max-h-8"
                :columns="dynamicColumns"
                :meta="meta"
                @change="onFkValueColIdChanged($event)"
              />
            </div>

            <SmartsheetToolbarFilterInputLite
              v-else
              v-bind="inputValueProps"
              class="nc-filter-value-select rounded-md min-w-34"
              :class="{
                '!w-full': webHook,
              }"
              :column="column"
              :filter="vModel"
              :disabled="isDisabled"
              :db-client-type="dbClientType"
              @update-filter-value="(value) => updateFilterValue(value)"
              @click.stop
            />
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
                        @click="onResetDynamicField()"
                      >
                        <div class="flex flex-row items-center justify-between w-full">
                          <div class="flex flex-row items-center justify-start gap-x-3">Static condition</div>
                          <GeneralIcon
                            v-if="!vModel.dynamic && !vModel.fk_value_col_id"
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
                          isDynamicFilterAllowed(vModel, column, dbClientType) && showFilterInput
                            ? 'cursor-pointer'
                            : 'cursor-not-allowed'
                        "
                        @click="onChangeToDynamic()"
                      >
                        <div class="flex flex-row items-center justify-between w-full">
                          <div class="flex flex-row items-center justify-start gap-x-2.5">Dynamic condition</div>
                          <GeneralIcon
                            v-if="vModel.dynamic || vModel.fk_value_col_id"
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
          </template>
          <div v-else class="flex-grow"></div>
        </div>
      </template>
      <div :class="{ 'cursor-wait': isLoadingFilter }">
        <!-- if locked view, do not hide the button -->
        <NcButton
          v-if="!vModel.readOnly && !disabled"
          v-e="['c:filter:delete', { link: !!link, webHook: !!webHook, widget: !!widget }]"
          v-bind="deleteButtonProps"
          type="text"
          size="small"
          :disabled="isLockedView"
          class="nc-filter-item-remove-btn self-center"
          :class="{ 'pointer-events-none': isLoadingFilter }"
          @click.stop="onDelete()"
        >
          <component :is="iconMap.deleteListItem" />
        </NcButton>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-filter-where-label {
  @apply text-gray-400;
}

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
