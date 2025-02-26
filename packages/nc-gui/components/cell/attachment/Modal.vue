<script lang="ts" setup>
import { onKeyDown, useEventListener } from '@vueuse/core'
import { useAttachmentCell } from './utils'
import { useSortable } from './sort'

const { isUIAllowed } = useRoles()

const {
  isLoading,
  isPublic,
  isReadonly: readOnly,
  visibleItems,
  modalVisible,
  column,
  onDrop,
  updateModelValue,
  selectedFile,
  selectedVisibleItems,
  bulkDownloadAttachments,
} = useAttachmentCell()!

const dropZoneRef = ref<HTMLDivElement>()

const canvasSelectCell = inject(CanvasSelectCellInj)
const sortableRef = ref<HTMLDivElement>()

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, readOnly)
const onDropAction = function (...args: any[]) {
  const draggingBool = unref(dragging)
  if (!draggingBool) {
    onDrop.apply(this, args)
  }
}

const { isOverDropZone } = useDropZone(dropZoneRef, onDropAction)

const { isSharedForm } = useSmartsheetStoreOrThrow()

onKeyDown('Escape', () => {
  modalVisible.value = false
  isOverDropZone.value = false
})

watch(modalVisible, (newVal, oldVal) => {
  if (oldVal && !newVal) canvasSelectCell?.trigger()
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

// when user paste on modal
useEventListener(dropZoneRef, 'paste', (event: ClipboardEvent) => {
  if (event.clipboardData?.files) {
    onDrop(event.clipboardData.files)
  }
})

const isNewAttachmentModalOpen = ref(false)
</script>

<template>
  <NcModal
    v-model:visible="modalVisible"
    wrap-class-name="nc-modal-attachment-expand-cell"
    class="nc-attachment-modal"
    :class="{ active: modalVisible }"
    width="80%"
  >
    <div class="flex justify-between pb-6 gap-4 items-center">
      <div class="font-semibold text-xl">{{ column?.title }}</div>

      <div class="flex items-center gap-2">
        <NcButton
          :disabled="!selectedVisibleItems.some((v) => !!v)"
          type="secondary"
          size="small"
          @click="bulkDownloadAttachments"
        >
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
          @click="isNewAttachmentModalOpen = true"
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
        class="grid max-h-140 overflow-auto nc-scrollbar-md md:grid-cols-3 xl:grid-cols-5 gap-y-8 gap-x-4 relative"
      >
        <CellAttachmentCard
          v-for="(item, i) in visibleItems"
          :key="`${item?.title}-${i}`"
          v-model:dragging="dragging"
          v-model:selected="selectedVisibleItems[i]"
          :attachment="item"
          :index="i"
          :allow-selection="true"
          :allow-rename="!isSharedForm || (!readOnly && isUIAllowed('dataEdit') && !isPublic)"
          :allow-delete="!readOnly"
          @clicked="onClick(item)"
        />
        <div v-if="isLoading" class="flex flex-col gap-1">
          <a-card class="nc-attachment-item group">
            <div class="nc-attachment h-full w-full flex items-center justify-center">
              <a-skeleton-image class />
            </div>
          </a-card>
        </div>

        <LazyCellAttachmentAttachFile v-if="isNewAttachmentModalOpen" v-model:value="isNewAttachmentModalOpen" />
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.hide-ui {
  @apply h-0 w-0 overflow-x-hidden whitespace-nowrap;
  .group:hover & {
    @apply h-auto w-auto overflow-visible whitespace-normal;
  }
}
.nc-attachment-modal {
  .nc-attachment-item {
    @apply h-[200px] max-h-[200px] flex relative overflow-hidden;
  }

  .dragging {
    .nc-attachment-item {
      @apply !pointer-events-none;
    }
  }

  .nc-checkbox > .ant-checkbox {
    box-shadow: none !important;
  }
}
</style>
