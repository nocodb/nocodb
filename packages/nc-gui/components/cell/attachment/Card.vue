<script setup lang="ts">
import { useAttachmentCell } from './utils'

const props = withDefaults(
  defineProps<{
    attachment: Record<string, any>
    index: number
    selected?: boolean
    dragging?: boolean
    allowEditing?: boolean
    allowSelection?: boolean
  }>(),
  {
    selected: false,
    dragging: false,
    allowEditing: false,
    allowSelection: false,
  },
)

const emits = defineEmits<{
  'clicked': []
  'update:selected': [boolean]
  'update:dragging': [boolean]
}>()

const isSelected = useVModel(props, 'selected', emits)
const isDragging = useVModel(props, 'dragging', emits)

const { getPossibleAttachmentSrc } = useAttachment()
const { FileIcon, downloadAttachment, renameFileInline, removeFile } = useAttachmentCell()!

const isRenamingFile = ref(false)
const newTitle = ref('')

const inputBox = ref()

const handleFileRenameStart = () => {
  isRenamingFile.value = true
  newTitle.value = props.attachment.title
  nextTick(() => {
    setTimeout(() => {
      inputBox.value.focus()
      inputBox.value.select()
    }, 100)
  })
}

const handleResetFileRename = () => {
  newTitle.value = ''
  isRenamingFile.value = false
}

const handleFileRename = async () => {
  if (!isRenamingFile.value) return

  if (newTitle.value) {
    try {
      await renameFileInline(props.index, newTitle.value)
      handleResetFileRename()
    } catch (e) {
      message.error('Error while renaming file')
      throw e
    }
  }
}
</script>

<template>
  <div class="nc-attachment-item group gap-1 flex border-1 rounded-md border-gray-200 flex-col relative">
    <NcCheckbox
      v-model:checked="isSelected"
      class="nc-attachment-checkbox absolute top-2 left-2 group-hover:(opacity-100) opacity-0 z-50"
      :class="{ '!opacity-100': isSelected }"
      v-if="allowSelection"
    />
    <div
      :class="{
        'cursor-move': isDragging,
        'cursor-pointer': !isDragging,
      }"
      class="nc-attachment h-full flex justify-center items-center overflow-hidden"
    >
      <LazyCellAttachmentPreviewImage
        v-if="isImage(attachment.title, attachment.mimetype)"
        :srcs="getPossibleAttachmentSrc(attachment, 'card_cover')"
        object-fit="cover"
        class="!w-full object-cover !m-0 rounded-t-[5px] justify-center"
        @click.stop="emits('clicked')"
      />

      <component
        :is="FileIcon(attachment.icon)"
        v-else-if="attachment.icon"
        :height="45"
        :width="45"
        class="text-white"
        @click.stop="emits('clicked')"
      />

      <GeneralIcon v-else icon="ncFileTypeUnknown" :height="45" :width="45" class="text-white" @click.stop="emits('clicked')" />
    </div>

    <div class="relative px-1 pb-1 items-center flex" :title="attachment.title">
      <div
        class="flex w-full text-[12px] items-center text-gray-700 cursor-default h-5"
        :class="{ truncate: !isRenamingFile }"
        @dblclick.stop="allowRename && handleFileRenameStart()"
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
          v-model:value="newTitle"
          class="!text-[12px] !h-5 !p-0 !px-0.5 !mr-1 !bg-transparent !rounded-md"
          type="text"
          @keydown.enter="handleFileRename"
          @keydown.escape.stop="handleResetFileRename"
          @blur.stop="handleResetFileRename"
        />
      </div>
      <div
        class="flex-none hide-ui transition-all transition-ease-in-out !h-5 gap-0.5 flex items-center bg-white"
        :class="{ '!h-auto !w-auto !overflow-visible !whitespace-normal': isRenamingFile }"
      >
        <NcTooltip placement="bottom">
          <template #title> {{ $t('title.downloadFile') }} </template>
          <NcButton
            class="!p-0 !w-5 !h-5 !text-gray-500 !min-w-[fit-content]"
            size="xsmall"
            type="text"
            @click="downloadAttachment(attachment)"
          >
            <component :is="iconMap.download" class="!text-xs h-13px w-13px" />
          </NcButton>
        </NcTooltip>

        <NcTooltip v-if="allowEditing" placement="bottom">
          <template #title> {{ $t('title.renameFile') }} </template>
          <NcButton
            size="xsmall"
            class="!p-0 nc-attachment-rename !h-5 !w-5 !text-gray-500 !min-w-[fit-content] gap-2"
            type="text"
            @click="handleFileRenameStart"
          >
            <component :is="iconMap.rename" class="text-xs h-13px w-13px" />
          </NcButton>
        </NcTooltip>

        <NcTooltip v-if="allowEditing" placement="bottom">
          <template #title> {{ $t('title.removeFile') }} </template>
          <NcButton
            class="!p-0 !h-5 !w-5 !text-red-500 nc-attachment-remove !min-w-[fit-content]"
            size="xsmall"
            type="text"
            @click="removeFile(index)"
          >
            <component :is="iconMap.delete" class="text-xs h-13px w-13px" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>
