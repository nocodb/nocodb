<script lang="ts" setup>
const props = defineProps<{
  value: string
  placeholder?: string
  dropdownClassName?: string
  showSearch?: boolean
  // filterOptions is a function
  filterOption?: (input: string, option: any) => boolean
  dropdownMatchSelectWidth?: boolean
}>()

const emits = defineEmits(['update:value', 'change'])

const placeholder = computed(() => props.placeholder)

const dropdownClassName = computed(() => props.dropdownClassName)

const showSearch = computed(() => props.showSearch)

const filterOption = computed(() => props.filterOption)

const dropdownMatchSelectWidth = computed(() => props.dropdownMatchSelectWidth)

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
    :dropdown-class-name="dropdownClassName ? `nc-select-dropdown ${dropdownClassName}` : 'nc-select'"
    :show-search="showSearch"
    :filter-option="filterOption"
    :dropdown-match-select-width="dropdownMatchSelectWidth"
    @click.stop
    @change="onChange"
  >
    <template #suffixIcon>
      <GeneralIcon icon="arrowDown" class="text-gray-800" />
    </template>
    <slot />
  </a-select>
</template>

<style lang="scss">
.nc-select.ant-select {
  .ant-select-selector {
    box-shadow: 0px 5px 3px -2px rgba(0, 0, 0, 0.02), 0px 3px 1px -2px rgba(0, 0, 0, 0.06);
    @apply border-1 border-gray-200 !rounded-lg;
  }
}
.nc-select.ant-select-focused:not(.ant-select-disabled).ant-select:not(.ant-select-customize-input) .ant-select-selector {
  box-shadow: none;
  @apply border-brand-500;
}
</style>
