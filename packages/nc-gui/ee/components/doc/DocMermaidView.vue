<script setup lang="ts">
/**
 * Renders a Mermaid source string as an SVG diagram.
 *
 * - Mermaid is lazy-loaded on first use (~1MB chunk) and cached at module scope
 *   so multiple diagrams on the same page share one instance.
 * - Theme is fixed to `neutral` in this iteration; theme sync arrives later.
 * - `securityLevel: 'strict'` makes mermaid sanitise SVG output, so the
 *   v-html block below is safe for trusted-input docs.
 * - Renders are debounced and stamped with a monotonic id so stale async
 *   results from rapid typing can't overwrite the latest output.
 */
type MermaidApi = typeof import('mermaid').default

const props = defineProps<{
  code: string
}>()

let mermaidPromise: Promise<MermaidApi> | null = null

const loadMermaid = (): Promise<MermaidApi> => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
        fontFamily: 'inherit',
      })
      return mod.default
    })
  }
  return mermaidPromise
}

// Module-scoped counter — guarantees unique element ids across all instances.
let nextRenderId = 0

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
    const mermaid = await loadMermaid()
    const elemId = `nc-mermaid-${++nextRenderId}`
    const { svg: rendered } = await mermaid.render(elemId, code)
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

watch(() => props.code, debouncedRender, { immediate: true })
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
  </div>
</template>

<style lang="scss" scoped>
.nc-mermaid-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  padding: 16px;
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
</style>
