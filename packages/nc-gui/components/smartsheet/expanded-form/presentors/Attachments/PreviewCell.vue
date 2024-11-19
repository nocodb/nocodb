<script lang="ts" setup>

import type { AttachmentType } from 'nocodb-sdk';


/* interface */

const props = defineProps<{
  attachment: AttachmentType,
  active?: boolean,
}>();

const { getPossibleAttachmentSrc } = useAttachment()


/* file detection */

const fileType = computed(() => {
  return props.attachment.mimetype?.split('/')?.at(-1);
});

const fileIcon = computed((): keyof typeof iconMap => {
  if (fileType.value === 'pdf') return 'pdfFile';
  return 'file';
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
        :icon="fileIcon"
        class="text-red-500 text-xl mt-1"
      />
    </div>
    <div class="font-bold text-center uppercase truncate px-1 pb-1">
      {{ fileType }}
    </div>
  </div>
</template>