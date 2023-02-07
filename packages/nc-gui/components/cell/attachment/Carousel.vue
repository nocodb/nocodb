<script lang="ts" setup>
import { onKeyDown } from '@vueuse/core'
import { useAttachmentCell } from './utils'
import { computed, isImage, onClickOutside, ref, useAttachment } from '#imports'

const { selectedImage, visibleItems, downloadFile } = useAttachmentCell()!

const carouselRef = ref()

const imageItems = computed(() => visibleItems.value.filter((item) => isImage(item.title, item.mimetype)))

const { getAttachmentSrc, showFallback, getBackgroundImage } = useAttachment()

/** navigate to previous image on button click */
onKeyDown(
  (e) => ['Left', 'ArrowLeft', 'A'].includes(e.key),
  () => {
    if (carouselRef.value) carouselRef.value.prev()
  },
)

/** navigate to next image on button click */
onKeyDown(
  (e) => ['Right', 'ArrowRight', 'D'].includes(e.key),
  () => {
    if (carouselRef.value) carouselRef.value.next()
  },
)

/** set our selected image when slide changes */
function onSlideChange(index: number) {
  selectedImage.value = imageItems.value[index]
}

/** set our carousel ref and move to initial slide  */
const setCarouselRef = (el: Element) => {
  carouselRef.value = el

  carouselRef.value?.goTo(
    imageItems.value.findIndex((item) => item === selectedImage.value),
    true,
  )
}

/** close overlay view when clicking outside of image */
onClickOutside(carouselRef, () => {
  selectedImage.value = false
})
</script>

<template>
  <GeneralOverlay v-model="selectedImage" :z-index="1001">
    <template v-if="selectedImage">
      <div class="overflow-hidden p-12 text-center relative">
        <div class="text-white group absolute top-5 right-5">
          <MdiCloseCircle class="group-hover:text-red-500 cursor-pointer text-4xl" @click.stop="selectedImage = false" />
        </div>

        <div
          class="select-none group hover:(ring-1 ring-accent) ring-opacity-100 cursor-pointer leading-8 inline-block px-3 py-1 bg-gray-300 text-white mb-4 text-center rounded shadow"
          @click.stop="downloadFile(selectedImage)"
        >
          <h3 class="group-hover:text-primary">{{ selectedImage && selectedImage.title }}</h3>
        </div>

        <a-carousel
          v-if="!!selectedImage"
          :ref="setCarouselRef"
          dots-class="slick-dots slick-thumb"
          :after-change="onSlideChange"
          arrows
        >
          <template #prevArrow>
            <div class="custom-slick-arrow left-2 z-1">
              <MaterialSymbolsArrowCircleLeftRounded class="rounded-full" />
            </div>
          </template>

          <template #nextArrow>
            <div class="custom-slick-arrow !right-2 z-1">
              <MaterialSymbolsArrowCircleRightRounded class="rounded-full" />
            </div>
          </template>

          <template #customPaging="props">
            <a>
              <LazyNuxtImg
                quality="90"
                placeholder
                class="!block"
                :alt="imageItems[props.i].title || `#${props.i}`"
                :src="getAttachmentSrc(imageItems[props.i])"
                :onerror="(e) => showFallback(e, imageItems[props.i])"
              />
            </a>
          </template>
          <div v-for="item of imageItems" :key="getAttachmentSrc(item)">
            <div
              :style="{ backgroundImage: getBackgroundImage(item) }"
              class="min-w-70vw min-h-70vh w-full h-full bg-contain bg-center bg-no-repeat"
            />
          </div>
        </a-carousel>
      </div>
    </template>
  </GeneralOverlay>
</template>

<style scoped>
.ant-carousel :deep(.custom-slick-arrow .nc-icon):hover {
  @apply !bg-white;
}
.ant-carousel :deep(.slick-dots) {
  @apply relative mt-4;
}

.ant-carousel :deep(.slick-slide) {
  @apply w-full;
}

.ant-carousel :deep(.slick-slide img) {
  @apply border-1 m-auto;
}

.ant-carousel :deep(.slick-thumb) {
  @apply bottom-2;
}

.ant-carousel :deep(.slick-thumb li) {
  @apply w-[60px] h-[45px];
}

.ant-carousel :deep(.slick-thumb li img) {
  @apply w-full h-full block;
  filter: grayscale(100%);
}

.ant-carousel :deep .slick-thumb li.slick-active img {
  filter: grayscale(0%);
}

.ant-carousel :deep(.slick-arrow.custom-slick-arrow) {
  @apply text-4xl text-white hover:text-primary active:text-accent opacity-100 cursor-pointer z-1;
}
.ant-carousel :deep(.custom-slick-arrow:before) {
  display: none;
}
.ant-carousel :deep(.custom-slick-arrow:hover) {
  opacity: 0.5;
}
</style>
