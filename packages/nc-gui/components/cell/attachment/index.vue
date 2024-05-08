<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'
import { useProvideAttachmentCell } from './utils'
import { useSortable } from './sort'
import {
  ActiveCellInj,
  CurrentCellInj,
  DropZoneRef,
  IsExpandedFormOpenInj,
  IsGalleryInj,
  IsGridInj,
  IsKanbanInj,
  IsSurveyFormInj,
  RowHeightInj,
  iconMap,
  inject,
  isImage,
  ref,
  useAttachment,
  useDropZone,
  useSelectedCellKeyupListener,
  useSmartsheetRowStoreOrThrow,
  useSmartsheetStoreOrThrow,
  watch,
} from '#imports'

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

const { getPossibleAttachmentSrc, openAttachment: _openAttachment } = useAttachment()

const {
  isPublic,
  isForm,
  column,
  modalVisible,
  attachments,
  visibleItems,
  onDrop,
  isLoading,
  open: _open,
  FileIcon,
  selectedImage,
  isReadonly,
  storedFiles,
  removeFile,
} = useProvideAttachmentCell(updateModelValue)

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, isReadonly)

const active = inject(ActiveCellInj, ref(false))

const { state: rowState } = useSmartsheetRowStoreOrThrow()

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

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e) => {
  if (e.key === 'Enter' && !isReadonly.value) {
    e.stopPropagation()
    if (!modalVisible.value && !isMobileMode.value) {
      modalVisible.value = true
    } else {
      // click Attach File button
      ;(document.querySelector('.nc-attachment-modal.active .nc-attach-file') as HTMLDivElement)?.click()
    }
  }
})

const rowHeight = inject(RowHeightInj, ref())

const open = (e: Event) => {
  e.stopPropagation()

  _open()
}

const openAttachment = (item: any) => {
  if (isMobileMode.value && !isExpandedForm.value) {
    isExpandedForm.value = true

    return
  }

  _openAttachment(item)
}

const onExpand = () => {
  if (isMobileMode.value) return

  modalVisible.value = true
}

const onImageClick = (item: any) => {
  if (isMobileMode.value && !isExpandedForm.value) return

  if (!isMobileMode.value && (isGallery.value || (isKanban.value && !isExpandedForm.value))) return

  selectedImage.value = item
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
</script>

<template>
  <div
    ref="attachmentCellRef"
    :style="{
      height:
        isForm || isExpandedForm
          ? undefined
          : `max(${!rowHeight || rowHeight === 1 ? rowHeightInPx['1'] - 10 : rowHeightInPx[`${rowHeight}`] - 18}px, ${
              isGrid ? '22px' : '32px'
            })`,
    }"
    class="nc-attachment-cell relative flex color-transition flex items-center w-full xs:(min-h-12 max-h-32)"
    :class="{ 'justify-center': !active, 'justify-between': active, 'px-2': isExpandedForm }"
  >
    <LazyCellAttachmentCarousel />

    <template v-if="isSharedForm || (!isReadonly && !dragging && !!currentCellRef)">
      <general-overlay
        v-model="isOverDropZone"
        inline
        :target="currentCellRef"
        data-rec="true"
        class="nc-attachment-cell-dropzone text-white text-lg ring ring-accent ring-opacity-100 bg-gray-700/75 flex items-center justify-center gap-2 backdrop-blur-xl"
      >
        <MaterialSymbolsFileCopyOutline class="text-accent" />
        {{ $t('labels.dropHere') }}
      </general-overlay>
    </template>

    <div
      v-if="!isReadonly"
      :class="{ 'sm:(mx-auto px-4) xs:(w-full min-w-8)': !visibleItems.length }"
      class="group cursor-pointer py-1 flex gap-1 items-center active:(ring ring-accent ring-opacity-100) rounded border-none shadow-sm hover:(bg-primary bg-opacity-10) dark:(!bg-slate-500)"
      data-testid="attachment-cell-file-picker-button"
      tabindex="0"
      @click="open"
      @keydown.enter="keydownEnter"
      @keydown.space="keydownSpace"
    >
      <component :is="iconMap.reload" v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

      <NcTooltip placement="bottom" class="xs:w-full">
        <template #title
          ><span data-rec="true">{{ $t('activity.attachmentDrop') }} </span></template
        >

        <div
          v-if="active || !visibleItems.length || (isForm && visibleItems.length)"
          class="flex items-center gap-1 xs:(w-full min-w-12 h-7 justify-center)"
        >
          <MaterialSymbolsAttachFile
            class="transform dark:(!text-white) group-hover:(!text-accent scale-120) text-gray-500 text-tiny"
          />
          <div
            v-if="!visibleItems.length"
            data-rec="true"
            class="group-hover:text-primary text-gray-500 dark:text-gray-200 dark:group-hover:!text-white text-tiny xs:(justify-center rounded-lg text-sm)"
          >
            {{ $t('activity.addFiles') }}
          </div>
        </div>
      </NcTooltip>
    </div>

    <div v-else class="flex" />

    <template v-if="visibleItems.length">
      <div
        ref="sortableRef"
        :class="{
          'justify-center': !isExpandedForm && !isGallery && !isKanban,
          'py-1': rowHeight === 1 && !isForm && !isExpandedForm,
          'py-1.5': rowHeight !== 1 || isForm || isExpandedForm,
        }"
        class="nc-attachment-wrapper flex cursor-pointer w-full items-center flex-wrap gap-2 scrollbar-thin-dull overflow-hidden mt-0 items-start"
        :style="{
          maxHeight: isForm || isExpandedForm ? undefined : `max(100%, ${isGrid ? '22px' : '32px'})`,
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
                :class="{ 'ml-2': active, '!w-30': isForm || isExpandedForm }"
                @click="() => onImageClick(item)"
              >
                <LazyCellAttachmentImage
                  :alt="item.title || `#${i}`"
                  class="rounded"
                  :class="{
                    'h-5.5': !isGrid && (!rowHeight || rowHeight === 1),
                    'h-4.5': isGrid && (!rowHeight || rowHeight === 1),
                    'h-8': rowHeight === 2,
                    'h-16.8': rowHeight === 4,
                    'h-20.8': rowHeight === 6 || isForm || isExpandedForm,
                  }"
                  :srcs="getPossibleAttachmentSrc(item)"
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
                'h-20.8 !w-30': rowHeight === 6 || isForm || isExpandedForm,
                'ml-2': active,
              }"
              @click="openAttachment(item)"
            >
              <component :is="FileIcon(item.icon)" v-if="item.icon" :class="{ 'h-13 w-13': isForm || isExpandedForm }" />

              <IcOutlineInsertDriveFile v-else :class="{ 'h-13 w-13': isForm || isExpandedForm }" />
            </div>

            <a-tooltip v-if="isForm || isExpandedForm">
              <template #title> {{ $t('title.removeFile') }} </template>
              <component
                :is="iconMap.closeCircle"
                v-if="isSharedForm || (isUIAllowed('dataEdit') && !isPublic)"
                class="nc-attachment-remove"
                @click.stop="onRemoveFileClick(item.title, i)"
              />
            </a-tooltip>
          </NcTooltip>
        </template>
      </div>

      <div
        v-if="active || (isForm && visibleItems.length)"
        class="xs:hidden h-6 w-5 group cursor-pointer flex gap-1 items-center active:(ring ring-accent ring-opacity-100) rounded border-none p-1 hover:(bg-primary bg-opacity-10) dark:(!bg-slate-500)"
      >
        <component :is="iconMap.reload" v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

        <NcTooltip v-else placement="bottom" class="flex">
          <template #title> {{ $t('activity.viewAttachment') }}</template>

          <component
            :is="iconMap.expand"
            class="flex-none transform dark:(!text-white) group-hover:(!text-grey-800 scale-120) text-gray-500 text-[0.75rem]"
            @click.stop="onExpand"
          />
        </NcTooltip>
      </div>
    </template>

    <LazyCellAttachmentModal />

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
  </div>
</template>

<style lang="scss">
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

    .nc-attachment-remove {
      @apply absolute -right-2 -top-2 rounded-full hidden;
    }

    &:hover .nc-attachment-remove {
      @apply block;
    }
  }
}
</style>
