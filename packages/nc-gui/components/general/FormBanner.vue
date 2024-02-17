<script lang="ts" setup>
interface Props {
  bannerImageUrl?: string
}
const { bannerImageUrl } = defineProps<Props>()
</script>

<template>
  <div class="w-full aspect-{4/1} bg-white border-1 border-gray-200 rounded-3xl overflow-hidden">
    <!-- Todo: cover image uploader and image cropper to crop image in fixed aspect ratio  -->
    <LazyNuxtImg v-if="bannerImageUrl" class="h-full" :src="bannerImageUrl" alt="form-banner'" placeholder quality="75" />
    <div v-else class="h-full flex items-stretch justify-between">
      <div>
        <img src="~assets/img/form-banner-left.png" alt="form-banner-left'" />
      </div>

      <div class="w-[91px] grid place-items-center">
        <img class="w-full" src="~assets/img/icons/256x256.png" alt="form-banner-logo'" />
      </div>
      <div>
        <img src="~assets/img/form-banner-right.png" alt="form-banner-left'" />
      </div>
    </div>
  </div>
</template>
