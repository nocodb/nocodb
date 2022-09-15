<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'
import { useProvideAttachmentCell } from './utils'
import { useSortable } from './sort'
import {
  DropZoneRef,
  IsGalleryInj,
  inject,
  isImage,
  nextTick,
  openLink,
  ref,
  useDropZone,
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

const { modelValue, rowIndex } = defineProps<Props>()

const emits = defineEmits<Emits>()

const isGallery = inject(IsGalleryInj, ref(false))

const dropZoneInjection = inject(DropZoneRef, ref())

const attachmentCellRef = ref<HTMLDivElement>()

const sortableRef = ref<HTMLDivElement>()

const currentCellRef = dropZoneInjection && dropZoneInjection.value ? ref() : dropZoneInjection

const { cellRefs, isSharedForm } = useSmartsheetStoreOrThrow()!

const {
  isPublic,
  isForm,
  column,
  modalVisible,
  attachments,
  visibleItems,
  onDrop,
  isLoading,
  open,
  FileIcon,
  selectedImage,
  isReadonly,
  storedFiles,
} = useProvideAttachmentCell(updateModelValue)

watch(
  [() => rowIndex, isForm, attachmentCellRef],
  () => {
    if (dropZoneInjection?.value) return

    if (!rowIndex && (isForm.value || isGallery.value)) {
      currentCellRef.value = attachmentCellRef.value
    } else {
      nextTick(() => {
        const nextCell = cellRefs.value.reduceRight((cell, curr) => {
          if (!cell && curr.dataset.key === `${rowIndex}${column.value!.id}`) cell = curr

          return cell
        }, undefined as HTMLTableDataCellElement | undefined)

        if (!nextCell) {
          currentCellRef.value = attachmentCellRef.value
        } else {
          currentCellRef.value = nextCell
        }
      })
    }
  },
  { immediate: true, flush: 'post' },
)

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, isReadonly)

const { state: rowState } = useSmartsheetRowStoreOrThrow()

const { isOverDropZone } = useDropZone(currentCellRef, onDrop)

/** on new value, reparse our stored attachments */
watch(
  () => modelValue,
  (nextModel) => {
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
    }
  },
  { immediate: true },
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
</script>

<template>
  <div
    ref="attachmentCellRef"
    class="nc-attachment-cell relative flex-1 color-transition flex items-center justify-between gap-1"
  >
    <LazyCellAttachmentCarousel />

    <template v-if="isSharedForm || (!isReadonly && !dragging && !!currentCellRef)">
      <general-overlay
        v-model="isOverDropZone"
        inline
        :target="currentCellRef"
        class="nc-attachment-cell-dropzone text-white text-lg ring ring-accent ring-opacity-100 bg-gray-700/75 flex items-center justify-center gap-2 backdrop-blur-xl"
      >
        <MaterialSymbolsFileCopyOutline class="text-accent" /> Drop here
      </general-overlay>
    </template>

    <div
      v-if="!isReadonly"
      :class="{ 'mx-auto px-4': !visibleItems.length }"
      class="group cursor-pointer flex gap-1 items-center active:ring rounded border-1 p-1 hover:(bg-primary bg-opacity-10)"
      @click.stop="open"
    >
      <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

      <a-tooltip v-else placement="bottom">
        <template #title> Click or drop a file into cell </template>

        <div class="flex items-center gap-2">
          <MaterialSymbolsAttachFile class="transform group-hover:(text-accent scale-120) text-gray-500 text-[10px]" />

          <div v-if="!visibleItems.length" class="group-hover:text-primary text-gray-500 text-xs">Add file(s)</div>
        </div>
      </a-tooltip>
    </div>

    <div v-else class="flex" />

    <template v-if="visibleItems.length">
      <div
        ref="sortableRef"
        :class="{ dragging }"
        class="flex cursor-pointer justify-center items-center flex-wrap gap-2 p-1 scrollbar-thin-dull max-h-[150px] overflow-auto"
      >
        <template v-for="(item, i) of visibleItems" :key="item.url || item.title">
          <a-tooltip placement="bottom">
            <template #title>
              <div class="text-center w-full">{{ item.title }}</div>
            </template>

            <template v-if="isImage(item.title, item.mimetype ?? item.type) && (item.url || item.data)">
              <div class="nc-attachment flex items-center justify-center" @click="selectedImage = item">
                <LazyNuxtImg
                  quality="75"
                  placeholder
                  fit="cover"
                  :alt="item.title || `#${i}`"
                  :src="item.url || item.data"
                  class="max-w-full max-h-full"
                />
              </div>
            </template>

            <div v-else class="nc-attachment flex items-center justify-center" @click="openLink(item.url || item.data)">
              <component :is="FileIcon(item.icon)" v-if="item.icon" />

              <IcOutlineInsertDriveFile v-else />
            </div>
          </a-tooltip>
        </template>
      </div>

      <div class="group cursor-pointer flex gap-1 items-center border-1 active:ring rounded p-1 hover:(bg-primary bg-opacity-10)">
        <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

        <a-tooltip v-else placement="bottom">
          <template #title> View attachments </template>

          <MdiArrowExpand
            class="select-none transform group-hover:(text-accent scale-120) text-[10px] text-gray-500"
            @click.stop="modalVisible = true"
          />
        </a-tooltip>
      </div>
    </template>

    <LazyCellAttachmentModal />
  </div>
</template>

<style lang="scss">
.nc-cell {
  .nc-attachment-cell {
    .nc-attachment {
      @apply w-[50px] h-[50px] min-h-[50px] min-w-[50px] ring-1 ring-gray-300 rounded;
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
}
</style>
