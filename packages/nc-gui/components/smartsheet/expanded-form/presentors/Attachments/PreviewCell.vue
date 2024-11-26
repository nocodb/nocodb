<script lang="ts" setup>
import type { AttachmentType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  attachment: AttachmentType
  active?: boolean
  isExpanded?: boolean
}>()

const { getPossibleAttachmentSrc } = useAttachment()

/* file detection */

const fileEntry: ComputedRef<{ icon: keyof typeof iconMap; title: string | undefined }> = computed(() => {
  if (isImage(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'image',
      title: props.attachment.mimetype?.split('/')?.at(-1) || 'Image',
    }
  }

  if (isPdf(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypePdf',
      title: 'PDF',
    }
  }

  if (isVideo(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeVideo',
      title: props.attachment.mimetype?.split('/')?.at(-1) || 'Video',
    }
  }

  if (isAudio(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeAudio',
      title: props.attachment.mimetype?.split('/')?.at(-1) || 'Audio',
    }
  }

  if (isWord(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeWord',
      title: 'Word',
    }
  }

  if (isExcel(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeExcel',
      title: 'Excel',
    }
  }

  if (isPresentation(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypePresentation',
      title: 'PPT',
    }
  }

  if (isZip(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeZip',
      title: 'Zip',
    }
  }

  return {
    icon: 'ncFileTypeUnknown',
    title: props.attachment.mimetype?.split('/')?.at(-1) || 'File',
  }
})
</script>

<template>
  <div
    class="w-full h-[64px] border-2 rounded-lg overflow-hidden hover:bg-gray-50 cursor-pointer flex flex-row transition-all overflow-clip"
    :class="{
      'border-gray-200': !props.isExpanded,
      'border-transparent': props.isExpanded,
      '!border-2 !border-primary ring-3 ring-[#3069fe44]': props.active,
    }"
  >
    <div class="flex flex-col shrink-0 relative">
      <div class="h-0 w-[60px] flex-1 relative">
        <img
          v-if="isImage(props.attachment.title || '', props.attachment.mimetype)"
          :src="getPossibleAttachmentSrc(props.attachment, 'tiny')?.[0]"
          class="object-cover transition-all duration-300 absolute overflow-hidden"
          :class="{
            'top-0 left-0 right-0 w-full h-[calc(100%-20px)] rounded-none': !props.isExpanded,
            'top-1 left-1 right-1 w-[calc(100%-0.5rem)] h-[calc(100%-0.5rem)] rounded-lg': props.isExpanded,
          }"
        />
        <GeneralIcon
          v-else
          :icon="fileEntry.icon"
          class="text-white !transition-all !duration-300 absolute w-full h-full"
          :class="{
            'top-0 left-0 right-0 h-[calc(100%-16px)]': !props.isExpanded,
            'top-0 left-0 right-0 h-full': props.isExpanded,
          }"
        />
      </div>
      <div
        class="font-bold text-center uppercase truncate px-1 transition-all duration-300 absolute"
        :class="{
          'left-0 right-0 bottom-0': !props.isExpanded,
          'left-0 right-0 bottom-0 transform translate-y-full': props.isExpanded,
        }"
      >
        {{ fileEntry.title }}
      </div>
    </div>
    <div class="whitespace-nowrap flex flex-col justify-center">
      <div>
        {{ props.attachment.title }}
      </div>
      <div>{{ (props.attachment.size! / 1000).toFixed(2) }} KB</div>
    </div>
  </div>
</template>
