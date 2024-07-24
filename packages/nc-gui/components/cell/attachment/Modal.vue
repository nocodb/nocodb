<script lang="ts" setup>
import { onKeyDown, useEventListener } from '@vueuse/core'
import { useAttachmentCell } from './utils'
import { useSortable } from './sort'

const { isUIAllowed } = useRoles()

const {
  open,
  isLoading,
  isPublic,
  isReadonly: readOnly,
  visibleItems,
  modalVisible,
  column,
  FileIcon,
  removeFile,
  onDrop,
  downloadAttachment,
  updateModelValue,
  selectedFile,
  selectedVisibleItems,
  bulkDownloadAttachments,
  renameFile,
} = useAttachmentCell()!

const dropZoneRef = ref<HTMLDivElement>()

const sortableRef = ref<HTMLDivElement>()

const { isMobileMode } = useGlobal()

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, readOnly)

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

const { isSharedForm } = useSmartsheetStoreOrThrow()

const { getPossibleAttachmentSrc, openAttachment } = useAttachment()

onKeyDown('Escape', () => {
  modalVisible.value = false
  isOverDropZone.value = false
})

function onClick(item: Record<string, any>) {
  selectedFile.value = item
  modalVisible.value = false

  const stopHandle = watch(selectedFile, (nextImage) => {
    if (!nextImage) {
      setTimeout(() => {
        modalVisible.value = true
      }, 50)
      stopHandle?.()
    }
  })
}

const isModalOpen = ref(false)
const filetoDelete = reactive({
  title: '',
  i: 0,
})

function onRemoveFileClick(title: any, i: number) {
  isModalOpen.value = true
  filetoDelete.i = i
  filetoDelete.title = title
}

// when user paste on modal
useEventListener(dropZoneRef, 'paste', (event: ClipboardEvent) => {
  if (event.clipboardData?.files) {
    onDrop(event.clipboardData.files)
  }
})
const handleFileDelete = (i: number) => {
  removeFile(i)
  isModalOpen.value = false
  filetoDelete.i = 0
  filetoDelete.title = ''
}
</script>

<template>
  <NcModal
    v-model:visible="modalVisible"
    wrap-class-name="nc-modal-attachment-expand-cell"
    class="nc-attachment-modal"
    :class="{ active: modalVisible }"
    width="80%"
  >
    <div class="flex justify-between pb-2 gap-4">
      <div class="font-semibold underline">{{ column?.title }}</div>

      <div class="flex items-center gap-2">
        <NcButton v-if="selectedVisibleItems.length > 0" size="small" @click="bulkDownloadAttachments">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="download" />
            {{ $t('activity.bulkDownload') }}
          </div>
        </NcButton>

        <NcButton
          v-if="isSharedForm || (!readOnly && isUIAllowed('dataEdit') && !isPublic)"
          class="nc-attach-file group"
          size="small"
          data-testid="attachment-expand-file-picker-button"
          @click="open"
        >
          <div class="flex gap-2 items-center">
            <component :is="iconMap.cellAttachment" class="w-4 h-4" />
            {{ $t('activity.attachFile') }}
          </div>
        </NcButton>

        <NcButton type="secondary" size="small" @click="modalVisible = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
    </div>

    <div ref="dropZoneRef" tabindex="0" class="relative">
      <div
        v-if="isSharedForm || (!readOnly && !dragging && isOverDropZone)"
        class="text-white absolute inset-0 bg-white flex flex-col items-center justify-center gap-2 border-dashed border-1 border-gray-700"
      >
        <MaterialSymbolsFileCopyOutline class="text-accent" height="35" width="35" />
        <div class="text-gray-800 text-3xl">{{ $t('labels.dropHere') }}</div>
      </div>

      <div
        ref="sortableRef"
        :class="{ dragging }"
        class="grid max-h-140 overflow-auto nc-scrollbar-md md:grid-cols-3 xl:grid-cols-5 gap-y-8 gap-x-4 relative"
      >
        <div
          v-for="(item, i) of visibleItems"
          :key="`${item.title}-${i}`"
          class="nc-attachment-item group flex border-1 gap-2 rounded-md border-gray-200 flex-col relative"
        >
          <NcCheckbox
            v-model:checked="selectedVisibleItems[i]"
            class="nc-attachment-checkbox absolute top-2 left-2 group-hover:(opacity-100)"
            :class="{ '!opacity-100': selectedVisibleItems[i] }"
          />

          <div
            :class="[dragging ? 'cursor-move' : 'cursor-pointer']"
            class="nc-attachment h-full flex justify-center items-center overflow-hidden"
          >
            <LazyCellAttachmentPreviewImage
              v-if="isImage(item.title, item.mimetype)"
              :srcs="getPossibleAttachmentSrc(item)"
              class="max-h-full h-64 m-auto rounded-md justify-center"
              @click.stop="onClick(item)"
            />

            <component
              :is="FileIcon(item.icon)"
              v-else-if="item.icon"
              :height="isMobileMode ? 45 : 150"
              :width="isMobileMode ? 45 : 150"
              @click.stop="openAttachment(item)"
            />

            <IcOutlineInsertDriveFile
              v-else
              :height="isMobileMode ? 45 : 150"
              :width="isMobileMode ? 45 : 150"
              @click.stop="openAttachment(item)"
            />
          </div>

          <div class="relative px-1 flex" :title="item.title">
            <div class="flex-auto truncate line-height-4">
              {{ item.title }}
            </div>
            <div class="flex-none hide-ui transition-all transition-ease-in-out !h-6 flex items-center bg-white">
              <NcTooltip placement="bottom">
                <template #title> {{ $t('title.downloadFile') }} </template>
                <NcButton class="!text-gray-500" size="xsmall" type="text" @click="downloadAttachment(item)">
                  <component :is="iconMap.download" />
                </NcButton>
              </NcTooltip>

              <NcTooltip v-if="!isSharedForm || (!readOnly && isUIAllowed('dataEdit') && !isPublic)" placement="bottom">
                <template #title> {{ $t('title.renameFile') }} </template>
                <NcButton size="xsmall" class="nc-attachment-rename !text-gray-500" type="text" @click="renameFile(item, i)">
                  <component :is="iconMap.rename" />
                </NcButton>
              </NcTooltip>

              <NcTooltip v-if="!readOnly" placement="bottom">
                <template #title> {{ $t('title.removeFile') }} </template>
                <NcButton class="!text-red-500" size="xsmall" type="text" @click="onRemoveFileClick(item.title, i)">
                  <component :is="iconMap.delete" v-if="isSharedForm || (isUIAllowed('dataEdit') && !isPublic)" />
                </NcButton>
              </NcTooltip>
            </div>
          </div>
        </div>

        <div v-if="isLoading" class="flex flex-col gap-1">
          <a-card class="nc-attachment-item group">
            <div class="nc-attachment h-full w-full flex items-center justify-center">
              <a-skeleton-image class />
            </div>
          </a-card>
        </div>
      </div>
    </div>

    <GeneralDeleteModal v-model:visible="isModalOpen" entity-name="File" :on-delete="() => handleFileDelete(filetoDelete.i)">
      <template #entity-preview>
        <span>
          <div class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700 mb-4">
            <GeneralIcon icon="file" class="nc-view-icon"></GeneralIcon>
            <div
              class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
              :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            >
              {{ filetoDelete.title }}
            </div>
          </div>
        </span>
      </template>
    </GeneralDeleteModal>
  </NcModal>
</template>

<style lang="scss">
.hide-ui {
  @apply h-0 w-0 overflow-hidden whitespace-nowrap;
  .group:hover & {
    @apply h-auto w-auto overflow-visible whitespace-normal;
  }
}
.nc-attachment-modal {
  .nc-attachment-item {
    @apply h-[200px] max-h-[200px] flex relative;
  }

  .dragging {
    .nc-attachment-item {
      @apply !pointer-events-none;
    }
  }
}
</style>
