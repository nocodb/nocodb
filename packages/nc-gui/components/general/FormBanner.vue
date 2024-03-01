<script lang="ts" setup>
import type { AttachmentResType } from 'nocodb-sdk';

interface Props {
  bannerImageUrl?: AttachmentResType
}
const { bannerImageUrl } = defineProps<Props>()

const { getPossibleAttachmentSrc } = useAttachment()
</script>

<template>
  <div
    class="nc-form-banner-wrapper w-full mx-auto bg-white border-1 border-gray-200 rounded-2xl overflow-hidden"
    :style="{ aspectRatio: 4 / 1 }"
  >
    <LazyCellAttachmentImage
      v-if="bannerImageUrl"
      :srcs="getPossibleAttachmentSrc(parseProp(bannerImageUrl))"
      class="nc-form-banner-image object-cover w-full"
    />
    <!-- Todo: aspect ratio and cover image uploader and image cropper to crop image in fixed aspect ratio  -->
    <div v-else class="h-full flex items-stretch justify-between">
      <div class="flex">
        <img src="~assets/img/form-banner-left.png" alt="form-banner-left'" />
      </div>

      <div class="w-[91px] flex justify-center">
        <img class="max-h-full self-center" src="~assets/img/icons/256x256.png" alt="form-banner-logo'" />
      </div>
      <div class="flex justify-end">
        <img src="~assets/img/form-banner-right.png" alt="form-banner-left'" />
      </div>
    </div>
  </div>
</template>
