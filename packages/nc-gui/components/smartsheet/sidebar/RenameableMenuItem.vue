<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import type { KanbanType, ViewType, ViewTypes } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { Tooltip } from 'ant-design-vue'
import {
  IsLockedInj,
  iconMap,
  inject,
  message,
  onKeyStroke,
  useDebounceFn,
  useNuxtApp,
  useUIPermission,
  useVModel,
} from '#imports'

interface Props {
  view: ViewType
  onValidate: (view: ViewType) => boolean | string
  disabled: boolean
}

interface Emits {
  (event: 'update:view', data: Record<string, any>): void

  (event: 'selectIcon', icon: string): void

  (event: 'changeView', view: Record<string, any>): void

  (event: 'rename', view: ViewType, title: string | undefined): void

  (event: 'delete', view: ViewType): void

  (event: 'openModal', data: { type: ViewTypes; title?: string; copyViewId?: string; groupingFieldColumnId?: string }): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'view', emits) as WritableComputedRef<ViewType & { alias?: string; is_default: boolean }>

const { $e } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const _isEditing = ref(false)
/** Is editing the view name enabled */
const isEditing = computed({
  get: () => !props.disabled && _isEditing.value,
  set: (value) => {
    if (props.disabled) return

    _isEditing.value = value
  },
})

/** Helper to check if editing was disabled before the view navigation timeout triggers */
let isStopped = $ref(false)

/** Original view title when editing the view name */
let _title = $ref<string | undefined>()

/** Debounce click handler, so we can potentially enable editing view name {@see onDblClick} */
const onClick = useDebounceFn(() => {
  if (isEditing.value || isStopped) return

  emits('changeView', vModel.value)
}, 250)

/** Enable editing view name on dbl click */
function onDblClick() {
  if (!isUIAllowed('virtualViewsCreateOrEdit')) return
  if (props.disabled) return

  if (!isEditing.value) {
    isEditing.value = true
    _title = vModel.value.title
    $e('c:view:rename', { view: vModel.value?.type })
  }
}

/** Handle keydown on input field */
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    onKeyEsc(event)
  } else if (event.key === 'Enter') {
    onKeyEnter(event)
  }
}

/** Rename view when enter is pressed */
function onKeyEnter(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onRename()
}

/** Disable renaming view when escape is pressed */
function onKeyEsc(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onCancel()
}

onKeyStroke('Enter', (event) => {
  if (isEditing.value) {
    onKeyEnter(event)
  }
})

const focusInput: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

/** Duplicate a view */
// todo: This is not really a duplication, maybe we need to implement a true duplication?
function onDuplicate() {
  emits('openModal', {
    type: vModel.value.type!,
    title: vModel.value.title,
    copyViewId: vModel.value.id,
    groupingFieldColumnId: (vModel.value.view as KanbanType).fk_grp_col_id!,
  })

  $e('c:view:copy', { view: vModel.value.type })
}

/** Delete a view */
async function onDelete() {
  emits('delete', vModel.value)
}

/** Rename a view */
async function onRename() {
  if (!isEditing.value) return

  const isValid = props.onValidate(vModel.value)

  if (isValid !== true) {
    message.error(isValid)

    onCancel()
    return
  }

  if (vModel.value.title === '' || vModel.value.title === _title) {
    onCancel()
    return
  }

  vModel.value.title = _title || ''

  emits('rename', vModel.value, vModel.value.title)

  onStopEdit()
}

/** Cancel renaming view */
function onCancel() {
  if (!isEditing.value) return

  // vModel.value.title = _title || ''
  onStopEdit()
}

/** Stop editing view name, timeout makes sure that view navigation (click trigger) does not pick up before stop is done */
function onStopEdit() {
  isStopped = true
  isEditing.value = false
  _title = ''

  setTimeout(() => {
    isStopped = false
  }, 250)
}
</script>

<template>
  <a-menu-item
    class="!min-h-8 !max-h-8 !mb-0.25 select-none group text-gray-700 !flex !items-center !mt-0 hover:(!bg-gray-100 !text-gray-900)"
    :data-testid="`view-sidebar-view-${vModel.alias || vModel.title}`"
    @dblclick.stop="onDblClick"
    @click="onClick"
  >
    <div v-e="['a:view:open', { view: vModel.type }]" class="text-xs flex items-center w-full gap-1" data-testid="view-item">
      <div class="flex min-w-6" :data-testid="`view-sidebar-drag-handle-${vModel.alias || vModel.title}`">
        <LazyGeneralEmojiPicker
          class="nc-table-icon"
          :emoji="props.view?.meta?.icon"
          size="small"
          :clearable="true"
          @emoji-selected="emits('selectIcon', $event)"
        >
          <template #default>
            <GeneralViewIcon :meta="props.view" class="nc-view-icon !w-4"></GeneralViewIcon>
          </template>
        </LazyGeneralEmojiPicker>
      </div>

      <a-input
        v-if="isEditing && !props.disabled"
        :ref="focusInput"
        v-model:value="_title"
        class="!bg-transparent !text-xs !border-0 !ring-0 !outline-transparent !border-transparent"
        :class="{
          'font-medium': activeView?.id === vModel.id,
        }"
        @blur="onRename"
        @keydown.stop="onKeyDown($event)"
      />

      <div
        v-else
        class="capitalize text-ellipsis overflow-hidden select-none w-full"
        data-testid="sidebar-view-title"
        :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
      >
        {{ vModel.alias || vModel.title }}
      </div>

      <div class="flex-1" />

      <template v-if="!isEditing && !isLocked && isUIAllowed('virtualViewsCreateOrEdit')">
        <div class="flex items-center gap-1" :data-testid="`view-sidebar-view-actions-${vModel.alias || vModel.title}`">
          <a-tooltip placement="left">
            <template #title>
              {{ $t('activity.copyView') }}
            </template>

            <component :is="iconMap.copy" class="!hidden !group-hover:block nc-view-copy-icon" @click.stop="onDuplicate" />
          </a-tooltip>

          <template v-if="!vModel.is_default">
            <a-tooltip placement="left">
              <template #title>
                {{ $t('activity.deleteView') }}
              </template>

              <component
                :is="iconMap.delete"
                class="!hidden !group-hover:block text-red-600 nc-view-delete-icon"
                @click.stop="onDelete"
              />
            </a-tooltip>
          </template>
        </div>
      </template>
    </div>
  </a-menu-item>
</template>
