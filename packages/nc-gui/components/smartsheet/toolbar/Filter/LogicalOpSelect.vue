<script lang="ts" setup>
interface Props {
  modelValue: string
  filter: ColumnFilterType
  link: boolean
  webHook: boolean
  isLogicalOpChangeAllowed: boolean

  isLockedView: boolean
  readOnly: boolean
}
interface Emits {
  (event: 'update:modelValue', model: string): void
  (event: 'change', model: { filter: ColumnFilterType; comparison_op: string }): void
}
const props = defineProps<Props>()
const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const { t } = useI18n()

const logicalOps = [
  { value: 'and', text: t('general.and') },
  { value: 'or', text: t('general.or') },
]

const onChange = () => {
  const { filter } = props
  emits('change', {
    filter,
    comparison_op: filter.comparison_op,
  })
}
</script>

<template>
  <NcSelect
    v-model:value="vModel"
    v-e="['c:filter:logical-op:select', { link: !!link, webHook: !!webHook }]"
    :dropdown-match-select-width="false"
    class="h-full !max-w-18 !min-w-18 capitalize"
    hide-details
    :disabled="filter.readOnly || !isLogicalOpChangeAllowed || isLockedView || readOnly"
    dropdown-class-name="nc-dropdown-filter-logical-op"
    :class="{
      'nc-disabled-logical-op': filter.readOnly || !isLogicalOpChangeAllowed || readOnly,
    }"
    @change="onChange"
    @click.stop
  >
    <a-select-option v-for="op of logicalOps" :key="op.value" :value="op.value">
      <div class="flex items-center w-full justify-between w-full gap-2">
        <div class="truncate flex-1 capitalize">{{ op.text }}</div>
        <component
          :is="iconMap.check"
          v-if="filter.logical_op === op.value"
          id="nc-selected-item-icon"
          class="text-primary w-4 h-4"
        />
      </div>
    </a-select-option>
  </NcSelect>
</template>
