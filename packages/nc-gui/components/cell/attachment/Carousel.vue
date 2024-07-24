<script lang="ts" setup>
import type { CarouselApi } from '../../nc/Carousel/interface'
import { useAttachmentCell } from './utils'
const { selectedImage, visibleItems, downloadAttachment } = useAttachmentCell()!

const container = ref<HTMLElement | null>(null)

const emblaMainApi: CarouselApi = ref()
const emblaThumbnailApi: CarouselApi = ref()
const selectedIndex = ref()

const { getPossibleAttachmentSrc } = useAttachment()

useEventListener(container, 'click', (e) => {
  const target = e.target as HTMLElement
  if (!target.closest('.keep-open') && (!target.closest('img') || !target.closest('video'))) {
    selectedFile.value = false
  }
})

const onThumbClick = (index: number) => {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return

  emblaMainApi.value.scrollTo(index)
  emblaThumbnailApi.value.scrollTo(index)
}

const onSelect = () => {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return

  const newSnap = emblaMainApi.value.selectedScrollSnap()

  selectedIndex.value = newSnap
  selectedFile.value = visibleItems.value[newSnap]
  emblaThumbnailApi.value.scrollTo(newSnap)
}

watchOnce(emblaMainApi, async (emblaMainApi) => {
  if (!emblaMainApi) return

  emblaThumbnailApi.value?.on('reInit', onSelect)

  emblaMainApi.on('select', onSelect)

  await nextTick(() => {
    if (!selectedIndex.value) {
      const newIndex = visibleItems.value.findIndex((item) => {
        if (selectedFile.value?.path) return item?.path === selectedFile.value.path
        if (selectedFile.value?.url) return item?.url === selectedFile.value.url
        return selectedFile.value?.title === item?.title
      })

      selectedIndex.value = newIndex
      emblaMainApi.scrollTo(newIndex)
    }
  })
})
</script>

<template>
  <GeneralOverlay v-model="selectedFile" transition :z-index="1001" class="bg-black bg-opacity-90">
    <div v-if="selectedFile" class="flex w-full justify-center items-center">
      <div ref="container" class="overflow-hidden w-full flex items-center justify-center text-center relative h-screen">
        <NcButton
          class="top-5 !absolute cursor-pointer !hover:bg-transparent left-5"
          size="xsmall"
          type="text"
          @click.stop="selectedFile = false"
        >
          <component :is="iconMap.close" class="text-white" />
        </NcButton>

        <div
          class="keep-open select-none absolute top-5 pointer-events-none inset-x-0 mx-auto group flex items-center justify-center leading-8 inline-block text-center rounded shadow"
        >
          <h3
            style="width: max-content"
            class="hover:underline pointer-events-auto font-semibold cursor-pointer text-white"
            @click.stop="downloadAttachment(selectedImage)"
          >
            {{ selectedFile && selectedFile.title }}
          </h3>
        </div>

        <NcCarousel
          class="!absolute inset-16 keep-open flex justify-center items-center"
          @init-api="(val) => (emblaMainApi = val)"
        >
          <NcCarouselContent>
            <NcCarouselItem v-for="(item, index) in visibleItems" :key="index">
              <div class="w-full h-full justify-center flex items-center">
                <LazyCellAttachmentPreviewImage
                  v-if="isImage(item.title, item.mimeType)"
                  class="nc-attachment-img-wrapper"
                  object-fit="contain"
                  :alt="item.title"
                  :srcs="getPossibleAttachmentSrc(item)"
                />

                <LazyCellAttachmentPreviewVideo
                  v-else-if="isVideo(item.title, item.mimeType)"
                  class="!h-full flex items-center"
                  :src="getPossibleAttachmentSrc(item)[0]"
                  :sources="getPossibleAttachmentSrc(item).map((src) => ({ src, type: item.mimeType }))"
                />
                <LazyCellAttachmentPreviewPdf
                  v-else-if="isPdf(item.title, item.mimeType)"
                  :src="getPossibleAttachmentSrc(item)[0]"
                />
                <div v-else class="bg-white h-full flex flex-col justify-center rounded-md gap-1 items-center w-full">
                  <component :is="iconMap.file" class="text-gray-600 w-20 h-20" />
                  <div class="text-gray-800 text-sm">{{ item.title }}</div>
                </div>
              </div>
            </NcCarouselItem>
          </NcCarouselContent>
        </NcCarousel>

        <div class="absolute w-full !bottom-3 max-h-18 z-30 flex items-center justify-center">
          <NcCarousel class="absolute max-w-sm" @init-api="(val) => (emblaThumbnailApi = val)">
            <NcCarouselContent class="!flex !gap-2 ml-0">
              <NcCarouselItem
                v-for="(item, index) in visibleItems"
                :key="index"
                :class="{
                  'opacity-100': index === selectedIndex,
                  '!basis-1/2': visibleItems.length === 2,
                  '!basis-1/3': visibleItems.length === 3,
                  '!basis-1': visibleItems.length === 1,
                  '!basis-1/4': visibleItems.length === 4,
                  '!basis-1/8': visibleItems.length > 4,
                }"
                class="px-2 keep-open opacity-50 cursor-pointer"
                @click="onThumbClick(index)"
              >
                <div class="flex items-center justify-center">
                  <LazyCellAttachmentPreviewImage
                    v-if="isImage(item.title, item.mimeType)"
                    class="nc-attachment-img-wrapper h-12"
                    object-fit="contain"
                    :alt="item.title"
                    :srcs="getPossibleAttachmentSrc(item)"
                  />
                  <div
                    v-else-if="isVideo(item.title, item.mimeType)"
                    class="h-full flex items-center h-6 justify-center rounded-md px-2 py-1 border-1 border-gray-200"
                  >
                    <GeneralIcon class="text-white" icon="play" />
                  </div>

                  <div v-else class="h-full flex items-center h-6 justify-center rounded-md px-2 py-1 border-1 border-gray-200">
                    <GeneralIcon class="text-white" icon="file" />
                  </div>
                </div>
              </NcCarouselItem>
            </NcCarouselContent>
          </NcCarousel>
        </div>
      </div>
    </div>
  </GeneralOverlay>
</template>

<style lang="scss">
.nc-attachment-carousel {
  width: max-content;
}

.carousel-container {
  @apply !w-full flex items-center h-full;

  .embla__container {
    @apply items-center h-full w-full;
  }
}

.vjs-fluid {
  &:not(.vjs-audio-only-mode) {
    padding-top: 49.25% !important;
  }
}
</style>
