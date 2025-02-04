<script lang="ts" setup>
import type { CarouselApi } from '../../nc/Carousel/interface'
import { useAttachmentCell } from './utils'
import { isOffice } from '~/utils/fileUtils'

const { selectedFile, visibleItems, downloadAttachment, removeFile, renameFile, isPublic, isRenameModalOpen, isEditAllowed } =
  useAttachmentCell()!

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const { isUIAllowed } = useRoles()

const container = ref<HTMLElement | null>(null)

const emblaMainApi: CarouselApi = ref()
const emblaThumbnailApi: CarouselApi = ref()
const selectedIndex = ref()

const { getPossibleAttachmentSrc } = useAttachment()

useEventListener(container, 'click', (e) => {
  const target = e.target as HTMLElement
  if (!target.closest('.keep-open') && !target.closest('.nc-button') && !target.closest('img') && !target.closest('video')) {
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

const goPrev = () => {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return

  emblaMainApi.value.scrollPrev()
  emblaThumbnailApi.value.scrollPrev()
}

const goNext = () => {
  if (!emblaMainApi.value || !emblaThumbnailApi.value) return

  emblaMainApi.value.scrollNext()
  emblaThumbnailApi.value.scrollNext()
}

// When the carousel is initialized, we set the selected index to the index of the selected file
// and scroll to that index. We only need to do this once, so we use watchOnce.
watchOnce(emblaMainApi, async (emblaMainApi) => {
  if (!emblaMainApi) return

  // The focus is set to the container so that the keyboard navigation works
  container.value?.focus()

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

const { loadRow } = useSmartsheetRowStoreOrThrow()

const isUpdated = ref(1)

const triggerReload = async () => {
  await loadRow()
  isUpdated.value = isUpdated.value + 1
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

function onKeyDown(event: KeyboardEvent) {
  if (isRenameModalOpen.value) return
  const prevKey = ['ArrowLeft', 'Left', 'a', 'A']
  const nextKey = ['ArrowRight', 'Right', 'd', 'D']

  if (prevKey.includes(event.key)) {
    event.preventDefault()
    emblaMainApi.value?.scrollPrev()
    return
  }

  if (nextKey.includes(event.key)) {
    event.preventDefault()
    emblaMainApi.value?.scrollNext()
  }
}

const { isFeatureEnabled } = useBetaFeatureToggle()

const openComments = ref(false)

const toggleComment = () => {
  openComments.value = !openComments.value
}

onMounted(() => {
  if (
    !isPublic.value &&
    !isExpandedFormOpen.value &&
    isUIAllowed('commentList') &&
    isFeatureEnabled(FEATURE_FLAG.ATTACHMENT_CAROUSEL_COMMENTS)
  ) {
    const { loadComments } = useRowCommentsOrThrow()
    loadComments()
  }
})

const initEmblaApi = (val: any) => {
  emblaMainApi.value = val
}
</script>

<template>
  <GeneralOverlay v-model="selectedFile" transition :z-index="isExpandedFormOpen ? 1000 : 50" class="bg-black bg-opacity-90">
    <div class="flex w-full h-full">
      <div
        v-if="selectedFile"
        ref="container"
        class="flex w-full overflow-hidden justify-center text-center relative h-screen items-center"
      >
        <NcButton
          class="top-5 !absolute cursor-pointer !z-30 !hover:bg-transparent left-5"
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
            @click.stop="downloadAttachment(selectedFile)"
          >
            {{ selectedFile && selectedFile.title }}
          </h3>
        </div>

        <NcCarousel class="!absolute inset-y-16 inset-x-24 keep-open flex justify-center items-center" @init-api="initEmblaApi">
          <NcCarouselContent>
            <NcCarouselItem v-for="(item, index) in visibleItems" :key="index">
              <div v-if="selectedIndex === index" :key="isUpdated" class="justify-center w-full h-full flex items-center">
                <LazyCellAttachmentPreviewImage
                  v-if="isImage(item.title, item.mimetype)"
                  class="nc-attachment-img-wrapper"
                  object-fit="contain"
                  controls
                  :alt="item.title"
                  :srcs="getPossibleAttachmentSrc(item)"
                  @error="triggerReload"
                />

                <LazyCellAttachmentPreviewVideo
                  v-else-if="isVideo(item.title, item.mimetype)"
                  class="flex items-center w-full"
                  :mime-type="item.mimetype"
                  :title="item.title"
                  :src="getPossibleAttachmentSrc(item)"
                  @error="triggerReload"
                />
                <LazyCellAttachmentPreviewPdf
                  v-else-if="isPdf(item.title, item.mimetype)"
                  class="keep-open"
                  :src="getPossibleAttachmentSrc(item)"
                  @error="triggerReload"
                />
                <LazyCellAttachmentPreviewMiscOffice
                  v-else-if="isOffice(item.title, item.mimetype)"
                  class="keep-open"
                  :src="getPossibleAttachmentSrc(item)"
                  @error="triggerReload"
                />
                <div v-else class="bg-white h-full flex flex-col justify-center rounded-md gap-1 items-center w-full">
                  <component :is="iconMap.file" class="text-gray-600 w-20 h-20" />
                  <div class="text-gray-800 text-sm">{{ item.title }}</div>
                </div>
              </div>
            </NcCarouselItem>
          </NcCarouselContent>
        </NcCarousel>

        <div
          v-if="emblaMainApi?.canScrollPrev()"
          :key="selectedIndex"
          class="left-2 carousel-navigation keep-open"
          @click="goPrev"
        >
          <component :is="iconMap.arrowLeft" class="text-7xl" />
        </div>
        <div
          v-if="emblaMainApi?.canScrollNext()"
          :key="selectedIndex"
          class="right-2 carousel-navigation keep-open"
          @click="goNext"
        >
          <component :is="iconMap.arrowRight" class="text-7xl" />
        </div>

        <div
          v-if="isUIAllowed('commentList') && !isExpandedFormOpen && isFeatureEnabled(FEATURE_FLAG.ATTACHMENT_CAROUSEL_COMMENTS)"
          class="absolute top-2 right-2"
        >
          <NcButton class="!hover:bg-transparent" type="text" size="small" @click="toggleComment">
            <div class="flex gap-1 text-white justify-center items-center">
              Comments
              <GeneralIcon icon="messageCircle" />
            </div>
          </NcButton>
        </div>

        <div class="text-white absolute right-2 top-2 cursor-pointer"></div>

        <div class="absolute w-full !bottom-2 max-h-18 z-30 flex items-center justify-center">
          <NcCarousel class="absolute max-w-sm" @init-api="(val) => (emblaThumbnailApi = val)">
            <NcCarouselContent class="!flex !gap-2">
              <NcCarouselItem
                v-for="(item, index) in visibleItems"
                :key="index"
                :class="{
                  '!opacity-100': index === selectedIndex,
                  '!basis-1/4': visibleItems.length >= 4,
                  '!basis-1/3': visibleItems.length === 3,
                  '!basis-1/2': visibleItems.length === 2,
                }"
                class="px-2 keep-open opacity-50 cursor-pointer"
                @click="onThumbClick(index)"
              >
                <div class="flex items-center justify-center">
                  <LazyCellAttachmentPreviewImage
                    v-if="isImage(item.title, item.mimetype)"
                    class="nc-attachment-img-wrapper h-12"
                    object-fit="contain"
                    :alt="item.title"
                    :srcs="getPossibleAttachmentSrc(item, 'tiny')"
                    @error="triggerReload"
                  />
                  <div
                    v-else-if="isVideo(item.title, item.mimetype)"
                    class="h-full flex items-center h-6 justify-center rounded-md px-2 py-1 border-1 border-gray-200"
                  >
                    <GeneralIcon class="text-white" icon="play" />
                  </div>

                  <div
                    v-else-if="isPdf(item.title, item.mimetype)"
                    class="h-full flex items-center h-6 justify-center rounded-md px-2 py-1 border-1 border-gray-200"
                  >
                    <GeneralIcon class="text-white" icon="pdfFile" />
                  </div>

                  <div v-else class="h-full flex items-center h-6 justify-center rounded-md px-2 py-1 border-1 border-gray-200">
                    <GeneralIcon class="text-white" icon="file" />
                  </div>
                </div>
              </NcCarouselItem>
            </NcCarouselContent>
          </NcCarousel>
        </div>

        <div class="absolute keep-open right-2 z-30 bottom-3 transition-all gap-3 transition-ease-in-out !h-6 flex items-center">
          <NcTooltip v-if="isEditAllowed" color="light" placement="bottom">
            <template #title> {{ $t('title.renameFile') }} </template>
            <NcButton
              size="xsmall"
              class="nc-attachment-rename !hover:text-gray-400 !hover:bg-transparent !text-white"
              type="text"
              @click="renameFile(selectedFile, selectedIndex, true)"
            >
              <component :is="iconMap.rename" class="!hover:text-gray-400" />
            </NcButton>
          </NcTooltip>

          <NcTooltip color="light" placement="bottom">
            <template #title> {{ $t('title.downloadFile') }} </template>
            <NcButton
              class="!hover:bg-transparent !text-white"
              size="xsmall"
              type="text"
              @click="downloadAttachment(selectedFile)"
            >
              <component :is="iconMap.download" class="!hover:text-gray-400" />
            </NcButton>
          </NcTooltip>

          <NcTooltip v-if="isEditAllowed" color="light" placement="bottomRight">
            <template #title> {{ $t('title.removeFile') }} </template>
            <NcButton class="!hover:bg-transparent !text-white" size="xsmall" type="text" @click="removeFile(selectedIndex)">
              <component :is="iconMap.delete" class="!hover:text-gray-400" />
            </NcButton>
          </NcTooltip>
        </div>
        <GeneralDeleteModal v-model:visible="isModalOpen" entity-name="File" :on-delete="() => handleFileDelete(filetoDelete.i)">
          <template #entity-preview>
            <span>
              <div class="flex flex-row items-center py-2.25 px-2.5 bg-gray-50 rounded-lg text-gray-700 mb-4">
                <GeneralIcon icon="file" class="nc-view-icon"></GeneralIcon>
                <div
                  class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
                  :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
                >
                  {{ filetoDelete.title }}
                </div>
              </div>
            </span>
          </template>
        </GeneralDeleteModal>
      </div>
      <div
        v-if="isUIAllowed('commentList') && !isExpandedFormOpen && isFeatureEnabled(FEATURE_FLAG.ATTACHMENT_CAROUSEL_COMMENTS)"
        :class="{
          'w-0': !openComments,
          '!w-88': openComments,
        }"
        class="bg-white max-w-88 transition-all"
      >
        <LazySmartsheetExpandedFormSidebarComments />
      </div>
    </div>
  </GeneralOverlay>
</template>

<style scoped lang="scss">
.carousel-navigation {
  @apply absolute text-gray-400 hover:text-white  cursor-pointer text-white h-full flex items-center inset-y-0 my-0;
}
</style>

<style lang="scss">
.nc-attachment-carousel {
  @apply w-max;
}

.carousel-container {
  @apply !w-full flex items-center h-full;

  .embla__container {
    @apply items-center h-full w-full;
  }
}
</style>
