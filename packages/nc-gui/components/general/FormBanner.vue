<script lang="ts" setup>
import type { AttachmentResType } from 'nocodb-sdk'

interface Props {
  bannerImageUrl?: AttachmentResType
}
const { bannerImageUrl } = defineProps<Props>()

const { getPossibleAttachmentSrc } = useAttachment()

const getBannerImageSrc = computed(() => {
  return getPossibleAttachmentSrc(parseProp(bannerImageUrl))
})
</script>

<template>
  <div
    class="nc-form-banner-wrapper w-full mx-auto rounded-2xl overflow-hidden"
    :class="!bannerImageUrl ? 'shadow-sm' : ''"
    :style="{ aspectRatio: 4 / 1 }"
  >
    <LazyCellAttachmentPreviewImage
      v-if="bannerImageUrl"
      :srcs="getBannerImageSrc"
      class="nc-form-banner-image object-cover w-full"
    />
    <div v-else class="h-full flex items-stretch justify-between bg-white">
      <div class="flex -mt-1">
        <img src="~assets/img/form-banner-left.png" alt="form-banner-left'" />
      </div>

      <div class="w-[91px] flex justify-center">
        <img class="max-h-full self-center" src="~assets/img/icons/256x256.png" alt="form-banner-logo" />
      </div>
      <div class="flex justify-end -mb-1">
        <img src="~assets/img/form-banner-right.png" alt="form-banner-left'" />
      </div>
    </div>
  </div>
</template>
