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

const isUnderLookup = inject(IsUnderLookupInj, ref(false))
const isCanvasInjected = inject(IsCanvasInjectionInj, false)
const clientMousePosition = inject(ClientMousePositionInj)
const canvasSelectCell = inject(CanvasSelectCellInj)

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
  selectedFile,
  isReadonly,
  storedFiles,
  removeFile,
  updateAttachmentTitle,
  isEditAllowed,
} = useProvideAttachmentCell(updateModelValue)

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, isReadonly)

const active = inject(ActiveCellInj, ref(false))

const { state: rowState, row } = useSmartsheetRowStoreOrThrow()

const meta = inject(MetaInj, ref())

if (!isPublic.value && !isForm.value && meta.value) {
  useProvideRowComments(meta, row)
}

const onDropAction = function (...args: any[]) {
  const draggingBool = unref(dragging)
  if (!draggingBool) {
    onDrop.apply(this, args)
  }
}
const { isOverDropZone } = useDropZone(currentCellRef as any, onDropAction)

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

watch(isNewAttachmentModalOpen, (newVal, oldVal) => {
  if (oldVal && !newVal) canvasSelectCell?.trigger()
})

watch(selectedFile, (newVal, oldVal) => {
  if (oldVal && !newVal) canvasSelectCell?.trigger()
})

const openAttachmentModal = (e: Event) => {
  e?.stopPropagation()
  isNewAttachmentModalOpen.value = true
}

onKeyDown('Enter', () => {
  if (!isUnderLookup.value && isCanvasInjected && !isExpandedForm.value && isGrid.value) {
    if (attachments.value.length) {
      modalRendered.value = true
      modalVisible.value = true
    } else if (isEditAllowed.value) {
      isNewAttachmentModalOpen.value = true
    }
  }
})
useSelectedCellKeydownListener(inject(ActiveCellInj, ref(false)), (e) => {
  if (isCanvasInjected) return
  if (modalVisible.value) return
  if (e.key === 'Enter' && !isReadonly.value && !selectedFile.value) {
    if (isNewAttachmentModalOpen.value) return
    e.stopPropagation()
    if (!isMobileMode.value && visibleItems.value.length) {
      modalRendered.value = true
      modalVisible.value = true
    } else {
      // open attachment modal
      openAttachmentModal(e)
    }
  }
})

const rowHeight = inject(RowHeightInj, ref())

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
    openAttachmentModal(e)
    e.stopPropagation()
  }
}
const keydownSpace = (e: KeyboardEvent) => {
  if (isSurveyForm.value) {
    openAttachmentModal(e)
    e.stopPropagation()
  }
}

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

const showAllAttachments = ref(false)

defineExpose({
  openFilePicker: openAttachmentModal,
  downloadAttachment,
  renameAttachment: renameFile,
  removeAttachment: onRemoveFileClick,
  updateAttachmentTitle,
})

onMounted(() => {
  if (!isUnderLookup.value && isCanvasInjected && !isExpandedForm.value && isGrid.value) {
    forcedNextTick(() => {
      const clickableSelectors = ['.view-attachments', '.add-files', '.nc-attachment', '.empty-add-files']
        .map((selector) => `.nc-canvas-table-editable-cell-wrapper ${selector}`)
        .join(', ')
      const clickable = getElementAtMouse<HTMLElement>(clickableSelectors, clientMousePosition)
      if (clickable) {
        clickable.click()
      } else {
        if (attachments.value.length) {
          modalRendered.value = true
          modalVisible.value = true
        } else if (isEditAllowed.value) {
          isNewAttachmentModalOpen.value = true
        }
      }
    })
  }
})
</script>

<template>
  <div v-if="isExpandedForm || isForm" class="form-attachment-cell">
    <LazyCellAttachmentCarousel v-if="selectedFile" />
    <div v-if="visibleItems.length > 0" ref="sortableRef" class="flex flex-wrap items-stretch mb-2 gap-2">
      <CellAttachmentCard
        v-for="(item, i) in showAllAttachments ? visibleItems : visibleItems.slice(0, 3)"
        :key="`${item?.title}-${i}`"
        v-model:dragging="dragging"
        class="nc-attachment-item group gap-2 flex border-1 rounded-md border-gray-200 flex-col relative w-[124px] overflow-hidden"
        :attachment="item"
        :index="i"
        :allow-selection="false"
        :allow-rename="isEditAllowed"
        :allow-delete="!isReadonly"
        preview-class-override="!h-20"
        :rename-inline="false"
        :confirm-to-delete="true"
        @clicked="onFileClick(item)"
        @on-delete="onRemoveFileClick(item.title, i)"
      />
    </div>
    <div v-if="visibleItems.length > 3" class="mb-2">
      <NcButton type="text" size="small" @click="showAllAttachments = !showAllAttachments">
        {{
          showAllAttachments ? `${$t('general.showLess')}` : `+ ${visibleItems.length - 3} ${$t('general.more').toLowerCase()}`
        }}
      </NcButton>
    </div>
    <NcButton
      v-if="isEditAllowed"
      data-testid="attachment-cell-file-picker-button"
      type="secondary"
      size="xsmall"
      class="mb-1 !px-2"
      @click="openAttachmentModal"
    >
      <div class="flex items-center gap-1.5 justify-center">
        <GeneralIcon icon="upload" class="text-gray-500 h-3.5 w-3.5" />
        <span class="text-tiny">
          {{ $t('activity.uploadFiles') }}
        </span>
      </div>
    </NcButton>

    <LazyGeneralDeleteModal
      v-model:visible="isConfirmModalOpen"
      entity-name="File"
      :on-delete="async () => handleFileDelete(filetoDelete.i)"
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
  </div>
  <div v-else ref="attachmentCellRef" class="nc-attachment-cell relative group color-transition" :data-row-height="rowHeight">
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
      class="group cursor-pointer flex nc-upload-btn gap-1 items-center rounded border-none"
      tabindex="0"
      @keydown.enter="keydownEnter"
      @keydown.space="keydownSpace"
    >
      <component :is="iconMap.reload" v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

      <NcTooltip placement="bottom" class="w-full text-center">
        <template #title>
          <span data-rec="true">{{ $t('activity.attachmentDrop') }} </span>
        </template>

        <NcButton
          type="secondary"
          size="xs"
          data-testid="attachment-cell-file-picker-button"
          class="!px-2 !h-6 !min-w-[fit-content] empty-add-files"
          @click.stop="openAttachmentModal"
        >
          <div class="flex items-center gap-1 justify-center">
            <GeneralIcon icon="upload" class="text-gray-500 text-tiny" />
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
        }"
        class="nc-attachment-wrapper flex cursor-pointer w-full items-center flex-wrap gap-2 mt-0 items-start overflow-y-auto nc-scrollbar-thin"
        :style="{
          height: `max(${
            !rowHeight || rowHeight === 1 ? Number(rowHeightInPx['1']) - 1 : rowHeightInPx[`${rowHeight}`] - 17
          }px, ${isGrid ? 22 : 32}px)`,
          paddingTop: !rowHeight || rowHeight === 1 ? '4px' : undefined,
          paddingBottom: !rowHeight || rowHeight === 1 ? '4px' : undefined,
        }"
      >
        <NcTooltip v-for="(item, i) of visibleItems" :key="item.url || item.title" placement="bottom" class="nc-attachment-item">
          <template #title>
            <div class="text-center w-full">{{ item.title }}</div>
          </template>
          <div
            class="aspect-square"
            :class="{
              'h-[24px]': !rowHeight || rowHeight === 1,
              'h-[32px]': rowHeight === 2,
              'h-[64px]': rowHeight === 4 || rowHeight === 6,
            }"
          >
            <LazyCellAttachmentPreviewImage
              v-if="isImage(item.title, item.mimetype ?? item.type)"
              :alt="item.title || `#${i}`"
              class="nc-attachment rounded-lg w-full h-full object-cover overflow-hidden"
              :srcs="getPossibleAttachmentSrc(item, attachmentSize)"
              @click="() => onFileClick(item)"
            />
            <div v-else class="nc-attachment h-full w-full flex items-center justify-center" @click="onFileClick(item)">
              <CellAttachmentIconView :item="item" class="max-h-full max-w-full" />
            </div>
          </div>
        </NcTooltip>
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
          class="!p-0 !w-5 !h-5 !min-w-[fit-content] view-attachments"
          @click.stop="onExpand"
        >
          <component :is="iconMap.reload" v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

          <component :is="iconMap.maximize" v-else class="transform group-hover:(!text-grey-800) text-gray-700 w-3 h-3" />
        </NcButton>
      </NcTooltip>

      <NcTooltip
        v-if="isEditAllowed"
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
          class="!p-0 !w-5 !h-5 !min-w-[fit-content] add-files"
          @click.stop="openAttachmentModal"
        >
          <GeneralIcon icon="ncPaperclip" class="w-3 group-hover:(!text-grey-800) text-nc-content-gray-subtle" />
        </NcButton>
      </NcTooltip>
    </template>

    <LazyCellAttachmentModal v-if="modalRendered" />
  </div>
  <LazyCellAttachmentAttachFile v-if="isNewAttachmentModalOpen" v-model:value="isNewAttachmentModalOpen" />
</template>

<style lang="scss">
.nc-data-cell {
  &:has(.form-attachment-cell) {
    @apply !border-none pt-1 -mt-1;
    box-shadow: none !important;

    &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
      box-shadow: none !important;
    }
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
