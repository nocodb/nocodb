<script setup lang="ts">
import { useAttachmentCell } from '../utils'
import { createThumbnail } from '~/utils/attachmentUtils'

const emits = defineEmits<{
  'update:visible': [value: boolean]
  'upload': [fileList: File[]]
}>()

const dropZoneRef = ref<HTMLDivElement>()

const tempFiles = ref<File[]>([])

const { isLoading } = useAttachmentCell()!

const { files, open: _open } = useFileDialog({
  reset: true,
})

watch(files, (newFiles) => {
  if (!newFiles) return
  Object.values(newFiles).forEach((file) => {
    tempFiles.value.push(file)
  })
})

const onDrop = (files: File[], event: DragEvent) => {
  tempFiles.value.push(...files)
  event.preventDefault()
  event.stopPropagation()
}

const thumbnails = computedAsync(async () => {
  const map = new Map()
  await Promise.all(
    tempFiles.value.map(async (file) => {
      const thumbnail = await createThumbnail(file)
      if (thumbnail) {
        map.set(file, thumbnail)
      }
    }),
  )
  return map
})

const onRemoveFileClick = (file: File) => {
  tempFiles.value = tempFiles.value.filter((f) => f !== file)
}

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)

const clearAll = () => {
  tempFiles.value = []
}

const open = () => {
  _open()
}

onBeforeUnmount(() => {
  tempFiles.value = []
})
</script>

<template>
  <div :style="`height: ${tempFiles.length > 0 ? 'calc(100% - 88px)' : '100%'};`" class="w-full p-1 space-y-2">
    <div v-if="tempFiles.length > 0" class="flex w-full items-center pt-1 justify-between top-0">
      <NcButton type="text" class="!hover:bg-transparent" size="small" @click="clearAll"> Clear all files </NcButton>

      <span class="text-xs">
        {{ tempFiles.length }} files, total size:
        {{
          formatBytes(
            tempFiles.reduce((acc, file) => acc + file.size, 0),
            2,
          )
        }}
      </span>

      <NcButton type="text" class="!hover:bg-transparent" size="small" @click="open"> Add more </NcButton>
    </div>
    <div
      ref="dropZoneRef"
      :class="{
        'border-brand-500': isOverDropZone,
        'border-dashed': !tempFiles.length,
      }"
      data-testid="attachment-drop-zone"
      class="flex flex-col items-center justify-center bg-gray-50 w-full h-full flex-grow-1 border-1 rounded-lg"
      @click="tempFiles.length > 0 ? () => {} : open()"
    >
      <div v-if="!tempFiles.length" class="flex cursor-pointer items-center justify-center flex-col gap-2">
        <template v-if="!isOverDropZone">
          <component :is="iconMap.upload" class="w-5 h-5" />
          <h1>Click to browser files OR drag files here to upload</h1>
        </template>
        <template v-if="isOverDropZone">
          <component :is="iconMap.upload" class="w-5 text-brand-500 h-5" />
          <h1 class="text-brand-500 font-bold">Drop here</h1>
        </template>
      </div>
      <template v-else>
        <div class="grid overflow-y-auto grid-cols-4 w-full h-full items-start p-4 justify-center gap-4">
          <div v-for="file in tempFiles" :key="file.name" class="flex gap-1.5 group min-w-34 max-w-28 pb-4 flex-col relative">
            <div
              v-if="!thumbnails.get(file)"
              style="height: 140px"
              class="flex items-center justify-center rounded-md bg-gray-300"
            >
              <component :is="iconMap.file" class="w-16 h-16" />
            </div>
            <img v-else :src="thumbnails.get(file)" style="height: 140px" alt="thumbnail" class="rounded-md object-cover" />

            <div class="relative text-[12px] font-semibold text-gray-800 flex">
              <NcTooltip class="flex-auto truncate" placement="bottom">
                <template #title> {{ file.name }} </template>
                <div class="flex-auto truncate line-height-4">
                  {{ file.name }}
                </div>
              </NcTooltip>

              <div class="flex-none hide-ui transition-all transition-ease-in-out !h-4 flex items-center bg-white">
                <NcTooltip placement="bottom">
                  <template #title> {{ $t('title.removeFile') }} </template>
                  <component :is="iconMap.delete" class="!text-red-500 cursor-pointer" @click="onRemoveFileClick(file)" />
                </NcTooltip>
              </div>
            </div>
            <div class="flex-none text-[10px] font-semibold text-gray-500">
              {{ formatBytes(file.size, 2) }}
            </div>
          </div>
        </div>
      </template>
    </div>
    <div v-if="tempFiles.length" class="flex gap-2 pr-2 bg-white w-full items-center justify-end">
      <NcButton :disabled="isLoading" type="secondary" size="small" @click="emits('update:visible', false)"> Cancel </NcButton>

      <NcButton :loading="isLoading" data-testid="nc-upload-file" size="small" @click="emits('upload', tempFiles)">
        <template v-if="isLoading"> Uploading </template>
        <template v-else> Upload {{ tempFiles.length }} files </template>
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss">
.hide-ui {
  @apply h-0 w-0 overflow-hidden whitespace-nowrap;

  // When the parent with class 'group' is hovered
  .group:hover & {
    @apply h-auto w-auto overflow-visible whitespace-normal;
  }
}
</style>
