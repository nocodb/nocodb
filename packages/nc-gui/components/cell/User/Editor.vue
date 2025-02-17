<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import { Checkbox, CheckboxGroup, Radio, RadioGroup } from 'ant-design-vue'
import type { Select as AntSelect } from 'ant-design-vue'
import type { UserFieldRecordType } from 'nocodb-sdk'
import { getOptions, getSelectedUsers } from './utils'
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  modelValue?: UserFieldRecordType[] | UserFieldRecordType | string | null
  rowIndex?: number
  location?: 'cell' | 'filter'
  forceMulti?: boolean
  options?: UserFieldRecordType[]
}

const { modelValue, forceMulti, options: userOptions } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMobileMode } = useGlobal()

const meta = inject(MetaInj)!

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const isEditable = inject(EditModeInj, ref(false))

const activeCell = inject(ActiveCellInj, ref(false))

const basesStore = useBases()

const baseStore = useBase()

const { basesUser } = storeToRefs(basesStore)

const { idUserMap } = storeToRefs(baseStore)

const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

// use both ActiveCellInj or EditModeInj to determine the active state
// since active will be false in case of form view
const active = computed(() => activeCell.value || isEditable.value)

const isForm = inject(IsFormInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isMultiple = computed(() => forceMulti || (column.value.meta as { is_multi: boolean; notify: boolean })?.is_multi)

const rowHeight = inject(RowHeightInj, ref(undefined))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isFocusing = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const canvasSelectCell = inject(CanvasSelectCellInj)

const searchVal = ref<string | null>()

const { isUIAllowed } = useRoles()

const options = computed(() => {
  return userOptions ?? getOptions(column.value, false, isForm.value, baseUsers.value)
})

const optionsMap = computed(() => {
  return options.value.reduce((acc, op) => {
    if (op.id) {
      acc[op.id] = op
    }
    if (op.email) {
      acc[op.email.trim()] = op
    }
    return acc
  }, {} as Record<string, (typeof options.value)[number]>)
})

const hasEditRoles = computed(() => isUIAllowed('dataEdit'))

const editAllowed = computed(() => (hasEditRoles.value || isForm.value) && active.value)

const vModel = computed({
  get: () => {
    return getSelectedUsers(optionsMap.value, modelValue)
  },
  set: (val) => {
    const value: string[] = []
    if (val && val.length) {
      val.forEach((item) => {
        // @ts-expect-error antd select returns string[] instead of { label: string, value: string }[]
        const user = options.value.find((u) => u.id === item)
        if (user) {
          value.push(user.id)
        }
      })
    }
    if (isMultiple.value) {
      emit('update:modelValue', val?.length ? value.join(',') : null)
    } else {
      emit('update:modelValue', val?.length ? value[value.length - 1] : null)
      isOpen.value = false
    }
  },
})

const vModelListLayout = computed(() => {
  if (isMultiple.value) {
    return (vModel.value || []).map((item) => item.value)
  } else {
    return (vModel.value || [])?.[0]?.value || ''
  }
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

// set isOpen to false when active cell is changed
watch(active, (n, _o) => {
  if (!n) isOpen.value = false
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
          e.stopPropagation()
          toggleMenu()
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
    if (e.key === 'Escape') {
      isOpen.value = false
      canvasSelectCell?.trigger()
    }
  },
  {
    isGridCell: false,
    immediate: true,
  },
)

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

function toggleMenu() {
  if (isFocusing.value) return

  isOpen.value = editAllowed.value && !isOpen.value
}

const handleClose = (e: MouseEvent) => {
  // close dropdown if clicked outside of dropdown
  if (
    isOpen.value &&
    aselect.value &&
    !aselect.value.$el.contains(e.target) &&
    !document.querySelector('.nc-dropdown-user-select-cell.active')?.contains(e.target as Node)
  ) {
    // loose focus when clicked outside
    isEditable.value = false
    isOpen.value = false
  }
}

useEventListener(document, 'click', handleClose, true)

// search with email
const filterOption = (input: string, option: any) => {
  const opt = options.value.find((o) => o.id === option.value)
  const searchVal = opt?.display_name || opt?.email
  if (searchVal) {
    return searchVal.toLowerCase().includes(input.toLowerCase())
  }
}

// check if user is part of the base
const isCollaborator = (userIdOrEmail) => {
  return !idUserMap.value?.[userIdOrEmail]?.deleted
}

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

  if (isSurveyForm.value && vModel.value) return

  isOpen.value = true
}
const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isGrid = inject(IsGridInj, ref(false))
const isUnderLookup = inject(IsUnderLookupInj, ref(false))

onMounted(() => {
  if (isGrid.value && isCanvasInjected && !isExpandedForm.value && !isEditColumn.value && !isUnderLookup.value) {
    isOpen.value = true
  }
})
</script>

<template>
  <div
    class="nc-cell-field nc-user-select h-full w-full flex items-center"
    :class="{ 'read-only': readOnly }"
    @click="toggleMenu"
  >
    <div v-if="!isEditColumn && isForm && parseProp(column.meta)?.isList" class="w-full max-w-full">
      <component
        :is="isMultiple ? CheckboxGroup : RadioGroup"
        :value="vModelListLayout"
        :disabled="readOnly || !editAllowed"
        class="nc-field-layout-list"
        @update:value="
          (value) => {
            vModel = isMultiple ? value : [value]
          }
        "
      >
        <template v-for="op of options" :key="op.id || op.email">
          <component
            :is="isMultiple ? Checkbox : Radio"
            v-if="!op.deleted"
            :key="op.id || op.email"
            :value="op.id"
            :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
            :class="`nc-select-option-${column.title}-${op.email}`"
          >
            <a-tag class="rounded-tag max-w-full !pl-0" color="'#ccc'">
              <span
                :style="{
                  color: tinycolor.isReadable('#ccc' || '#ccc', '#fff', { level: 'AA', size: 'large' })
                    ? '#fff'
                    : tinycolor.mostReadable('#ccc' || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                }"
                class="flex items-stretch gap-2 text-small"
              >
                <div>
                  <GeneralUserIcon
                    size="auto"
                    :user="op"
                    class="!text-[0.65rem] !h-[16.8px]"
                    :disabled="!isCollaborator(op.id)"
                  />
                </div>
                <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                  <template #title>
                    {{ op.display_name?.trim() || op.email }}
                  </template>
                  <span
                    class="text-ellipsis overflow-hidden"
                    :style="{
                      wordBreak: 'keep-all',
                      whiteSpace: 'nowrap',
                      display: 'inline',
                    }"
                    :class="{
                      'text-gray-600': !isCollaborator(op.id || op.email),
                    }"
                  >
                    {{ op.display_name?.trim() || op.email }}
                  </span>
                </NcTooltip>
              </span>
            </a-tag>
          </component>
        </template>
      </component>
      <div
        v-if="!readOnly && !isMultiple && vModel.length"
        class="inline-block px-2 pt-2 cursor-pointer text-xs text-gray-500 hover:text-gray-800"
        @click="vModel = []"
      >
        {{ $t('labels.clearSelection') }}
      </div>
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
      :show-arrow="editAllowed && !readOnly"
      :open="isOpen && editAllowed"
      :disabled="readOnly || !editAllowed"
      :class="{ 'caret-transparent': !hasEditRoles }"
      :dropdown-class-name="`nc-dropdown-user-select-cell !min-w-156px ${isOpen ? 'active' : ''}`"
      :filter-option="filterOption"
      @search="search"
      @focus="onFocus"
      @blur="isOpen = false"
      @keydown="onKeyDown"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-gray-700 nc-select-expand-btn" />
      </template>
      <template v-for="op of options" :key="op.id || op.email">
        <a-select-option
          v-if="!op.deleted"
          :value="op.id"
          :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
          :class="`nc-select-option-${column.title}-${op.email}`"
          @click.stop
        >
          <a-tag
            class="rounded-tag max-w-full !pl-0"
            :class="{
              '!my-0': !rowHeight || rowHeight === 1,
            }"
            color="'#ccc'"
          >
            <span
              :style="{
                color: tinycolor.isReadable('#ccc' || '#ccc', '#fff', { level: 'AA', size: 'large' })
                  ? '#fff'
                  : tinycolor.mostReadable('#ccc' || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
              }"
              class="flex items-stretch gap-2"
              :class="{ 'text-sm': isKanban, 'text-small': !isKanban }"
            >
              <div>
                <GeneralUserIcon size="auto" :user="op" class="!text-[0.65rem] !h-[16.8px]" />
              </div>
              <NcTooltip class="truncate max-w-full" show-on-truncate-only placement="right">
                <template #title>
                  {{ op.display_name?.trim() || op.email }}
                </template>
                <span
                  class="text-ellipsis overflow-hidden"
                  :style="{
                    wordBreak: 'keep-all',
                    whiteSpace: 'nowrap',
                    display: 'inline',
                  }"
                >
                  {{ op.display_name?.trim() || op.email }}
                </span>
              </NcTooltip>
            </span>
          </a-tag>
        </a-select-option>
      </template>

      <template #tagRender="{ label, value: val, onClose }">
        <a-tag
          v-if="options.find((el) => el.id === val)"
          class="rounded-tag nc-selected-option !pl-0"
          :class="{
            '!my-0': !rowHeight || rowHeight === 1,
          }"
          :style="{ display: 'flex', alignItems: 'center' }"
          color="'#ccc'"
          :closable="editAllowed && ((vModel?.length ?? 0) > 1 || !column?.rqd)"
          :close-icon="h(MdiCloseCircle, { class: ['ms-close-icon'] })"
          @click="onTagClick($event, onClose)"
          @close="onClose"
        >
          <span
            :style="{
              color: tinycolor.isReadable('#ccc' || '#ccc', '#fff', {
                level: 'AA',
                size: 'large',
              })
                ? '#fff'
                : tinycolor.mostReadable('#ccc' || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
            }"
            class="flex items-stretch gap-2"
            :class="{ 'text-sm': isKanban, 'text-small': !isKanban }"
          >
            <div>
              <GeneralUserIcon
                size="auto"
                :user="{
                  display_name: !label?.includes('@') ? label.trim() : '',
                  email: label,
                  meta: options.find((el) => el.id === val)?.meta,
                }"
                class="!text-[0.65rem] !h-[16.8px]"
                :disabled="!isCollaborator(val)"
              />
            </div>
            <span
              :class="{
                'text-gray-600': !isCollaborator(val),
              }"
            >
              {{ label }}
            </span>
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
  @apply bg-gray-200 px-2 rounded-[12px];
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

.nc-user-select:not(.read-only) {
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

:deep(.nc-user-avatar) {
  @apply min-h-4.2;
}
</style>
