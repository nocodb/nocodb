<script setup lang="ts">
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { GlobalWorkerOptions, RenderingCancelledException, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// Renders PDFs to canvas for browsers without an inline PDF viewer (iOS / iPadOS Safari, mobile browsers)

interface Props {
  src: string[]
  class?: string
}

const props = defineProps<Props>()

const emits = defineEmits(['error'])

GlobalWorkerOptions.workerSrc = workerSrc

// Caps canvas memory; iOS Safari has a low total canvas memory limit
const MAX_PIXEL_RATIO = 2

const MAX_PAGE_WIDTH = 900

const containerRef = ref<HTMLDivElement>()

const { width: containerWidth } = useElementSize(containerRef)

const pageSizes = ref<{ width: number; height: number }[]>([])

const isLoading = ref(true)

const hasError = ref(false)

let pdfDoc: PDFDocumentProxy | null = null

let loadingTask: PDFDocumentLoadingTask | null = null

let observer: IntersectionObserver | null = null

let loadId = 0

const canvasRefs = new Map<number, HTMLCanvasElement>()

const renderTasks = new Map<number, RenderTask>()

const visiblePages = new Set<number>()

const pageWidth = computed(() => Math.max(Math.min(containerWidth.value - 16, MAX_PAGE_WIDTH), 0))

function setCanvasRef(el: unknown, index: number) {
  if (el instanceof HTMLCanvasElement) canvasRefs.set(index, el)
  else canvasRefs.delete(index)
}

function releasePage(index: number) {
  renderTasks.get(index)?.cancel()
  renderTasks.delete(index)

  // Shrinking the canvas frees its backing store
  const canvas = canvasRefs.get(index)
  if (canvas) {
    canvas.width = 0
    canvas.height = 0
  }
}

async function renderPage(index: number) {
  const doc = pdfDoc
  const canvas = canvasRefs.get(index)
  const size = pageSizes.value[index]
  if (!doc || !canvas || !size || !pageWidth.value) return

  const page = await doc.getPage(index + 1)
  if (doc !== pdfDoc || !visiblePages.has(index)) return

  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  const viewport = page.getViewport({ scale: (pageWidth.value / size.width) * pixelRatio })

  const offscreen = document.createElement('canvas')
  offscreen.width = Math.floor(viewport.width)
  offscreen.height = Math.floor(viewport.height)
  const offscreenCtx = offscreen.getContext('2d')
  if (!offscreenCtx) return

  const task = page.render({ canvasContext: offscreenCtx, viewport })
  renderTasks.get(index)?.cancel()
  renderTasks.set(index, task)

  try {
    await task.promise
  } catch (e) {
    if (e instanceof RenderingCancelledException) return
    throw e
  } finally {
    if (renderTasks.get(index) === task) renderTasks.delete(index)
  }

  // Draw the finished page in one step so a re-render never flashes blank
  if (doc !== pdfDoc || !visiblePages.has(index)) return
  canvas.width = offscreen.width
  canvas.height = offscreen.height
  canvas.getContext('2d')?.drawImage(offscreen, 0, 0)
  offscreen.width = 0
  offscreen.height = 0
}

function observePages() {
  observer?.disconnect()
  if (!containerRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.pageIndex)
        if (entry.isIntersecting) {
          visiblePages.add(index)
          renderPage(index).catch(() => {})
        } else {
          visiblePages.delete(index)
          releasePage(index)
        }
      }
    },
    { root: containerRef.value, rootMargin: '300px 0px' },
  )

  canvasRefs.forEach((canvas) => observer?.observe(canvas))
}

function cleanup() {
  observer?.disconnect()
  observer = null
  canvasRefs.forEach((_, index) => releasePage(index))
  visiblePages.clear()
  loadingTask?.destroy()
  loadingTask = null
  pdfDoc = null
}

async function loadDocument() {
  const currentLoadId = ++loadId

  cleanup()
  isLoading.value = true
  hasError.value = false
  pageSizes.value = []

  for (const url of props.src) {
    const task = getDocument({ url, isEvalSupported: false })
    loadingTask = task

    try {
      const doc = await task.promise

      const sizes: { width: number; height: number }[] = []
      for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
        const { width, height } = (await doc.getPage(pageNo)).getViewport({ scale: 1 })
        sizes.push({ width, height })
      }

      if (currentLoadId !== loadId) return

      pdfDoc = doc
      pageSizes.value = sizes
      isLoading.value = false

      await nextTick()
      observePages()
      return
    } catch {
      if (currentLoadId !== loadId) return
      task.destroy()
    }
  }

  isLoading.value = false
  hasError.value = true

  const srcKey = props.src.join('\n')
  if (reloadRequested.has(srcKey)) return

  const isURLExp = await isURLExpired(props.src[0])
  if (currentLoadId === loadId && isURLExp.isExpired) {
    reloadRequested.add(srcKey)
    emits('error')
  }
}

// `src` is a fresh array on every parent render, so watch its content
watch(
  () => props.src.join('\n'),
  () => {
    loadDocument()
  },
  { immediate: true },
)

watchDebounced(
  pageWidth,
  () => {
    visiblePages.forEach((index) => {
      renderPage(index).catch(() => {})
    })
  },
  { debounce: 200 },
)

onBeforeUnmount(() => {
  loadId++
  cleanup()
})
</script>

<script lang="ts">
// Module-scoped so it survives the parent's remount; CORS/offline failures look expired and would reload forever
const reloadRequested = new Set<string>()
</script>

<template>
  <div ref="containerRef" :class="props.class" class="nc-attachment-pdf-js-viewer w-full h-full overflow-auto">
    <div v-if="isLoading" class="w-full h-full flex items-center justify-center text-nc-content-gray-muted">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else-if="hasError" class="w-full h-full flex items-center justify-center">
      <div class="bg-nc-bg-default flex flex-col justify-center rounded-md gap-2 items-center px-6 py-8 max-w-100">
        <GeneralIcon icon="pdfFile" class="text-nc-content-gray-subtle w-16 h-16" />
        <div class="text-nc-content-gray-muted text-sm text-center">{{ $t('labels.noPreviewAvailable') }}</div>
        <a :href="props.src[0]" target="_blank" rel="noopener noreferrer" class="text-sm font-semibold">
          {{ $t('general.download') }}
        </a>
      </div>
    </div>

    <div v-else class="flex flex-col items-center gap-4 py-2">
      <canvas
        v-for="(size, index) in pageSizes"
        :key="index"
        :ref="(el) => setCanvasRef(el, index)"
        :data-page-index="index"
        class="bg-white shadow-md flex-none"
        :style="{ width: `${pageWidth}px`, height: `${(pageWidth * size.height) / size.width}px` }"
      />
    </div>
  </div>
</template>
