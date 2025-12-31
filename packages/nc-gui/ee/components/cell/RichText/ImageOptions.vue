<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import { type Node } from '@tiptap/core'
import { isValidImageURL } from 'nocodb-sdk'

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

const useForm = Form.useForm

// Image options state
const imageSrcInputRef = ref<HTMLInputElement>()

const formState = reactive<{
  imageSrc: string
  imageAlt: string
}>({
  imageSrc: '',
  imageAlt: '',
})

// Get allowBase64 option from editor's image extension
const allowBase64 = computed(() => {
  const imageExtension = editor.value.extensionManager.extensions.find((ext) => ext.name === 'image')
  return imageExtension?.options?.allowBase64 ?? false
})

const validators = computed(() => ({
  imageSrc: [
    {
      required: true,
      message: 'Image URL is required',
    },
    {
      validator: async (_: any, value: string) => {
        if (!value?.trim()) return Promise.resolve()

        try {
          const isValid = await isValidImageURL(value, {
            allowDataUrl: allowBase64.value,
            timeout: 5000,
          })

          if (!isValid) {
            if (value.startsWith('data:') && !allowBase64.value) {
              return Promise.reject(new Error('Base64 image URLs are not allowed'))
            } else {
              return Promise.reject(new Error('Image URL is not valid'))
            }
          }

          return Promise.resolve()
        } catch (error) {
          return Promise.reject(new Error('Failed to validate image URL'))
        }
      },
    },
  ],
}))

const { validate, validateInfos } = useForm(formState, validators)

const updateImageAttributes = () => {
  if (!imageNode.value) return

  const { from } = editor.value.state.selection
  const formattedSrc = formState.imageSrc

  editor.value.view.dispatch(
    editor.value.view.state.tr.setNodeMarkup(from, undefined, {
      src: formattedSrc,
      alt: formState.imageAlt,
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

const applyImageChanges = async () => {
  try {
    await validate()

    if (isAddImageMode.value) {
      // Adding a new image
      if (formState.imageSrc) {
        // Insert new image at current cursor position
        editor.value
          ?.chain()
          ?.setImage({
            src: formState.imageSrc,
            alt: formState.imageAlt || undefined,
          })
          ?.focus()
          ?.run()
      } else {
        editor.value?.chain().focus().run()
      }

      // If no URL provided, do nothing (just close the form)
    } else {
      // Editing existing image
      if (!formState.imageSrc) {
        // If no URL provided, remove the existing image
        deleteImage()
      } else {
        updateImageAttributes()
      }
    }

    isImageEditMode.value = false
    isAddImageMode.value = false
  } catch (error: any) {
    // no need to show toast as we show error in the form item

    if (error?.errorFields?.length) {
      console.error(error)
    }
  }
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

    formState.imageSrc = node?.attrs?.src || ''
    formState.imageAlt = node?.attrs?.alt || ''
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
          <a v-if="formState.imageSrc" :href="formState.imageSrc" target="_blank" rel="noopener noreferrer">
            {{ formState.imageSrc }}
          </a>
          <span v-else>No URL</span>
        </div>
      </div>

      <!-- Action buttons -->
      <NcTooltip v-if="formState.imageSrc" overlay-class-name="nc-text-area-rich-image-options">
        <template #title> Copy image URL </template>
        <GeneralCopyButton :tabindex="tabIndex" :content="formState.imageSrc" size="small" :show-toast="false">
        </GeneralCopyButton>
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
    <a-form v-else :model="formState" layout="vertical" class="space-y-2">
      <!-- Image URL Input -->
      <a-form-item v-bind="validateInfos.imageSrc">
        <template #label> Image URL </template>
        <a-input
          ref="imageSrcInputRef"
          v-model:value="formState.imageSrc"
          :tabindex="tabIndex"
          class="nc-input-sm"
          placeholder="Enter image URL"
          @press-enter="applyImageChanges"
        />
      </a-form-item>

      <!-- Alt Text Input -->
      <a-form-item>
        <template #label> Alt Text </template>
        <a-input
          v-model:value="formState.imageAlt"
          :tabindex="tabIndex"
          class="nc-input-sm"
          placeholder="Enter alt text"
          @press-enter="applyImageChanges"
        />
      </a-form-item>

      <!-- Action buttons -->
      <div class="flex items-center justify-end gap-x-2 pt-2 border-t border-nc-border-gray-light">
        <NcButton :tabindex="tabIndex" size="small" type="text" @click="cancelImageEdit"> Cancel </NcButton>
        <NcButton :tabindex="tabIndex" size="small" type="primary" @click="applyImageChanges"> Apply </NcButton>
      </div>
    </a-form>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-form-item-label > label) {
  @apply !text-small !leading-[18px] mb-2 text-nc-content-gray-subtle flex font-normal;

  &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
    @apply content-[''] m-0;
  }
}

:deep(.ant-form-item) {
  @apply my-0;
}
</style>
