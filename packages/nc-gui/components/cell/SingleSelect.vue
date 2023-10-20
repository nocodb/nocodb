<script lang="ts" setup>
import { onUnmounted } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditColumnInj,
  EditModeInj,
  IsFormInj,
  IsKanbanInj,
  ReadonlyInj,
  computed,
  enumColor,
  extractSdkResponseErrorMsg,
  iconMap,
  inject,
  isDrawerOrModalExist,
  ref,
  useBase,
  useEventListener,
  useRoles,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
  disableOptionCreation?: boolean
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

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const { $api } = useNuxtApp()

const searchVal = ref()

const { getMeta } = useMetas()

const { isUIAllowed } = useRoles()

const { isPg, isMysql } = useBase()

// a variable to keep newly created option value
// temporary until it's add the option to column meta
const tempSelectedOptState = ref<string>()

const isNewOptionCreateEnabled = computed(() => !isPublic.value && !disableOptionCreation && isUIAllowed('fieldEdit'))

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

const hasEditRoles = computed(() => isUIAllowed('dataEdit'))

const editAllowed = computed(() => (hasEditRoles.value || isForm.value) && active.value)

const vModel = computed({
  get: () => tempSelectedOptState.value ?? modelValue?.trim(),
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

async function addIfMissingAndSave() {
  if (!tempSelectedOptState.value || isPublic.value) return false

  const newOptValue = tempSelectedOptState.value
  searchVal.value = ''
  tempSelectedOptState.value = undefined

  if (newOptValue && !options.value.some((o) => o.title === newOptValue)) {
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

      await $api.dbTableColumn.update(
        (column.value as { fk_column_id?: string })?.fk_column_id || (column.value?.id as string),
        updatedColMeta,
      )
      vModel.value = newOptValue
      await getMeta(column.value.fk_model_id!, true)
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
}

const onSelect = () => {
  isOpen.value = false
  isEditable.value = false
}

const cellClickHook = inject(CellClickHookInj, null)

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
  if (isOpen.value && aselect.value && !aselect.value.$el.contains(e.target)) {
    isOpen.value = false
  }
}

useEventListener(document, 'click', handleClose, true)

const selectedOpt = computed(() => {
  return options.value.find((o) => o.value === vModel.value)
})
</script>

<template>
  <div
    class="h-full w-full flex items-center nc-single-select"
    :class="{ 'read-only': readOnly || isLockedMode }"
    @click="toggleMenu"
  >
    <div v-if="!(active || isEditable)">
      <a-tag v-if="selectedOpt" class="rounded-tag" :color="selectedOpt.color">
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
    </div>

    <a-select
      v-else
      ref="aselect"
      v-model:value="vModel"
      class="w-full overflow-hidden xs:min-h-12"
      :class="{ 'caret-transparent': !hasEditRoles }"
      :placeholder="isEditColumn ? $t('labels.optional') : ''"
      :allow-clear="!column.rqd && editAllowed"
      :bordered="false"
      :open="isOpen && editAllowed"
      :disabled="readOnly || !editAllowed || isLockedMode"
      :show-arrow="hasEditRoles && !(readOnly || isLockedMode) && active && vModel === null"
      :dropdown-class-name="`nc-dropdown-single-select-cell ${isOpen && active ? 'active' : ''}`"
      :show-search="!isMobileMode && isOpen && active"
      @select="onSelect"
      @keydown="onKeydown($event)"
      @search="search"
    >
      <a-select-option
        v-for="op of options"
        :key="op.title"
        :value="op.title"
        :data-testid="`select-option-${column.title}-${rowIndex}`"
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
      <a-select-option v-if="searchVal && isOptionMissing && isNewOptionCreateEnabled" :key="searchVal" :value="searchVal">
        <div class="flex gap-2 text-gray-500 items-center h-full">
          <component :is="iconMap.plusThick" class="min-w-4" />
          <div class="text-xs whitespace-normal">
            {{ $t('msg.selectOption.createNewOptionNamed') }} <strong>{{ searchVal }}</strong>
          </div>
        </div>
      </a-select-option>
    </a-select>
  </div>
</template>

<style scoped lang="scss">
.rounded-tag {
  @apply py-0 px-[12px] rounded-[12px];
}

:deep(.ant-tag) {
  @apply "rounded-tag" my-[2px];
}

:deep(.ant-select-clear) {
  opacity: 1;
}

.nc-single-select:not(.read-only) {
  :deep(.ant-select-selector),
  :deep(.ant-select-selector input) {
    @apply !cursor-pointer;
  }
}

:deep(.ant-select-selector) {
  @apply !px-0;
}

:deep(.ant-select-selection-search-input) {
  @apply !text-xs;
}

:deep(.ant-select-clear > span) {
  @apply block;
}
</style>
