<script setup lang="ts">
import { usePlaygroundTokens } from '../../-helper/tokens'

/** Same-origin frame of a real app route, kept in sync with the host's tokens and theme. */
const props = defineProps<{
  src: string
  /** px width, or null for full width */
  width: number | null
}>()

const { css, registerFrame, unregisterFrame } = usePlaygroundTokens()

const { isDark } = useTheme()

const frameRef = ref<HTMLIFrameElement>()

const isLoading = ref(true)

/** bumped to get a fresh iframe window — a written document can't boot the app twice in one realm */
const frameKey = ref(0)

let reapplyTimer: ReturnType<typeof setTimeout> | undefined

function mirrorTheme() {
  const root = frameRef.value?.contentDocument?.documentElement
  if (!root) return
  if (isDark.value) {
    root.setAttribute('theme', 'dark')
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.removeAttribute('theme')
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
}

/**
 * The frame's canvas grid caches resolved colours in its own useTheme instance.
 * Its `storage` listener for the dark-palette key re-applies the palette, which
 * flushes those caches and bumps its repaint counter — so replay that event.
 */
function repaintFrame() {
  const win = frameRef.value?.contentWindow
  if (!win) return
  try {
    win.dispatchEvent(new StorageEvent('storage', { key: 'nc-dark-palette', newValue: localStorage.getItem('nc-dark-palette') }))
  } catch {}
}

/**
 * middleware/02.security.global.ts 403s every app route inside an iframe (`self !== top`).
 * Writing the app shell into the frame's initial about:blank document lets an inline
 * script run first: it moves the URL to the target route and aliases `self` to `top`.
 */
async function boot(path: string) {
  isLoading.value = true
  await nextTick()
  const doc = frameRef.value?.contentDocument
  if (!doc) return
  const html = await (await fetch(path)).text()
  const prelude = `<script>history.replaceState(null, '', ${JSON.stringify(path)}); window.self = window.top<\/script>`
  doc.open()
  doc.write(html.replace(/<head[^>]*>/i, (head) => `${head}${prelude}`))
  doc.close()
}

function syncFrame() {
  if (!frameRef.value) return
  registerFrame(frameRef.value)
  mirrorTheme()
  repaintFrame()
}

function onLoad() {
  const win = frameRef.value?.contentWindow
  if (!win || win.location.href === 'about:blank') return
  // a full reload inside the frame (sign-out, hard refresh) lands unpatched — reboot at that route
  if (win.self !== win.top) {
    const path = `${win.location.pathname}${win.location.search}`
    frameKey.value++
    nextTick(() => boot(path))
    return
  }
  isLoading.value = false
  syncFrame()
  // app styles injected after boot can win source-order ties (e.g. !important ant vars); re-append ours
  clearTimeout(reapplyTimer)
  reapplyTimer = setTimeout(syncFrame, 3000)
}

watch(
  () => props.src,
  (src) => {
    if (frameRef.value) unregisterFrame(frameRef.value)
    frameKey.value++
    boot(src)
  },
)

// the frame's own useTheme follows the host through the `nc-theme` storage event; this covers the gap until it reacts
watch(isDark, () => nextTick(mirrorTheme))

watch(css, repaintFrame, { flush: 'post' })

onMounted(() => boot(props.src))

onBeforeUnmount(() => {
  clearTimeout(reapplyTimer)
  if (frameRef.value) unregisterFrame(frameRef.value)
})
</script>

<template>
  <div
    class="relative h-full mx-auto transition-all duration-200"
    :style="{ width: width ? `${width}px` : '100%', maxWidth: '100%' }"
  >
    <iframe
      :key="frameKey"
      ref="frameRef"
      class="w-full h-full border-1 border-nc-border-gray-medium rounded-lg bg-nc-bg-default"
      data-testid="nc-playground-live-frame"
      @load="onLoad"
    />
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <GeneralLoader size="xlarge" />
    </div>
  </div>
</template>
