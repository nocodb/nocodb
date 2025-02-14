<script lang="ts" setup>
import type { Select as AntSelect } from 'ant-design-vue'
import { message } from 'ant-design-vue'
import type { SelectOptionType } from 'nocodb-sdk'
import { getOptions } from './utils'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
  disableOptionCreation?: boolean
  selectOptions?: (SelectOptionType & { value?: string })[]
}

const { modelValue, disableOptionCreation, selectOptions } = defineProps<Props>()

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

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)
const canvasSelectCell = inject(CanvasSelectCellInj)

const isKanban = inject(IsKanbanInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const { $api } = useNuxtApp()

const searchVal = ref()

const { isUIAllowed, isMetaReadOnly } = useRoles()

const { isPg, isMysql } = useBase()

// a variable to keep newly created option value
// temporary until it's add the option to column meta
const tempSelectedOptState = ref<string>()

const isFocusing = ref(false)

const isNewOptionCreateEnabled = computed(
  () => !isPublic.value && !disableOptionCreation && isUIAllowed('fieldEdit') && !isMetaReadOnly.value && !isForm.value,
)

const options = computed(() => {
  return selectOptions ?? getOptions(column.value, isEditColumn.value, isForm.value)
})

const optionsMap = computed(() => {
  return options.value.reduce((acc, op) => {
    if (op.value) {
      acc[op.value.trim()] = op
    }
    return acc
  }, {} as Record<string, (typeof options.value)[number]>)
})

const isOptionMissing = computed(() => {
  return searchVal.value ? !optionsMap.value[searchVal.value] : false
})

const hasEditRoles = computed(() => isUIAllowed('dataEdit') || isForm.value)

const editAllowed = computed(() => (hasEditRoles.value || isForm.value) && active.value)

const vModel = computed({
  get: () => tempSelectedOptState.value ?? modelValue,
  set: (val) => {
    if (val && isNewOptionCreateEnabled.value && (options.value ?? []).every((op) => op.title !== val)) {
      tempSelectedOptState.value = val
      return addIfMissingAndSave()
    }
    emit('update:modelValue', val || null)
  },
})

watch(isOpen, (n, _o) => {
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

async function addIfMissingAndSave() {
  if (!tempSelectedOptState.value || isPublic.value) return false

  const newOptValue = tempSelectedOptState.value
  searchVal.value = ''
  tempSelectedOptState.value = undefined

  if (newOptValue && !optionsMap.value[newOptValue]) {
    try {
      options.value.push({
        title: newOptValue,
        value: newOptValue,
        color: enumColor.light[(options.value.length + 1) % enumColor.light.length],
      })
      column.value.colOptions = { options: options.value.map(({ value: _, ...rest }) => rest) }

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

      vModel.value = newOptValue
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }
}

const search = () => {
  if (isMobileMode.value) return

  searchVal.value = aselect.value?.$el?.querySelector('.ant-select-selection-search-input')?.value
}

// prevent propagation of keydown event if select is open
const onKeydown = (e: KeyboardEvent) => {
  if (isOpen.value && active.value) {
    e.stopPropagation()
  }
  if (e.key === 'Enter') {
    e.stopPropagation()
  }

  if (e.key === 'Escape') {
    isOpen.value = false
  }
}

const handleKeyDownList = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowRight':
    case 'ArrowLeft':
      // skip
      e.stopPropagation()
      break
  }
}

const onSelect = () => {
  isOpen.value = false
  isEditable.value = false
}

const toggleMenu = (e: Event) => {
  // todo: refactor
  // check clicked element is clear icon
  if (
    (e.target as HTMLElement)?.classList.contains('ant-select-clear') ||
    (e.target as HTMLElement)?.closest('.ant-select-clear')
  ) {
    vModel.value = ''
    return e.stopPropagation()
  }

  if (isFocusing.value) return

  isOpen.value = editAllowed.value && !isOpen.value
}

const handleClose = (e: MouseEvent) => {
  if (isOpen.value && aselect.value && !aselect.value.$el.contains(e.target)) {
    isOpen.value = false
  }
}

useEventListener(document, 'click', handleClose, true)

const onFocus = () => {
  isFocusing.value = true

  setTimeout(() => {
    isFocusing.value = false
  }, 250)

  if (isSurveyForm.value && vModel.value) return

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
    class="nc-cell-field h-full w-full flex items-center nc-single-select focus:outline-transparent"
    :class="{ 'read-only': readOnly, 'max-w-full': isForm }"
    @click="toggleMenu"
    @keydown.enter.stop.prevent="toggleMenu"
  >
    <div v-if="!isEditColumn && isForm && parseProp(column.meta)?.isList" class="w-full max-w-full">
      <a-radio-group
        v-model:value="vModel"
        :disabled="readOnly || !editAllowed"
        class="nc-field-layout-list"
        @keydown="handleKeyDownList"
        @click.stop
      >
        <a-radio
          v-for="op of options"
          :key="op.title"
          :value="op.title"
          :data-testid="`select-option-${column.title}-${rowIndex}`"
          :class="`nc-select-option-${column.title}-${op.title}`"
        >
          <a-tag class="rounded-tag max-w-full" :color="op.color">
            <span
              :style="{
                color: getSelectTypeOptionTextColor(op.color),
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
        </a-radio>
      </a-radio-group>
      <div
        v-if="!readOnly && editAllowed && vModel"
        class="inline-block px-2 pt-2 cursor-pointer text-xs text-gray-500 hover:text-gray-800"
        @click="vModel = ''"
      >
        {{ $t('labels.clearSelection') }}
      </div>
    </div>

    <NcSelect
      v-else
      ref="aselect"
      v-model:value="vModel"
      class="w-full overflow-hidden"
      :class="{ 'caret-transparent': !hasEditRoles }"
      :allow-clear="!column.rqd && editAllowed"
      :bordered="false"
      :open="isOpen && editAllowed"
      :disabled="readOnly || !editAllowed"
      :show-search="!isMobileMode && isOpen && active"
      :show-arrow="hasEditRoles && !readOnly && active && (vModel === null || vModel === undefined) && !searchVal"
      :dropdown-class-name="`nc-dropdown-single-select-cell !min-w-156px ${isOpen && active ? 'active' : ''}`"
      :dropdown-match-select-width="true"
      :search-value="searchVal ?? ''"
      @select="onSelect"
      @keydown="onKeydown($event)"
      @search="search"
      @blur="isOpen = false"
      @focus="onFocus"
    >
      <a-select-option
        v-for="op of options"
        :key="op.title"
        :value="op.title"
        class="gap-2"
        :data-testid="`select-option-${column.title}-${rowIndex}`"
        :class="`nc-select-option-${column.title}-${op.title}`"
        @click.stop
      >
        <a-tag class="rounded-tag max-w-full" :color="op.color">
          <span
            :style="{
              color: getSelectTypeOptionTextColor(op.color),
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
      <a-select-option v-if="searchVal && isOptionMissing && isNewOptionCreateEnabled" :key="searchVal" :value="searchVal">
        <div class="flex gap-2 text-gray-500 items-center h-full">
          <component :is="iconMap.plusThick" class="min-w-4" />
          <div class="text-xs whitespace-normal">
            {{ $t('msg.selectOption.createNewOptionNamed') }} <strong>{{ searchVal }}</strong>
          </div>
        </div>
      </a-select-option>
    </NcSelect>
  </div>
</template>

<style scoped lang="scss">
.rounded-tag {
  @apply py-[1px] px-2 rounded-[12px];
}

:deep(.ant-tag) {
  @apply "rounded-tag";
}

:deep(.ant-select-clear) {
  opacity: 1;
  border-radius: 100%;
}

.nc-single-select:not(.read-only) {
  :deep(.ant-select-selector),
  :deep(.ant-select-selector input) {
    @apply !cursor-pointer;
  }
}

:deep(.ant-select-selector) {
  @apply !pl-0 !pr-4;
}

:deep(.ant-select-selector .ant-select-selection-item) {
  @apply flex items-center;
  text-overflow: clip;
}

:deep(.ant-select-selection-search) {
  @apply flex items-center;

  .ant-select-selection-search-input {
    @apply !text-small;
  }
}

:deep(.ant-select-clear > span) {
  @apply block;
}
</style>

<style lang="scss">
.ant-select-item-option-content {
  @apply !flex !items-center;
}
</style>
