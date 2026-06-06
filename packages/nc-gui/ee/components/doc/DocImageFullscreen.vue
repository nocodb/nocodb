<script setup lang="ts">
/**
 * Fullscreen carousel for doc editor images.
 *
 * Collects every image in the document and shows them in a carousel
 * (thumbnail strip + prev/next + keyboard nav), mirroring the attachment
 * cell viewer. Reuses CellAttachmentPreviewImage (zoom/pan) for the main
 * image and NcCarousel for navigation. Opened at the clicked image's index.
 */
import type { UnwrapRefCarouselApi as CarouselApi } from '../../../components/nc/Carousel/interface'

interface DocImage {
  src: string
  caption?: string
  alt?: string
  title?: string
}

interface Props {
  modelValue: boolean
  images: DocImage[]
  startIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  startIndex: 0,
})

const emits = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()

const vModel = useVModel(props, 'modelValue', emits)

const container = ref<HTMLElement | null>(null)

const emblaMainApi = ref<CarouselApi>()

const emblaThumbnailApi = ref<CarouselApi>()

const selectedIndex = ref(props.startIndex)

const currentImage = computed(() => props.images[selectedIndex.value])

function close() {
  vModel.value = false
}

function onSelect() {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return

  const newSnap = emblaMainApi.value.selectedScrollSnap()
  selectedIndex.value = newSnap
  emblaThumbnailApi.value.scrollTo(newSnap)
}

function onThumbClick(index: number) {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return

  emblaMainApi.value.scrollTo(index)
  emblaThumbnailApi.value.scrollTo(index)
}

function goPrev() {
  emblaMainApi.value?.scrollPrev()
  emblaThumbnailApi.value?.scrollPrev()
}

function goNext() {
  emblaMainApi.value?.scrollNext()
  emblaThumbnailApi.value?.scrollNext()
}

function initEmblaApi(val: CarouselApi) {
  emblaMainApi.value = val
}

function onKeyDown(event: KeyboardEvent) {
  if (['ArrowLeft', 'Left'].includes(event.key)) {
    event.preventDefault()
    goPrev()
    return
  }
  if (['ArrowRight', 'Right'].includes(event.key)) {
    event.preventDefault()
    goNext()
  }
}

watchOnce(emblaMainApi, (api) => {
  if (!api) return

  // Focus container so keyboard navigation works
  container.value?.focus()

  emblaThumbnailApi.value?.on('reInit', onSelect)
  api.on('select', onSelect)

  nextTick(() => {
    api.scrollTo(props.startIndex, true)
    emblaThumbnailApi.value?.scrollTo(props.startIndex, true)
    selectedIndex.value = props.startIndex
  })
})

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <GeneralOverlay v-model="vModel" transition :z-index="1000" class="bg-black bg-opacity-90 nc-doc-image-fullscreen">
    <div
      v-if="vModel"
      ref="container"
      tabindex="0"
      class="flex w-full h-full nc-h-screen items-center justify-center relative outline-none"
      @click.self="close"
    >
      <!-- Close -->
      <NcButton
        class="!absolute top-5 left-5 !z-30 !hover:bg-transparent"
        size="xsmall"
        type="text"
        :aria-label="t('general.close')"
        data-testid="nc-doc-image-fullscreen-close"
        @click.stop="close"
      >
        <component :is="iconMap.close" class="text-white" />
      </NcButton>

      <!-- Title -->
      <div
        v-if="currentImage?.title"
        class="absolute top-5 inset-x-0 mx-auto pointer-events-none flex items-center justify-center"
      >
        <h3 style="width: max-content" class="text-white font-semibold">{{ currentImage.title }}</h3>
      </div>

      <!-- Main carousel -->
      <NcCarousel class="!absolute inset-y-16 inset-x-24 flex justify-center items-center" @init-api="initEmblaApi">
        <NcCarouselContent>
          <NcCarouselItem v-for="(item, index) in images" :key="index">
            <div class="justify-center w-full h-full flex items-center" @click.self="close">
              <CellAttachmentPreviewImage
                v-if="selectedIndex === index"
                class="nc-doc-image-fullscreen-img"
                object-fit="contain"
                controls
                :alt="item.alt || ''"
                :srcs="[item.src]"
              />
            </div>
          </NcCarouselItem>
        </NcCarouselContent>
      </NcCarousel>

      <!-- Prev / Next -->
      <div v-if="emblaMainApi?.canScrollPrev()" class="left-2 nc-doc-carousel-nav" @click.stop="goPrev">
        <component :is="iconMap.arrowLeft" class="text-7xl" />
      </div>
      <div v-if="emblaMainApi?.canScrollNext()" class="right-2 nc-doc-carousel-nav" @click.stop="goNext">
        <component :is="iconMap.arrowRight" class="text-7xl" />
      </div>

      <!-- Caption -->
      <div
        v-if="currentImage?.caption"
        class="absolute bottom-22 inset-x-0 text-center text-white text-bodySm opacity-80 px-4 pointer-events-none"
      >
        {{ currentImage.caption }}
      </div>

      <!-- Thumbnails -->
      <div v-if="images.length > 1" class="absolute w-full !bottom-2 max-h-18 z-30 flex items-center justify-center">
        <NcCarousel class="absolute max-w-sm" @init-api="(val) => (emblaThumbnailApi = val)">
          <NcCarouselContent class="!flex !gap-2">
            <NcCarouselItem
              v-for="(item, index) in images"
              :key="index"
              :class="{
                '!opacity-100': index === selectedIndex,
                '!basis-1/4': images.length >= 4,
                '!basis-1/3': images.length === 3,
                '!basis-1/2': images.length === 2,
              }"
              class="px-2 opacity-50 cursor-pointer"
              @click.stop="onThumbClick(index)"
            >
              <div class="flex items-center justify-center">
                <img :src="item.src" :alt="item.alt || ''" class="h-12 w-auto object-contain rounded" draggable="false" />
              </div>
            </NcCarouselItem>
          </NcCarouselContent>
        </NcCarousel>
      </div>
    </div>
  </GeneralOverlay>
</template>

<style lang="scss" scoped>
.nc-doc-image-fullscreen-img {
  @apply h-full w-full flex items-center justify-center;
  max-height: 80vh;
}

.nc-doc-carousel-nav {
  @apply absolute inset-y-0 my-0 h-full flex items-center cursor-pointer text-gray-400 hover:text-white z-30;
}
</style>
