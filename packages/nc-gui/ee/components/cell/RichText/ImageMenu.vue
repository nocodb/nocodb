<script lang="ts" setup>
import type { Editor } from '@tiptap/vue-3'
import type { TooltipPlacement } from 'ant-design-vue/es/tooltip'

interface Props {
  editor: Editor
  tabIndex?: number
  tooltipPlacement?: TooltipPlacement
}

const props = defineProps<Props>()

const { editor } = toRefs(props)

const onAddImage = () => {
  // if active node is an image, return
  if (editor.value?.isActive('image')) return

  // Initialize storage if it doesn't exist
  if (!editor.value?.storage.image) {
    editor.value!.storage.image = {}
  }

  // Set add image mode flag
  editor.value!.storage.image.addImageMode = true

  editor.value!.chain().focus().run()
}
</script>

<template>
  <NcTooltip :placement="tooltipPlacement" :disabled="editor.isActive('codeBlock') || editor.isActive('image')">
    <template #title> {{ $t('general.attachImage') }}</template>
    <NcButton
      size="small"
      type="text"
      :class="{ 'is-active': editor.isActive('image') }"
      :disabled="editor.isActive('codeBlock')"
      :tabindex="tabIndex"
      @click="onAddImage"
    >
      <GeneralIcon icon="ncImage"></GeneralIcon>
    </NcButton>
  </NcTooltip>
</template>
