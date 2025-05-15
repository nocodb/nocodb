<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { getMarkRange } from '@tiptap/core'
import type { Mark } from '@tiptap/pm/model'

const props = defineProps<Props>()

const emits = defineEmits(['blur'])

interface Props {
  editor: Editor
  isFormField?: boolean
  isComment?: boolean
}

const { editor, isFormField } = toRefs(props)

const inputRef = ref<HTMLInputElement>()
const linkNodeMark = ref<Mark | undefined>()
const href = ref('')
const isLinkOptionsVisible = ref(false)

// This is used to prevent the menu from showing up after a link is deleted, an edge case when the link with empty placeholder text is deleted.
// This is because checkLinkMark is not called in that case
const justDeleted = ref(false)

// This function is called by BubbleMenu on selection change
// It is used to check if the link mark is active and only show the menu if it is
const checkLinkMark = (editor: Editor) => {
  if (!editor.view.editable) return false

  if (justDeleted.value) {
    setTimeout(() => {
      justDeleted.value = false
    }, 100)
    return false
  }

  const activeNode = editor?.state?.selection?.$from?.nodeBefore || editor?.state?.selection?.$from?.nodeAfter

  const isLinkMarkedStoredInEditor = editor?.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')

  const isActiveNodeMarkActive = activeNode?.marks?.some((mark: Mark) => mark.type.name === 'link') || isLinkMarkedStoredInEditor

  if (isActiveNodeMarkActive) {
    linkNodeMark.value = activeNode?.marks.find((mark: Mark) => mark.type.name === 'link')
    href.value = linkNodeMark.value?.attrs?.href
  }

  if (isLinkMarkedStoredInEditor) {
    linkNodeMark.value = editor?.state?.storedMarks?.find((mark: Mark) => mark.type.name === 'link')
    href.value = linkNodeMark.value?.attrs?.href
  }

  const isTextSelected = editor?.state?.selection?.from !== editor?.state?.selection?.to

  // check if active node is a text node
  const showLinkOptions = isActiveNodeMarkActive && !isTextSelected
  isLinkOptionsVisible.value = !!showLinkOptions

  return showLinkOptions
}

function notStartingWithNetworkProtocol(inputString: string) {
  const pattern = /^(?![^:]+:\/\/).*/

  const isMatch = pattern.test(inputString)

  return isMatch
}

const onChange = () => {
  const isLinkMarkedStoredInEditor = editor.value.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')
  let formatedHref = href.value
  if (
    isValidURL(href.value) &&
    href.value.length > 0 &&
    !href.value.startsWith('/') &&
    notStartingWithNetworkProtocol(href.value)
  ) {
    formatedHref = `https://${href.value}`
  }

  if (isLinkMarkedStoredInEditor) {
    editor.value.view.dispatch(
      editor.value.view.state.tr
        .removeStoredMark(editor.value.schema.marks.link)
        .addStoredMark(editor.value.schema.marks.link.create({ href: formatedHref })),
    )
  } else if (linkNodeMark.value) {
    const selection = editor.value.state?.selection
    const markSelection = getMarkRange(selection.$anchor, editor.value.schema.marks.link) as any

    editor.value.view.dispatch(
      editor.value.view.state.tr
        .removeMark(markSelection.from, markSelection.to, editor.value.schema.marks.link)
        .addMark(markSelection.from, markSelection.to, editor.value.schema.marks.link.create({ href: formatedHref })),
    )
  }
}

const onDelete = () => {
  const isLinkMarkedStoredInEditor = editor.value.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')

  if (isLinkMarkedStoredInEditor) {
    editor.value.view.dispatch(editor.value.view.state.tr.removeStoredMark(editor.value.schema.marks.link))
  } else if (linkNodeMark.value) {
    const selection = editor.value.state.selection
    const markSelection = getMarkRange(selection.$anchor, editor.value.schema.marks.link) as any

    editor.value.view.dispatch(
      editor.value.view.state.tr.removeMark(markSelection.from, markSelection.to, editor.value.schema.marks.link),
    )
  }

  justDeleted.value = true
}

const handleKeyDown = (e: any) => {
  const isCtrlPressed = isMac() ? e.metaKey : e.ctrlKey

  // Ctrl + Z/ Meta + Z
  if (isCtrlPressed && e.key === 'z') {
    e.preventDefault()
    editor.value.commands.undo()
  }

  // Ctrl + Shift + Z/ Meta + Shift + Z
  if (isCtrlPressed && e.shiftKey && e.key === 'z') {
    e.preventDefault()
    editor.value.commands.redo()
  }
}

const onInputBoxEnter = () => {
  inputRef.value?.blur()
  editor.value.chain().focus().run()
}

const handleInputBoxKeyDown = (e: any) => {
  if (e.key === 'ArrowDown' || e.key === 'Escape') {
    editor.value.chain().focus().run()
  }
}

watch(isLinkOptionsVisible, (value, oldValue) => {
  if (value && !oldValue) {
    const isPlaceholderEmpty =
      !editor.value.state.selection.$from.nodeBefore?.textContent && !editor.value.state.selection.$from.nodeAfter?.textContent

    if (!isPlaceholderEmpty) return

    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  }
})

const openLink = () => {
  if (href.value) {
    window.open(href.value, '_blank', 'noopener,noreferrer')
  }
}

const onMountLinkOptions = (e) => {
  if (e?.popper?.style) {
    if (props.isComment) {
      e.popper.style.left = '-10%'
    }
    e.popper.style.width = '95%'
  }
}

const tabIndex = computed(() => {
  return isFormField.value ? -1 : 0
})
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :tippy-options="{
      duration: 100,
      maxWidth: 600,
      onMount: onMountLinkOptions,
    }"
    :should-show="(checkLinkMark as any)"
  >
    <div
      v-if="!justDeleted"
      ref="wrapperRef"
      class="relative bubble-menu nc-text-area-rich-link-options bg-white flex flex-col border-1 border-gray-200 py-1 px-1 rounded-lg w-full"
      data-testid="nc-text-area-rich-link-options"
      @keydown.stop="handleKeyDown"
    >
      <div class="flex items-center gap-x-1">
        <div class="!py-0.5 bg-white rounded-md !z-10 flex-1">
          <a-input
            ref="inputRef"
            v-model:value="href"
            :tabindex="tabIndex"
            class="nc-text-area-rich-link-option-input flex-1 !mx-0.5 !px-1.5 !py-0.5 !rounded-md z-10"
            :bordered="false"
            placeholder="Enter a link"
            @change="onChange"
            @press-enter="onInputBoxEnter"
            @keydown="handleInputBoxKeyDown"
            @blur="emits('blur')"
          />
        </div>
        <NcTooltip overlay-class-name="nc-text-area-rich-link-options">
          <template #title> Open link </template>
          <NcButton
            :tabindex="tabIndex"
            :class="{
              '!text-gray-300 cursor-not-allowed': href.length === 0,
            }"
            data-testid="text-gray-700 nc-text-area-rich-link-options-open-link"
            size="small"
            type="text"
            @click="openLink"
          >
            <GeneralIcon icon="externalLink" />
          </NcButton>
        </NcTooltip>
        <NcTooltip overlay-class-name="nc-text-area-rich-link-options">
          <template #title> Delete link </template>
          <NcButton
            :tabindex="tabIndex"
            class="!duration-0 !hover:(text-red-400 bg-red-50)"
            data-testid="nc-text-area-rich-link-options-open-delete"
            size="small"
            type="text"
            @click="onDelete"
          >
            <GeneralIcon icon="delete" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>
  </BubbleMenu>
</template>

<style lang="scss">
.bubble-menu {
  // shadow
  @apply shadow-gray-200 shadow-sm;
}

.nc-text-area-rich-link-option-input {
  @apply !placeholder:text-gray-500 text-gray-800;
}

.nc-text-area-rich-link-options {
  .ant-popover-inner-content {
    @apply !shadow-none !p-0;
  }
  .ant-popover-arrow {
    @apply !shadow-none;
    .ant-popover-arrow-content {
      @apply !shadow-none !bg-gray-100;
    }
  }
  .ant-popover-inner {
    @apply !shadow-none !bg-gray-100 py-1.5 px-2.5 text-xs !rounded-sm;
  }
}
</style>
