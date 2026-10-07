<script setup lang="ts">
import { usePlaygroundTokens } from '../../-helper/tokens'

const props = defineProps<{
  src: string
  width: number | null
}>()

const { css, registerFrame, unregisterFrame } = usePlaygroundTokens()

const { isDark, selectedTheme } = useTheme()

const frameRef = ref<HTMLIFrameElement>()

const isLoading = ref(true)

const loadError = ref<string>()

/** a written document can't boot the app twice in one realm, so bump for a fresh iframe */
const frameKey = ref(0)

let reapplyTimer: ReturnType<typeof setTimeout> | undefined

let themeObserver: MutationObserver | undefined

function mirrorTheme() {
  const root = frameRef.value?.contentDocument?.documentElement
  if (!root) return
  // the playground's theme isn't persisted, so hand it to the frame's useTheme directly
  try {
    frameRef.value?.contentWindow?.dispatchEvent(new StorageEvent('storage', { key: 'nc-theme', newValue: selectedTheme.value }))
  } catch {}
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

// replaying the dark-palette `storage` event flushes the frame grid's cached colours
function repaintFrame() {
  const win = frameRef.value?.contentWindow
  if (!win) return
  try {
    win.dispatchEvent(new StorageEvent('storage', { key: 'nc-dark-palette', newValue: localStorage.getItem('nc-dark-palette') }))
  } catch {}
}

// 02.security.global.ts 403s app routes in an iframe; the prelude aliases `self` to `top` first
async function boot(path: string) {
  themeObserver?.disconnect()
  isLoading.value = true
  loadError.value = undefined
  await nextTick()
  const doc = frameRef.value?.contentDocument
  if (!doc) return
  // deep paths have no SPA fallback on deployed builds
  let html: string
  try {
    const res = await fetch('/')
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    html = await res.text()
  } catch (e) {
    loadError.value = `Couldn't load the app shell: ${e instanceof Error ? e.message : String(e)}`
    isLoading.value = false
    return
  }
  const prelude = `<script>history.replaceState(null, '', ${JSON.stringify(path)}); window.self = window.top<\/script>`
  doc.open()
  doc.write(html.replace(/<head[^>]*>/i, (head) => `${head}${prelude}`))
  doc.close()
}

// the framed app applies its stored theme after boot; put the playground's back
function watchFrameTheme() {
  themeObserver?.disconnect()
  const root = frameRef.value?.contentDocument?.documentElement
  if (!root) return
  themeObserver = new MutationObserver(() => {
    if ((root.getAttribute('theme') === 'dark') !== isDark.value) mirrorTheme()
  })
  themeObserver.observe(root, { attributes: true, attributeFilter: ['theme'] })
}

function syncFrame() {
  if (!frameRef.value) return
  registerFrame(frameRef.value)
  mirrorTheme()
  watchFrameTheme()
  repaintFrame()
}

function onLoad() {
  const win = frameRef.value?.contentWindow
  if (!win || win.location.href === 'about:blank') return
  // a full reload inside the frame (sign-out, hard refresh) lands unpatched — reboot at that route
  if (win.self !== win.top) {
    const path = `${win.location.pathname}${win.location.search}`
    // rebooting at an inherited playground URL would frame the playground inside itself
    if (path === '/playground' || path.startsWith('/playground/')) {
      loadError.value = `The frame lost its route and landed on ${win.location.pathname}`
      isLoading.value = false
      win.location.replace('about:blank')
      return
    }
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

watch(isDark, () => nextTick(mirrorTheme))

watch(css, repaintFrame, { flush: 'post' })

onMounted(() => boot(props.src))

onBeforeUnmount(() => {
  clearTimeout(reapplyTimer)
  themeObserver?.disconnect()
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
    <div
      v-if="loadError"
      class="absolute inset-0 flex items-center justify-center p-6 rounded-lg bg-nc-bg-default text-center text-captionSm text-nc-content-red-dark"
    >
      {{ loadError }}
    </div>
    <div v-else-if="isLoading" class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <GeneralLoader size="xlarge" />
    </div>
  </div>
</template>
