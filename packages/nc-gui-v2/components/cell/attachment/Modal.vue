<script lang="ts" setup>
import { onKeyDown } from '@vueuse/core'
import { useAttachmentCell } from './utils'
import { useSortable } from './sort'
import { ref, useDropZone, useUIPermission } from '#imports'
import { isImage, openLink } from '~/utils'
import MaterialSymbolsAttachFile from '~icons/material-symbols/attach-file'
import MdiCloseCircle from '~icons/mdi/close-circle'
import MdiDownload from '~icons/mdi/download'
import MaterialSymbolsFileCopyOutline from '~icons/material-symbols/file-copy-outline'
import IcOutlineInsertDriveFile from '~icons/ic/outline-insert-drive-file'

const { isUIAllowed } = useUIPermission()

const {
  open,
  isLoading,
  isPublicGrid,
  isForm,
  isReadonly,
  visibleItems,
  modalVisible,
  column,
  FileIcon,
  removeFile,
  onDrop,
  downloadFile,
  updateModelValue,
  selectedImage,
} = useAttachmentCell()!

// todo: replace placeholder var
const isLocked = ref(false)

const dropZoneRef = ref<HTMLDivElement>()

const sortableRef = ref<HTMLDivElement>()

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, isReadonly)

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

onKeyDown('Escape', () => {
  modalVisible.value = false
  isOverDropZone.value = false
})
</script>

<template>
  <a-modal v-model:visible="modalVisible" class="nc-attachment-modal" width="80%" :footer="null">
    <template #title>
      <div class="flex gap-4">
        <div
          v-if="!isReadonly && (isForm || isUIAllowed('tableAttachment')) && !isPublicGrid && !isLocked"
          class="nc-attach-file group"
          @click="open"
        >
          <MaterialSymbolsAttachFile class="transform group-hover:(text-pink-500 scale-120)" />
          Attach File
        </div>

        <div class="flex items-center gap-2">
          <div v-if="isReadonly" class="text-gray-400">[Readonly]</div>
          Viewing Attachments of
          <div class="font-semibold underline">{{ column.title }}</div>
        </div>
      </div>
    </template>

    <div ref="dropZoneRef">
      <div
        v-if="!isReadonly && !dragging"
        :class="[isOverDropZone ? 'opacity-100' : 'opacity-0 pointer-events-none']"
        class="transition-all duration-150 ease-in-out ring ring-pink-500 rounded bg-gray-700/75 flex items-center justify-center gap-4 z-99 absolute top-0 bottom-0 left-0 right-0 backdrop-blur-xl"
      >
        <MaterialSymbolsFileCopyOutline class="text-pink-500" height="35" width="35" />
        <div class="text-white text-3xl">Drop here</div>
      </div>

      <div ref="sortableRef" :class="{ dragging }" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 relative p-6">
        <div v-for="(item, i) of visibleItems" :key="`${item.title}-${i}`" class="flex flex-col gap-1">
          <a-card class="nc-attachment-item group">
            <a-tooltip v-if="!isReadonly">
              <template #title> Remove File </template>

              <MdiCloseCircle
                v-if="isUIAllowed('tableAttachment') && !isPublicGrid && !isLocked"
                class="nc-attachment-remove"
                @click.stop="removeFile(i)"
              />
            </a-tooltip>

            <a-tooltip placement="bottom">
              <template #title> Download file </template>

              <div class="nc-attachment-download group-hover:(opacity-100)">
                <MdiDownload @click.stop="downloadFile(item)" />
              </div>
            </a-tooltip>

            <div class="nc-attachment h-full w-full flex items-center justify-center cursor-move">
              <div
                v-if="isImage(item.title, item.mimetype)"
                :style="{ backgroundImage: `url('${item.url}')` }"
                class="w-full h-full bg-contain bg-center bg-no-repeat"
                @click.stop="() => (selectedImage = item) && (modalVisible = false)"
              />

              <component
                :is="FileIcon(item.icon)"
                v-else-if="item.icon"
                height="150"
                width="150"
                @click.stop="openLink(item.url || item.data)"
              />

              <IcOutlineInsertDriveFile v-else height="150" width="150" @click.stop="openLink(item.url || item.data)" />
            </div>
          </a-card>

          <div class="truncate" :title="item.title">
            {{ item.title }}
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss">
.nc-attachment-modal {
  .nc-attach-file {
    @apply select-none cursor-pointer color-transition flex items-center gap-1 border-1 p-2 rounded
    @apply hover:(bg-primary/10 text-primary ring);
    @apply active:(ring-pink-500 bg-primary/20);
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
        @apply ring ring-pink-500 shadow transform scale-103;
      }
    }
  }

  .nc-attachment-download {
    @apply bg-white absolute bottom-2 right-2;
    @apply transition-opacity duration-150 ease-in opacity-0 hover:ring;
    @apply cursor-pointer rounded shadow flex items-center p-1 border-1;
    @apply active:(ring border-0 ring-pink-500);
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
