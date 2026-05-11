<script setup lang="ts">
/**
 * Renders a Mermaid source string as an SVG diagram.
 *
 * The shared lazy-loader and render queue live in `./mermaidRenderer.ts`.
 * They must be module-scoped (not declared inside this `<script setup>`)
 * — see that file's comment for why. This component is purely the
 * per-instance UI layer: track loading/error state and write the result
 * into a reactive `svg` ref to render via `v-html`.
 *
 * Renders are debounced and stamped with a monotonic id so stale async
 * results from rapid typing can't overwrite the latest output.
 */
import { type MermaidTheme, renderMermaidDiagram } from './mermaidRenderer'

const props = defineProps<{
  code: string
}>()

const { isDark } = useTheme()

const themeKey = computed<MermaidTheme>(() => (isDark.value ? 'dark' : 'light'))

const svg = ref('')

const errorMsg = ref('')

const isLoading = ref(false)

let activeRenderId = 0

const trimmedCode = computed(() => props.code.trim())

const render = async () => {
  const code = trimmedCode.value

  if (!code) {
    svg.value = ''
    errorMsg.value = ''
    isLoading.value = false
    return
  }

  const myId = ++activeRenderId
  isLoading.value = true

  try {
    const rendered = await renderMermaidDiagram(code, themeKey.value)
    if (myId !== activeRenderId) return
    svg.value = rendered
    errorMsg.value = ''
  } catch (e: any) {
    if (myId !== activeRenderId) return
    svg.value = ''
    errorMsg.value = e?.message || String(e)
  } finally {
    if (myId === activeRenderId) isLoading.value = false
  }
}

const debouncedRender = useDebounceFn(render, 200)

// Re-render on code OR theme change (flipping dark mode swaps the palette).
watch([() => props.code, themeKey], debouncedRender, { immediate: true })

// --- Actions exposed to the parent toolbar ---

const isExpanded = ref(false)

const expandDiagram = () => {
  if (!svg.value) return
  isExpanded.value = true
}

const downloadDiagram = () => {
  if (!svg.value) return
  // SVG output already carries inline styles + viewBox from mermaid, so a
  // direct blob is portable — opens in any viewer or imports cleanly to
  // design tools. PNG export would need canvas rasterisation, deferred.
  const blob = new Blob([svg.value], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mermaid-diagram.svg'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

defineExpose({
  expandDiagram,
  downloadDiagram,
  hasSvg: computed(() => !!svg.value),
})
</script>

<template>
  <div class="nc-mermaid-view" contenteditable="false">
    <div v-if="!trimmedCode" class="nc-mermaid-empty">
      {{ $t('labels.emptyMermaidDiagram') }}
    </div>
    <div v-else-if="errorMsg" class="nc-mermaid-error">
      <GeneralIcon icon="ncInfo" class="nc-mermaid-error-icon" />
      <span>{{ errorMsg }}</span>
    </div>
    <div v-else-if="isLoading && !svg" class="nc-mermaid-loading">
      <GeneralLoader />
    </div>
    <!-- eslint-disable vue/no-v-html -->
    <div v-else class="nc-mermaid-svg" v-html="svg" />
    <!-- eslint-enable vue/no-v-html -->

    <NcModal v-model:visible="isExpanded" size="xl" :show-separator="false" :destroy-on-close="false">
      <div class="nc-mermaid-expanded-body">
        <!-- eslint-disable vue/no-v-html -->
        <div class="nc-mermaid-expanded-svg" v-html="svg" />
        <!-- eslint-enable vue/no-v-html -->
      </div>
    </NcModal>
  </div>
</template>

<style lang="scss" scoped>
.nc-mermaid-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  // Toolbar sits at top: 8px + height ~28px — leave clearance so it never
  // overlaps the rendered diagram regardless of mermaid's intrinsic size.
  padding: 48px 16px 16px;
  background: var(--nc-bg-default);
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 0.5em;
  user-select: none;
}

.nc-mermaid-svg {
  width: 100%;
  overflow-x: auto;
  text-align: center;

  :deep(svg) {
    max-width: 100%;
    height: auto;
  }
}

.nc-mermaid-empty {
  color: var(--nc-content-gray-subtle);
  font-size: 13px;
}

.nc-mermaid-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  color: var(--nc-content-red-dark);
  @apply bg-nc-bg-red-light;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

.nc-mermaid-error-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.nc-mermaid-loading {
  color: var(--nc-content-gray-subtle);
}

.nc-mermaid-expanded-body {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 24px;
  overflow: auto;
}

.nc-mermaid-expanded-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;

  :deep(svg) {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }
}
</style>
