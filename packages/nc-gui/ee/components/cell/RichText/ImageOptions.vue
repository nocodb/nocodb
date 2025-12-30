<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { type Node } from '@tiptap/core'

interface Props {
  editor: Editor
  tabIndex?: number
  isAddImageMode: boolean
  isImageEditMode: boolean
  imageNode: Node
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:isAddImageMode', 'update:isImageEditMode'])

const isImageEditMode = useVModel(props, 'isImageEditMode', emits)

const isAddImageMode = useVModel(props, 'isAddImageMode', emits)

const { editor, imageNode } = toRefs(props)

// Image options state
const imageSrcInputRef = ref<HTMLInputElement>()
const imageSrc = ref('')
const imageAlt = ref('')

const updateImageAttributes = () => {
  if (!imageNode.value) return

  const { from } = editor.value.state.selection
  const formattedSrc = imageSrc.value

  editor.value.view.dispatch(
    editor.value.view.state.tr.setNodeMarkup(from, undefined, {
      src: formattedSrc,
      alt: imageAlt.value,
    }),
  )

  editor.value?.chain().focus().run()
}

const deleteImage = () => {
  if (!imageNode.value) return

  const { from, to } = editor.value.state.selection
  editor.value.view.dispatch(editor.value.view.state.tr.delete(from, to))

  editor.value?.chain().focus().run()
}

const toggleImageEditMode = () => {
  isImageEditMode.value = !isImageEditMode.value
}

const cancelImageEdit = () => {
  // For add image mode, just close the form (no image was inserted yet)
  // For edit mode, just close the form (keep existing image unchanged)
  isImageEditMode.value = false
  isAddImageMode.value = false

  editor.value!.chain().focus().run()
}

const applyImageChanges = () => {
  if (isAddImageMode.value) {
    // Adding a new image
    if (imageSrc.value) {
      // Insert new image at current cursor position
      editor.value
        ?.chain()
        ?.setImage({
          src: imageSrc.value,
          alt: imageAlt.value || undefined,
        })
        ?.focus()
        ?.run()
    } else {
      editor.value?.chain().focus().run()
    }

    // If no URL provided, do nothing (just close the form)
  } else {
    // Editing existing image
    if (!imageSrc.value) {
      // If no URL provided, remove the existing image
      deleteImage()
    } else {
      updateImageAttributes()
    }
  }

  isImageEditMode.value = false
  isAddImageMode.value = false
}

// Watch for edit mode changes to focus input
watch(
  isImageEditMode,
  (editMode, oldEditMode) => {
    if (editMode && !oldEditMode) {
      // Entering edit mode - focus the URL input
      nextTick(() => {
        imageSrcInputRef.value?.focus()
      })
    }
  },
  {
    immediate: true,
  },
)

watch(
  imageNode,
  (node, oldNode) => {
    if (!node || node === oldNode) return

    imageSrc.value = node?.attrs?.src || ''
    imageAlt.value = node?.attrs?.alt || ''
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    class="relative bubble-menu nc-text-area-rich-image-options bg-nc-bg-default flex flex-col border-1 border-nc-border-gray-medium rounded-lg w-full"
    :class="{
      'p-3': isImageEditMode,
      'py-1 pr-1 pl-3': !isImageEditMode,
    }"
    data-testid="nc-text-area-rich-image-options"
  >
    <!-- Compact view (Google Sheets style) - only show for existing images -->
    <div v-if="!isImageEditMode && !isAddImageMode && imageNode" class="flex items-center gap-x-1">
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
</template>
