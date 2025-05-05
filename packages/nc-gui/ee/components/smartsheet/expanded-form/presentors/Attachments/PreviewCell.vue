<script lang="ts" setup>
import type { AttachmentType, ColumnType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  attachment: AttachmentType
  active?: boolean
  isExpanded?: boolean
  isFileContentMenuOpen: boolean
  selectedField: ColumnType
  attachmentIndex: number
}>()

const emits = defineEmits<{
  (e: 'update:isFileContentMenuOpen', value: boolean): void
  (e: 'expand', value: boolean): void
}>()
const { getPossibleAttachmentSrc } = useAttachment()
const isFileContentMenuOpen = useVModel(props, 'isFileContentMenuOpen', emits)

const { attachment, selectedField, attachmentIndex } = toRefs(props)

/* stores */
const { changedColumns, loadRow: _loadRow, row: _row } = useExpandedFormStoreOrThrow()

const { currentRow } = useSmartsheetRowStoreOrThrow()

const attachmentVModel = computed({
  get: () => {
    return _row.value.row[selectedField.value!.title!]
  },
  set: (val) => {
    if (val !== attachmentVModel.value) {
      currentRow.value.rowMeta.changed = true
      _row.value.row[selectedField.value!.title!] = val
      changedColumns.value.add(selectedField.value!.title!)
    }
  },
})

const refAttachmentCell = ref()

/* file detection */

const fileEntry: ComputedRef<{ icon: keyof typeof iconMap; title: string | undefined }> = computed(() => {
  if (isImage(attachment.value.title || '', attachment.value.mimetype)) {
    return {
      icon: 'image',
      title: attachment.value.mimetype?.split('/')?.at(-1) || 'Image',
    }
  }

  if (isPdf(attachment.value.title || '', attachment.value.mimetype)) {
    return {
      icon: 'ncFileTypePdf',
      title: 'PDF',
    }
  }

  if (isVideo(attachment.value.title || '', attachment.value.mimetype)) {
    return {
      icon: 'ncFileTypeVideo',
      title: attachment.value.mimetype?.split('/')?.at(-1) || 'Video',
    }
  }

  if (isAudio(attachment.value.title || '', attachment.value.mimetype)) {
    return {
      icon: 'ncFileTypeAudio',
      title: attachment.value.mimetype?.split('/')?.at(-1) || 'Audio',
    }
  }

  if (isWord(attachment.value.title || '', attachment.value.mimetype)) {
    return {
      icon: 'ncFileTypeWord',
      title: 'Word',
    }
  }

  if (isExcel(attachment.value.title || '', attachment.value.mimetype)) {
    return {
      icon: 'ncFileTypeCsv',
      title: 'Excel',
    }
  }

  if (isPresentation(attachment.value.title || '', attachment.value.mimetype)) {
    return {
      icon: 'ncFileTypePresentation',
      title: 'PPT',
    }
  }

  if (isZip(attachment.value.title || '', attachment.value.mimetype)) {
    return {
      icon: 'ncFileTypeZip',
      title: 'Zip',
    }
  }

  return {
    icon: 'ncFileTypeUnknown',
    title: attachment.value.mimetype?.split('/')?.at(-1) || 'File',
  }
})

const showRenameInput = ref(false)

const attachmentTitle = ref('')

function downloadCurrentFile() {
  refAttachmentCell.value?.downloadAttachment(attachment.value)
  isFileContentMenuOpen.value = false
}

function deleteCurrentFile() {
  refAttachmentCell.value?.removeAttachment(attachment.value.title, attachmentIndex.value)
  isFileContentMenuOpen.value = false
}

function updateAttachmentTitle() {
  if (!attachmentTitle.value?.trim()) return

  if (attachment.value.title === attachmentTitle.value) {
    return cancelRename()
  }

  refAttachmentCell.value?.updateAttachmentTitle(attachmentIndex.value, attachmentTitle.value)
  cancelRename()
}

function renameCurrentFile() {
  isFileContentMenuOpen.value = true
  attachmentTitle.value = attachment.value.title ?? ''
  showRenameInput.value = true
}

function cancelRename() {
  showRenameInput.value = false
  attachmentTitle.value = ''
  isFileContentMenuOpen.value = false
}

const onVisibilityChange = (value: boolean) => {
  isFileContentMenuOpen.value = value
}

useEventListener(document, 'click', (e) => {
  if ((e.target as HTMLElement)?.closest('.nc-attachments-preview-bar, .nc-dropdown')) return

  emits('expand', false)
})
</script>

<template>
  <div
    class="h-[56px] border-1 rounded-md overflow-hidden hover:bg-gray-50 cursor-pointer flex flex-row transition-all"
    :class="{
      'w-[56px] border-gray-200': !props.isExpanded,
      'w-full border-transparent': props.isExpanded,
      '!border-primary ring-3 ring-[#3069fe44] preview-cell-active': props.active,
    }"
    style="scroll-margin-top: 28px"
  >
    <div class="hidden">
      <LazyCellAttachment ref="refAttachmentCell" v-model="attachmentVModel" />
    </div>
    <div class="flex flex-col shrink-0 relative">
      <div class="h-0 w-[56px] flex-1 relative">
        <img
          v-if="isImage(attachment.title || '', attachment.mimetype)"
          :src="getPossibleAttachmentSrc(attachment, 'tiny')?.[0]"
          class="object-cover transition-all duration-300 absolute overflow-hidden"
          :class="{
            'top-0 left-0 right-0 w-full h-[calc(100%-20px)] rounded-none': !props.isExpanded,
            'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[36px] h-[36px] rounded-lg ring-1 ring-gray-300':
              props.isExpanded,
          }"
        />
        <GeneralIcon
          v-else
          :icon="fileEntry.icon"
          class="text-white !transition-all !duration-300 absolute w-full h-full"
          :class="{
            'top-0 left-0 right-0 h-[calc(100%-16px)]': !props.isExpanded,
            'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-[48px] w-[48px]': props.isExpanded,
          }"
        />
      </div>
      <div
        class="font-bold text-[12px] text-center uppercase truncate px-1 transition-all duration-300 absolute"
        :class="{
          'left-0 right-0 bottom-1': !props.isExpanded,
          'left-0 right-0 bottom-0 transform translate-y-full': props.isExpanded,
        }"
      >
        {{ fileEntry.title }}
      </div>
    </div>
    <div v-if="showRenameInput" class="flex-1 flex items-center pr-2">
      <a-input
        :ref="(el) => el?.focus?.()"
        v-model:value="attachmentTitle"
        class="!rounded-lg !w-auto flex-1"
        @blur="updateAttachmentTitle"
        @keyup.enter.prevent="updateAttachmentTitle"
        @keyup.esc="cancelRename"
      />
    </div>
    <div v-else class="whitespace-nowrap flex flex-col justify-center pl-1 w-[calc(100%_-_104px)]">
      <NcTooltip class="truncate max-w-full" show-on-truncate-only>
        <template #title>
          {{ attachment.title }}
        </template>
        {{ attachment.title }}
      </NcTooltip>
      <div class="text-xs text-gray-500">{{ getReadableFileSize(attachment.size!) }}</div>
    </div>
    <div v-if="props.isExpanded && !showRenameInput" class="self-center px-2">
      <NcDropdown @visible-change="onVisibilityChange">
        <NcButton type="text" size="xs" class="!px-1" @click.stop>
          <GeneralIcon icon="threeDotVertical" />
        </NcButton>
        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem @click="renameCurrentFile">
              <GeneralIcon icon="edit" />
              Rename
            </NcMenuItem>
            <NcMenuItem @click="downloadCurrentFile">
              <GeneralIcon icon="download" />
              Download
            </NcMenuItem>
            <NcDivider />
            <NcMenuItem class="!text-red-500" @click="deleteCurrentFile">
              <GeneralIcon icon="delete" />
              Delete
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
  </div>
</template>
