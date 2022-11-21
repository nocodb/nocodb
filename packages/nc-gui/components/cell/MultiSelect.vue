<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionType, SelectOptionsType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ColumnInj,
  EditModeInj,
  IsKanbanInj,
  ReadonlyInj,
  computed,
  h,
  inject,
  onMounted,
  ref,
  useEventListener,
  useProject,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  modelValue?: string | string[]
  rowIndex?: number
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useProject()

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const selectedIds = ref<string[]>([])

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const options = computed<SelectOptionType[]>(() => {
  if (column?.value.colOptions) {
    const opts = column.value.colOptions
      ? (column.value.colOptions as SelectOptionsType).options.filter((el: SelectOptionType) => el.title !== '') || []
      : []
    for (const op of opts.filter((el: SelectOptionType) => el.order === null)) {
      op.title = op.title?.replace(/^'/, '').replace(/'$/, '')
    }
    return opts
  }
  return []
})

const vModel = computed({
  get: () =>
    selectedIds.value.reduce((acc, id) => {
      const title = options.value.find((op) => op.id === id)?.title

      if (title) acc.push(title)

      return acc
    }, [] as string[]),
  set: (val) => emit('update:modelValue', val.length === 0 ? null : val.join(',')),
})

const selectedTitles = computed(() =>
  modelValue
    ? typeof modelValue === 'string'
      ? isMysql
        ? modelValue.split(',').sort((a, b) => {
            const opa = options.value.find((el) => el.title === a)
            const opb = options.value.find((el) => el.title === b)
            if (opa && opb) {
              return opa.order! - opb.order!
            }
            return 0
          })
        : modelValue.split(',')
      : modelValue
    : [],
)

const handleClose = (e: MouseEvent) => {
  if (aselect.value && !aselect.value.$el.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  selectedIds.value = selectedTitles.value.flatMap((el) => {
    const item = options.value.find((op) => op.title === el)?.id
    if (item) {
      return [item]
    }

    return []
  })
})

useEventListener(document, 'click', handleClose)

watch(
  () => modelValue,
  () => {
    selectedIds.value = selectedIds.value = selectedTitles.value.flatMap((el) => {
      const item = options.value.find((op) => op.title === el)?.id
      if (item) {
        return [item]
      }

      return []
    })
  },
)

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
</script>

<template>
  <a-select
    ref="aselect"
    v-model:value="vModel"
    v-model:open="isOpen"
    mode="multiple"
    class="w-full"
    :bordered="false"
    :show-arrow="!readOnly"
    :show-search="false"
    :disabled="readOnly"
    :class="{ '!ml-[-8px]': readOnly }"
    :dropdown-class-name="`nc-dropdown-multi-select-cell ${isOpen ? 'active' : ''}`"
    @keydown.enter.stop
    @click="isOpen = (active || editable) && !isOpen"
  >
    <a-select-option
      v-for="op of options"
      :key="op.id"
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

    <template #tagRender="{ value: val, onClose }">
      <a-tag
        v-if="options.find((el) => el.title === val)"
        class="rounded-tag"
        :style="{ display: 'flex', alignItems: 'center' }"
        :color="options.find((el) => el.title === val)?.color"
        :closable="(active || editable) && (vModel.length > 1 || !column?.rqd)"
        :close-icon="h(MdiCloseCircle, { class: ['ms-close-icon'] })"
        @close="onClose"
      >
        <span
          :style="{
            'color': tinycolor.isReadable(options.find((el) => el.title === val)?.color || '#ccc', '#fff', {
              level: 'AA',
              size: 'large',
            })
              ? '#fff'
              : tinycolor
                  .mostReadable(options.find((el) => el.title === val)?.color || '#ccc', ['#0b1d05', '#fff'])
                  .toHex8String(),
            'font-size': '13px',
          }"
          :class="{ 'text-sm': isKanban }"
        >
          {{ val }}
        </span>
      </a-tag>
    </template>
  </a-select>
</template>

<style scoped>
.ms-close-icon {
  color: rgba(0, 0, 0, 0.25);
  cursor: pointer;
  display: flex;
  font-size: 12px;
  font-style: normal;
  height: 12px;
  line-height: 1;
  text-align: center;
  text-transform: none;
  transition: color 0.3s ease, opacity 0.15s ease;
  width: 12px;
  z-index: 1;
  margin-right: -6px;
  margin-left: 3px;
}

.ms-close-icon:before {
  display: block;
}

.ms-close-icon:hover {
  color: rgba(0, 0, 0, 0.45);
}

.rounded-tag {
  @apply py-0 px-[12px] rounded-[12px];
}

:deep(.ant-tag) {
  @apply "rounded-tag" my-[2px];
}

:deep(.ant-tag-close-icon) {
  @apply "text-slate-500";
}

:deep(.ant-select-selection-overflow-item) {
  @apply "flex overflow-hidden";
}
</style>
<!--

-->
