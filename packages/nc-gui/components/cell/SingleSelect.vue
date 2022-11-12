<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionType } from 'nocodb-sdk'
import { ActiveCellInj, ColumnInj, IsKanbanInj, ReadonlyInj, computed, inject, ref, useEventListener, watch } from '#imports'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const active = inject(ActiveCellInj, ref(false))

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const vModel = computed({
  get: () => modelValue,
  set: (val) => emit('update:modelValue', val || null),
})

const options = computed<SelectOptionType[]>(() => {
  if (column?.value.colOptions) {
    const opts = column.value.colOptions
      ? // todo: fix colOptions type, options does not exist as a property
        (column.value.colOptions as any).options.filter((el: SelectOptionType) => el.title !== '') || []
      : []
    for (const op of opts.filter((el: any) => el.order === null)) {
      op.title = op.title.replace(/^'/, '').replace(/'$/, '')
    }
    return opts
  }
  return []
})

const handleKeys = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      isOpen.value = false
      break
  }
}

const handleClose = (e: MouseEvent) => {
  if (aselect.value && !aselect.value.$el.contains(e.target)) {
    isOpen.value = false
    aselect.value.blur()
  }
}

useEventListener(document, 'click', handleClose)

watch(isOpen, (n, _o) => {
  if (!n) aselect.value?.$el.blur()
})
</script>

<template>
  <a-select
    ref="aselect"
    v-model:value="vModel"
    class="w-full"
    :allow-clear="!column.rqd && active"
    :bordered="false"
    :open="isOpen"
    :disabled="readOnly"
    :show-arrow="!readOnly && (active || vModel === null)"
    dropdown-class-name="nc-dropdown-single-select-cell"
    @select="isOpen = false"
    @keydown="handleKeys"
    @click="isOpen = !isOpen"
  >
    <a-select-option
      v-for="op of options"
      :key="op.title"
      :value="op.title"
      :data-testid="`select-option-${column.title}-${rowIndex}`"
      @click.stop
    >
      <a-tag class="rounded-tag" :color="op.color">
        <span
          :style="{
            'color': tinycolor.isReadable(op.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
              ? '#fff'
              : tinycolor.mostReadable(op.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
            'font-size': '13px',
          }"
          :class="{ 'text-sm': isKanban }"
        >
          {{ op.title }}
        </span>
      </a-tag>
    </a-select-option>
  </a-select>
</template>

<style scoped lang="scss">
.rounded-tag {
  @apply py-0 px-[12px] rounded-[12px];
}
:deep(.ant-tag) {
  @apply "rounded-tag";
}
:deep(.ant-select-clear) {
  opacity: 1;
}
</style>
<!--

-->
