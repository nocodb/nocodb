<script setup lang="ts">
import type { DocHeadingEntry } from '../../composables/useDocHeadingAnchors'

interface Props {
  headings: DocHeadingEntry[]
  activeId: string | null
}

const props = defineProps<Props>()

const emits = defineEmits<{
  jump: [id: string]
}>()

const { headings, activeId } = toRefs(props)

const { $e } = useNuxtApp()

const { t } = useI18n()

const { height: windowHeight } = useWindowSize()

// Marker dash width per heading level (px). H1 widest → H3 narrowest.
const LEVEL_WIDTH: Record<number, number> = { 1: 12, 2: 9, 3: 6 }

// Vertical pitch of one dash row: button height (4px) + flex gap (8px).
const DASH_PITCH = 12

const isOpen = ref(false)

const railRef = ref<HTMLElement | null>(null)

// The rail is meaningful only when there's something to navigate between.
const isVisible = computed(() => headings.value.length > 1)

// Cap the dash stack to ~60vh (matching the outline panel) so it never runs
// past the viewport on long docs. `max(1, …)` guards tiny viewports.
const maxDashes = computed(() => Math.max(1, Math.floor((windowHeight.value * 0.6 + 8) / DASH_PITCH)))

// Progressive level-of-detail: show every heading if it fits; otherwise drop
// H3 (H1+H2 only); if still too many, drop H2 too and show only H1s.
const dashHeadings = computed(() => {
  const all = headings.value
  if (all.length <= maxDashes.value) return all

  const h1h2 = all.filter((h) => h.level <= 2)
  if (h1h2.length <= maxDashes.value) return h1h2

  return all.filter((h) => h.level === 1)
})

// The active heading may have been dropped from the dashes (e.g. an H3 while
// only H1/H2 are shown) — fall back to the nearest shown heading above it so a
// marker is always highlighted.
const activeDashId = computed(() => {
  if (!activeId.value) return null

  const shown = new Set(dashHeadings.value.map((h) => h.id))
  if (shown.has(activeId.value)) return activeId.value

  const activeIdx = headings.value.findIndex((h) => h.id === activeId.value)
  for (let i = activeIdx; i >= 0; i--) {
    const id = headings.value[i]?.id
    if (id && shown.has(id)) return id
  }
  return null
})

const { start: scheduleClose, stop: cancelClose } = useTimeoutFn(
  () => {
    isOpen.value = false
  },
  150,
  { immediate: false },
)

function dashWidth(level: number) {
  return `${LEVEL_WIDTH[level] ?? 8}px`
}

function open() {
  cancelClose()
  if (isOpen.value) return
  isOpen.value = true
  $e('c:doc:toc:open')
}

function onLeave() {
  scheduleClose()
}

function jumpTo(id: string) {
  cancelClose()
  isOpen.value = false
  $e('c:doc:toc:jump')
  emits('jump', id)
}

onClickOutside(railRef, () => {
  isOpen.value = false
})
</script>

<template>
  <div
    v-if="isVisible"
    ref="railRef"
    class="nc-doc-toc-rail hidden lg:flex"
    data-testid="nc-doc-toc-rail"
    @mouseenter="open"
    @mouseleave="onLeave"
  >
    <!-- Collapsed marker dashes — height-capped, drops H3 then H2 on long docs -->
    <div class="nc-doc-toc-dashes" :class="{ 'opacity-0': isOpen }">
      <button
        v-for="heading in dashHeadings"
        :key="heading.id"
        type="button"
        class="nc-doc-toc-dash-btn"
        :data-testid="`nc-doc-toc-dash-${heading.id}`"
        :aria-label="heading.text"
        @click="jumpTo(heading.id)"
      >
        <span
          class="nc-doc-toc-dash"
          :class="{ 'nc-doc-toc-dash-active': heading.id === activeDashId }"
          :style="{ width: dashWidth(heading.level) }"
        />
      </button>
    </div>

    <!-- Expanded outline panel (on hover) -->
    <Transition name="nc-doc-toc-fade">
      <div v-if="isOpen" class="nc-doc-toc-panel" data-testid="nc-doc-toc-panel" @mouseenter="cancelClose" @mouseleave="onLeave">
        <div class="nc-doc-toc-panel-label">{{ t('labels.onThisPage') }}</div>
        <div class="nc-doc-toc-panel-list nc-scrollbar-thin">
          <button
            v-for="heading in headings"
            :key="heading.id"
            v-e="['c:doc:toc:jump']"
            type="button"
            class="nc-doc-toc-row"
            :class="{ 'nc-doc-toc-row-active': heading.id === activeId }"
            :style="{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }"
            :data-testid="`nc-doc-toc-row-${heading.id}`"
            @click="jumpTo(heading.id)"
          >
            <NcTooltip class="truncate" show-on-truncate-only>
              <template #title>{{ heading.text }}</template>
              {{ heading.text }}
            </NcTooltip>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-toc-rail {
  @apply absolute left-2 top-1/2 z-20 items-center;
  transform: translateY(-50%);
  // Comfortable hover hit-area wider than the visible dashes.
  padding: 8px 12px 8px 4px;
}

.nc-doc-toc-dashes {
  @apply flex flex-col items-start;
  gap: 8px;
  transition: opacity 0.12s ease;
}

.nc-doc-toc-dash-btn {
  @apply flex items-center bg-transparent border-0 outline-none cursor-pointer p-0;
  // Keep the clickable row a consistent height so dashes stay evenly spaced.
  height: 4px;
}

.nc-doc-toc-dash {
  @apply block rounded-full;
  height: 1px;
  background: var(--nc-content-gray-disabled);
  transition: background-color 0.12s ease, width 0.12s ease;
}

.nc-doc-toc-dash-active {
  height: 2px;
  background: var(--nc-content-gray-emphasis);
}

.nc-doc-toc-dash-btn:hover .nc-doc-toc-dash {
  background: var(--nc-content-gray-subtle);
}

.nc-doc-toc-panel {
  @apply absolute left-0 top-1/2 rounded-lg bg-nc-bg-default shadow-md border-1 border-nc-border-gray-medium py-2;
  transform: translateY(-50%);
  min-width: 200px;
  max-width: 280px;
}

.nc-doc-toc-panel-label {
  @apply text-captionSm text-nc-content-gray-muted uppercase tracking-wide px-3 pb-1.5;
}

.nc-doc-toc-panel-list {
  @apply flex flex-col;
  max-height: 60vh;
  overflow-y: auto;
}

.nc-doc-toc-row {
  @apply flex items-center text-left bg-transparent border-0 outline-none cursor-pointer pr-3 py-1 text-bodySm text-nc-content-gray-muted;
  transition: color 0.1s ease, background-color 0.1s ease;

  &:hover {
    @apply bg-nc-bg-gray-light text-nc-content-gray-subtle;
  }
}

.nc-doc-toc-row-active {
  @apply text-nc-content-gray-emphasis font-medium;
}

.nc-doc-toc-fade-enter-active,
.nc-doc-toc-fade-leave-active {
  transition: opacity 0.12s ease;
}

.nc-doc-toc-fade-enter-from,
.nc-doc-toc-fade-leave-to {
  opacity: 0;
}
</style>
