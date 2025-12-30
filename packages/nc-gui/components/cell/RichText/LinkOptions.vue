<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3'
import { getMarkRange } from '@tiptap/core'
import type { Mark } from '@tiptap/pm/model'
import { nextTick } from 'vue'

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

// Image options state
const imageWrapperRef = ref<HTMLElement>()
const imageSrcInputRef = ref<HTMLInputElement>()
const imageNode = ref<any>()
const imageSrc = ref('')
const imageAlt = ref('')
const imagePreviewError = ref(false)
const isImageOptionsVisible = ref(false)
const isImageEditMode = ref(false) // Track if we're in edit mode
const isAddImageMode = ref(false) // Track if we're adding a new image

// This is used to prevent the menu from showing up after a link is deleted, an edge case when the link with empty placeholder text is deleted.
// This is because checkLinkMark is not called in that case
const justDeleted = ref(false)

// This function is called by BubbleMenu on selection change
// It checks if either a link mark is active or an image node is selected
const checkLinkMarkOrImageNode = (editor: Editor) => {
  if (!editor.view.editable) return false

  console.log('editor', editor)

  if (justDeleted.value) {
    setTimeout(() => {
      justDeleted.value = false
    }, 100)
    return false
  }

  // Check for image node first
  const selection = editor?.state?.selection
  const selectedNode = selection && 'node' in selection ? (selection as any).node : null

  if (selectedNode && selectedNode.type && selectedNode.type.name === 'image') {
    if (imageNode.value !== selectedNode) {
      isImageEditMode.value = false
      isAddImageMode.value = false
    }

    imageNode.value = selectedNode
    imageSrc.value = selectedNode.attrs?.src || ''
    imageAlt.value = selectedNode.attrs?.alt || ''

    // Check if we're in "add image" mode from editor storage
    if (!imageSrc.value) {
      // New image being added - enter edit mode automatically
      isImageEditMode.value = true
      isAddImageMode.value = true
    }

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

const updateImageAttributes = () => {
  if (!imageNode.value) return

  const { from, to } = editor.value.state.selection
  const formatedSrc = imageSrc.value

  editor.value.view.dispatch(
    editor.value.view.state.tr.setNodeMarkup(from, undefined, {
      src: formatedSrc,
      alt: imageAlt.value,
    }),
  )
}

const deleteImage = () => {
  if (!imageNode.value) return

  const { from, to } = editor.value.state.selection
  editor.value.view.dispatch(editor.value.view.state.tr.delete(from, to))
}

const toggleImageEditMode = () => {
  isImageEditMode.value = !isImageEditMode.value
}

const cancelImageEdit = () => {
  if (isAddImageMode.value) {
    // For new images, remove the temporary image when canceling
    deleteImage()
    isAddImageMode.value = false
  }
  isImageEditMode.value = false
}

const applyImageChanges = () => {
  if (!imageSrc.value) {
    // If no URL provided, remove the temporary image
    deleteImage()
  } else {
    updateImageAttributes()
  }

  isImageEditMode.value = false
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

// Watch for edit mode changes to focus input
watch(isImageEditMode, (editMode, oldEditMode) => {
  if (editMode && !oldEditMode) {
    // Entering edit mode - focus the URL input
    nextTick(() => {
      imageSrcInputRef.value?.focus()
    })
  }
})

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
      onMount: onMountLinkOptions,
    }"
    :should-show="(checkLinkMarkOrImageNode as any)"
  >
    <!-- Link Options -->
    <div
      v-if="!justDeleted && isLinkOptionsVisible && !isImageOptionsVisible"
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
    <div
      v-if="isImageOptionsVisible"
      ref="imageWrapperRef"
      class="relative bubble-menu nc-text-area-rich-image-options bg-nc-bg-default flex flex-col border-1 border-nc-border-gray-medium rounded-lg w-full"
      :class="{
        'p-3': isImageEditMode,
        'py-1 pr-1 pl-3': !isImageEditMode,
      }"
      data-testid="nc-text-area-rich-image-options"
      @keydown.stop="handleKeyDown"
    >
      <!-- Compact view (Google Sheets style) -->
      <div v-if="!isImageEditMode && !isAddImageMode" class="flex items-center gap-x-1">
        <!-- Image URL text (truncated) -->
        <div class="flex-1 min-w-0">
          <div class="text-bodyDefaultSm text-nc-content-gray truncate">
            <a v-if="imageSrc" :href="imageSrc" target="_blank" rel="noopener noreferrer"> {{ imageSrc }} </a>
            <span v-else>No URL</span>
          </div>
        </div>

        <!-- Action buttons -->
        <NcTooltip v-if="imageSrc" overlay-class-name="nc-text-area-rich-image-options">
          <template #title> Copy image URL </template>
          <GeneralCopyButton :tabindex="tabIndex" :content="imageSrc" size="small" :show-toast="false"> </GeneralCopyButton>
        </NcTooltip>

        <NcTooltip overlay-class-name="nc-text-area-rich-image-options">
          <template #title> Edit image </template>
          <NcButton :tabindex="tabIndex" size="small" type="text" @click="toggleImageEditMode">
            <GeneralIcon icon="edit" />
          </NcButton>
        </NcTooltip>

        <NcTooltip overlay-class-name="nc-text-area-rich-image-options">
          <template #title> Remove image </template>
          <NcButton
            :tabindex="tabIndex"
            class="!duration-0 !hover:(text-nc-content-red-medium bg-nc-bg-red-light)"
            size="small"
            type="text"
            @click="deleteImage"
          >
            <GeneralIcon icon="delete" />
          </NcButton>
        </NcTooltip>
      </div>

      <!-- Edit mode (expanded) -->
      <div v-else class="space-y-3">
        <!-- Image URL Input -->
        <div class="flex flex-col gap-1.5">
          <label class="text-bodyDefaultSm text-nc-content-gray-muted">Image URL</label>
          <a-input
            ref="imageSrcInputRef"
            v-model:value="imageSrc"
            :tabindex="tabIndex"
            class="nc-input-sm"
            placeholder="Enter image URL"
            @press-enter="applyImageChanges"
          />
        </div>

        <!-- Alt Text Input -->
        <div class="flex flex-col gap-1.5">
          <label class="text-bodyDefaultSm text-nc-content-gray-muted">Alt Text</label>
          <a-input
            v-model:value="imageAlt"
            :tabindex="tabIndex"
            class="nc-input-sm"
            placeholder="Enter alt text"
            @press-enter="applyImageChanges"
          />
        </div>

        <!-- Action buttons -->
        <div class="flex items-center justify-end gap-x-2 pt-2 border-t border-nc-border-gray-light">
          <NcButton :tabindex="tabIndex" size="small" type="text" @click="cancelImageEdit"> Cancel </NcButton>
          <NcButton :tabindex="tabIndex" size="small" type="primary" @click="applyImageChanges"> Apply </NcButton>
        </div>
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
