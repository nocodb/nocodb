<script lang="ts" setup>
import type { AttachmentType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  attachment: AttachmentType
}>()

const { getPossibleAttachmentSrc } = useAttachment()

/* file detection */

const isImageAttachment = computed(() => isImage(props.attachment.title ?? '', props.attachment.mimetype ?? ''))

const isVideoAttachment = computed(() => isVideo(props.attachment.title ?? '', props.attachment.mimetype ?? ''))

const isAudioAttachment = computed(() => isAudio(props.attachment.title ?? '', props.attachment.mimetype ?? ''))

const isPdfAttachment = computed(() => isPdf(props.attachment.title ?? '', props.attachment.mimetype ?? ''))
</script>

<template>
  <div class="w-full h-full">
    <template v-if="isImageAttachment">
      <div class="w-full h-full nc-files-viewer-image">
        <img :src="getPossibleAttachmentSrc(props.attachment)?.[0]" class="w-full h-full object-contain" />
      </div>
    </template>
    <template v-else-if="isVideoAttachment">
      <div class="w-full h-full nc-files-viewer-video">
        <video class="w-full h-full object-contain" controls>
          <source :src="getPossibleAttachmentSrc(props.attachment)?.[0]" :type="props.attachment.mimetype" />
        </video>
      </div>
    </template>
    <template v-else-if="isAudioAttachment">
      <div class="w-full h-full flex items-center justify-center nc-files-viewer-audio">
        <audio class="w-full" controls>
          <source :src="getPossibleAttachmentSrc(props.attachment)?.[0]" :type="props.attachment.mimetype" />
        </audio>
      </div>
    </template>
    <template v-else-if="isPdfAttachment">
      <div class="w-full h-full nc-files-viewer-pdf">
        <embed :src="getPossibleAttachmentSrc(props.attachment)?.[0]" class="w-full h-full" />
      </div>
    </template>
    <template v-else>
      <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100 nc-files-viewer-unsupported">
        <GeneralIcon icon="alertTriangleSolid" class="text-yellow-500 w-[40px] h-[40px]" />
        <span class="text-base font-black mt-4"> Unsupported File Type </span>
        <span class="text-xs mt-3 w-[250px] text-center">
          This file type is currently not supported for viewing.
          <a href="https://docs.nocodb.com/records/expand-record/#supported-files" target="_blank" rel="noopener">Learn more</a>
        </span>
      </div>
    </template>
  </div>
</template>
