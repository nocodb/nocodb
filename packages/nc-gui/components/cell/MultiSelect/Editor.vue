<script lang="ts" setup>
import { message } from 'ant-design-vue'
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import { type LocalSelectOptionType, type SelectInputOptionType, getOptions, getSelectedTitles } from './utils'
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  modelValue?: string | string[]
  rowIndex?: number
  disableOptionCreation?: boolean
  location?: 'cell' | 'filter'
  options?: LocalSelectOptionType[]
}

const { modelValue, disableOptionCreation, options: selectOptions } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMobileMode } = useGlobal()

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const isEditable = inject(EditModeInj, ref(false))

const activeCell = inject(ActiveCellInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

// use both ActiveCellInj or EditModeInj to determine the active state
// since active will be false in case of form view
const active = computed(() => activeCell.value || isEditable.value || isForm.value)

const isPublic = inject(IsPublicInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)
const canvasSelectCell = inject(CanvasSelectCellInj)

const isFocusing = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const searchVal = ref<string | null>()

const { $api } = useNuxtApp()

const { isUIAllowed, isMetaReadOnly } = useRoles()

const { isPg, isMysql } = useBase()

// a variable to keep newly created options value
// temporary until it's add the option to column meta
const tempSelectedOptsState = reactive<SelectInputOptionType[]>([])

const isNewOptionCreateEnabled = computed(
  () => !isPublic.value && !disableOptionCreation && isUIAllowed('fieldEdit') && !isMetaReadOnly.value && !isForm.value,
)

const options = computed(() => {
  return selectOptions ?? getOptions(column.value, isEditColumn.value, isForm.value)
})

const optionsMap = computed(() => {
  return options.value.reduce((acc, op) => {
    if (op.title) {
      acc[op.title.trim()] = op
    }
    return acc
  }, {} as Record<string, (typeof options.value)[number]>)
})

const isOptionMissing = computed(() => {
  return searchVal.value ? !optionsMap.value[searchVal.value] : false
})

const hasEditRoles = computed(() => isUIAllowed('dataEdit'))

const editAllowed = computed(() => (hasEditRoles.value || isForm.value) && active.value)

const vModel = computed({
  get: () => {
    let selected: SelectInputOptionType[] = []

    selected = getSelectedTitles(column.value, optionsMap.value, isMysql, modelValue).reduce((acc, el) => {
      const item = optionsMap.value[el?.trim()]

      if (item?.id || item?.title) {
        acc.push({
          ...item,
          value: item.value!,
          label: item.title || item.value || '',
        })
      }

      return acc
    }, [] as SelectInputOptionType[])

    if (tempSelectedOptsState.length) selected.push(...tempSelectedOptsState)

    return selected
  },
  set: (val) => {
    if (isNewOptionCreateEnabled.value && isOptionMissing.value && val.length && val[val.length - 1] === searchVal.value) {
      return addIfMissingAndSave()
    }
    emit('update:modelValue', val.length === 0 ? null : val.join(','))
  },
})

const vModelListLayout = computed(() => {
  return (vModel.value || []).map((item) => item.value)
})

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

useSelectedCellKeydownListener(
  activeCell,
  (e) => {
    switch (e.key) {
      case 'Escape':
        if (canvasSelectCell) {
          canvasSelectCell.trigger()
          return
        }
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
        if (!(e.metaKey || e.ctrlKey || e.altKey) && e.key?.length === 1 && !isDrawerOrModalExist()) {
          e.stopPropagation()
          isOpen.value = true
        }
        break
    }
  },
  {
    immediate: true,
    isGridCell: true,
  },
)

// close dropdown list on escape
useSelectedCellKeydownListener(
  isOpen,
  (e) => {
    if (e.key === 'Escape') isOpen.value = false
  },
  {
    isGridCell: false,
  },
)

const activeOptCreateInProgress = ref(0)

async function addIfMissingAndSave() {
  if (!searchVal.value || isPublic.value) return false

  try {
    const newOptPayload: SelectInputOptionType = {
      label: searchVal.value,
      title: searchVal.value,
      value: searchVal.value,
      color: enumColor.light[(options.value.length + 1) % enumColor.light.length],
    }
    tempSelectedOptsState.push(newOptPayload)
    searchVal.value = ''
    activeOptCreateInProgress.value++
    if (newOptPayload.value && !optionsMap.value[newOptPayload.value]) {
      const newOptions = [...options.value]
      newOptions.push(newOptPayload)
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

      const data = await $api.dbTableColumn.update(
        (column.value as { fk_column_id?: string })?.fk_column_id || (column.value?.id as string),
        updatedColMeta,
      )

      column.value.colOptions = data.columns.find((c) => c.id === column.value.id).colOptions

      activeOptCreateInProgress.value--
      if (!activeOptCreateInProgress.value) {
        tempSelectedOptsState.splice(0, tempSelectedOptsState.length)
        vModel.value = [...vModel.value.map((op) => op.title), newOptPayload.title!]
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

const toggleMenu = () => {
  if (isFocusing.value) return

  isOpen.value = editAllowed.value && !isOpen.value
}

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

const onKeyDown = (e: KeyboardEvent) => {
  // Tab
  if (e.key === 'Tab') {
    isOpen.value = false
    return
  } else if (e.key === 'Escape' && isForm.value) {
    isOpen.value = false
    return
  }

  e.stopPropagation()
}

const onFocus = () => {
  isFocusing.value = true

  setTimeout(() => {
    isFocusing.value = false
  }, 250)

  if (isSurveyForm.value && vModel.value?.length) return

  isOpen.value = true
}

watch(
  () => active.value,
  (newValue) => {
    if (newValue) return

    searchVal.value = ''
    isOpen.value = false
  },
)

const canvasCellEventData = inject(CanvasCellEventDataInj)!
const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))
const isGrid = inject(IsGridInj, ref(false))
onMounted(() => {
  if (!isUnderLookup.value && isCanvasInjected && !isExpandedForm.value && isGrid.value) {
    forcedNextTick(() => {
      const key = canvasCellEventData.keyboardKey
      if (key && isSinglePrintableKey(key)) {
        onFocus()
        searchVal.value = key
      } else if (key === 'Enter') {
        onFocus()
      }
    })
  }
})
</script>

<template>
  <div
    class="nc-cell-field nc-multi-select h-full w-full flex items-center"
    :class="{ 'read-only': readOnly, 'max-w-full': isForm }"
    @click="toggleMenu"
  >
    <div v-if="!isEditColumn && isForm && parseProp(column.meta)?.isList" class="w-full max-w-full">
      <a-checkbox-group
        :value="vModelListLayout"
        :disabled="readOnly || !editAllowed"
        class="nc-field-layout-list"
        @click.stop
        @update:value="vModel = $event"
      >
        <a-checkbox
          v-for="op of options"
          :key="op.title"
          :value="op.title"
          class="gap-2"
          :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
          :class="`nc-select-option-${column.title}-${op.title}`"
        >
          <a-tag class="rounded-tag max-w-full" :color="op.color">
            <span
              :style="{
                color: tinycolor.isReadable(op.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                  ? '#fff'
                  : tinycolor.mostReadable(op.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
              }"
              class="text-small"
            >
              <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                <template #title>
                  {{ op.title }}
                </template>
                <span
                  class="text-ellipsis overflow-hidden"
                  :style="{
                    wordBreak: 'keep-all',
                    whiteSpace: 'nowrap',
                    display: 'inline',
                  }"
                >
                  {{ op.title }}
                </span>
              </NcTooltip>
            </span>
          </a-tag>
        </a-checkbox>
      </a-checkbox-group>
    </div>

    <a-select
      v-else
      ref="aselect"
      v-model:value="vModel"
      mode="multiple"
      class="w-full overflow-hidden"
      :bordered="false"
      clear-icon
      :show-search="!isMobileMode"
      :show-arrow="editAllowed && !readOnly && !searchVal"
      :open="isOpen && editAllowed"
      :disabled="readOnly || !editAllowed"
      :class="{ 'caret-transparent': !hasEditRoles }"
      :dropdown-class-name="`nc-dropdown-multi-select-cell !min-w-156px ${isOpen ? 'active' : ''}`"
      :search-value="searchVal ?? ''"
      @search="search"
      @keydown="onKeyDown"
      @focus="onFocus"
      @blur="isOpen = false"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-gray-700 nc-select-expand-btn" />
      </template>
      <a-select-option
        v-for="op of options"
        :key="op.id || op.title"
        :value="op.title"
        class="gap-2"
        :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
        :class="`nc-select-option-${column.title}-${op.title}`"
        @click.stop
      >
        <a-tag class="rounded-tag max-w-full" :color="op.color">
          <span
            :style="{
              color: tinycolor.isReadable(op.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                ? '#fff'
                : tinycolor.mostReadable(op.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
            }"
            :class="{ 'text-sm': isKanban, 'text-small': !isKanban }"
          >
            <NcTooltip class="truncate max-w-full" show-on-truncate-only>
              <template #title>
                {{ op.title }}
              </template>
              <span
                class="text-ellipsis overflow-hidden"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ op.title }}
              </span>
            </NcTooltip>
          </span>
        </a-tag>
      </a-select-option>

      <a-select-option
        v-if="!isMetaReadOnly && searchVal && isOptionMissing && isNewOptionCreateEnabled"
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
          :class="{
            '!my-0': !rowHeight || rowHeight === 1,
          }"
          :style="{ display: 'flex', alignItems: 'center' }"
          :color="options.find((el) => el.title === val)?.color"
          :closable="editAllowed && (vModel.length > 1 || !column?.rqd)"
          :close-icon="h(MdiCloseCircle, { class: ['ms-close-icon'] })"
          @click="onTagClick($event, onClose)"
          @close="onClose"
        >
          <span
            :style="{
              color: tinycolor.isReadable(options.find((el) => el.title === val)?.color || '#ccc', '#fff', {
                level: 'AA',
                size: 'large',
              })
                ? '#fff'
                : tinycolor
                    .mostReadable(options.find((el) => el.title === val)?.color || '#ccc', ['#0b1d05', '#fff'])
                    .toHex8String(),
            }"
            :class="{ 'text-sm': isKanban, 'text-small': !isKanban }"
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
  @apply py-[0.5px] px-2 rounded-[12px];
}

:deep(.ant-tag) {
  @apply "rounded-tag" my-[1px];
}

:deep(.ant-tag-close-icon) {
  @apply "text-slate-500";
}

:deep(.ant-select-selection-overflow-item) {
  @apply "flex overflow-hidden";
}

:deep(.ant-select-selection-overflow) {
  @apply flex-nowrap overflow-hidden max-w-[fit-content];
}

.nc-multi-select:not(.read-only) {
  :deep(.ant-select-selector),
  :deep(.ant-select-selector input) {
    @apply "!cursor-pointer";
  }
}

:deep(.ant-select-selector) {
  @apply !pl-0 flex-nowrap;
}

:deep(.ant-select-selection-search-input) {
  @apply !text-small;
}
</style>

<style lang="scss">
.ant-select-item-option-content,
.ant-select-item-option-state {
  @apply !flex !items-center;
}
</style>
