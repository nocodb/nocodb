<script lang="ts" setup>

import type { AttachmentType } from 'nocodb-sdk';


/* interface */

const props = defineProps<{
  attachment: AttachmentType,
  active?: boolean,
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
    class="w-full h-[64px] border-2 border-gray-200 rounded-lg overflow-hidden hover:bg-gray-50 cursor-pointer flex flex-col transition-all"
    :class="{
      'border-primary ring-3 ring-[#3069fe44]': props.active,
    }"
  >
    <div class="h-0 flex-1 flex items-center justify-center">
      <img
        v-if="isImage(props.attachment.title || '', props.attachment.mimetype)"
        :src="getPossibleAttachmentSrc(props.attachment, 'tiny')?.[0]"
        class="w-full h-full object-cover"
      />
      <GeneralIcon
        v-else
        :icon="fileEntry.icon"
        class="text-white h-[36px] w-[36px] text-xl mt-1"
      />
    </div>
    <div class="font-bold text-center uppercase truncate px-1 pb-1">
      {{ fileEntry.title }}
    </div>
  </div>
</template>