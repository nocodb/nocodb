<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { type Node, getMarkRange } from '@tiptap/core'
import type { Mark } from '@tiptap/pm/model'

const props = defineProps<Props>()

const emits = defineEmits(['blur'])

interface Props {
  editor: Editor
  isFormField?: boolean
  isComment?: boolean
}

const { editor, isFormField } = toRefs(props)

const propsEditor = computed(() => editor.value)

const isImageRenderEnabled = computed(() => !propsEditor.value?.storage?.markdown?.options?.renderImagesAsLinks)

const inputRef = ref<HTMLInputElement>()
const linkNodeMark = ref<Mark | undefined>()
const href = ref('')
const isLinkOptionsVisible = ref(false)

// Image options state
const imageNode = ref<Node | null>(null)
const isImageOptionsVisible = ref(false)
const isImageEditMode = ref(false) // Track if we're in edit mode
const isAddImageMode = ref(false) // Track if we're adding a new image

const revalidatePosition = ref(false)

// This is used to prevent the menu from showing up after a link is deleted, an edge case when the link with empty placeholder text is deleted.
// This is because checkLinkMark is not called in that case
const justDeleted = ref(false)

// This function is called by BubbleMenu on selection change
// It checks if either a link mark is active or an image node is selected
const checkLinkMarkOrImageNode = (editor: Editor) => {
  if (!editor.view.editable) return false

  if (justDeleted.value) {
    setTimeout(() => {
      justDeleted.value = false
    }, 100)
    return false
  }

  // Check for image node first
  const selection = editor?.state?.selection
  const selectedNode = selection && 'node' in selection ? (selection as any).node : null

  // Check if we're in add image mode (from SelectedBubbleMenu)
  if (isImageRenderEnabled.value && propsEditor.value?.storage?.image?.addImageMode) {
    // Reset the flag so it doesn't trigger again
    propsEditor.value.storage.image.addImageMode = false

    // Enter add image mode
    isImageEditMode.value = true
    isAddImageMode.value = true
    isImageOptionsVisible.value = true
    isLinkOptionsVisible.value = false

    // Clear any existing values for new image
    imageNode.value = null

    return true
  }

  // Check for existing image node selection
  if (isImageRenderEnabled.value && selectedNode && selectedNode.type && selectedNode.type.name === 'image') {
    if (imageNode.value !== selectedNode && !revalidatePosition.value) {
      isImageEditMode.value = false
      isAddImageMode.value = false
    }

    console.log('nonde', selectedNode)
    imageNode.value = selectedNode

    isImageOptionsVisible.value = true
    isLinkOptionsVisible.value = false
    return true
  }

  // Check for link mark
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
  isImageOptionsVisible.value = false
  isImageEditMode.value = false // Reset edit mode

  return showLinkOptions
}

function notStartingWithNetworkProtocol(inputString: string) {
  const pattern = /^(?![^:]+:\/\/).*/

  const isMatch = pattern.test(inputString)

  return isMatch
}

const onChange = () => {
  const linkMark = editor.value.schema.marks.link
  if (!linkMark) return

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
      editor.value.view.state.tr.removeStoredMark(linkMark).addStoredMark(linkMark.create({ href: formatedHref })),
    )
  } else if (linkNodeMark.value) {
    const selection = editor.value.state?.selection
    const markSelection = getMarkRange(selection.$anchor, linkMark) as any

    editor.value.view.dispatch(
      editor.value.view.state.tr
        .removeMark(markSelection.from, markSelection.to, linkMark)
        .addMark(markSelection.from, markSelection.to, linkMark.create({ href: formatedHref })),
    )
  }
}

const onDelete = () => {
  const linkMark = editor.value.schema.marks.link
  if (!linkMark) return

  const isLinkMarkedStoredInEditor = editor.value.state?.storedMarks?.some((mark: Mark) => mark.type.name === 'link')

  if (isLinkMarkedStoredInEditor) {
    editor.value.view.dispatch(editor.value.view.state.tr.removeStoredMark(linkMark))
  } else if (linkNodeMark.value) {
    const selection = editor.value.state.selection
    const markSelection = getMarkRange(selection.$anchor, linkMark) as any

    editor.value.view.dispatch(editor.value.view.state.tr.removeMark(markSelection.from, markSelection.to, linkMark))
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

watch([isLinkOptionsVisible, isImageOptionsVisible], ([linkVisible, imageVisible], [oldLinkVisible, oldImageVisible]) => {
  if (linkVisible && !oldLinkVisible) {
    const isPlaceholderEmpty =
      !editor.value.state.selection.$from.nodeBefore?.textContent && !editor.value.state.selection.$from.nodeAfter?.textContent

    if (!isPlaceholderEmpty) return

    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  }

  // Reset edit mode when image options are hidden
  if (!imageVisible && oldImageVisible) {
    isImageEditMode.value = false
    isAddImageMode.value = false
  }
})

watch([isImageEditMode, isImageOptionsVisible], () => {
  if (!isImageEditMode.value || !isImageOptionsVisible.value) {
    revalidatePosition.value = false
  }
})

const onImageEditModeUpdate = () => {
  setTimeout(() => {
    revalidatePosition.value = true
    editor.value?.chain()?.focus().run()
  }, 100)
}

const openLink = () => {
  if (href.value) {
    window.open(href.value, '_blank', 'noopener,noreferrer')
  }
}

const onMountLinkOptions = (e: any) => {
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
  <!-- Link Options Bubble Menu -->
  <BubbleMenu
    :editor="editor"
    :tippy-options="{
      duration: 100,
      maxWidth: 400,
      placement: isImageOptionsVisible && isImageRenderEnabled && (isImageEditMode || isAddImageMode) ? 'auto-start' : 'auto',
      onMount: onMountLinkOptions,
    }"
    :should-show="(checkLinkMarkOrImageNode as any)"
  >
    <!-- Link Options -->
    <div
      v-if="!justDeleted && isLinkOptionsVisible && !isImageOptionsVisible"
      class="relative bubble-menu nc-text-area-rich-link-options bg-nc-bg-default flex flex-col border-1 border-nc-border-gray-medium py-1 px-1 rounded-lg w-full"
      data-testid="nc-text-area-rich-link-options"
      @keydown.stop="handleKeyDown"
    >
      <div class="flex items-center gap-x-1">
        <div class="!py-0.5 bg-nc-bg-default rounded-md !z-10 flex-1">
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
              '!text-nc-content-brand-hover cursor-not-allowed': href.length === 0,
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
            class="!duration-0 !hover:(text-nc-content-red-medium bg-nc-bg-red-light)"
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
    <CellRichTextImageOptions
      v-if="isImageOptionsVisible && isImageRenderEnabled"
      v-model:is-add-image-mode="isAddImageMode"
      v-model:is-image-edit-mode="isImageEditMode"
      v-model:is-image-options-visible="isImageOptionsVisible"
      :editor="editor"
      :tab-index="tabIndex"
      :image-node="imageNode"
      @update:is-image-edit-mode="onImageEditModeUpdate"
    />
  </BubbleMenu>
</template>

<style lang="scss">
.bubble-menu {
  // shadow
  @apply shadow-nc-border-gray-medium shadow-sm;
}

.nc-text-area-rich-link-option-input {
  @apply text-nc-content-gray;

  &::placeholder {
    @apply text-nc-content-gray-muted;
  }
}

.nc-text-area-rich-link-options {
  .ant-popover-inner-content {
    @apply !shadow-none !p-0;
  }
  .ant-popover-arrow {
    @apply !shadow-none;
    .ant-popover-arrow-content {
      @apply !shadow-none !bg-nc-bg-gray-light;
    }
  }
  .ant-popover-inner {
    @apply !shadow-none !bg-nc-bg-gray-light py-1.5 px-2.5 text-xs !rounded-sm;
  }
}
</style>
