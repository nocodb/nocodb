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

// Carousel comments + annotations are available whenever the full-screen
// viewer is open — including over the expanded record (the most common way to
// open an attachment). The viewer sits on top, so its own comments panel is
// the active one regardless of how it was opened.
const carouselCommentsEnabled = computed(
  () => !isPublic.value && isUIAllowed('commentList') && isFeatureEnabled(FEATURE_FLAG.ATTACHMENT_CAROUSEL_COMMENTS),
)

const annotationEnabled = carouselCommentsEnabled

// Bottom-left file meta (type • size) for the current attachment.
const fileTypeLabel = computed(() => {
  if (!selectedFile.value) return ''
  const fromMime = getReadableFileType(selectedFile.value.mimetype)
  if (fromMime) return fromMime
  const title = `${selectedFile.value.title || ''}`
  const ext = title.includes('.') ? title.split('.').pop() : ''
  return ext ? ext.toUpperCase() : ''
})

const fileSizeLabel = computed(() =>
  selectedFile.value && selectedFile.value.size ? formatFileSize(selectedFile.value.size, 1) : '',
)

const {
  markers,
  draft,
  activeAnnotationId,
  hoveredAnnotationId,
  focusTarget,
  startDraft,
  cancelDraft,
  setHovered,
  setActive,
  clearFocus,
} = useProvideImageAnnotations(selectedFile, visibleItems)

// Clicks in the carousel area (outside the image/chrome): close an open comment
// modal first, otherwise close the carousel. Marker/popup clicks use @click.stop
// so they never reach here.
useEventListener(container, 'click', (e) => {
  const target = e.target as HTMLElement
  if (
    target.closest('.keep-open') ||
    target.closest('.nc-button') ||
    target.closest('img') ||
    target.closest('video') ||
    target.closest('.nc-annotation-comment-box') ||
    target.closest('.nc-annotation-comment-view') ||
    target.closest('.nc-annotation-marker')
  ) {
    return
  }

  if (draft.value || activeAnnotationId.value) {
    cancelDraft()
    setActive(null)
    return
  }

  selectedFile.value = false
})

const toggleComment = () => {
  openComments.value = !openComments.value
}

// Switching the previewed image invalidates any in-progress draft (its
// coordinates belong to the previous file). A stale active id is harmless —
// no marker on another file matches it.
watch(selectedIndex, () => {
  cancelDraft()
  setHovered(null)
})

function onCreateAnnotation(payload: { region: any; anchor: { x: number; y: number } }) {
  // Don't auto-open the comments panel — opening it resizes the image and
  // would shift the just-placed marker. The anchored popup is enough; the
  // saved comment shows in the panel once the user opens it.
  startDraft(payload.region, payload.anchor)
}

function onSelectAnnotation(commentId: string) {
  // Clicking a marker opens its conversation popup on the image. Don't force
  // the side panel open — opening it resizes the image and shifts the marker.
  setActive(commentId)
}

// "View" from the comments sidebar — switch to the annotated file + highlight.
watch(focusTarget, (target) => {
  if (!target) return

  if (target.attachment) {
    const idx = visibleItems.value.findIndex(
      (item) => item?.path === target.attachment?.path && item?.url === target.attachment?.url,
    )
    if (idx >= 0 && idx !== selectedIndex.value) {
      emblaMainApi.value?.scrollTo(idx)
      emblaThumbnailApi.value?.scrollTo(idx)
    }
  }

  setActive(target.commentId)
  openComments.value = true
  clearFocus()
})

onMounted(() => {
  if (carouselCommentsEnabled.value) {
    const { loadComments } = useRowCommentsOrThrow()
    loadComments()
  }
})

const initEmblaApi = (val: any) => {
  emblaMainApi.value = val
}
</script>

<template>
  <GeneralOverlay v-model="selectedFile" transition :z-index="isExpandedFormOpen ? 1000 : 504" class="bg-black bg-opacity-90">
    <!-- The carousel is always dark; force the dark theme on its subtree (the
         comment popup + comments side-panel) regardless of the app theme.
         `theme="dark"` switches the CSS variables; `dark` enables Windi dark: variants. -->
    <div class="flex w-full h-full dark" theme="dark">
      <div
        v-if="selectedFile"
        ref="container"
        class="flex w-full overflow-hidden justify-center text-center relative nc-h-screen items-center"
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
                <CellAttachmentPreviewImage
                  v-if="isImage(item.title, item.mimetype)"
                  class="nc-attachment-img-wrapper"
                  object-fit="contain"
                  controls
                  :alt="item.title"
                  :srcs="getPossibleAttachmentSrc(item)"
                  :annotatable="annotationEnabled"
                  :markers="markers"
                  :draft="draft"
                  :active-id="activeAnnotationId"
                  :hovered-id="hoveredAnnotationId"
                  @error="triggerReload"
                  @create-annotation="onCreateAnnotation"
                  @select-annotation="onSelectAnnotation"
                  @hover-annotation="setHovered"
                >
                  <template #popup>
                    <CellAttachmentAnnotationCommentBox />
                  </template>
                  <template #viewPopup>
                    <CellAttachmentAnnotationCommentView />
                  </template>
                </CellAttachmentPreviewImage>

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

        <div v-if="carouselCommentsEnabled" class="absolute top-2 right-2">
          <NcButton class="!hover:bg-transparent" type="text" size="small" @click="toggleComment">
            <div class="flex gap-1 text-white justify-center items-center">
              {{ $t('general.comments') }}
              <GeneralIcon icon="messageCircle" />
            </div>
          </NcButton>
        </div>

        <div class="text-white absolute right-2 top-2 cursor-pointer"></div>

        <div
          v-if="fileTypeLabel || fileSizeLabel"
          class="nc-attachment-file-meta absolute left-4 bottom-3 z-30 flex items-center gap-1.5 text-small font-medium text-gray-300 select-none pointer-events-none"
        >
          <span v-if="fileTypeLabel">{{ fileTypeLabel }}</span>
          <span v-if="fileTypeLabel && fileSizeLabel">•</span>
          <span v-if="fileSizeLabel">{{ fileSizeLabel }}</span>
        </div>

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
                  <CellAttachmentPreviewThumbnail
                    class="nc-attachment-img-wrapper h-12"
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
        v-if="carouselCommentsEnabled"
        :class="{
          'w-0': !openComments,
          '!w-88': openComments,
        }"
        class="bg-nc-bg-gray-light max-w-88 transition-all"
      >
        <SmartsheetExpandedFormSidebarComments />
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
