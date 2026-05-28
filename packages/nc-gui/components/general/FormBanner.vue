<script lang="ts" setup>
import type { AttachmentResType } from 'nocodb-sdk'

interface Props {
  bannerImageUrl?: AttachmentResType
}
const { bannerImageUrl } = defineProps<Props>()

const { getPossibleAttachmentSrc } = useAttachment()

const { isWhiteLabelled, logoUrl, productName } = useBranding()

const getBannerImageSrc = computed(() => {
  return getPossibleAttachmentSrc(parseProp(bannerImageUrl))
})

// When the form author hasn't uploaded a custom banner, fall back to the
// instance white-label logo on white-labelled deployments. The default
// NocoDB-decorated banner only renders when neither is available.
const showWhiteLabelBanner = computed(() => !bannerImageUrl && isWhiteLabelled.value && !!logoUrl.value)
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
      :is-cell-preview="false"
    />
    <div
      v-else-if="showWhiteLabelBanner"
      class="h-full flex items-center justify-center bg-nc-bg-default px-6"
    >
      <img
        :src="logoUrl!"
        :alt="productName"
        class="max-h-[70%] max-w-[60%] object-contain"
      />
    </div>
    <div v-else dir="ltr" class="h-full flex items-stretch justify-between bg-nc-bg-default">
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
