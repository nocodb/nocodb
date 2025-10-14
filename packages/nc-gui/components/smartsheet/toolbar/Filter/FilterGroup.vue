<script setup lang="ts">
import { type FilterType, UITypes } from 'nocodb-sdk'
import { type GroupEmits, type GroupProps } from './types'
import { SmartsheetToolbarFilterGroupRow } from '#components'
const props = defineProps<GroupProps>()
const emits = defineEmits<GroupEmits>()
const vModel = useVModel(props, 'modelValue', emits)

const { $e } = useNuxtApp()

const wrapperDomRef = ref<HTMLElement>()
const addFiltersRowDomRef = ref<HTMLElement>()
const filterPrevComparisonOp = ref<Record<string, string>>({})

// #region utils & computed
const slots = useSlots()

const slotHasChildren = (name?: string) => {
  return (slots[name ?? 'default']?.()?.length ?? 0) > 0
}

const nested = computed(() => props.nestedLevel > 0)
const visibleFilters = computed(() => vModel.value.filter((filter) => filter.status !== 'delete'))

const scrollToBottom = () => {
  wrapperDomRef.value?.scrollTo({
    top: wrapperDomRef.value.scrollHeight,
    behavior: 'smooth',
  })
}

const scrollDownIfNeeded = () => {
  if (nested.value || props.isColourFilter) {
    nextTick(() => {
      if (
        !addFiltersRowDomRef?.value ||
        (props.isColourFilter && addFiltersRowDomRef?.value?.getBoundingClientRect()?.top < 200)
      ) {
        return
      }

      addFiltersRowDomRef?.value?.scrollIntoView({
        behavior: 'smooth',
        block: !props.isColourFilter ? 'end' : undefined,
        inline: 'nearest',
      })
    })
  }
}

const getColumn = (filter: FilterType) => {
  // extract looked up column if available
  return props.columns?.find((col: ColumnTypeForFilter) => col.id === filter.fk_column_id)
}

const handleFilterChange = async (filter) => {
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
  } else if (isDateType((col.filterUidt ?? col.uidt) as UITypes)) {
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

  filterPrevComparisonOp.value[filter.id!] = filter.comparison_op!
  $e('a:filter:update', {
    logical: filter.logical_op,
    comparison: filter.comparison_op,
    comparison_sub_op: filter.comparison_sub_op,
    link: !!props.link,
    widget: !!props.widget,
    webHook: !!props.webHook,
  })
}
// #endregion

// #region event handling
const onFilterRowChange = (event: FilterRowChangeEvent, index: number) => {
  handleFilterChange(event.filter, index)
  emits('rowChange', event)
  emits('change', {
    filters: [...vModel.value],
    value: [...vModel.value],
    filter: event.filter,
    index: event.index,
    type: 'row_changed',
  })
}
const onLockedViewFooterOpen = () => {}

const innerAdd = async (isGroup: boolean) => {
  const prevValue = [...vModel.value]
  if (isGroup && props.handler?.addFilterGroup) {
    await props.handler.addFilterGroup({
      type: 'add',
      filter: null,
      filters: vModel.value,
      index: props.index,
      value: [...vModel.value],
      parentFilter: props.parentFilter,
      fk_parent_id: props.fkParentId,
      prevValue,
    })
  } else if (!isGroup && props.handler?.addFilter) {
    await props.handler.addFilter({
      type: 'add',
      filter: null,
      filters: vModel.value,
      index: props.index,
      value: [...vModel.value],
      parentFilter: props.parentFilter,
      fk_parent_id: props.fkParentId,
      prevValue,
    })
  } else {
    const newFilter = isGroup
      ? {
          _id: Math.random().toString(36).substring(2, 15),
          is_group: true,
          logical_op: vModel.value[0]?.logical_op ?? 'and',
          children: [],
          fk_parent_id: props.fkParentId,
          parentFilter: props.parentFilter,
          order: (vModel.value?.[vModel.value?.length - 1]?.order ?? 0) + 1,
        }
      : {
          _id: Math.random().toString(36).substring(2, 15),
          is_group: false,
          logical_op: vModel.value[0]?.logical_op ?? 'and',
          fk_column_id: props.columns[0].id,
          comparison_op: null,
          fk_parent_id: props.fkParentId,
          parentFilter: props.parentFilter,
          order: (vModel.value?.[vModel.value?.length - 1]?.order ?? 0) + 1,
        }
    if (!newFilter.is_group) {
      const evalColumn = getColumn(newFilter)
      const evalUidt = (evalColumn?.filterUidt ?? evalColumn?.uidt) as UITypes
      newFilter.comparison_op = comparisonOpList(evalUidt, parseProp(evalColumn?.meta)?.date_format).filter((compOp) =>
        isComparisonOpAllowed(newFilter, compOp, evalUidt, props.showNullAndEmptyInFilter),
      )[0]?.value
    }
    handleFilterChange(newFilter, props.index)
    vModel.value.push(newFilter)

    emits('change', {
      type: 'add',
      filter: newFilter,
      filters: [...vModel.value],
      index: props.index,
      value: [...vModel.value],
      parentFilter: props.parentFilter,
      fk_parent_id: props.fkParentId,
      prevValue,
    })
  }

  if (!nested.value) {
    // if nested, scroll to bottom
    scrollToBottom()
    scrollDownIfNeeded()
  } else {
    scrollDownIfNeeded()
  }
}
const addFilter = async () => {
  return innerAdd(false)
}

const addFilterGroup = async () => {
  return innerAdd(true)
}
const onFilterDelete = async (
  event: {
    filter: ColumnFilterType
    index: number
  },
  index: number,
) => {
  const prevValue = [...vModel.value]

  if (props.handler?.deleteFilter) {
    await props.handler?.deleteFilter({
      type: 'delete',
      filter: vModel.value[index],
      filters: vModel.value,
      index: props.index,
      value: [...vModel.value],
      parentFilter: props.parentFilter,
      fk_parent_id: props.fkParentId,
      prevValue,
    })
  } else {
    const deletedFilter = vModel.value.splice(index, 1)

    emits('change', {
      type: 'delete',
      filter: deletedFilter,
      filters: [...vModel.value],
      index: props.index,
      value: [...vModel.value],
      parentFilter: props.parentFilter,
      fk_parent_id: props.fkParentId,
      prevValue,
    })
  }
}
// #endregion
</script>

<template>
  <div
    data-testid="nc-filter"
    class="menu-filter-dropdown w-min"
    :class="{
      'max-h-[max(80vh,500px)] min-w-122 py-2 pl-4': !nested && !queryFilter,
      '!min-w-127.5': isForm && !webHook,
      '!min-w-full !w-full !pl-0': isFullWidth || (!nested && webHook),
      'min-w-full': isFullWidth || nested || queryFilter,
    }"
  >
    <div v-if="nested" class="flex min-w-full w-min items-center gap-1 mb-2">
      <slot name="nestedRow"></slot>
      <template v-if="!slotHasChildren('nestedRow')">
        <div :class="[`nc-filter-logical-op-level-${nestedLevel}`]">
          <slot name="nestedRowStart"></slot>
        </div>
        <div class="flex-grow"></div>
        <NcDropdown
          :trigger="['hover']"
          overlay-class-name="nc-dropdown-filter-group-sub-menu"
          :disabled="disableAddNewFilter || isLockedView || disabled"
        >
          <NcButton size="xs" type="text" :disabled="disableAddNewFilter || isLockedView || disabled">
            <GeneralIcon icon="plus" class="cursor-pointer" data-testid="filter-add-icon" />
          </NcButton>

          <template #overlay>
            <NcMenu>
              <template v-if="!isEeUI && !isPublic">
                <template v-if="filtersCount < filterPerViewLimit">
                  <NcMenuItem data-testid="add-filter-menu" @click.stop="addFilter">
                    <div class="flex items-center gap-1">
                      <component :is="iconMap.plus" data-testid="filter-add-icon" />
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
                    <component :is="iconMap.plus" data-testid="filter-add-icon" />
                    <!-- Add Filter -->
                    {{ isForm && !webHook ? $t('activity.addCondition') : $t('activity.addFilter') }}
                  </div>
                </NcMenuItem>

                <NcMenuItem
                  v-if="!webHook && nestedLevel < MAX_NESTED_LEVEL"
                  data-testid="add-filter-group-menu"
                  @click.stop="addFilterGroup"
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
          <slot name="nestedRowEnd"></slot>
        </div>
      </template>
    </div>
    <template v-else>
      <slot name="root-header"></slot>
    </template>
    <!-- #region filter group rows -->
    <div
      v-if="visibleFilters && visibleFilters.length"
      ref="wrapperDomRef"
      class="flex flex-col gap-y-1.5 nc-filter-grid min-w-full w-min"
      :class="{
        'max-h-420px nc-scrollbar-thin nc-filter-top-wrapper pr-4 mt-1 mb-2 py-1': !nested && !queryFilter,
        '!pr-0': webHook && !nested,
      }"
      @click.stop
    >
      <template v-for="(filter, i) in vModel" :key="i">
        <template v-if="filter.status !== 'delete'">
          <template v-if="filter.is_group">
            <slot name="filterGroupRow"> </slot>
            <template v-if="!slotHasChildren('filterGroupRow')">
              <SmartsheetToolbarFilterGroupRow
                :model-value="filter"
                :index="i"
                :nested-level="nestedLevel"
                :columns="columns"
                :disabled="disabled"
                :is-full-width="isFullWidth"
                :is-logical-op-change-allowed="isLogicalOpChangeAllowed"
                :is-locked-view="isLockedView"
                :db-client-type="dbClientType"
                :web-hook="webHook"
                :link="link"
                :widget="widget"
                :is-form="isForm"
                :is-public="isPublic"
                :filter-per-view-limit="filterPerViewLimit"
                :disable-add-new-filter="disableAddNewFilter"
                :filters-count="filtersCount"
                :query-filter="queryFilter"
                :handler="handler"
                :is-colour-filter="isColourFilter"
                :is-loading-filter="isLoadingFilter"
                @change="onFilterRowChange($event, i)"
                @delete="onFilterDelete($event, i)"
              />
            </template>
          </template>
          <template v-else>
            <slot name="filterRow"> </slot>
            <template v-if="!slotHasChildren('filterRow')">
              <SmartsheetToolbarFilterRow
                :model-value="filter"
                :index="i"
                :columns="columns"
                :show-null-and-empty-in-filter="showNullAndEmptyInFilter"
                :disabled="disabled"
                :is-logical-op-change-allowed="isLogicalOpChangeAllowed"
                :is-locked-view="isLockedView"
                :db-client-type="dbClientType"
                :web-hook="webHook"
                :widget="widget"
                :link="link"
                :handler="handler"
                :is-colour-filter="isColourFilter"
                :is-loading-filter="isLoadingFilter"
                @change="onFilterRowChange($event, i)"
                @delete="onFilterDelete($event, i)"
              />
            </template>
          </template>
        </template>
      </template>
    </div>
    <!-- #endregion filter group rows -->
    <template v-if="!nested">
      <template v-if="isEeUI && !isPublic">
        <div
          v-if="!disabled && filtersCount < filterPerViewLimit"
          ref="addFiltersRowDomRef"
          class="flex gap-2"
          :class="{
            'mt-1 mb-2': vModel.length,
            'cursor-wait': isLoadingFilter,
          }"
        >
          <NcButton
            size="small"
            :type="actionBtnType"
            :disabled="disableAddNewFilter || isLockedView || readOnly"
            class="nc-btn-focus"
            data-testid="add-filter"
            :class="{ 'pointer-events-none': isLoadingFilter }"
            @click.stop="addFilter()"
          >
            <div class="flex items-center gap-1">
              <component :is="iconMap.plus" />
              <!-- Add Filter -->
              {{ isForm && !webHook ? $t('activity.addCondition') : $t('activity.addFilter') }}
            </div>
          </NcButton>

          <NcButton
            v-if="nestedLevel < MAX_NESTED_LEVEL && !disabled"
            class="nc-btn-focus"
            :class="{ 'pointer-events-none': isLoadingFilter }"
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
          <slot name="root-add-filter-row"></slot>
        </div>
      </template>

      <template v-else-if="!disabled">
        <div
          ref="addFiltersRowDomRef"
          class="flex gap-2"
          :class="{
            'mt-1 mb-2': vModel.length,
            'cursor-wait': isLoadingFilter,
          }"
        >
          <NcButton
            class="nc-btn-focus"
            :class="{ 'pointer-events-none': isLoadingFilter }"
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
            v-if="!link && !webHook && !widget && nestedLevel < MAX_NESTED_LEVEL"
            class="nc-btn-focus"
            :class="{ 'pointer-events-none': isLoadingFilter }"
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
          <slot name="root-add-filter-row"></slot>
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
      @on-open="onLockedViewFooterOpen()"
    />
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
