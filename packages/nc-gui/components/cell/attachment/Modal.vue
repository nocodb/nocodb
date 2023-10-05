<script lang="ts" setup>
import { onKeyDown, useEventListener } from '@vueuse/core'
import { useAttachmentCell } from './utils'
import { useSortable } from './sort'
import { iconMap, isImage, ref, useAttachment, useDropZone, useRoles, watch } from '#imports'

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
  downloadFile,
  updateModelValue,
  selectedImage,
  selectedVisibleItems,
  bulkDownloadFiles,
  renameFile,
} = useAttachmentCell()!

const isLocked = inject(IsLockedInj, ref(false))

const dropZoneRef = ref<HTMLDivElement>()

const sortableRef = ref<HTMLDivElement>()

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, readOnly)

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

const { isSharedForm } = useSmartsheetStoreOrThrow()

const { getPossibleAttachmentSrc, openAttachment } = useAttachment()

onKeyDown('Escape', () => {
  modalVisible.value = false
  isOverDropZone.value = false
})

function onClick(item: Record<string, any>) {
  selectedImage.value = item
  modalVisible.value = false

  const stopHandle = watch(selectedImage, (nextImage) => {
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
  <a-modal
    v-model:visible="modalVisible"
    class="nc-attachment-modal"
    :class="{ active: modalVisible }"
    width="80%"
    :footer="null"
    wrap-class-name="nc-modal-attachment-expand-cell"
  >
    <template #title>
      <div class="flex gap-4">
        <div
          v-if="isSharedForm || (!readOnly && isUIAllowed('dataEdit') && !isPublic && !isLocked)"
          class="nc-attach-file group"
          data-testid="attachment-expand-file-picker-button"
          @click="open"
        >
          <MaterialSymbolsAttachFile class="transform group-hover:(text-accent scale-120)" />
          {{ $t('activity.attachFile') }}
        </div>

        <div class="flex items-center gap-2">
          <div v-if="readOnly" class="text-gray-400">[{{ $t('labels.readOnly') }}]</div>
          {{ $t('labels.viewingAttachmentsOf') }}
          <div class="font-semibold underline">{{ column?.title }}</div>
        </div>

        <div v-if="selectedVisibleItems.includes(true)" class="flex flex-1 items-center gap-3 justify-end mr-[30px]">
          <NcButton type="primary" class="nc-attachment-download-all" @click="bulkDownloadFiles">
            {{ $t('activity.bulkDownload') }}
          </NcButton>
        </div>
      </div>
    </template>
    <div ref="dropZoneRef" tabindex="0">
      <template v-if="isSharedForm || (!readOnly && !dragging)">
        <general-overlay
          v-model="isOverDropZone"
          inline
          class="text-white ring ring-accent ring-opacity-100 bg-gray-700/75 flex items-center justify-center gap-2 backdrop-blur-xl"
        >
          <MaterialSymbolsFileCopyOutline class="text-accent" height="35" width="35" />
          <div class="text-white text-3xl">{{ $t('labels.dropHere') }}</div>
        </general-overlay>
      </template>

      <div ref="sortableRef" :class="{ dragging }" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 relative p-6">
        <div v-for="(item, i) of visibleItems" :key="`${item.title}-${i}`" class="flex flex-col gap-1">
          <a-card class="nc-attachment-item group">
            <a-checkbox
              v-model:checked="selectedVisibleItems[i]"
              class="nc-attachment-checkbox group-hover:(opacity-100)"
              :class="{ '!opacity-100': selectedVisibleItems[i] }"
            />

            <a-tooltip v-if="!readOnly">
              <template #title> {{ $t('title.removeFile') }} </template>
              <component
                :is="iconMap.closeCircle"
                v-if="isSharedForm || (isUIAllowed('dataEdit') && !isPublic && !isLocked)"
                class="nc-attachment-remove"
                @click.stop="onRemoveFileClick(item.title, i)"
              />
            </a-tooltip>

            <a-tooltip placement="bottom">
              <template #title> {{ $t('title.downloadFile') }} </template>

              <div class="nc-attachment-download group-hover:(opacity-100)">
                <component :is="iconMap.download" @click.stop="downloadFile(item)" />
              </div>
            </a-tooltip>

            <a-tooltip v-if="isSharedForm || (!readOnly && isUIAllowed('dataEdit') && !isPublic && !isLocked)" placement="bottom">
              <template #title> {{ $t('title.renameFile') }} </template>

              <div class="nc-attachment-download group-hover:(opacity-100) mr-[35px]">
                <component :is="iconMap.edit" @click.stop="renameFile(item, i)" />
              </div>
            </a-tooltip>

            <div
              :class="[dragging ? 'cursor-move' : 'cursor-pointer']"
              class="nc-attachment h-full w-full flex items-center justify-center overflow-hidden"
            >
              <LazyCellAttachmentImage
                v-if="isImage(item.title, item.mimetype)"
                :srcs="getPossibleAttachmentSrc(item)"
                class="object-cover h-64 m-auto justify-center"
                @click.stop="onClick(item)"
              />

              <component
                :is="FileIcon(item.icon)"
                v-else-if="item.icon"
                height="150"
                width="150"
                @click.stop="openAttachment(item)"
              />

              <IcOutlineInsertDriveFile v-else height="150" width="150" @click.stop="openAttachment(item)" />
            </div>
          </a-card>

          <div class="truncate" :title="item.title">
            {{ item.title }}
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
  </a-modal>
</template>

<style lang="scss">
.nc-attachment-modal {
  .nc-attach-file {
    @apply select-none cursor-pointer color-transition flex items-center gap-1 border-1 p-2 rounded
    @apply hover:(bg-primary bg-opacity-10 text-primary ring);
    @apply active:(ring-accent ring-opacity-100 bg-primary bg-opacity-20);
  }

  .nc-attachment-item {
    @apply !h-2/3 !min-h-[200px] flex items-center justify-center relative;

    @supports (-moz-appearance: none) {
      @apply hover:border-0;
    }

    &::after {
      @apply pointer-events-none rounded absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out;
      content: '';
    }

    @supports (-moz-appearance: none) {
      &:hover::after {
        @apply ring shadow transform scale-103;
      }

      &:active::after {
        @apply ring ring-accent ring-opacity-100 shadow transform scale-103;
      }
    }
  }

  .nc-attachment-download {
    @apply bg-white absolute bottom-2 right-2;
    @apply transition-opacity duration-150 ease-in opacity-0 hover:ring;
    @apply cursor-pointer rounded shadow flex items-center p-1 border-1;
    @apply active:(ring border-0 ring-accent);
  }

  .nc-attachment-checkbox {
    @apply absolute top-2 left-2;
    @apply transition-opacity duration-150 ease-in opacity-0;
  }

  .nc-attachment-remove {
    @apply absolute top-2 right-2 bg-white;
    @apply hover:(ring ring-red-500);
    @apply cursor-pointer rounded-full border-2;
    @apply active:(ring border-0 ring-red-500);
  }

  .ant-card-body {
    @apply !p-2 w-full h-full;
  }

  .ant-modal-body {
    @apply !p-0;
  }

  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  .dragging {
    .nc-attachment-item {
      @apply !pointer-events-none;
    }

    .ant-tooltip {
      @apply !hidden;
    }
  }
}
</style>
