<script lang="ts" setup>

import type { AttachmentType } from 'nocodb-sdk';


/* interface */

const props = defineProps<{
  attachment: AttachmentType,
  active?: boolean,
  isExpanded?: boolean,
}>();

const { getPossibleAttachmentSrc } = useAttachment()


/* file detection */

const fileEntry: ComputedRef<{ icon: keyof typeof iconMap, title: string | undefined }> = computed(() => {

  if (isImage(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'image',
      title: props.attachment.mimetype?.split('/')?.at(-1) || 'Image',
    };
  }

  if (isPdf(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypePdf',
      title: 'PDF',
    };
  }

  if (isVideo(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeVideo',
      title: props.attachment.mimetype?.split('/')?.at(-1) || 'Video',
    };
  }

  if (isAudio(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeAudio',
      title: props.attachment.mimetype?.split('/')?.at(-1) || 'Audio',
    };
  }

  if (isWord(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeWord',
      title: 'Word',
    };
  }

  if (isExcel(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeExcel',
      title: 'Excel',
    };
  }

  if (isPresentation(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypePresentation',
      title: 'PPT',
    };
  }

  if (isZip(props.attachment.title || '', props.attachment.mimetype)) {
    return {
      icon: 'ncFileTypeZip',
      title: 'Zip',
    };
  }

  return {
    icon: 'ncFileTypeUnknown',
    title: props.attachment.mimetype?.split('/')?.at(-1) || 'File',
  };

});

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
    <div class="flex flex-col shrink-0">
      <div class="h-0 w-[60px] flex-1 flex items-center justify-center">
        <img
          v-if="isImage(props.attachment.title || '', props.attachment.mimetype)"
          :src="getPossibleAttachmentSrc(props.attachment, 'tiny')?.[0]"
          class="object-cover transition-all duration-500"
          :class="{
            'w-full h-full': !props.isExpanded,
            'w-full h-full p-2 rounded-lg': props.isExpanded,
          }"
        />
        <GeneralIcon
          v-else
          :icon="fileEntry.icon"
          class="text-white transition-all duration-500"
          :class="{
            'h-[36px] w-[36px] mt-1': !props.isExpanded,
            'h-[52px] w-[52px]': props.isExpanded,
          }"
        />
      </div>
      <div v-if="!props.isExpanded" class="font-bold text-center uppercase truncate px-1 pb-1">
        {{ fileEntry.title }}
      </div>
    </div>
    <div class="whitespace-nowrap flex flex-col justify-center">
      <div>
        {{ props.attachment.title }}
      </div>
      <div>
        {{ (props.attachment.size! / 1000).toFixed(2) }} KB
      </div>
    </div>
  </div>
</template>