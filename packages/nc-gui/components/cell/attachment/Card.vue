<script setup lang="ts">
import { useAttachmentCell } from './utils'

const props = withDefaults(
  defineProps<{
    attachment: Record<string, any>
    index: number
    selected?: boolean
    dragging?: boolean
    allowRename?: boolean
    allowDelete?: boolean
    allowSelection?: boolean
    previewClassOverride?: string
    renameInline?: boolean
    confirmToDelete?: boolean
    iconWidth?: number
    iconHeight?: number
  }>(),
  {
    selected: false,
    dragging: false,
    allowRename: false,
    allowDelete: true,
    allowSelection: false,
    renameInline: true,
    confirmToDelete: false,
  },
)

const emits = defineEmits<{
  'clicked': []
  'update:selected': [boolean]
  'update:dragging': [boolean]
  'onDelete': []
}>()

const isSelected = useVModel(props, 'selected', emits)
const isDragging = useVModel(props, 'dragging', emits)

const { downloadAttachment, renameFileInline, renameFile, removeFile, isEditAllowed } = useAttachmentCell()!

const isRenamingFile = ref(false)
const renameTitle = ref('')

const inputBox = ref()

const handleFileRenameStart = () => {
  if (!props.renameInline) {
    renameFile(props.attachment, props.index)
    return
  }
  isRenamingFile.value = true
  renameTitle.value = props.attachment.title
  nextTick(() => {
    setTimeout(() => {
      inputBox.value.focus()
      inputBox.value.select()
    }, 100)
  })
}

const handleResetFileRename = () => {
  renameTitle.value = ''
  isRenamingFile.value = false
}

const handleFileRename = async () => {
  if (!isRenamingFile.value) return

  if (renameTitle.value) {
    try {
      await renameFileInline(props.index, renameTitle.value)
      handleResetFileRename()
    } catch (e) {
      message.error('Error while renaming file')
      throw e
    }
  }
}

const handleFileDeleteStart = () => {
  if (!props.confirmToDelete) {
    removeFile(props.index)
    return
  }

  emits('onDelete')
}
</script>

<template>
  <div class="nc-attachment-item group gap-1 flex border-1 rounded-md border-nc-border-gray-medium flex-col relative">
    <NcCheckbox
      v-if="allowSelection"
      v-model:checked="isSelected"
      class="nc-attachment-checkbox absolute top-2 left-2 group-hover:(opacity-100) opacity-0 z-50"
      :class="{ '!opacity-100': isSelected }"
    />
    <div
      :class="{
        'cursor-move': isDragging,
        'cursor-pointer': !isDragging,
      }"
      class="nc-attachment h-full flex justify-center items-center overflow-hidden"
      @click.stop="emits('clicked')"
    >
      <LazyCellAttachmentPreviewThumbnail
        :attachment="attachment"
        thumbnail="card_cover"
        :class="previewClassOverride ? `${previewClassOverride}` : ''"
        object-fit="contain"
        class="!w-full !m-0 rounded-t-[5px] justify-center"
        :icon-height="iconHeight"
        :icon-width="iconWidth"
      />
    </div>

    <div class="relative px-1 pb-1 items-center flex" :title="attachment.title">
      <div
        class="flex w-full text-[12px] items-center text-nc-content-gray-subtle cursor-default h-5"
        :class="{ truncate: !isRenamingFile }"
        @dblclick.stop="allowRename && isEditAllowed && handleFileRenameStart()"
      >
        <NcTooltip v-if="!isRenamingFile" class="truncate h-5 flex items-center" show-on-truncate-only>
          {{ attachment.title }}

          <template #title>
            {{ attachment.title }}
          </template>
        </NcTooltip>
        <a-input
          v-else
          ref="inputBox"
          v-model:value="renameTitle"
          class="!text-[12px] !h-5 !p-0 !px-0.5 !mr-1 !bg-transparent !rounded-md"
          type="text"
          @keydown.enter="handleFileRename"
          @keydown.escape.stop="handleResetFileRename"
          @blur.stop="handleResetFileRename"
        />
      </div>
      <div
        class="flex-none hide-ui transition-all transition-ease-in-out !h-5 gap-0.5 flex items-center bg-nc-bg-default"
        :class="{ '!h-auto !w-auto !overflow-visible !whitespace-normal': isRenamingFile }"
      >
        <NcTooltip placement="bottom">
          <template #title> {{ $t('title.downloadFile') }} </template>
          <NcButton
            class="!p-0 !w-5 !h-5 !text-nc-content-gray-muted !min-w-[fit-content]"
            size="xsmall"
            type="text"
            @click="downloadAttachment(attachment)"
          >
            <component :is="iconMap.download" class="!text-xs h-13px w-13px" />
          </NcButton>
        </NcTooltip>

        <NcTooltip v-if="allowRename && isEditAllowed" placement="bottom">
          <template #title> {{ $t('title.renameFile') }} </template>
          <NcButton
            size="xsmall"
            class="!p-0 nc-attachment-rename !h-5 !w-5 !text-nc-content-gray-muted !min-w-[fit-content] gap-2"
            type="text"
            @click="handleFileRenameStart"
          >
            <component :is="iconMap.rename" class="text-xs h-13px w-13px" />
          </NcButton>
        </NcTooltip>

        <NcTooltip v-if="allowDelete && isEditAllowed" placement="bottom">
          <template #title> {{ $t('title.removeFile') }} </template>
          <NcButton
            class="!p-0 !h-5 !w-5 !text-nc-fill-red-medium nc-attachment-remove !min-w-[fit-content]"
            size="xsmall"
            type="text"
            @click="handleFileDeleteStart"
          >
            <component :is="iconMap.delete" class="text-xs h-13px w-13px" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>
