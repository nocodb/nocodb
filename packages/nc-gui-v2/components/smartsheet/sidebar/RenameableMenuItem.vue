<script lang="ts" setup>
import type { ViewTypes } from 'nocodb-sdk'
import { viewIcons } from '~/utils'
import { useDebounceFn, useNuxtApp, useVModel } from '#imports'
import MdiTrashCan from '~icons/mdi/trash-can'
import MdiContentCopy from '~icons/mdi/content-copy'
import MdiDrag from '~icons/mdi/drag-vertical'

interface Props {
  view: Record<string, any>
}

interface Emits {
  (event: 'openModal', data: { type: ViewTypes; title?: string }): void
  (event: 'update:view', data: Record<string, any>): void
  (event: 'changeView', view: Record<string, any>): void
  (event: 'rename', view: Record<string, any>): void
  (event: 'delete', view: Record<string, any>): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vModel = useVModel(props, 'view', emits)

const { $e } = useNuxtApp()

/** Is editing the view name enabled */
let isEditing = $ref<boolean>(false)

/** Helper to check if editing was disabled before the view navigation timeout triggers */
let isStopped = $ref(false)

/** Original view title when editing the view name */
let originalTitle = $ref<string | undefined>()

/** Debounce click handler, so we can potentially enable editing view name {@see onDblClick} */
const onClick = useDebounceFn(() => {
  if (isEditing || isStopped) return

  emits('changeView', vModel.value)
}, 250)

/** Enable editing view name on dbl click */
function onDblClick() {
  if (!isEditing) {
    isEditing = true
    originalTitle = vModel.value.title
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
  if (isEditing) {
    onKeyEnter(event)
  }
})

function focusInput(el: HTMLInputElement) {
  if (el) el.focus()
}

/** Duplicate a view */
// todo: This is not really a duplication, maybe we need to implement a true duplication?
function onDuplicate() {
  emits('openModal', { type: vModel.value.type, title: vModel.value.title })

  $e('c:view:copy', { view: vModel.value.type })
}

/** Delete a view */
async function onDelete() {
  emits('delete', vModel.value)
}

/** Rename a view */
async function onRename() {
  if (!isEditing) return

  if (vModel.value.title === '' || vModel.value.title === originalTitle) {
    onCancel()
    return
  }

  emits('rename', vModel.value)

  onStopEdit()
}

/** Cancel renaming view */
function onCancel() {
  if (!isEditing) return

  vModel.value.title = originalTitle
  onStopEdit()
}

/** Stop editing view name, timeout makes sure that view navigation (click trigger) does not pick up before stop is done */
function onStopEdit() {
  isStopped = true
  isEditing = false
  originalTitle = ''

  setTimeout(() => {
    isStopped = false
  }, 250)
}
</script>

<template>
  <a-menu-item class="group !flex !items-center !my-0" @dblclick="onDblClick" @click="onClick">
    <div v-t="['a:view:open', { view: vModel.type }]" class="text-xs flex items-center w-full gap-2">
      <div class="flex w-auto">
        <MdiDrag
          class="nc-drag-icon hidden group-hover:block transition-opacity opacity-0 group-hover:opacity-100 text-gray-500 cursor-move"
          :class="`nc-child-draggable-icon-${vModel.title}`"
          @click.stop.prevent
        />

        <component :is="viewIcons[vModel.type].icon" class="group-hover:hidden" :class="`text-${viewIcons[vModel.type].color}`" />
      </div>

      <a-input v-if="isEditing" :ref="focusInput" v-model:value="vModel.title" @blur="onCancel" @keydown="onKeyDown($event)" />
      <div v-else>{{ vModel.alias || vModel.title }}</div>

      <div class="flex-1" />

      <template v-if="!isEditing">
        <div class="flex items-center gap-1">
          <a-tooltip placement="left">
            <template #title>
              {{ $t('activity.copyView') }}
            </template>

            <MdiContentCopy class="hidden group-hover:block text-gray-500" @click.stop="onDuplicate" />
          </a-tooltip>

          <template v-if="!vModel.is_default">
            <a-tooltip placement="left">
              <template #title>
                {{ $t('activity.deleteView') }}
              </template>

              <MdiTrashCan class="hidden group-hover:block text-red-500" @click.stop="onDelete" />
            </a-tooltip>
          </template>
        </div>
      </template>
    </div>
  </a-menu-item>
</template>
