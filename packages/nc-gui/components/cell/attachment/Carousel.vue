<script lang="ts" setup>
import type { CarouselApi } from '../../nc/Carousel/interface'
import { useAttachmentCell } from './utils'

const { selectedImage, visibleItems, downloadAttachment } = useAttachmentCell()!

const container = ref()

const emblaMainApi: CarouselApi = ref()
const emblaThumbnailApi: CarouselApi = ref()
const selectedIndex = ref(0)
const { getPossibleAttachmentSrc } = useAttachment()

useEventListener(container, 'click', (e) => {
  if (!(e.target as HTMLElement)?.closest('.keep-open') && !(e.target as HTMLElement)?.closest('img')) {
    selectedImage.value = false
  }
})

function onThumbClick(index: number) {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return
  emblaMainApi.value.scrollTo(index)
}

function onSelect() {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return
  selectedIndex.value = emblaMainApi.value?.selectedScrollSnap()
  selectedImage.value = visibleItems.value[emblaMainApi.value?.selectedScrollSnap()]
  emblaThumbnailApi.value.scrollTo(emblaMainApi.value.selectedScrollSnap())
}

watchOnce(emblaMainApi, (emblaMainApi) => {
  if (!emblaMainApi) return

  onSelect()
  emblaMainApi.on('select', onSelect)
  emblaThumbnailApi.value?.on('reInit', onSelect)
})
</script>

<template>
  <GeneralOverlay v-model="selectedImage" transition :z-index="1001" class="bg-black bg-opacity-90">
    <div v-if="selectedImage" class="flex">
      <div ref="container" class="overflow-hidden text-center relative h-screen">
        <NcButton
          class="top-5 !absolute cursor-pointer !hover:bg-transparent left-5"
          size="xsmall"
          type="text"
          @click.stop="selectedImage = false"
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
            {{ selectedImage && selectedImage.title }}
          </h3>
        </div>

        <NcCarousel class="relative p-22 keep-open" @init-api="(val) => (emblaMainApi = val)">
          <NcCarouselContent>
            <NcCarouselItem v-for="(item, index) in visibleItems" :key="index">
              <LazyCellAttachmentImage
                class="nc-attachment-img-wrapper !h-[80%]"
                object-fit="contain"
                :alt="item.title"
                :srcs="getPossibleAttachmentSrc(item)"
              />
            </NcCarouselItem>
          </NcCarouselContent>
          <NcCarouselPrevious size="small" class="!top-5/12 z-20 !left-8 !absolute" />
          <NcCarouselNext size="small" class="!top-5/12 z-20 !right-8 !absolute" />
        </NcCarousel>

        <div class="absolute !w-screen !bottom-5 max-h-18 z-30 flex items-center justify-center inset-x-0">
          <NcCarousel class="absolute max-w-sm" @init-api="(val) => (emblaThumbnailApi = val)">
            <NcCarouselContent class="!flex !gap-3 ml-0">
              <NcCarouselItem
                v-for="(item, index) in visibleItems"
                :key="index"
                :class="{
                  'nc-active-attachment': index === selectedIndex,
                }"
                class="pl-0 opacity-50 !basis-1/4 cursor-pointer"
                @click="onThumbClick(index)"
              >
                <LazyCellAttachmentImage
                  class="nc-attachment-img-wrapper"
                  object-fit="contain"
                  :alt="item.title"
                  :srcs="getPossibleAttachmentSrc(item)"
                />
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

.nc-active-attachment {
  @apply transform opacity-100 scale-110 transition-transform;
}
</style>
