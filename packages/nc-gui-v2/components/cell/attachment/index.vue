<script setup lang="ts">
import { useProvideAttachmentCell } from './utils'
import Modal from './Modal.vue'
import { ref, useDropZone, watch } from '#imports'
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

const dropZoneRef = ref<HTMLDivElement>()

const { modalVisible, attachments, visibleItems, onFileSelect, isLoading, open, FileIcon, fileRemovedHook, fileAddedHook } =
  useProvideAttachmentCell()

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

watch(
  () => modelValue,
  (nextModel) => {
    if (nextModel) {
      attachments.value = ((typeof nextModel === 'string' ? JSON.parse(nextModel) : nextModel) || []).filter(Boolean)
    }
  },
  { immediate: true },
)

fileRemovedHook.on((data) => {
  emits('update:modelValue', data)
})

fileAddedHook.on((data) => {
  emits('update:modelValue', data)
})

function onDrop(droppedFiles: File[] | null) {
  if (droppedFiles) {
    // set files
    onFileSelect(droppedFiles)
  }
}

const selectImage = (file: any, i: unknown) => {
  // todo: implement
}
</script>

<template>
  <div ref="dropZoneRef" class="flex-1 color-transition flex items-center justify-between gap-1">
    <template v-if="isOverDropZone">
      <div
        class="w-full h-full flex items-center justify-center p-1 rounded gap-1 bg-gradient-to-t from-primary/10 via-primary/25 to-primary/10 !text-primary"
      >
        <MaterialSymbolsFileCopyOutline class="text-pink-500" /> Drop here
      </div>
    </template>

    <template v-else>
      <div
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
        <div
          class="h-full w-full flex flex-wrap flex-col gap-2 content-start py-1 overflow-x-scroll overflow-y-hidden scrollbar-thin-primary"
        >
          <div
            v-for="(item, i) of visibleItems"
            :key="item.url || item.title"
            class="flex-auto flex items-center justify-center w-[45px] border-1"
          >
            <a-tooltip placement="bottom">
              <template #title>
                <div class="text-center w-full">{{ item.title }}</div>
              </template>

              <img
                v-if="isImage(item.title, item.mimetype)"
                :alt="item.title || `#${i}`"
                :src="item.url || item.data"
                @click="selectImage(item.url || item.data, i)"
              />

              <component :is="FileIcon(item.icon)" v-else-if="item.icon" @click="openLink(item.url || item.data)" />

              <IcOutlineInsertDriveFile v-else @click.stop="openLink(item.url || item.data)" />
            </a-tooltip>
          </div>
        </div>

        <div class="group flex gap-1 items-center active:ring rounded border-1 p-1 hover:bg-primary/10">
          <MdiReload v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

          <a-tooltip v-else placement="bottom">
            <template #title> View attachments </template>

            <MaterialArrowExpandIcon class="transform group-hover:(text-pink-500 scale-120)" @click.stop="modalVisible = true" />
          </a-tooltip>
        </div>
      </template>
    </template>

    <Modal />
  </div>
</template>
