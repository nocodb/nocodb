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
  enumColor,
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

const { $api } = useNuxtApp()

const searchVal = ref()
const tempVal = ref<string>()

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

const isOptionMissing = computed(() => {
  return (options.value ?? []).every((op) => op.title !== searchVal.value)
})

const vModel = computed({
  get: () => tempVal.value ?? modelValue,
  set: (val) => {
    if (isOptionMissing.value && val === searchVal.value) {
      tempVal.value = val
      return addIfMissingAndSave().finally(() => {
        tempVal.value = undefined
      })
    }
    emit('update:modelValue', val || null)
  },
})

// const handleKeys = async (e: KeyboardEvent) => {
//   switch (e.key) {
//     case 'Escape':
//       e.preventDefault()
//       isOpen.value = false
//       break
//     case 'Enter':
//       e.preventDefault()
//       // if (await addIfMissingAndSave())
//       //   e.stopPropagation()
//       break
//   }
// }

const handleClose = (_e: MouseEvent) => {
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

async function addIfMissingAndSave() {
  if (!searchVal.value) return false

  const newOptValue = searchVal.value
  searchVal.value = ''

  if (newOptValue && !options.value.some((o) => o.title === newOptValue)) {
    options.value.push({
      title: newOptValue,
      value: newOptValue,
      color: enumColor.light[(options.value.length + 1) % enumColor.light.length],
    })
    column.value.colOptions = { options: options.value.map(({ value: _, ...rest }) => rest) }

    await $api.dbTableColumn.update(column.value?.id as string, {
      ...column.value,
    })
    vModel.value = newOptValue
  }
}

const search = () => {
  searchVal.value = aselect.value?.$el?.querySelector('.ant-select-selection-search-input')?.value
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
    :show-search="active || editable"
    @select="isOpen = false"
    @keydown.stop
    @search="search"
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

    <a-select-option v-if="searchVal && isOptionMissing" :key="searchVal" :value="searchVal">
      <div class="flex gap-2 text-gray-500 items-center">
        <MdiPlusThick class="min-w-4" />
        <div class="text-xs whitespace-normal">
          Create new option named <strong>{{ searchVal }}</strong>
        </div>
      </div>
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
