<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/lib/select'
import type { NSelectProps } from './types'
const props = withDefaults(defineProps<NSelectProps>(), {
  placeholder: '- select -',
  showSearch: false,
  suffixIcon: 'arrowDown',
  disabled: false,
})
const emits = defineEmits<{
  'update:modelValue': [string | string[]]
  'change': [SelectValue]
}>()
const selectedValue = useVModel(props, 'modelValue', emits)
const { showSearch, dropdownMatchSelectWidth, loading, mode, placeholder } = toRefs(props)
const onChange = (value: SelectValue) => {
  emits('change', value)
}
const selectValue = (value: SelectValue) => {
  selectedValue.value = value
  onChange(value)
}
defineExpose({
  selectValue,
})
</script>

<template>
  <a-select
    v-model:value="selectedValue"
    :size="size"
    :allow-clear="allowClear"
    :disabled="disabled || loading"
    :dropdown-class-name="`nc-select-dropdown ${dropdownClassOverride}`"
    :dropdown-match-select-width="dropdownMatchSelectWidth"
    :filter-option="filterOption"
    :loading="loading"
    :mode="mode"
    :placeholder="placeholder"
    :show-search="showSearch"
    :options="options"
    class="nc-select"
    @change="onChange"
  >
    <template #suffixIcon>
      <GeneralLoader v-if="loading" />
      <GeneralIcon v-else class="text-gray-800 nc-select-expand-btn" :icon="suffixIcon" />
    </template>

    <template v-if="$slots.dropdownRender" #dropdownRender="options">
      <slot name="dropdownRender" v-bind="options" />
    </template>

    <template v-if="$slots.option" #option="option">
      <slot name="option" v-bind="option" />
    </template>

    <slot />
  </a-select>
</template>

<style lang="scss">
.ant-select-item {
  @apply !xs:h-13 !min-h-[2.375rem] !p-2;
}
.ant-select-item-option-content {
  @apply !xs:mt-2.5;
}
.ant-select-item-option-state {
  @apply !xs:mt-1.75;
}
.ant-select-item-option {
  @apply !rounded-md;
}
.nc-select.ant-select {
  height: fit-content;
  .ant-select-selector {
    box-shadow: 0px 5px 3px -2px rgba(0, 0, 0, 0.02), 0px 3px 1px -2px rgba(0, 0, 0, 0.06);
    @apply border-1 border-gray-200 rounded-lg shadow-default;
  }
  .ant-select-selection-item {
    @apply font-medium pr-3 rounded-md flex items-center;
  }
  .ant-select-selection-placeholder {
    @apply text-gray-600;
  }
  .ant-select-selection-item-remove {
    @apply text-gray-800 !pb-1;
  }
  .ant-select-clear {
    @apply flex;
    svg {
      @apply flex-none;
    }
  }
}
.nc-select.ant-select-focused:not(.ant-select-disabled).ant-select:not(.ant-select-customize-input) .ant-select-selector {
  box-shadow: none;
  @apply border-brand-500;
}
.nc-select.ant-select.ant-select-disabled .nc-select-expand-btn {
  @apply text-gray-300;
}
.nc-select-dropdown {
  @apply !rounded-lg py-1.5;
  .rc-virtual-list-holder {
    overflow-y: auto;
    overflow-x: hidden;
    font-weight: 500;
    .ant-select-item-option-content {
      font-weight: 500;
    }
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    &::-webkit-scrollbar-track-piece {
      width: 0px;
    }
    &::-webkit-scrollbar {
      @apply bg-transparent;
    }
    &::-webkit-scrollbar-thumb {
      width: 4px;
      @apply bg-gray-300 rounded-md;
    }
    &::-webkit-scrollbar-thumb:hover {
      @apply bg-gray-400;
    }
  }
}
</style>
