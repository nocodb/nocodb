<script setup lang="ts">
import { type ClientType } from 'nocodb-sdk'
import type { GroupHandler } from './types'
import { SmartsheetToolbarFilterGroup } from '#components'

interface Props {
  modelValue: ColumnFilterType
  index: number
  nestedLevel: number
  columns: ColumnTypeForFilter[]
  dbClientType?: ClientType

  disableAddNewFilter?: boolean
  actionBtnType?: 'text' | 'secondary'
  webHook?: boolean
  link?: boolean
  widget?: boolean
  isForm?: boolean
  isPublic?: boolean
  isFullWidth?: boolean

  disabled?: boolean
  // some view is different when locked view but not disabled
  isLockedView?: boolean
  isLogicalOpChangeAllowed?: boolean

  // limit imposed by user plan
  filterPerViewLimit: number
  // total filter already added into section
  filtersCount?: number

  // what's this???
  queryFilter?: boolean

  handler?: GroupHandler
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

const { t } = useI18n()

const logicalOps = [
  { value: 'and', text: t('general.and') },
  { value: 'or', text: t('general.or') },
]

// #region utils & computed
const isDisabled = computed(() => {
  return vModel.value.readOnly || props.disabled || props.isLockedView
})

const isChildLogicalOpChangeAllowed = computed(() => {
  return new Set(vModel.value.children?.slice(1).map((filter) => filter.logical_op)).size > 1
})
// #endregion

// #region event handling
const onFilterChange = (event: FilterGroupChangeEvent) => {
  switch (event.type) {
    case 'add': {
      event.filter.fk_parent_id = vModel.value.id
      emits('change', {
        filter: { ...vModel.value },
        type: 'child_add',
        prevValue: { ...vModel.value, children: event.prevValue },
        value: { ...vModel.value },
        index: props.index,
      })
      break
    }
    case 'delete': {
      event.filter.fk_parent_id = vModel.value.id
      emits('change', {
        filter: { ...vModel.value },
        type: 'child_delete',
        prevValue: { ...vModel.value, children: event.prevValue },
        value: { ...vModel.value },
        index: props.index,
      })
      break
    }
  }
}
const onFilterRowChange = (event: FilterRowChangeEvent) => {
  emits('change', {
    ...event,
    index: props.index,
  })
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
const onDelete = () => {
  emits('delete', {
    filter: { ...vModel.value },
    index: props.index,
  })
}
// #endregion
</script>

<template>
  <div class="flex flex-col min-w-full w-min gap-y-2">
    <div class="flex rounded-lg p-2 min-w-full w-min border-1" :class="[`nc-filter-nested-level-${nestedLevel}`]">
      <SmartsheetToolbarFilterGroup
        v-model="vModel.children"
        :index="index"
        :nested-level="nestedLevel + 1"
        :columns="columns"
        :disabled="disabled"
        :is-locked-view="isLockedView"
        :is-logical-op-change-allowed="isChildLogicalOpChangeAllowed"
        :action-btn-type="actionBtnType"
        :web-hook="webHook"
        :link="link"
        :widget="widget"
        :is-form="isForm"
        :is-public="isPublic"
        :filter-per-view-limit="filterPerViewLimit"
        :disable-add-new-filter="disableAddNewFilter"
        :filters-count="filtersCount"
        :query-filter="queryFilter"
        :fk-parent-id="vModel.id"
        :parent-filter="vModel"
        :is-full-width="isFullWidth"
        :handler="handler"
        :is-colour-filter="isColourFilter"
        :is-loading-filter="isLoadingFilter"
        @change="onFilterChange"
        @row-change="onFilterRowChange"
      >
        <template #nestedRowStart>
          <template v-if="index === 0">
            <span class="flex items-center nc-filter-where-label ml-1">{{ $t('labels.where') }}</span>
          </template>
          <div v-else :key="`${index}nested`" class="flex nc-filter-logical-op">
            <NcSelect
              v-model:value="vModel.logical_op"
              v-e="['c:filter:logical-op:select']"
              :dropdown-match-select-width="false"
              class="min-w-18 capitalize"
              placeholder="Group op"
              dropdown-class-name="nc-dropdown-filter-logical-op-group"
              :disabled="(index > 1 && !isLogicalOpChangeAllowed) || isDisabled"
              :class="{
                'nc-disabled-logical-op': isDisabled || (index > 1 && !isLogicalOpChangeAllowed),
              }"
              @click.stop
              @change="onLogicalOpChange($event)"
            >
              <a-select-option v-for="op in logicalOps" :key="op.value" :value="op.value">
                <div class="flex items-center w-full justify-between gap-2">
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
          </div>
        </template>
        <template #nestedRowEnd>
          <div :class="{ 'cursor-wait': isLoadingFilter }">
            <NcButton
              v-if="!vModel.readOnly && !disabled"
              :key="index"
              v-e="['c:filter:delete', { link: !!link, webHook: !!webHook, widget: !!widget }]"
              type="text"
              size="small"
              :disabled="isLockedView"
              class="nc-filter-item-remove-btn cursor-pointer"
              :class="{ 'pointer-events-none': isLoadingFilter }"
              @click.stop="onDelete()"
            >
              <component :is="iconMap.deleteListItem" />
            </NcButton>
          </div>
        </template>
      </SmartsheetToolbarFilterGroup>
    </div>
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
