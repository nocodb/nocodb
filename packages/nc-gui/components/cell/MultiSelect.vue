<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionType, SelectOptionsType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ColumnInj,
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
  watch,enumColor,useMetas
} from '#imports'
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  modelValue?: string | string[]
  rowIndex?: number
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const emptyOption = Symbol('emptyOption')

const { isMysql } = useProject()

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const selectedIds = ref<string[]>([])

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const searchVal = ref()
const { $api } = useNuxtApp()
const { getMeta } = useMetas()

const isOptionMissing = computed(() => {
  return (options.value ?? []).every((op) => op.title !== searchVal.value)
})

const options = computed<(SelectOptionType & { value?: string })[]>(() => {
  if (column?.value.colOptions) {
    const opts = column.value.colOptions
      ? (column.value.colOptions as SelectOptionsType).options.filter((el: SelectOptionType) => el.title !== '') || []
      : []
    for (const op of opts.filter((el: SelectOptionType) => el.order === null)) {
      op.title = op.title?.replace(/^'/, '').replace(/'$/, '')
    }
    return opts.map((o: SelectOptionType) => ({ ...o, value: o.title }))
  }
  return []
})

const vModel = computed({
  get: () => {
    return selectedIds.value.reduce((acc, id) => {
      const title = (options.value.find((op) => op.id === id) || options.value.find((op) => op.title === id))?.title

      if (title) acc.push(title)

      return acc
    }, [] as string[])
  },
  set: (val) => {
    if (isOptionMissing.value && val[val.length - 1] === searchVal.value) {
      return addIfMissingAndSave()
    }
    emit('update:modelValue', val.length === 0 ? null : val.join(','))
  },
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

const handleKeys = async (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      isOpen.value = false
      break
    case 'Enter':
      e.stopPropagation()
      await addIfMissingAndSave()
      break
  }
}
const v = Math.floor(Math.random() * 1000)

const handleClose = (e: MouseEvent) => {
  if (aselect.value && !aselect.value.$el.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  selectedIds.value = selectedTitles.value.flatMap((el) => {
    const item = options.value.find((op) => op.title === el)
    const itemIdOrTitle = item?.id || item?.title
    if (itemIdOrTitle) {
      return [itemIdOrTitle]
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


async function addIfMissingAndSave() {
  if (!searchVal) return false

  const newOptValue = searchVal?.value

  if (newOptValue && !options.value.some((o) => o.title === newOptValue)) {
    const newOptions = [...options.value]
    newOptions.push({ title: newOptValue, value: newOptValue,
      color: enumColor.light[(options.value.length + 1) % enumColor.light.length], })
    column.value.colOptions = { options: newOptions.map(({ value: _, ...rest }) => rest) }

    await $api.dbTableColumn.update(column.value?.id as string, {
      ...column.value,
    })
    await getMeta(column.value.fk_model_id!, true)

    vModel.value = [...vModel.value, newOptValue]
    searchVal.value = ''
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
    v-model:open="isOpen"
    mode="multiple"
    class="w-full"
    :bordered="false"
    :show-arrow="!readOnly"
    show-search
    :open="isOpen"
    :disabled="readOnly"
    :class="{ '!ml-[-8px]': readOnly }"
    :dropdown-class-name="`nc-dropdown-multi-select-cell ${isOpen ? 'active' : ''}`"
    @search="search"
    @keydown.stop
    @click="isOpen = (active || editable) && !isOpen"
  >
    <a-select-option
      v-for="op of options"
      :key="op.id || op.title"
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
        <div class="text-xs whitespace-normal"> Create new option named <strong>{{ searchVal }}</strong></div>
      </div>
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
