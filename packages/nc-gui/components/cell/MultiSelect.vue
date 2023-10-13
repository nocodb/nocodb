<script lang="ts" setup>
import { onUnmounted } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionType, SelectOptionsType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditColumnInj,
  EditModeInj,
  IsKanbanInj,
  ReadonlyInj,
  RowHeightInj,
  computed,
  enumColor,
  extractSdkResponseErrorMsg,
  h,
  iconMap,
  inject,
  isDrawerOrModalExist,
  onMounted,
  reactive,
  ref,
  useBase,
  useEventListener,
  useMetas,
  useRoles,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  modelValue?: string | string[]
  rowIndex?: number
  disableOptionCreation?: boolean
  location?: 'cell' | 'filter'
}

const { modelValue, disableOptionCreation } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMobileMode } = useGlobal()

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const isLockedMode = inject(IsLockedInj, ref(false))

const isEditable = inject(EditModeInj, ref(false))

const activeCell = inject(ActiveCellInj, ref(false))

// use both ActiveCellInj or EditModeInj to determine the active state
// since active will be false in case of form view
const active = computed(() => activeCell.value || isEditable.value)

const isPublic = inject(IsPublicInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const selectedIds = ref<string[]>([])

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const searchVal = ref<string | null>()

const { $api } = useNuxtApp()

const { getMeta } = useMetas()

const { isUIAllowed } = useRoles()

const { isPg, isMysql } = useBase()

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

const hasEditRoles = computed(() => isUIAllowed('dataEdit'))

const editAllowed = computed(() => (hasEditRoles.value || isForm.value) && active.value)

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
      ? isMysql(column.value.source_id)
        ? modelValue.split(',').sort((a, b) => {
            const opa = options.value.find((el) => el.title === a)
            const opb = options.value.find((el) => el.title === b)
            if (opa && opb) {
              return opa.order! - opb.order!
            }
            return 0
          })
        : modelValue.split(',').map((el) => el.trim())
      : modelValue.map((el) => el.trim())
    : [],
)

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
  if (!n) searchVal.value = ''

  if (editAllowed.value) {
    if (!n) {
      aselect.value?.$el?.querySelector('input')?.blur()
    } else {
      aselect.value?.$el?.querySelector('input')?.focus()
    }
  }
})

useSelectedCellKeyupListener(activeCell, (e) => {
  switch (e.key) {
    case 'Escape':
      isOpen.value = false
      break
    case 'Enter':
      if (editAllowed.value && active.value && !isOpen.value) {
        isOpen.value = true
      }
      break
    // skip space bar key press since it's used for expand row
    case ' ':
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
      if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && e.key?.length === 1 && !isDrawerOrModalExist()) {
        e.stopPropagation()
        isOpen.value = true
      }
      break
  }
})

// close dropdown list on escape
useSelectedCellKeyupListener(isOpen, (e) => {
  if (e.key === 'Escape') isOpen.value = false
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
        if (isPg(column.value.source_id)) {
          updatedColMeta.cdf = updatedColMeta.cdf.substring(
            updatedColMeta.cdf.indexOf(`'`) + 1,
            updatedColMeta.cdf.lastIndexOf(`'`),
          )
        }

        // Mysql escapes single quotes with backslash so we keep quotes but others have to unescaped
        if (!isMysql(column.value.source_id) && !isPg(column.value.source_id)) {
          updatedColMeta.cdf = updatedColMeta.cdf.replace(/''/g, "'")
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
  } catch (e: any) {
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

const cellClickHook = inject(CellClickHookInj, null)

const toggleMenu = () => {
  if (cellClickHook) return
  isOpen.value = editAllowed.value && !isOpen.value
}

const cellClickHookHandler = () => {
  isOpen.value = editAllowed.value && !isOpen.value
}
onMounted(() => {
  cellClickHook?.on(cellClickHookHandler)
})
onUnmounted(() => {
  cellClickHook?.on(cellClickHookHandler)
})

const handleClose = (e: MouseEvent) => {
  // close dropdown if clicked outside of dropdown
  if (
    isOpen.value &&
    aselect.value &&
    !aselect.value.$el.contains(e.target) &&
    !document.querySelector('.nc-dropdown-multi-select-cell.active')?.contains(e.target as Node)
  ) {
    // loose focus when clicked outside
    isEditable.value = false
    isOpen.value = false
  }
}

useEventListener(document, 'click', handleClose, true)

const selectedOpts = computed(() => {
  return vModel.value.reduce<SelectOptionType[]>((selectedOptions, option) => {
    const selectedOption = options.value.find((o) => o.value === option)
    if (selectedOption) {
      selectedOptions.push(selectedOption)
    }
    return selectedOptions
  }, [])
})
</script>

<template>
  <div
    class="nc-multi-select h-full w-full flex items-center"
    :class="{ 'read-only': readOnly || isLockedMode }"
    @click="toggleMenu"
  >
    <div
      v-if="!active"
      class="flex flex-wrap"
      :style="{
        'display': '-webkit-box',
        'max-width': '100%',
        '-webkit-line-clamp': rowHeight || 1,
        '-webkit-box-orient': 'vertical',
        'overflow': 'hidden',
      }"
    >
      <template v-for="selectedOpt of selectedOpts" :key="selectedOpt.value">
        <a-tag class="rounded-tag" :color="selectedOpt.color">
          <span
            :style="{
              'color': tinycolor.isReadable(selectedOpt.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                ? '#fff'
                : tinycolor.mostReadable(selectedOpt.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
              'font-size': '13px',
            }"
            :class="{ 'text-sm': isKanban }"
          >
            {{ selectedOpt.title }}
          </span>
        </a-tag>
      </template>
    </div>

    <a-select
      v-else
      ref="aselect"
      v-model:value="vModel"
      mode="multiple"
      class="w-full overflow-hidden"
      :placeholder="isEditColumn ? $t('labels.optional') : ''"
      :bordered="false"
      clear-icon
      :show-search="!isMobileMode"
      :show-arrow="editAllowed && !(readOnly || isLockedMode)"
      :open="isOpen && editAllowed"
      :disabled="readOnly || !editAllowed || isLockedMode"
      :class="{ 'caret-transparent': !hasEditRoles }"
      :dropdown-class-name="`nc-dropdown-multi-select-cell ${isOpen ? 'active' : ''}`"
      @search="search"
      @keydown.stop
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-gray-700 nc-select-expand-btn" />
      </template>
      <a-select-option
        v-for="op of options"
        :key="op.id || op.title"
        :value="op.title"
        :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
        :class="`nc-select-option-${column.title}-${op.title}`"
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
        v-if="searchVal && isOptionMissing && !isPublic && !disableOptionCreation && isUIAllowed('fieldEdit')"
        :key="searchVal"
        :value="searchVal"
      >
        <div class="flex gap-2 text-gray-500 items-center h-full">
          <component :is="iconMap.plusThick" class="min-w-4" />
          <div class="text-xs whitespace-normal">
            {{ $t('msg.selectOption.createNewOptionNamed') }} <strong>{{ searchVal }}</strong>
          </div>
        </div>
      </a-select-option>

      <template #tagRender="{ value: val, onClose }">
        <a-tag
          v-if="options.find((el) => el.title === val)"
          class="rounded-tag nc-selected-option"
          :style="{ display: 'flex', alignItems: 'center' }"
          :color="options.find((el) => el.title === val)?.color"
          :closable="editAllowed && (vModel.length > 1 || !column?.rqd)"
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

<style scoped lang="scss">
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

.read-only {
  .ms-close-icon {
    display: none;
  }
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
  @apply flex-nowrap overflow-hidden;
}

.nc-multi-select:not(.read-only) {
  :deep(.ant-select-selector),
  :deep(.ant-select-selector input) {
    @apply "!cursor-pointer";
  }
}

:deep(.ant-select-selector) {
  @apply !px-0;
}

:deep(.ant-select-selection-search-input) {
  @apply !text-xs;
}
</style>
