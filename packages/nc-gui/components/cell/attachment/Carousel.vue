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
  if (!target.closest('.keep-open') && !target.closest('img')) {
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

        <NcCarousel class="relative p-22 keep-open" @init-api="(val) => (emblaMainApi = val)">
          <NcCarouselContent>
            <NcCarouselItem v-for="(item, index) in visibleItems" :key="index">
              <LazyCellAttachmentImage
                v-if="isImage(item.title, item.mimeType)"
                class="nc-attachment-img-wrapper !h-[60%]"
                object-fit="contain"
                :alt="item.title"
                :srcs="getPossibleAttachmentSrc(item)"
              />

              <LazyCellAttachmentVideo
                v-else-if="isVideo(item.title, item.mimeType)"
                class="!h-[60%]"
                :alt="item.title"
                :srcs="getPossibleAttachmentSrc(item)"
              />
            </NcCarouselItem>
          </NcCarouselContent>
        </NcCarousel>

        <div class="absolute w-full !bottom-5 max-h-18 z-30 flex items-center justify-center">
          <NcCarousel class="absolute max-w-sm" @init-api="(val) => (emblaThumbnailApi = val)">
            <NcCarouselContent class="!flex !gap-2 ml-0">
              <NcCarouselItem
                v-for="(item, index) in visibleItems"
                :key="index"
                :class="{
                  ' opacity-100': index === selectedIndex,
                }"
                class="px-2 keep-open opacity-50 !basis-1/8 cursor-pointer"
                @click="onThumbClick(index)"
              >
                <div class="flex items-center justify-center">
                  <LazyCellAttachmentImage
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
.nc-attachment-img-wrapper {
  width: fit-content !important;
}
</style>
