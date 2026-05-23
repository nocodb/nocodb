<script lang="ts" setup>
/**
 * Inline-embedded version of components/cell/attachment/Carousel.vue.
 *
 * The original Carousel is wrapped in <GeneralOverlay> with a black backdrop
 * and uses `nc-h-screen` for full-viewport height — designed for the grid-cell
 * "View Attachments" overlay. This component reuses the same per-file-type
 * preview chrome (image / video / audio / pdf / office), navigation, actions,
 * AND the original's dark theme — but renders inline in the side panel's
 * File mode instead of as an overlay.
 *
 * State binding:
 * - Original drives display via `selectedFile` ref (set/unset to open/close)
 *   and pulls items/actions from `useAttachmentCell()` injection state.
 * - This component is always rendered; the active item is driven by an
 *   `activeIndex` v-model and items + edit permission come in via props.
 *   Actions bubble up as emitted events.
 */
import type { CarouselApi } from '../../../../../../components/nc/Carousel/interface'
import { isOffice } from '~/utils/fileUtils'

const props = defineProps<{
  attachments: any[]
  isEditAllowed: boolean
  isRenameModalOpen?: boolean
}>()

const emit = defineEmits<{
  (e: 'download', attachment: any): void
  (e: 'rename', attachment: any, index: number): void
  (e: 'remove', index: number): void
  (e: 'add-file'): void
}>()

const { getPossibleAttachmentSrc } = useAttachment()

const { loadRow } = useSmartsheetRowStoreOrThrow()

/* v-model — active item index */

const activeIndex = defineModel<number>('activeIndex', { required: true })

/* alias to keep template diff vs the original Carousel minimal */
const visibleItems = computed(() => props.attachments)

/* carousel internals */

const container = ref<HTMLElement | null>(null)
const emblaMainApi: CarouselApi = ref()
const emblaThumbnailApi: CarouselApi = ref()
const isUpdated = ref(1)

const activeAttachment = computed(() => visibleItems.value?.[activeIndex.value ?? 0])

const initEmblaApi = (val: any) => {
  emblaMainApi.value = val
}

const onSelect = () => {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return
  const newSnap = emblaMainApi.value.selectedScrollSnap()
  if (newSnap !== activeIndex.value) activeIndex.value = newSnap
  emblaThumbnailApi.value.scrollTo(newSnap)
}

const goPrev = () => {
  emblaMainApi.value?.scrollPrev()
  emblaThumbnailApi.value?.scrollPrev()
}
const goNext = () => {
  emblaMainApi.value?.scrollNext()
  emblaThumbnailApi.value?.scrollNext()
}

const onThumbClick = (index: number) => {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return
  activeIndex.value = index
  emblaMainApi.value.scrollTo(index)
  emblaThumbnailApi.value.scrollTo(index)
}

const triggerReload = async () => {
  await loadRow()
  isUpdated.value++
}

// Initial sync: when Embla is ready, scroll to parent's activeIndex.
watchOnce(emblaMainApi, async (api) => {
  if (!api) return
  emblaThumbnailApi.value?.on('reInit', onSelect)
  api.on('select', onSelect)
  await nextTick(() => {
    if (activeIndex.value !== undefined && activeIndex.value >= 0) {
      api.scrollTo(activeIndex.value, true)
    }
  })
})

// External activeIndex change (e.g., user clicks the bottom strip in the
// parent or arrow-key navigation): scroll the carousel to match. Skip
// re-scrolling when Embla's own onSelect was the source of the change.
watch(activeIndex, (idx) => {
  if (!emblaMainApi.value || idx === undefined) return
  if (emblaMainApi.value.selectedScrollSnap() !== idx) {
    emblaMainApi.value.scrollTo(idx)
  }
})

/* keyboard navigation — arrows move active item */

function onKeyDown(event: KeyboardEvent) {
  if (props.isRenameModalOpen) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goPrev()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    goNext()
  }
}

onMounted(() => container.value?.addEventListener('keydown', onKeyDown))
onUnmounted(() => container.value?.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div
    ref="container"
    tabindex="0"
    class="nc-inline-attachment-carousel relative w-full h-full overflow-hidden bg-black bg-opacity-90 outline-none flex"
  >
    <div class="flex w-full overflow-hidden justify-center text-center relative items-center">
      <!-- File name at top — click to download (mirrors original) -->
      <div
        v-if="activeAttachment"
        class="keep-open select-none absolute top-3 pointer-events-none inset-x-0 mx-auto group flex items-center justify-center leading-8 text-center"
      >
        <h3
          style="width: max-content; max-width: 80%"
          class="hover:underline pointer-events-auto font-semibold cursor-pointer text-white text-sm truncate"
          @click.stop="emit('download', activeAttachment)"
        >
          {{ activeAttachment && activeAttachment.title }}
        </h3>
      </div>

      <!-- Embla carousel — slides per file type -->
      <NcCarousel class="!absolute inset-y-12 inset-x-16 keep-open flex justify-center items-center" @init-api="initEmblaApi">
        <NcCarouselContent>
          <NcCarouselItem v-for="(item, index) in visibleItems" :key="index">
            <div v-if="activeIndex === index" :key="isUpdated" class="justify-center w-full h-full flex items-center">
              <CellAttachmentPreviewImage
                v-if="isImage(item.title, item.mimetype)"
                class="nc-attachment-img-wrapper"
                object-fit="contain"
                controls
                :alt="item.title"
                :srcs="getPossibleAttachmentSrc(item)"
                @error="triggerReload"
              />
              <CellAttachmentPreviewVideo
                v-else-if="isVideo(item.title, item.mimetype)"
                class="flex items-center w-full"
                :mime-type="item.mimetype"
                :title="item.title"
                :src="getPossibleAttachmentSrc(item)"
                @error="triggerReload"
              />
              <CellAttachmentPreviewVideo
                v-else-if="isAudio(item.title, item.mimetype)"
                class="flex items-center w-full"
                :mime-type="item.mimetype"
                :title="item.title"
                :src="getPossibleAttachmentSrc(item)"
                @error="triggerReload"
              />
              <CellAttachmentPreviewPdf
                v-else-if="isPdf(item.title, item.mimetype)"
                class="keep-open"
                :src="getPossibleAttachmentSrc(item)"
                @error="triggerReload"
              />
              <CellAttachmentPreviewMiscOffice
                v-else-if="isOffice(item.title, item.mimetype)"
                class="keep-open"
                :src="getPossibleAttachmentSrc(item)"
                @error="triggerReload"
              />
              <div v-else class="bg-white h-full flex flex-col justify-center rounded-md gap-1 items-center w-full">
                <component :is="iconMap.file" class="text-gray-600 w-16 h-16" />
                <div class="text-gray-800 text-sm truncate px-4">{{ item.title }}</div>
              </div>
            </div>
          </NcCarouselItem>
        </NcCarouselContent>
      </NcCarousel>

      <!-- Full-height navigation arrows (mirrors original `carousel-navigation`) -->
      <div v-if="emblaMainApi?.canScrollPrev()" class="left-2 carousel-navigation keep-open" @click="goPrev">
        <component :is="iconMap.arrowLeft" class="text-5xl" />
      </div>
      <div v-if="emblaMainApi?.canScrollNext()" class="right-2 carousel-navigation keep-open" @click="goNext">
        <component :is="iconMap.arrowRight" class="text-5xl" />
      </div>

      <!-- Bottom thumbnail strip (mirrors original, scaled down a bit for the panel) -->
      <div class="absolute w-full !bottom-2 max-h-16 z-30 flex items-center justify-center pointer-events-none">
        <NcCarousel class="absolute max-w-xs pointer-events-auto" @init-api="(val) => (emblaThumbnailApi = val)">
          <NcCarouselContent class="!flex !gap-2">
            <NcCarouselItem
              v-for="(item, index) in visibleItems"
              :key="index"
              :class="{
                '!opacity-100': index === activeIndex,
                '!basis-1/4': visibleItems.length >= 4,
                '!basis-1/3': visibleItems.length === 3,
                '!basis-1/2': visibleItems.length === 2,
              }"
              class="px-1 keep-open opacity-50 cursor-pointer"
              @click="onThumbClick(index)"
            >
              <div class="flex items-center justify-center">
                <CellAttachmentPreviewThumbnail
                  class="nc-attachment-img-wrapper h-10"
                  :attachment="item"
                  thumbnail="tiny"
                  object-fit="contain"
                  :alt="item.title"
                  @error="triggerReload"
                />
              </div>
            </NcCarouselItem>
          </NcCarouselContent>
        </NcCarousel>
      </div>

      <!-- Action buttons (top-right) — add / rename / download / delete -->
      <div
        v-if="activeAttachment"
        class="absolute keep-open right-2 z-30 top-2 transition-all gap-3 transition-ease-in-out !h-6 flex items-center"
      >
        <NcTooltip v-if="isEditAllowed" color="light" placement="bottom">
          <template #title>Add file(s)</template>
          <NcButton
            class="nc-attachment-add !hover:text-gray-400 !hover:bg-transparent !text-white"
            size="xsmall"
            type="text"
            @click="emit('add-file')"
          >
            <component :is="iconMap.plus" class="!hover:text-gray-400" />
          </NcButton>
        </NcTooltip>
        <NcTooltip v-if="isEditAllowed" color="light" placement="bottom">
          <template #title>{{ $t('title.renameFile') }}</template>
          <NcButton
            size="xsmall"
            class="nc-attachment-rename !hover:text-gray-400 !hover:bg-transparent !text-white"
            type="text"
            @click="emit('rename', activeAttachment, activeIndex ?? 0)"
          >
            <component :is="iconMap.rename" class="!hover:text-gray-400" />
          </NcButton>
        </NcTooltip>
        <NcTooltip color="light" placement="bottom">
          <template #title>{{ $t('title.downloadFile') }}</template>
          <NcButton
            class="!hover:bg-transparent !text-white"
            size="xsmall"
            type="text"
            @click="emit('download', activeAttachment)"
          >
            <component :is="iconMap.download" class="!hover:text-gray-400" />
          </NcButton>
        </NcTooltip>
        <NcTooltip v-if="isEditAllowed" color="light" placement="bottomRight">
          <template #title>{{ $t('title.removeFile') }}</template>
          <NcButton class="!hover:bg-transparent !text-white" size="xsmall" type="text" @click="emit('remove', activeIndex ?? 0)">
            <component :is="iconMap.delete" class="!hover:text-gray-400" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Same as the original Carousel.vue — full-height clickable nav columns
 * with light-on-dark arrows. */
.carousel-navigation {
  @apply absolute text-gray-400 hover:text-white cursor-pointer text-white h-full flex items-center inset-y-0 my-0 z-20;
}
</style>

<style lang="scss">
.nc-inline-attachment-carousel {
  .nc-attachment-carousel {
    @apply w-max;
  }

  .carousel-container {
    @apply !w-full flex items-center h-full;

    .embla__container {
      @apply items-center h-full w-full;
    }
  }
}
</style>
