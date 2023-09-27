<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import type { KanbanType, ViewType, ViewTypes } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import {
  IsLockedInj,
  isDefaultBase as _isDefaultBase,
  inject,
  message,
  onKeyStroke,
  useDebounceFn,
  useNuxtApp,
  useRoles,
  useVModel,
} from '#imports'

interface Props {
  view: ViewType
  onValidate: (view: ViewType) => boolean | string
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

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { activeViewTitleOrId } = storeToRefs(useViewsStore())

const project = inject(ProjectInj, ref())

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const { rightSidebarState } = storeToRefs(useSidebarStore())

const isDefaultBase = computed(() => {
  const base = project.value?.bases?.find((b) => b.id === vModel.value.base_id)
  if (!base) return false

  return _isDefaultBase(base)
})

const isDropdownOpen = ref(false)

const isEditing = ref(false)
/** Is editing the view name enabled */

/** Helper to check if editing was disabled before the view navigation timeout triggers */
const isStopped = ref(false)

/** Original view title when editing the view name */
const _title = ref<string | undefined>()

/** Debounce click handler, so we can potentially enable editing view name {@see onDblClick} */
const onClick = useDebounceFn(() => {
  if (isEditing.value || isStopped.value) return

  emits('changeView', vModel.value)
}, 250)

/** Enable editing view name on dbl click */
function onDblClick() {
  if (!isUIAllowed('viewCreateOrEdit')) return

  if (!isEditing.value) {
    isEditing.value = true
    _title.value = vModel.value.title
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
  isDropdownOpen.value = false

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
  isDropdownOpen.value = false

  emits('delete', vModel.value)
}

/** Rename a view */
async function onRename() {
  isDropdownOpen.value = false
  if (!isEditing.value) return

  const isValid = props.onValidate({ ...vModel.value, title: _title.value! })

  if (isValid !== true) {
    message.error(isValid)

    onCancel()
    return
  }

  if (vModel.value.title === '' || vModel.value.title === _title.value) {
    onCancel()
    return
  }

  const originalTitle = vModel.value.title

  vModel.value.title = _title.value || ''

  emits('rename', vModel.value, originalTitle)

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
  isStopped.value = true
  isEditing.value = false
  _title.value = ''

  setTimeout(() => {
    isStopped.value = false
  }, 250)
}

watch(rightSidebarState, () => {
  if (rightSidebarState.value === 'peekCloseEnd') {
    isDropdownOpen.value = false
  }
})

function onRef(el: HTMLElement) {
  if (activeViewTitleOrId.value === vModel.value.id) {
    nextTick(() => {
      setTimeout(() => {
        el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }, 1000)
    })
  }
}
</script>

<template>
  <a-menu-item
    class="nc-sidebar-node !min-h-7 !max-h-7 !mb-0.25 select-none group text-gray-700 !flex !items-center !mt-0 hover:(!bg-gray-200 !text-gray-900) cursor-pointer"
    :class="{
      '!pl-18 !xs:(pl-19.75)': isDefaultBase,
      '!pl-23.5 !xs:(pl-27)': !isDefaultBase,
    }"
    :data-testid="`view-sidebar-view-${vModel.alias || vModel.title}`"
    @dblclick.stop="onDblClick"
    @click="onClick"
  >
    <div
      :ref="onRef"
      v-e="['a:view:open', { view: vModel.type }]"
      class="text-sm flex items-center w-full gap-1"
      data-testid="view-item"
    >
      <div class="flex min-w-6" :data-testid="`view-sidebar-drag-handle-${vModel.alias || vModel.title}`">
        <LazyGeneralEmojiPicker
          class="nc-table-icon"
          :emoji="props.view?.meta?.icon"
          size="small"
          :clearable="true"
          :readonly="isMobileMode"
          @emoji-selected="emits('selectIcon', $event)"
        >
          <template #default>
            <GeneralViewIcon :meta="props.view" class="nc-view-icon"></GeneralViewIcon>
          </template>
        </LazyGeneralEmojiPicker>
      </div>

      <a-input
        v-if="isEditing"
        :ref="focusInput"
        v-model:value="_title"
        class="!bg-transparent !border-0 !ring-0 !outline-transparent !border-transparent"
        :class="{
          'font-medium': activeView?.id === vModel.id,
        }"
        @blur="onRename"
        @keydown.stop="onKeyDown($event)"
      />

      <div
        v-else
        class="nc-sidebar-node-title capitalize text-ellipsis overflow-hidden select-none w-full"
        data-testid="sidebar-view-title"
        :class="{
          'font-medium': activeView?.id === vModel.id,
        }"
        :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
      >
        {{ vModel.alias || vModel.title }}
      </div>

      <div class="flex-1" />

      <template v-if="!isEditing && !isLocked && isUIAllowed('viewCreateOrEdit')">
        <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!rounded-lg">
          <NcButton
            type="text"
            size="xxsmall"
            class="nc-sidebar-node-btn invisible !group-hover:visible nc-sidebar-view-node-context-btn"
            :class="{
              '!visible': isDropdownOpen,
            }"
            @click.stop="isDropdownOpen = !isDropdownOpen"
          >
            <GeneralIcon icon="threeDotHorizontal" class="text-xl w-4.75" />
          </NcButton>

          <template #overlay>
            <NcMenu class="min-w-27" :data-testid="`view-sidebar-view-actions-${vModel.alias || vModel.title}`">
              <NcMenuItem @click.stop="onDblClick">
                <GeneralIcon icon="edit" />
                <div class="-ml-0.25">Rename</div>
              </NcMenuItem>
              <NcMenuItem @click.stop="onDuplicate">
                <GeneralIcon icon="duplicate" class="nc-view-copy-icon" />
                Duplicate
              </NcMenuItem>

              <NcDivider />

              <template v-if="!vModel.is_default">
                <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click.stop="onDelete">
                  <GeneralIcon icon="delete" class="text-sm nc-view-delete-icon" />
                  <div class="-ml-0.25">Delete</div>
                </NcMenuItem>
              </template>
            </NcMenu>
          </template>
        </NcDropdown>
      </template>
    </div>
  </a-menu-item>
</template>
