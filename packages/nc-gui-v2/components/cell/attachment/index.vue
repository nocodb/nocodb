<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'
import { useProvideAttachmentCell } from './utils'
import Modal from './Modal.vue'
import { useSortable } from './sort'
import Carousel from './Carousel.vue'
import { onMounted, ref, useDropZone, watch } from '#imports'
import { isImage, openLink } from '~/utils'
import MaterialSymbolsAttachFile from '~icons/material-symbols/attach-file'
import MaterialArrowExpandIcon from '~icons/mdi/arrow-expand'
import MaterialSymbolsFileCopyOutline from '~icons/material-symbols/file-copy-outline'
import MdiReload from '~icons/mdi/reload'
import IcOutlineInsertDriveFile from '~icons/ic/outline-insert-drive-file'

interface Props {
  modelValue: string | Record<string, any>[] | null
}

interface Emits {
  (event: 'update:modelValue', value: string | Record<string, any>): void
}

const { modelValue } = defineProps<Props>()

const emits = defineEmits<Emits>()

const dropZoneRef = ref<HTMLTableDataCellElement>()

const sortableRef = ref<HTMLDivElement>()

const { column, modalVisible, attachments, visibleItems, onDrop, isLoading, open, FileIcon, selectedImage, isReadonly } =
  useProvideAttachmentCell(updateModelValue)

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, isReadonly)

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

/** on new value, reparse our stored attachments */
watch(
  () => modelValue,
  (nextModel) => {
    if (nextModel) {
      attachments.value = ((typeof nextModel === 'string' ? JSON.parse(nextModel) : nextModel) || []).filter(Boolean)
    }
  },
  { immediate: true },
)

/** updates attachments array for autosave */
function updateModelValue(data: string | Record<string, any>) {
  emits('update:modelValue', typeof data !== 'string' ? JSON.stringify(data) : data)
}

/** Close modal on escape press, disable dropzone as well */
onKeyDown('Escape', () => {
  modalVisible.value = false
  isOverDropZone.value = false
})

/** if possible, on mounted we try to fetch the relevant `td` cell to use as a dropzone */
onMounted(() => {
  if (typeof document !== 'undefined') {
    dropZoneRef.value = document.querySelector(`td[data-col="${column.id}"]`) as HTMLTableDataCellElement
  }
})
</script>

<template>
  <div class="nc-attachment-cell relative flex-1 color-transition flex items-center justify-between gap-1">
    <Carousel />

    <template v-if="!isReadonly && !dragging && dropZoneRef">
      <general-overlay
        v-model="isOverDropZone"
        inline
        :target="`td[data-col='${column.id}']`"
        class="text-white text-lg ring ring-pink-500 bg-gray-700/75 flex items-center justify-center gap-2 backdrop-blur-xl"
      >
        <MaterialSymbolsFileCopyOutline class="text-pink-500" /> Drop here
      </general-overlay>
    </template>

    <div
      v-if="!isReadonly"
      :class="{ 'mx-auto px-4': !visibleItems.length }"
      class="group flex gap-1 items-center active:ring rounded border-1 p-1 hover:bg-primary/10"
      @click.stop="open"
    >
      <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

      <a-tooltip v-else placement="bottom">
        <template #title> Click or drop a file into cell </template>

        <div class="flex items-center gap-2">
          <MaterialSymbolsAttachFile class="transform group-hover:(text-pink-500 scale-120)" />

          <div v-if="!visibleItems.length" class="group-hover:text-primary">Add file(s)</div>
        </div>
      </a-tooltip>
    </div>

    <template v-if="visibleItems.length">
      <div ref="sortableRef" :class="{ dragging }" class="flex flex-wrap gap-2 p-1 scrollbar-thin-primary">
        <div
          v-for="(item, i) of visibleItems"
          :id="item.url"
          :key="item.url || item.title"
          style="flex: 1 1 50px"
          :class="isImage(item.title, item.mimetype) ? '' : 'border-1 rounded'"
          class="nc-attachment flex items-center justify-center"
        >
          <a-tooltip placement="bottom">
            <template #title>
              <div class="text-center w-full">{{ item.title }}</div>
            </template>

            <nuxt-img
              v-if="isImage(item.title, item.mimetype)"
              placeholder
              width="150"
              height="150"
              :alt="item.title || `#${i}`"
              :src="item.url || item.data"
              class="ring-1 ring-gray-300 rounded"
              @click="selectedImage = item"
            />

            <component :is="FileIcon(item.icon)" v-else-if="item.icon" @click="openLink(item.url || item.data)" />

            <IcOutlineInsertDriveFile v-else @click.stop="openLink(item.url || item.data)" />
          </a-tooltip>
        </div>
      </div>

      <div class="group flex gap-1 items-center border-1 active:ring rounded p-1 hover:bg-primary/10">
        <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

        <a-tooltip v-else placement="bottom">
          <template #title> View attachments </template>

          <MaterialArrowExpandIcon
            class="select-none transform group-hover:(text-pink-500 scale-120)"
            @click.stop="modalVisible = true"
          />
        </a-tooltip>
      </div>
    </template>

    <Modal />
  </div>
</template>

<style lang="scss">
.nc-cell {
  .nc-attachment-cell {
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
