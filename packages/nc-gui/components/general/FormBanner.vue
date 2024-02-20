<script lang="ts" setup>
interface Props {
  bannerImageUrl?: string
}
const { bannerImageUrl } = defineProps<Props>()
</script>

<template>
  <div
    class="w-full max-w-screen-xl mx-auto bg-white border-1 border-gray-200 rounded-3xl overflow-hidden"
    :style="{
      ...(bannerImageUrl
        ? { 'background-image': `url(${bannerImageUrl})`, 'background-size': 'cover', 'background-position': 'center' }
        : {}),
    }"
  >
    <!-- Todo: aspect ratio and cover image uploader and image cropper to crop image in fixed aspect ratio  -->
    <div v-if="!bannerImageUrl" class="h-full flex items-stretch justify-between">
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
