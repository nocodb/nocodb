<script lang="ts" setup>
import { message } from 'ant-design-vue'
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionType, SelectOptionsType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  ColumnInj,
  IsKanbanInj,
  ReadonlyInj,
  computed,
  enumColor,
  extractSdkResponseErrorMsg,
  h,
  inject,
  onMounted,
  reactive,
  ref,
  useEventListener,
  useMetas,
  useProject,
  useRoles,
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

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const selectedIds = ref<string[]>([])

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const searchVal = ref<string | null>()

const { $api } = useNuxtApp()

const { getMeta } = useMetas()

const { hasRole } = useRoles()

const { isPg, isMysql } = useProject()

// a variable to keep newly created options value
// temporary until it's add the option to column meta
const tempSelectedOptsState = reactive<string[]>([])

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

const isOptionMissing = computed(() => {
  return (options.value ?? []).every((op) => op.title !== searchVal.value)
})

const hasEditRoles = computed(() => hasRole('owner', true) || hasRole('creator', true) || hasRole('editor', true))

const editAllowed = computed(() => hasEditRoles.value && (active.value || editable.value))

const vModel = computed({
  get: () => {
    const selected = selectedIds.value.reduce((acc, id) => {
      const title = (options.value.find((op) => op.id === id) || options.value.find((op) => op.title === id))?.title

      if (title) acc.push(title)

      return acc
    }, [] as string[])

    if (tempSelectedOptsState.length) selected.push(...tempSelectedOptsState)

    return selected
  },
  set: (val) => {
    if (isOptionMissing.value && val.length && val[val.length - 1] === searchVal.value) {
      return addIfMissingAndSave()
    }
    emit('update:modelValue', val.length === 0 ? null : val.join(','))
  },
})

const selectedTitles = computed(() =>
  modelValue
    ? typeof modelValue === 'string'
      ? isMysql(column.value.base_id)
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
    selectedIds.value = selectedTitles.value.flatMap((el) => {
      const item = options.value.find((op) => op.title === el)
      if (item && (item.id || item.title)) {
        return [(item.id || item.title)!]
      }

      return []
    })
  },
)

watch(isOpen, (n, _o) => {
  if (editAllowed.value) {
    if (!n) {
      aselect.value?.$el?.querySelector('input')?.blur()
    } else {
      aselect.value?.$el?.querySelector('input')?.focus()
    }
  }
})

useSelectedCellKeyupListener(active, (e) => {
  switch (e.key) {
    case 'Escape':
      isOpen.value = false
      break
    case 'Enter':
      if (editAllowed.value && active.value && !isOpen.value) {
        isOpen.value = true
      }
      break
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowRight':
    case 'ArrowLeft':
    case 'Delete':
      // skip
      break
    default:
      if (!editAllowed.value) {
        e.preventDefault()
        break
      }
      // toggle only if char key pressed
      if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && e.key?.length === 1) {
        e.stopPropagation()
        isOpen.value = true
      }
      break
  }
})

const activeOptCreateInProgress = ref(0)

async function addIfMissingAndSave() {
  if (!searchVal.value || isPublic.value) return false
  try {
    tempSelectedOptsState.push(searchVal.value)
    const newOptValue = searchVal?.value
    searchVal.value = ''
    activeOptCreateInProgress.value++
    if (newOptValue && !options.value.some((o) => o.title === newOptValue)) {
      const newOptions = [...options.value]
      newOptions.push({
        title: newOptValue,
        value: newOptValue,
        color: enumColor.light[(options.value.length + 1) % enumColor.light.length],
      })
      column.value.colOptions = { options: newOptions.map(({ value: _, ...rest }) => rest) }

      const updatedColMeta = { ...column.value }

      // todo: refactor and avoid repetition
      if (updatedColMeta.cdf) {
        // Postgres returns default value wrapped with single quotes & casted with type so we have to get value between single quotes to keep it unified for all databases
        if (isPg(column.value.base_id)) {
          updatedColMeta.cdf = updatedColMeta.cdf.substring(
            updatedColMeta.cdf.indexOf(`'`) + 1,
            updatedColMeta.cdf.lastIndexOf(`'`),
          )
        }

        // Mysql escapes single quotes with backslash so we keep quotes but others have to unescaped
        if (!isMysql(column.value.base_id)) {
          updatedColMeta.cdf = updatedColMeta.cdf.replace(/''/g, '\'')
        }
      }

      await $api.dbTableColumn.update(
        (column.value as { fk_column_id?: string })?.fk_column_id || (column.value?.id as string),
        updatedColMeta,
      )

      activeOptCreateInProgress.value--
      if (!activeOptCreateInProgress.value) {
        await getMeta(column.value.fk_model_id!, true)
        vModel.value = [...vModel.value]
        tempSelectedOptsState.splice(0, tempSelectedOptsState.length)
      }
    } else {
      activeOptCreateInProgress.value--
    }
  } catch (e) {
    // todo: handle error
    console.log(e)
    activeOptCreateInProgress.value--
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const search = () => {
  searchVal.value = aselect.value?.$el?.querySelector('.ant-select-selection-search-input')?.value
}

const onTagClick = (e: Event, onClose: Function) => {
  // check clicked element is remove icon
  if (
    (e.target as HTMLElement)?.classList.contains('ant-tag-close-icon') ||
    (e.target as HTMLElement)?.closest('.ant-tag-close-icon')
  ) {
    e.stopPropagation()
    onClose()
  }
}
</script>

<template>
  <div class="nc-multi-select h-full w-full flex items-center"
       @click="isOpen = editAllowed && !isOpen" :class="{ 'read-only': readOnly }">
    <a-select
      ref="aselect"
      v-model:value="vModel"
      mode="multiple"
      class="w-full overflow-hidden"
      :bordered="false"
      clear-icon
      show-search
      :show-arrow="hasEditRoles && !readOnly && (editable || (active && vModel.length === 0))"
      :open="isOpen && (active || editable)"
      @update:open="isOpen = $event"
      :disabled="readOnly || !(active || editable)"
      :class="{ '!ml-[-8px]': readOnly, 'caret-transparent': !hasEditRoles }"
      :dropdown-class-name="`nc-dropdown-multi-select-cell ${isOpen ? 'active' : ''}`"
      @search="search"
      @keydown.stop
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

      <a-select-option
        v-if="searchVal && isOptionMissing && !isPublic && (hasRole('owner', true) || hasRole('creator', true))"
        :key="searchVal"
        :value="searchVal"
      >
        <div class="flex gap-2 text-gray-500 items-center h-full">
          <MdiPlusThick class="min-w-4" />
          <div class="text-xs whitespace-normal">
            Create new option named <strong>{{ searchVal }}</strong>
          </div>
        </div>
      </a-select-option>

      <template #tagRender="{ value: val, onClose }">
        <a-tag
          v-if="options.find((el) => el.title === val)"
          class="rounded-tag nc-selected-option"
          :style="{ display: 'flex', alignItems: 'center' }"
          :color="options.find((el) => el.title === val)?.color"
          :closable="editAllowed && (active || editable) && (vModel.length > 1 || !column?.rqd)"
          :close-icon="h(MdiCloseCircle, { class: ['ms-close-icon'] })"
          @click="onTagClick($event, onClose)"
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
  </div>
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

:deep(.ant-select-selection-overflow) {
  @apply flex-nowrap;
}
</style>
