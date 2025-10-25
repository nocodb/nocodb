<script setup lang="ts">
import { useUploadState } from './useUploadState'

const { isMobileMode } = useGlobal()

const { tempFiles, addFiles, removeFile, clearFiles, closeModal, isLoading } = useUploadState()

const dropZoneRef = ref<HTMLDivElement>()

const thumbnails = ref(new Map<File, string>())

const onRemoveFileClick = (file: File) => {
  const index = tempFiles.value.indexOf(file)
  if (index > -1) {
    removeFile(index)
    thumbnails.value.delete(file)
  }
}

const { files, open } = useFileDialog({
  reset: true,
})

watch(files, (newFiles) => {
  if (!newFiles) return
  const fileArray = Object.values(newFiles)
  addFiles(fileArray)

  // Generate thumbnails for images
  fileArray.forEach((file) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        thumbnails.value.set(file, e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  })
})

const onDrop = (files: File[], event: DragEvent) => {
  addFiles(files)

  files.forEach((file) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        thumbnails.value.set(file, e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  })

  event.preventDefault()
  event.stopPropagation()
}

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)
</script>

<template>
  <div
    :class="{
      'flex flex-col relative justify-center items-center': !tempFiles.length,
      'h-full': tempFiles.length > 0,
    }"
    class="w-full p-2 h-full"
  >
    <NcTooltip v-if="tempFiles.length === 0" class="absolute top-3 right-3">
      <NcButton type="text" class="!border-0" :disabled="isLoading" size="xsmall" @click="closeModal">
        <GeneralIcon icon="close" />
      </NcButton>

      <template #title> {{ $t('general.close') }} </template>
    </NcTooltip>

    <div v-if="tempFiles.length > 0" class="flex w-full border-b-1 py-1 h-9.5 items-center justify-between top-0">
      <NcButton :disabled="isLoading" type="text" size="small" @click="clearFiles">
        {{ $t('labels.clearAllFiles') }}
      </NcButton>

      <span class="text-xs">
        {{ tempFiles.length }} files, total size:
        {{
          formatBytes(
            tempFiles.reduce((acc, file) => acc + file.size, 0),
            0,
          )
        }}
      </span>

      <NcButton :disabled="isLoading" type="text" size="small" @click="open">
        <div class="flex gap-1 items-center">
          <component :is="iconMap.plus" />
          {{ $t('labels.addMore') }}
        </div>
      </NcButton>
    </div>
    <div
      ref="dropZoneRef"
      :class="{
        'border-brand-500': isOverDropZone,
        'border-dashed border-2': !tempFiles.length,
      }"
      data-testid="attachment-drop-zone"
      :style="`height: ${tempFiles.length > 0 ? '324px' : '100%'}`"
      class="flex flex-col items-center justify-center h-full w-full flex-grow-1 rounded-lg"
      @click="tempFiles.length > 0 ? () => {} : open()"
    >
      <div v-if="!tempFiles.length" class="flex cursor-pointer items-center justify-center flex-col gap-4">
        <template v-if="!isOverDropZone">
          <component :is="iconMap.upload" class="w-8 h-8 text-gray-500" />
          <span class="p-4">
            {{ $t('labels.clickTo') }}

            <span class="font-semibold text-brand-500"> {{ $t('labels.browseFiles') }} </span>
            {{ $t('general.or') }}
            <span class="font-semibold"> {{ $t('labels.dragFilesHere') }} </span>

            {{ $t('labels.toUpload') }}
          </span>
        </template>
        <template v-if="isOverDropZone">
          <component :is="iconMap.upload" class="w-8 text-brand-500 h-8" />
          <h1 class="text-brand-500 font-bold">{{ $t('labels.dropHere') }}</h1>
        </template>
      </div>
      <template v-else>
        <div
          class="grid overflow-y-auto flex-grow-1 nc-scrollbar-md grid-cols-4 w-full h-full items-start py-2 justify-center gap-4"
        >
          <div v-for="file in tempFiles" :key="file.name" class="flex gap-1.5 group max-w-34 pb-4 flex-col relative">
            <div
              v-if="!thumbnails.get(file)"
              style="height: 140px"
              class="flex items-center justify-center rounded-md bg-gray-100"
            >
              <GeneralIcon :icon="getAttachmentIcon(file.name, file.type)" :class="isMobileMode ? 'w-12 h-12' : 'w-16 h-16'" />
            </div>
            <img v-else :src="thumbnails.get(file)" style="height: 140px" alt="thumbnail" class="rounded-md object-cover" />

            <div class="relative text-[12px] font-semibold items-center text-gray-800 flex">
              <NcTooltip class="flex-auto truncate" placement="bottom">
                <template #title> {{ file.name }} </template>
                {{ file.name }}
              </NcTooltip>

              <div
                v-if="!isLoading"
                class="flex-none hide-ui transition-all transition-ease-in-out !h-4 flex items-center bg-white"
              >
                <NcTooltip placement="bottom">
                  <template #title> {{ $t('title.removeFile') }} </template>
                  <GeneralIcon icon="delete" class="!text-red-500 w-3 h-3 cursor-pointer" @click="onRemoveFileClick(file)" />
                </NcTooltip>
              </div>
            </div>
            <div class="flex-none text-[10px] font-semibold text-gray-500">
              {{ formatBytes(file.size, 0) }}
            </div>
          </div>
        </div>
      </template>
    </div>
    <NcFileUploadProvidersBottomBar v-if="tempFiles.length" />
  </div>
</template>

<style lang="scss">
.hide-ui {
  @apply md:(h-0 w-0 overflow-hidden whitespace-nowrap);
  .group:hover & {
    @apply h-auto w-auto overflow-visible whitespace-normal;
  }
}
</style>
