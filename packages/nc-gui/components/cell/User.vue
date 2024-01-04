<script lang="ts" setup>
import { onUnmounted } from '@vue/runtime-core'
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { UserFieldRecordType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditColumnInj,
  EditModeInj,
  IsExpandedFormOpenInj,
  IsKanbanInj,
  ReadonlyInj,
  RowHeightInj,
  computed,
  h,
  inject,
  isDrawerOrModalExist,
  onMounted,
  ref,
  useEventListener,
  useRoles,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'
import MdiCloseCircle from '~icons/mdi/close-circle'

interface Props {
  modelValue?: UserFieldRecordType[] | string | null
  rowIndex?: number
  location?: 'cell' | 'filter'
  forceMulti?: boolean
}

const { modelValue, forceMulti } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMobileMode } = useGlobal()

const meta = inject(MetaInj)!

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const isEditable = inject(EditModeInj, ref(false))

const activeCell = inject(ActiveCellInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

// use both ActiveCellInj or EditModeInj to determine the active state
// since active will be false in case of form view
const active = computed(() => activeCell.value || isEditable.value)

const isForm = inject(IsFormInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isMultiple = computed(() => forceMulti || (column.value.meta as { is_multi: boolean; notify: boolean })?.is_multi)

const rowHeight = inject(RowHeightInj, ref(undefined))

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const searchVal = ref<string | null>()

const { isUIAllowed } = useRoles()

const options = computed<UserFieldRecordType[]>(() => {
  const collaborators: UserFieldRecordType[] = []

  collaborators.push(
    ...(baseUsers.value?.map((user: any) => ({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      deleted: user.deleted,
    })) || []),
  )
  return collaborators
})

const hasEditRoles = computed(() => isUIAllowed('dataEdit'))

const editAllowed = computed(() => (hasEditRoles.value || isForm.value) && active.value)

const vModel = computed({
  get: () => {
    let selected: { label: string; value: string }[] = []
    if (typeof modelValue === 'string') {
      const idsOrMails = modelValue.split(',').map((idOrMail) => idOrMail.trim())
      selected = idsOrMails.reduce((acc, idOrMail) => {
        const user = options.value.find((u) => u.id === idOrMail || u.email === idOrMail)
        if (user) {
          acc.push({
            label: user?.display_name || user?.email,
            value: user.id,
          })
        }
        return acc
      }, [] as { label: string; value: string }[])
    } else {
      selected =
        modelValue?.reduce((acc, item) => {
          const label = item?.display_name || item?.email
          if (label) {
            acc.push({
              label,
              value: item.id,
            })
          }
          return acc
        }, [] as { label: string; value: string }[]) || []
    }

    return selected
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
</script>

<template>
  <div
    class="nc-user-select h-full w-full flex items-center"
    :class="{ 'read-only': readOnly, 'px-2': isExpandedFormOpen }"
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
      <template v-for="selectedOpt of vModel" :key="selectedOpt.value">
        <a-tag class="rounded-tag max-w-full" color="'#ccc'">
          <span
            :style="{
              'color': tinycolor.isReadable('#ccc' || '#ccc', '#fff', { level: 'AA', size: 'large' })
                ? '#fff'
                : tinycolor.mostReadable('#ccc' || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
              'font-size': '13px',
            }"
            :class="{ 'text-sm': isKanban }"
          >
            <NcTooltip class="truncate max-w-full" show-on-truncate-only>
              <template #title>
                {{ selectedOpt.label }}
              </template>
              <span
                class="text-ellipsis overflow-hidden"
                :style="{
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                  display: 'inline',
                }"
              >
                {{ selectedOpt.label }}
              </span>
            </NcTooltip>
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
      :show-arrow="editAllowed && !readOnly"
      :open="isOpen && editAllowed"
      :disabled="readOnly || !editAllowed"
      :class="{ 'caret-transparent': !hasEditRoles }"
      :dropdown-class-name="`nc-dropdown-user-select-cell !min-w-200px ${isOpen ? 'active' : ''}`"
      :filter-option="filterOption"
      @search="search"
      @keydown.stop
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
          <a-tag class="rounded-tag max-w-full !pl-0" color="'#ccc'">
            <span
              :style="{
                'color': tinycolor.isReadable('#ccc' || '#ccc', '#fff', { level: 'AA', size: 'large' })
                  ? '#fff'
                  : tinycolor.mostReadable('#ccc' || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                'font-size': '13px',
              }"
              class="flex items-center gap-2"
              :class="{ 'text-sm': isKanban }"
            >
              <GeneralUserIcon size="medium" :email="op.email" />
              <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                <template #title>
                  {{ op.display_name?.length ? op.display_name : op.email }}
                </template>
                <span
                  class="text-ellipsis overflow-hidden"
                  :style="{
                    wordBreak: 'keep-all',
                    whiteSpace: 'nowrap',
                    display: 'inline',
                  }"
                >
                  {{ op.display_name?.length ? op.display_name : op.email }}
                </span>
              </NcTooltip>
            </span>
          </a-tag>
        </a-select-option>
      </template>

      <template #tagRender="{ label, value: val, onClose }">
        <a-tag
          v-if="options.find((el) => el.id === val)"
          class="rounded-tag nc-selected-option"
          :style="{ display: 'flex', alignItems: 'center' }"
          color="'#ccc'"
          :closable="editAllowed && ((vModel?.length ?? 0) > 1 || !column?.rqd)"
          :close-icon="h(MdiCloseCircle, { class: ['ms-close-icon'] })"
          @click="onTagClick($event, onClose)"
          @close="onClose"
        >
          <span
            :style="{
              'color': tinycolor.isReadable('#ccc' || '#ccc', '#fff', {
                level: 'AA',
                size: 'large',
              })
                ? '#fff'
                : tinycolor.mostReadable('#ccc' || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
              'font-size': '13px',
            }"
            :class="{ 'text-sm': isKanban }"
          >
            {{ label }}
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
  @apply bg-gray-200 py-0 px-[12px] rounded-[12px];
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

.nc-user-select:not(.read-only) {
  :deep(.ant-select-selector),
  :deep(.ant-select-selector input) {
    @apply "!cursor-pointer";
  }
}

:deep(.ant-select-selector) {
  @apply !pl-0;
}

:deep(.ant-select-selection-search-input) {
  @apply !text-xs;
}
</style>
