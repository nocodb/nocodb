<script setup lang="ts">
import { useAttachmentCell } from '../utils'

const emits = defineEmits<{
  'update:visible': [value: boolean]
  'upload': [fileList: File[]]
}>()

const { isMobileMode } = useGlobal()

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

const closeMenu = () => {
  emits('update:visible', false)
}

onBeforeUnmount(() => {
  tempFiles.value = []
})
</script>

<template>
  <div
    :class="{
      'flex flex-col relative justify-center items-center': !tempFiles.length,
    }"
    class="w-full p-2 h-full"
  >
    <NcTooltip v-if="tempFiles.length === 0" class="absolute top-3 right-3">
      <NcButton type="text" class="!border-0" size="xsmall" @click="closeMenu">
        <GeneralIcon icon="close" />
      </NcButton>

      <template #title> {{ $t('general.close') }} </template>
    </NcTooltip>

    <div v-if="tempFiles.length > 0" class="flex w-full border-b-1 py-1 h-9.5 items-center justify-between top-0">
      <NcButton type="text" size="small" @click="clearAll">
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

      <NcButton type="text" size="small" @click="open">
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
              class="flex items-center justify-center rounded-md bg-gray-300"
            >
              <component :is="iconMap.file" :class="isMobileMode ? 'w-12 h-12' : 'w-16 h-16'" />
            </div>
            <img v-else :src="thumbnails.get(file)" style="height: 140px" alt="thumbnail" class="rounded-md object-cover" />

            <div class="relative text-[12px] font-semibold items-center text-gray-800 flex">
              <NcTooltip class="flex-auto truncate" placement="bottom">
                <template #title> {{ file.name }} </template>
                {{ file.name }}
              </NcTooltip>

              <div class="flex-none hide-ui transition-all transition-ease-in-out !h-4 flex items-center bg-white">
                <NcTooltip placement="bottom">
                  <template #title> {{ $t('title.removeFile') }} </template>
                  <component :is="iconMap.delete" class="!text-red-500 w-3 h-3 cursor-pointer" @click="onRemoveFileClick(file)" />
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
    <div v-if="tempFiles.length" class="flex gap-2 pt-2 bg-white w-full items-center justify-end">
      <NcButton :disabled="isLoading" type="secondary" size="small" @click="closeMenu">
        {{ $t('labels.cancel') }}
      </NcButton>

      <NcButton :loading="isLoading" data-testid="nc-upload-file" size="small" @click="emits('upload', tempFiles)">
        <template v-if="isLoading">
          {{ $t('labels.uploading') }}
        </template>
        <template v-else> {{ $t('general.upload') }} {{ tempFiles.length }} {{ $t('objects.files') }} </template>
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss">
.hide-ui {
  @apply h-0 w-0 overflow-hidden whitespace-nowrap;
  .group:hover & {
    @apply h-auto w-auto overflow-visible whitespace-normal;
  }
}
</style>
