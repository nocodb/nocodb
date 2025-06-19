<script setup lang="ts">
interface Props {
  modelValue: ColumnFilterType
  index: number
  nestedLevel: number
  columns: ColumnTypeForFilter[]

  disabled?: boolean
  // some view is different when locked view but not disabled
  isLockedView?: boolean
  isLogicalOpChangeAllowed?: boolean
}
interface Emits {
  (event: 'update:modelValue', model: string): void
  (
    event: 'change',
    model: {
      filter: ColumnFilterType
      type: 'logical_op' | 'fk_column_id' | 'comparison_op' | 'comparison_sub_op' | 'value'
      prevValue: any
      value: any
      index: number
    },
  ): void
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

const logicalOps = [
  { value: 'and', text: t('general.and') },
  { value: 'or', text: t('general.or') },
]

// #region utils & computed
const slots = useSlots()

const slotHasChildren = (name?: string) => {
  return (slots[name ?? 'default']?.()?.length ?? 0) > 0
}

const isDisabled = computed(() => {
  return vModel.value.readOnly || props.disabled || props.isLockedView
})
// #endregion

// #region event handling
const onLogicalOpChange = (logical_op: string) => {
  const prevValue = vModel.value.logical_op
  vModel.value.logical_op = logical_op as any
  emits('change', {
    filter: { ...vModel.value },
    type: 'logical_op',
    prevValue,
    value: logical_op,
    index: props.index,
  })
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
      <span v-if="index === 0" class="flex items-center nc-filter-where-label ml-1">{{ $t('labels.where') }}</span>
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
      </div>
      <template v-for="(filter, i) in vModel.children" :key="i">
        <slot name="child"></slot>
        <template v-if="!slotHasChildren('child')">
          {{ filter }}
        </template>
      </template>
      <div>
        <NcButton
          v-if="!vModel.readOnly && !disabled"
          :key="i"
          v-e="['c:filter:delete', { link: !!link, webHook: !!webHook }]"
          type="text"
          size="small"
          :disabled="isLockedView"
          class="nc-filter-item-remove-btn cursor-pointer"
          @click.stop="onDelete()"
        >
          <component :is="iconMap.deleteListItem" />
        </NcButton>
      </div>
    </div>
  </div>
</template>
