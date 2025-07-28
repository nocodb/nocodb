<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import { Checkbox, CheckboxGroup, Radio, RadioGroup } from 'ant-design-vue'
import type { Select as AntSelect } from 'ant-design-vue'
import { CURRENT_USER_TOKEN, type UserFieldRecordType } from 'nocodb-sdk'
import { getOptions, getSelectedUsers } from './utils'
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  modelValue?: UserFieldRecordType[] | UserFieldRecordType | string | null
  rowIndex?: number
  location?: 'cell' | 'filter'
  forceMulti?: boolean
  options?: UserFieldRecordType[]
}

const { modelValue, forceMulti, options: userOptions, location } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMobileMode } = useGlobal()

const { t } = useI18n()

const meta = inject(MetaInj)!

const isInFilter = inject(IsInFilterInj, ref(false))

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

const canvasSelectCell = inject(CanvasSelectCellInj, null)

const searchVal = ref<string | null>()

const { isUIAllowed } = useRoles()

const { showUpgradeToUseCurrentUserFilter } = useEeConfig()

const isFormListView = computed(() => !isEditColumn.value && isForm.value && parseProp(column.value.meta)?.isList)

const options = computed(() => {
  const currentUserField: any[] = []
  if (isEeUI && isInFilter.value) {
    currentUserField.push({
      id: CURRENT_USER_TOKEN,
      display_name: t('title.currentUser'),
      email: CURRENT_USER_TOKEN,
    })
  }
  return [...currentUserField, ...(userOptions ?? getOptions(column.value, false, isForm.value, baseUsers.value))]
})

const nonDeletedOptions = computed(() => {
  return options.value.filter((op) => !op.deleted)
})

const filteredOptions = computed(() => {
  return nonDeletedOptions.value.filter((op) => {
    return searchVal.value ? searchCompare([op.display_name, op.email], searchVal.value) : true
  })
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
    // @ts-expect-error antd select returns string[] instead of { label: string, value: string }[]
    if (isEeUI && val.includes(CURRENT_USER_TOKEN) && showUpgradeToUseCurrentUserFilter()) return

    // Clear search query after selection is made
    searchVal.value = ''

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
  // If it is form list view then we don't need to do anything here
  if (isFormListView.value) return

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

// search with email or display_name
const filterOption = (input: string, option: any): boolean => {
  const opt = options.value.find((o) => o.id === option.value)
  if (!opt) return false

  return searchCompare([opt.display_name, opt.email], input)
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

  if (isSurveyForm.value && vModel.value?.length) return

  isOpen.value = true
}
const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const isGrid = inject(IsGridInj, ref(false))
const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const canvasCellEventData = inject(CanvasCellEventDataInj, reactive<CanvasCellEventDataInjType>({}))
onMounted(() => {
  if (isGrid.value && isCanvasInjected && !isExpandedForm.value && !isEditColumn.value && !isUnderLookup.value) {
    forcedNextTick(() => {
      onFocus()
      const key = canvasCellEventData.keyboardKey
      if (key && isSinglePrintableKey(key)) {
        searchVal.value = key
      }
    })
  }
})
</script>

<template>
  <div
    class="nc-cell-field nc-user-select h-full w-full flex items-center"
    :class="{ 'read-only': readOnly }"
    @click="toggleMenu"
  >
    <div v-if="isFormListView" class="w-full max-w-full">
      <div class="rounded-lg border-1 border-nc-border-gray-medium w-full max-w-full">
        <div v-if="nonDeletedOptions.length > 6" class="border-b-1 border-nc-border-gray-medium pl-1 group" @click.stop>
          <a-input
            ref="inputRef"
            v-model:value="searchVal"
            :placeholder="$t('general.search')"
            class="nc-user-select-search-field-input !pl-2 !pr-1.5 flex-1 !py-2"
            allow-clear
            autocomplete="off"
            :bordered="false"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="nc-search-icon text-nc-content-gray-muted opacity-50 h-4 w-4 mr-1.5" /> </template
          ></a-input>
        </div>
        <div class="w-full max-w-full max-h-[328px] nc-scrollbar-thin p-1">
          <component
            :is="isMultiple ? CheckboxGroup : RadioGroup"
            :value="vModelListLayout"
            :disabled="readOnly || !editAllowed"
            class="nc-field-layout-list nc-user-select-list"
            @update:value="
              (value) => {
                vModel = isMultiple ? value : [value]
              }
            "
          >
            <!-- If we have not rendered all options then update value will not work properly so we have to use display: hidden on option which is not visible -->
            <template v-for="op of options" :key="op.id || op.email">
              <component
                :is="isMultiple ? Checkbox : Radio"
                v-if="!op.deleted"
                :key="op.id || op.email"
                :value="op.id"
                :data-testid="`select-option-${column.title}-${location === 'filter' ? 'filter' : rowIndex}`"
                :class="[
                  `nc-select-option-${column.title}-${op.email}`,
                  {
                    '!hidden nc-hidden-option': !searchCompare([op.display_name, op.email], searchVal ?? ''),
                  },
                ]"
              >
                <div class="w-full flex gap-2 items-center py-1.5">
                  <GeneralUserIcon :user="op" size="base" class="flex-none" :disabled="!isCollaborator(op.id || op.email)" />

                  <div class="flex flex-col w-[calc(100%_-_40px)]">
                    <div class="w-full flex gap-3">
                      <NcTooltip
                        class="text-bodyDefaultSmBold !leading-5 capitalize truncate max-w-full text-gray-800"
                        :class="{
                          '!text-gray-500': !isCollaborator(op.id || op.email),
                        }"
                        show-on-truncate-only
                        placement="bottom"
                      >
                        <template #title>
                          {{ op.display_name?.trim() || extractNameFromEmail(op.email) }}
                        </template>
                        {{ op.display_name?.trim() || extractNameFromEmail(op.email) }}
                      </NcTooltip>
                    </div>
                    <NcTooltip
                      class="text-xs !leading-4 text-nc-content-gray-muted truncate max-w-full"
                      show-on-truncate-only
                      placement="bottom"
                    >
                      <template #title>
                        {{ op.email === CURRENT_USER_TOKEN ? $t('title.filteredByLoggedInUser') : op.email }}
                      </template>

                      {{ op.email === CURRENT_USER_TOKEN ? $t('title.filteredByLoggedInUser') : op.email }}
                    </NcTooltip>
                  </div>
                </div>
              </component>
            </template>
          </component>

          <div
            v-if="nonDeletedOptions.length && searchVal && !filteredOptions.length"
            class="h-full text-center flex items-center justify-center gap-3 mt-4"
          >
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
          </div>
        </div>
      </div>
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
      :dropdown-class-name="`nc-dropdown-user-select-cell !min-w-256px ${isInFilter ? '!min-w-256px' : '!min-w-180px'}  ${
        isOpen ? 'active' : ''
      }`"
      :filter-option="filterOption"
      :search-value="searchVal ?? ''"
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
          :class="[
            `nc-select-option-${column.title}-${op.email}`,
            {
              'nc-select-option-current-user mb-2': op.email === CURRENT_USER_TOKEN,
            },
          ]"
          @click.stop
        >
          <div
            v-if="op.email === CURRENT_USER_TOKEN"
            class="absolute -bottom-1 w-[calc(100%_+_16px)] border-b-1 border-nc-border-gray-medium -ml-4"
          ></div>
          <div class="w-full flex gap-2 items-center">
            <GeneralUserIcon :user="op" size="base" class="flex-none" :show-placeholder-icon="op.email === CURRENT_USER_TOKEN" />

            <div
              class="flex flex-col"
              :class="{
                'w-[calc(100%_-_32px)]': !vModel.find((i) => i.email === op.email),
                'w-[calc(100%_-_68px)]': !!vModel.find((i) => i.email === op.email),
              }"
            >
              <div class="w-full flex gap-3">
                <NcTooltip
                  class="text-bodyDefaultSmBold !leading-5 capitalize truncate max-w-full"
                  :class="{
                    'text-nc-content-brand': op.email === CURRENT_USER_TOKEN,
                    'text-gray-800': op.email !== CURRENT_USER_TOKEN,
                  }"
                  show-on-truncate-only
                  placement="bottom"
                >
                  <template #title>
                    {{ op.display_name?.trim() || extractNameFromEmail(op.email) }}
                  </template>
                  {{ op.display_name?.trim() || extractNameFromEmail(op.email) }}
                </NcTooltip>
              </div>
              <NcTooltip
                class="text-xs !leading-4 text-nc-content-gray-muted truncate max-w-full"
                show-on-truncate-only
                placement="bottom"
              >
                <template #title>
                  {{ op.email === CURRENT_USER_TOKEN ? $t('title.filteredByLoggedInUser') : op.email }}
                </template>

                {{ op.email === CURRENT_USER_TOKEN ? $t('title.filteredByLoggedInUser') : op.email }}
              </NcTooltip>
            </div>
            <GeneralIcon
              v-if="!!vModel.find((i) => i.email === op.email)"
              id="nc-selected-item-icon"
              icon="check"
              class="flex-none text-primary w-4 h-4"
            />
          </div>
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
          :color="val === CURRENT_USER_TOKEN ? themeV4Colors.brand[50] : location === 'filter' ? themeV4Colors.gray[200] : '#ccc'"
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
                class="!text-[0.5rem] !h-[16.8px]"
                :class="{
                  '!bg-white': val === CURRENT_USER_TOKEN,
                }"
                :disabled="!isCollaborator(val)"
                :show-placeholder-icon="val === CURRENT_USER_TOKEN"
              />
            </div>
            <span
              :class="{
                'text-gray-600': !isCollaborator(val) && val !== CURRENT_USER_TOKEN,
                'text-nc-content-brand': val === CURRENT_USER_TOKEN,
                'font-600': isInFilter,
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

:deep(.nc-select-option-current-user) {
  @apply relative;
}
</style>

<style lang="scss">
.ant-select-dropdown.nc-dropdown-user-select-cell {
  .ant-select-item-option-content {
    @apply w-full;
  }

  .ant-select-item-option-state {
    @apply !hidden;
  }
}
</style>
