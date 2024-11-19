<script lang="ts" setup>

import type { AttachmentType } from 'nocodb-sdk';


/* interface */

const props = defineProps<{
  attachment: AttachmentType,
}>();


const { getPossibleAttachmentSrc } = useAttachment()


/* file detection */

const isImageAttachment = computed(() =>
  isImage(props.attachment.title ?? '', props.attachment.mimetype ?? '')
);

const isPdfAttachment = computed(() =>
  isPdf(props.attachment.title ?? '', props.attachment.mimetype ?? '')
);


</script>


<template>
  <div class="w-full h-full">
    <template v-if="isImageAttachment">
      <div class="w-full h-full p-6">
        <img
          :src="getPossibleAttachmentSrc(props.attachment)?.[0]"
          class="w-full h-full object-contain"
        />
      </div>
    </template>
    <template v-else-if="isPdfAttachment">
      <div class="w-full h-full p-6">
        <embed
          :src="getPossibleAttachmentSrc(props.attachment)?.[0]"
          class="w-full h-full"
        />
      </div>
    </template>
    <template v-else>
      <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100">
        <GeneralIcon icon="alertTriangleSolid" class="text-yellow-500 w-[40px] h-[40px]" />
        <span class="text-base font-black mt-4">
          Unsupported File Type
        </span>
        <span class="text-xs mt-3 w-[210px] text-center">
          This file type is currently not supported for viewing.
        </span>
      </div>
    </template>
  </div>
</template>