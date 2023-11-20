<script lang="ts" setup>
const props = defineProps<{
  value?: string
  placeholder?: string
  dropdownClassName?: string
  showSearch?: boolean
  // filterOptions is a function
  filterOption?: (input: string, option: any) => boolean
  dropdownMatchSelectWidth?: boolean
  allowClear?: boolean
  loading?: boolean
}>()

const emits = defineEmits(['update:value', 'change'])

const placeholder = computed(() => props.placeholder)

const dropdownClassName = computed(() => props.dropdownClassName)

const showSearch = computed(() => props.showSearch)

const filterOption = computed(() => props.filterOption)

const dropdownMatchSelectWidth = computed(() => props.dropdownMatchSelectWidth)

const loading = computed(() => props.loading)

const vModel = useVModel(props, 'value', emits)

const onChange = (value: string) => {
  emits('change', value)
}
</script>

<template>
  <a-select
    v-model:value="vModel"
    :placeholder="placeholder"
    class="nc-select"
    :dropdown-class-name="dropdownClassName ? `nc-select-dropdown  ${dropdownClassName}` : 'nc-select-dropdown'"
    :show-search="showSearch"
    :filter-option="filterOption"
    :dropdown-match-select-width="dropdownMatchSelectWidth"
    :allow-clear="allowClear"
    :loading="loading"
    :disabled="loading"
    @change="onChange"
  >
    <template #suffixIcon>
      <GeneralLoader v-if="loading" />
      <GeneralIcon v-else icon="arrowDown" class="text-gray-800 nc-select-expand-btn" />
    </template>
    <slot />
  </a-select>
</template>

<style lang="scss">
.ant-select-item {
  @apply !xs:h-13;
}
.ant-select-item-option-content {
  @apply !xs:mt-2.5;
}
.ant-select-item-option-state {
  @apply !xs:mt-1.75;
}

.nc-select.ant-select {
  height: fit-content;
  .ant-select-selector {
    box-shadow: 0px 5px 3px -2px rgba(0, 0, 0, 0.02), 0px 3px 1px -2px rgba(0, 0, 0, 0.06);
    @apply border-1 border-gray-200 !rounded-lg;
  }

  .ant-select-selection-item {
    @apply font-medium pr-3;
  }

  .ant-select-selection-placeholder {
    @apply text-gray-600;
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
  @apply !rounded-xl py-1.5;

  .rc-virtual-list-holder {
    overflow-y: scroll;
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
      @apply bg-gray-300;
    }
    &::-webkit-scrollbar-thumb:hover {
      @apply bg-gray-400;
    }
  }
}
</style>
