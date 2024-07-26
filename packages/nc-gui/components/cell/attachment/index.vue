<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'
import { useProvideAttachmentCell } from './utils'
import { useSortable } from './sort'

interface Props {
  modelValue?: string | Record<string, any>[] | null
  rowIndex?: number
}

interface Emits {
  (event: 'update:modelValue', value: string | Record<string, any>[]): void
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits<Emits>()

const dropZoneInjection = inject(DropZoneRef, ref())

const attachmentCellRef = ref<HTMLDivElement>()

const sortableRef = ref<HTMLDivElement>()

const currentCellRef = inject(CurrentCellInj, dropZoneInjection.value)

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const { isSharedForm } = useSmartsheetStoreOrThrow()!

const { isMobileMode } = useGlobal()

const { getPossibleAttachmentSrc } = useAttachment()

const {
  isPublic,
  isForm,
  column,
  modalRendered,
  downloadAttachment,
  renameFile,
  modalVisible,
  attachments,
  visibleItems,
  onDrop,
  isLoading,
  FileIcon,
  selectedFile,
  isReadonly,
  storedFiles,
  removeFile,
} = useProvideAttachmentCell(updateModelValue)

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, isReadonly)

const active = inject(ActiveCellInj, ref(false))

const { state: rowState, row } = useSmartsheetRowStoreOrThrow()

const meta = inject(MetaInj, ref())

if (!isPublic.value && !isForm.value && meta.value) {
  useProvideRowComments(meta, row)
}

const { isOverDropZone } = useDropZone(currentCellRef as any, onDrop)

/** on new value, reparse our stored attachments */
watch(
  () => modelValue,
  async (nextModel) => {
    if (nextModel) {
      try {
        const nextAttachments = ((typeof nextModel === 'string' ? JSON.parse(nextModel) : nextModel) || []).filter(Boolean)

        if (isPublic.value && isForm.value) {
          storedFiles.value = nextAttachments
        } else {
          attachments.value = nextAttachments
        }
      } catch (e) {
        console.error(e)
        if (isPublic.value && isForm.value) {
          storedFiles.value = []
        } else {
          attachments.value = []
        }
      }
    } else {
      if (isPublic.value && isForm.value) {
        storedFiles.value = []
      } else {
        attachments.value = []
      }
    }
  },
  {
    immediate: true,
  },
)

/** updates attachments array for autosave */
function updateModelValue(data: string | Record<string, any>[]) {
  emits('update:modelValue', data)
}

/** Close modal on escape press, disable dropzone as well */
onKeyDown('Escape', () => {
  modalVisible.value = false
  isOverDropZone.value = false
})

/** sync storedFiles state with row state */
watch(
  () => storedFiles.value.length || 0,
  () => {
    rowState.value[column.value!.title!] = storedFiles.value
  },
)

const isNewAttachmentModalOpen = ref(false)

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e) => {
  if (modalVisible.value) return
  if (e.key === 'Enter' && !isReadonly.value && !selectedFile.value) {
    if (isNewAttachmentModalOpen.value) return
    e.stopPropagation()
    if (!modalVisible.value && !isMobileMode.value) {
      modalRendered.value = true
      modalVisible.value = true
    } else {
      // click Attach File button
      ;(document.querySelector('.nc-attachment-modal.active .nc-attach-file') as HTMLDivElement)?.click()
    }
  }
})

const rowHeight = inject(RowHeightInj, ref())

const openAttachmentModal = () => {
  isNewAttachmentModalOpen.value = true
}

const open = (e: Event) => {
  e.stopPropagation()

  openAttachmentModal()
}

const onExpand = () => {
  if (isMobileMode.value) return

  modalRendered.value = true
  modalVisible.value = true
}

const onFileClick = (item: any) => {
  if (isMobileMode.value && !isExpandedForm.value) return

  if (!isMobileMode.value && (isGallery.value || isKanban.value) && !isExpandedForm.value) return
  selectedFile.value = item
}

const keydownEnter = (e: KeyboardEvent) => {
  if (!isSurveyForm.value) {
    open(e)
    e.stopPropagation()
  }
}
const keydownSpace = (e: KeyboardEvent) => {
  if (isSurveyForm.value) {
    open(e)
    e.stopPropagation()
  }
}

const { isUIAllowed } = useRoles()
const isConfirmModalOpen = ref(false)
const filetoDelete = reactive({
  title: '',
  i: 0,
})

function onRemoveFileClick(title: any, i: number) {
  isConfirmModalOpen.value = true
  filetoDelete.i = i
  filetoDelete.title = title
}

const handleFileDelete = (i: number) => {
  removeFile(i)
  isConfirmModalOpen.value = false
  filetoDelete.i = 0
  filetoDelete.title = ''
}

const attachmentSize = computed(() => {
  if (isForm.value || isExpandedForm.value) {
    return 'small'
  }

  switch (rowHeight.value) {
    case 1:
      return 'tiny'
    case 2:
      return 'tiny'
    case 4:
      return 'small'
    case 6:
      return 'small'
    default:
      return 'tiny'
  }
})
</script>

<template>
  <div v-if="isExpandedForm || isForm" class="form-attachment-cell">
    <NcButton data-testid="attachment-cell-file-picker-button" type="secondary" size="small" @click="open">
      <div class="flex items-center !text-xs gap-1 justify-center">
        <MaterialSymbolsAttachFile class="text-gray-500 text-tiny" />
        <span class="text-[10px]">
          {{ $t('activity.addFiles') }}
        </span>
      </div>
    </NcButton>
    <LazyCellAttachmentCarousel v-if="selectedFile" />

    <div v-if="visibleItems.length > 0" class="grid mt-2 gap-2 grid-cols-2">
      <div
        v-for="(item, i) in visibleItems"
        :key="`${item?.title}-${i}`"
        class="nc-attachment-item group gap-2 flex border-1 rounded-md border-gray-200 flex-col relative"
      >
        <div
          :class="[dragging ? 'cursor-move' : 'cursor-pointer']"
          class="nc-attachment h-full flex justify-center items-center overflow-hidden"
        >
          <LazyCellAttachmentPreviewImage
            v-if="isImage(item.title, item.mimetype)"
            :srcs="getPossibleAttachmentSrc(item, 'small')"
            object-fit="cover"
            class="!w-full !h-42 object-cover !m-0 rounded-t-[5px] justify-center"
            @click="onFileClick(item)"
          />

          <component :is="FileIcon(item.icon)" v-else-if="item.icon" :height="45" :width="45" @click="selectedFile = item" />

          <IcOutlineInsertDriveFile v-else :height="45" :width="45" @click="selectedFile = item" />
        </div>

        <div class="relative px-1 flex" :title="item.title">
          <NcTooltip show-on-truncate-only class="flex-auto truncate w-full text-[13px] items-center text-sm line-height-4">
            {{ item.title }}

            <template #title>
              {{ item.title }}
            </template>
          </NcTooltip>
          <div class="flex-none hide-ui transition-all transition-ease-in-out !h-5 gap-0.5 pb-2 flex items-center bg-white">
            <NcTooltip placement="bottom">
              <template #title> {{ $t('title.downloadFile') }} </template>
              <NcButton
                class="!p-0 !w-5 !h-5 text-gray-500 !min-w-[fit-content]"
                size="xsmall"
                type="text"
                @click="downloadAttachment(item)"
              >
                <component :is="iconMap.download" class="!text-xs h-13px w-13px" />
              </NcButton>
            </NcTooltip>

            <NcTooltip v-if="!isSharedForm || (!isReadonly && isUIAllowed('dataEdit') && !isPublic)" placement="bottom">
              <template #title> {{ $t('title.renameFile') }} </template>
              <NcButton
                size="xsmall"
                class="!p-0 nc-attachment-rename !h-5 !w-5 !text-gray-500 !min-w-[fit-content]"
                type="text"
                @click="renameFile(item, i)"
              >
                <component :is="iconMap.rename" class="text-xs h-13px w-13px" />
              </NcButton>
            </NcTooltip>

            <NcTooltip v-if="!isReadonly" placement="bottom">
              <template #title> {{ $t('title.removeFile') }} </template>
              <NcButton
                class="!p-0 !h-5 !w-5 !text-red-500 nc-attachment-remove !min-w-[fit-content]"
                size="xsmall"
                type="text"
                @click="onRemoveFileClick(item.title, i)"
              >
                <component
                  :is="iconMap.delete"
                  v-if="isSharedForm || (isUIAllowed('dataEdit') && !isPublic)"
                  class="text-xs h-13px w-13px"
                />
              </NcButton>
            </NcTooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else
    ref="attachmentCellRef"
    :style="{
      height: `max(${!rowHeight || rowHeight === 1 ? rowHeightInPx['1'] - 10 : rowHeightInPx[`${rowHeight}`] - 18}px, ${
        isGrid ? '22px' : '32px'
      })`,
    }"
    class="nc-attachment-cell relative group flex color-transition gap-2 flex items-center w-full xs:(min-h-12 max-h-32)"
    :class="{ 'justify-center': !active, 'justify-between': active }"
  >
    <LazyCellAttachmentCarousel v-if="selectedFile" />

    <template v-if="!isReadonly && !dragging && !!currentCellRef">
      <general-overlay
        v-model="isOverDropZone"
        inline
        :target="currentCellRef"
        data-rec="true"
        class="nc-attachment-cell-dropzone text-white text-lg bg-gray-600/75 flex text-sm items-center justify-center gap-2"
      >
        <MaterialSymbolsFileCopyOutline />
        {{ $t('labels.dropHere') }}
      </general-overlay>
    </template>

    <div
      v-if="!isReadonly && active && !visibleItems.length"
      :class="{ 'sm:(mx-auto px-4) xs:(w-full min-w-8)': !visibleItems.length }"
      class="group cursor-pointer py-1 flex gap-1 items-center rounded border-none"
      tabindex="0"
      @keydown.enter="keydownEnter"
      @keydown.space="keydownSpace"
    >
      <component :is="iconMap.reload" v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

      <NcTooltip placement="bottom" class="xs:w-full">
        <template #title>
          <span data-rec="true">{{ $t('activity.attachmentDrop') }} </span>
        </template>

        <NcButton
          type="secondary"
          size="xsmall"
          data-testid="attachment-cell-file-picker-button"
          class="!px-2 !h-5.5 !min-w-[fit-content]"
          @click.stop="open"
        >
          <div class="flex items-center !text-xs gap-1 justify-center">
            <MaterialSymbolsAttachFile class="text-gray-500 text-tiny" />
            <span class="text-[10px]">
              {{ $t('activity.addFiles') }}
            </span>
          </div>
        </NcButton>
      </NcTooltip>
    </div>

    <template v-if="visibleItems.length > 0">
      <div
        ref="sortableRef"
        :class="{
          'justify-center': !isGallery && !isKanban,
          'py-1': rowHeight === 1,
          'py-1.5 !gap-4 ': rowHeight !== 1,
        }"
        class="nc-attachment-wrapper flex cursor-pointer w-full items-center flex-wrap gap-3 nc-scrollbar-thin mt-0 items-start px-[1px]"
        :style="{
          maxHeight: `max(100%, ${isGrid ? '22px' : '32px'})`,
        }"
      >
        <template v-for="(item, i) of visibleItems" :key="item.url || item.title">
          <NcTooltip placement="bottom" class="nc-attachment-item">
            <template #title>
              <div class="text-center w-full">{{ item.title }}</div>
            </template>
            <div v-if="isImage(item.title, item.mimetype ?? item.type)">
              <div
                class="nc-attachment flex items-center flex-col flex-wrap justify-center flex-auto"
                @click="() => onFileClick(item)"
              >
                <LazyCellAttachmentPreviewImage
                  :alt="item.title || `#${i}`"
                  class="rounded"
                  :class="{
                    'h-5.5': !isGrid && (!rowHeight || rowHeight === 1),
                    'h-4.5': isGrid && (!rowHeight || rowHeight === 1),
                    'h-8': rowHeight === 2,
                    'h-16.8': rowHeight === 4,
                    'h-20.8': rowHeight === 6,
                  }"
                  :srcs="getPossibleAttachmentSrc(item, attachmentSize)"
                />
              </div>
            </div>
            <div
              v-else
              class="nc-attachment flex items-center justify-center px-4"
              :class="{
                'h-5.5': !isGrid && (!rowHeight || rowHeight === 1),
                'h-4.5': isGrid && (!rowHeight || rowHeight === 1),
                'h-8': rowHeight === 2,
                'h-16.8': rowHeight === 4,
                'h-20.8 !w-30': rowHeight === 6,
              }"
              @click="onFileClick(item)"
            >
              <component :is="FileIcon(item.icon)" v-if="item.icon" />

              <IcOutlineInsertDriveFile v-else />
            </div>
          </NcTooltip>
        </template>
      </div>

      <NcTooltip
        placement="bottom"
        class="nc-action-icon !absolute hidden right-0 nc-text-area-expand-btn !group-hover:block z-3"
        :class="{
          'top-0': isGrid && !(!rowHeight || rowHeight === 1),
          'top-1': !isGrid,
        }"
        :style="isGrid && (!rowHeight || rowHeight === 1) ? { top: '50%', transform: 'translateY(-50%)' } : undefined"
      >
        <template #title>{{ $t('activity.viewAttachment') }}</template>
        <NcButton
          type="secondary"
          size="xsmall"
          data-testid="attachment-cell-file-picker-button"
          class="!p-0 !w-5 !h-5 !min-w-[fit-content]"
          @click.stop="onExpand"
        >
          <component :is="iconMap.reload" v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

          <component :is="iconMap.expand" v-else class="transform group-hover:(!text-grey-800) text-gray-700 text-xs" />
        </NcButton>
      </NcTooltip>

      <NcTooltip
        placement="bottom"
        class="nc-action-icon !absolute hidden left-0 nc-text-area-expand-btn !group-hover:block z-3"
        :class="{
          'top-0': isGrid && !(!rowHeight || rowHeight === 1),
          'top-1': !isGrid,
        }"
        :style="isGrid && (!rowHeight || rowHeight === 1) ? { top: '50%', transform: 'translateY(-50%)' } : undefined"
      >
        <template #title>{{ $t('activity.addFiles') }}</template>
        <NcButton
          type="secondary"
          size="xsmall"
          data-testid="attachment-cell-file-picker-button"
          class="!p-0 !w-5 !h-5 !min-w-[fit-content]"
          @click.stop="open"
        >
          <MaterialSymbolsAttachFile class="text-gray-500 text-tiny group-hover:(!text-grey-800) text-gray-700" />
        </NcButton>
      </NcTooltip>
    </template>

    <LazyCellAttachmentModal v-if="modalRendered" />
  </div>
  <LazyGeneralDeleteModal
    v-if="isForm || isExpandedForm"
    v-model:visible="isConfirmModalOpen"
    entity-name="File"
    :on-delete="() => handleFileDelete(filetoDelete.i)"
  >
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
  </LazyGeneralDeleteModal>
  <LazyCellAttachmentAttachFile v-if="isNewAttachmentModalOpen" v-model:value="isNewAttachmentModalOpen" />
</template>

<style lang="scss">
.nc-data-cell {
  &:has(.form-attachment-cell) {
    @apply !border-none;
    box-shadow: none !important;
  }

  .nc-cell-attachment {
    @apply !border-none;
  }
}
.nc-cell {
  .nc-attachment-cell {
    .nc-attachment {
      @apply min-h-5.5 !ring-1 !ring-gray-300 !rounded;
    }

    .ghost,
    .ghost > * {
      @apply !pointer-events-none;
    }

    .dragging {
      .ant-tooltip {
        @apply !hidden;
      }
    }
  }
  .nc-attachment-item {
    @apply relative;
  }
}
</style>
