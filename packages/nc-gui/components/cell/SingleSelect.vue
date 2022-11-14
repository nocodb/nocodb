<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionType } from 'nocodb-sdk'
import { useSelectedCellKeyupListener } from '~/composables/useSelectedCellKeyupListener'
import {
  ActiveCellInj,
  ColumnInj,
  EditModeInj,
  IsKanbanInj,
  ReadonlyInj,
  computed,
  inject,
  ref,
  useEventListener,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const vModel = computed({
  get: () => modelValue,
  set: (val) => {
    emit('update:modelValue', val || null)
  },
})

const options = computed<(SelectOptionType & { value: string })[]>(() => {
  if (column?.value.colOptions) {
    const opts = column.value.colOptions
      ? // todo: fix colOptions type, options does not exist as a property
      (column.value.colOptions as any).options.filter((el: SelectOptionType) => el.title !== '') || []
      : []
    for (const op of opts.filter((el: any) => el.order === null)) {
      op.title = op.title.replace(/^'/, '').replace(/'$/, '')
    }
    return opts.map((o: any) => ({ ...o, value: o.title }))
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
  // if (aselect.value && !aselect.value.$el.contains(e.target)) {
  //   isOpen.value = false
  //   aselect.value.blur()
  // }
}

useEventListener(document, 'click', handleClose)

watch(isOpen, (n, _o) => {
  if (!n) {
    aselect.value?.$el?.querySelector('input')?.blur()
  } else {
    aselect.value?.$el?.querySelector('input')?.focus()
  }
})

useSelectedCellKeyupListener(active, (e) => {
  switch (e.key) {
    case 'Escape':
      isOpen.value = false
      break
    case 'Enter':
      if (active.value && !isOpen.value) {
        isOpen.value = true
      }
      break
  }
})

const val = ref()
const { $api } = useNuxtApp()

const addIfMissingAndSave = async () => {
  const newOptValue = aselect.value?.$el?.querySelector('.ant-select-selection-search-input')?.value

  if (newOptValue && !options.value.some((o) => o.title === newOptValue)) {
    options.value.push({ title: newOptValue, value: newOptValue })
    column.value.colOptions = { options: options.value.map(({ value: _, ...rest }) => rest) }

    await $api.dbTableColumn.update(column.value?.id as string, {
      ...column.value,
    })
  }
}
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
    :show-arrow="!readOnly && (active || editable || vModel === null)"
    :dropdown-class-name="`nc-dropdown-single-select-cell ${isOpen ? 'active' : ''}`"
    @select="isOpen = false"
    @keydown.enter.stop
    @click="isOpen = (active || editable) && !isOpen"
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
