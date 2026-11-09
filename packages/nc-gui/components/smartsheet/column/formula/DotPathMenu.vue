<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

export interface DotPathMenuItem {
  key: string
  kind: 'field' | 'function'
  label: string
  // right-aligned type hint, e.g. "Currency" or "Link · many"
  hint: string
  column?: ColumnType
  // following this field opens another hop
  isLink?: boolean
  // the value is a list (reached through a to-many link, or a to-many link itself)
  isList?: boolean
  description?: string
  syntax?: string
  examples?: string[]
  docsUrl?: string
  unsupported?: boolean
}

export interface DotPathMenuSection {
  key: string
  title: string
  items: DotPathMenuItem[]
}

interface Props {
  sections: DotPathMenuSection[]
  activeKey?: string
  isListContext: boolean
  position: { top: number; left: number }
}

const props = defineProps<Props>()

const emits = defineEmits<{
  select: [item: DotPathMenuItem, openLink?: boolean]
  activate: [key: string]
}>()

const listRef = ref<HTMLElement>()

// a hovered row is already in view; scrolling to it would move the list under the mouse
let isActivatedByMouse = false

function onItemHover(item: DotPathMenuItem) {
  if (item.unsupported || item.key === props.activeKey) return
  isActivatedByMouse = true
  emits('activate', item.key)
}

// a link row drills into the link; Enter on it still inserts the link itself
function onItemClick(item: DotPathMenuItem) {
  if (item.unsupported) return
  emits('select', item, !!item.isLink)
}

const activeItem = computed(() => props.sections.flatMap((s) => s.items).find((item) => item.key === props.activeKey))

const hasLinks = computed(() => props.sections.some((section) => section.items.some((item) => item.isLink)))

watch(
  () => props.activeKey,
  (key) => {
    if (isActivatedByMouse) {
      isActivatedByMouse = false
      return
    }
    nextTick(() => {
      listRef.value?.querySelector(`[data-key="${CSS.escape(key ?? '')}"]`)?.scrollIntoView({ block: 'nearest' })
    })
  },
)
</script>

<template>
  <div
    class="nc-formula-dot-menu-wrapper"
    :style="{ top: `${position.top}px`, left: `${position.left}px` }"
    data-testid="nc-formula-dot-menu"
    @mousedown.prevent
  >
    <div class="nc-formula-dot-menu">
      <div ref="listRef" class="nc-formula-dot-menu-list nc-scrollbar-thin" role="listbox">
        <template v-for="section of sections" :key="section.key">
          <div v-if="section.items.length" class="nc-formula-dot-menu-section">
            <div class="nc-formula-dot-menu-section-title">{{ section.title }}</div>
            <div
              v-for="item of section.items"
              :key="item.key"
              :data-key="item.key"
              :data-testid="`nc-formula-dot-menu-item-${item.label}`"
              class="nc-formula-dot-menu-item"
              :class="{ 'is-active': item.key === activeKey, 'is-unsupported': item.unsupported }"
              role="option"
              :aria-selected="item.key === activeKey"
              :aria-disabled="item.unsupported || undefined"
              @mouseenter="onItemHover(item)"
              @click="onItemClick(item)"
            >
              <span v-if="item.column" class="nc-formula-dot-menu-icon"><SmartsheetHeaderIcon :column="item.column" /></span>
              <GeneralIcon v-else icon="function" class="flex-none w-4 h-4 text-nc-content-brand" />
              <span v-if="item.kind === 'function'" class="nc-formula-dot-menu-fn"> {{ item.label }}() </span>
              <span v-else class="truncate">{{ item.label }}</span>
              <span class="flex-1" />
              <span class="nc-formula-dot-menu-hint">{{ item.hint }}</span>
              <GeneralIcon v-if="item.isLink" icon="ncChevronRight" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
              <span v-else-if="item.key === activeKey && !item.unsupported" class="nc-formula-dot-menu-kbd">↵</span>
            </div>
          </div>
        </template>
        <div v-if="!sections.some((s) => s.items.length)" class="px-3 py-4 text-bodySm text-nc-content-gray-muted">
          {{ $t('msg.formula.noSuggestedFieldFound') }}
        </div>
      </div>

      <div class="nc-formula-dot-menu-footer">
        <span
          ><span class="nc-formula-dot-menu-kbd">↑</span><span class="nc-formula-dot-menu-kbd">↓</span
          >{{ $t('labels.formulaDotPath.move') }}</span
        >
        <span><span class="nc-formula-dot-menu-kbd">↵</span>{{ $t('labels.formulaDotPath.insert') }}</span>
        <span v-if="hasLinks"><span class="nc-formula-dot-menu-kbd">→</span>{{ $t('labels.formulaDotPath.openLink') }}</span>
        <span><span class="nc-formula-dot-menu-kbd">esc</span>{{ $t('labels.formulaDotPath.close') }}</span>
      </div>
    </div>

    <!-- functions only: fields read fine from the formula itself -->
    <div v-if="activeItem?.kind === 'function'" class="nc-formula-dot-menu-detail">
      <div class="nc-formula-dot-menu-fn text-bodyDefaultSm">{{ activeItem.syntax || `${activeItem.label}()` }}</div>
      <div class="mt-2 text-bodySm text-nc-content-gray-subtle2 leading-5">{{ activeItem.description }}</div>
      <div v-if="activeItem.unsupported" class="mt-2 text-bodySm text-nc-content-red-dark leading-5">
        {{ $t('msg.formulaNotSupported') }}
      </div>
      <div v-if="activeItem.examples?.length" class="mt-2 flex flex-col gap-1">
        <code v-for="example of activeItem.examples" :key="example" class="nc-formula-dot-menu-code">{{ example }}</code>
      </div>
      <div v-if="activeItem.docsUrl" class="mt-2 flex justify-end">
        <a
          :href="activeItem.docsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-bodySm !text-nc-content-gray-muted hover:!text-nc-content-gray-subtle !no-underline"
        >
          {{ $t('labels.viewInDocs') }}
          <GeneralIcon icon="ncExternalLink" class="w-3 h-3" />
        </a>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-formula-dot-menu-wrapper {
  @apply fixed z-1100 flex items-start gap-0.5;
}

.nc-formula-dot-menu {
  @apply w-[340px] flex flex-col bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl overflow-hidden;
  box-shadow: 0 8px 24px -6px rgba(var(--rgb-base), 0.16), 0 2px 6px -2px rgba(var(--rgb-base), 0.08);
}

.nc-formula-dot-menu-list {
  @apply max-h-[280px] overflow-y-auto py-1;
}

.nc-formula-dot-menu-section + .nc-formula-dot-menu-section {
  @apply border-t-1 border-nc-border-gray-light mt-1 pt-1;
}

.nc-formula-dot-menu-section-title {
  @apply px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-nc-content-gray-muted;
}

.nc-formula-dot-menu-item {
  @apply mx-1 px-2 h-8 flex items-center gap-2 rounded-lg cursor-pointer text-bodyDefaultSm text-nc-content-gray;

  &.is-active {
    @apply bg-nc-bg-brand;
  }

  &.is-unsupported {
    @apply cursor-not-allowed opacity-50;
  }

  // all-caps monospace reads larger than field titles at the same size
  .nc-formula-dot-menu-fn {
    @apply text-xs;
  }
}

// the header icon ignores size classes, so size it here: smaller and lighter than the grid header
.nc-formula-dot-menu-icon {
  @apply flex-none inline-flex items-center justify-center w-3.5 h-3.5;

  :deep(svg) {
    @apply w-3.5 h-3.5;
  }

  :deep(svg path),
  :deep(svg circle),
  :deep(svg rect),
  :deep(svg line),
  :deep(svg polyline) {
    stroke-width: 1.5;
  }
}

.nc-formula-dot-menu-hint {
  @apply flex-none text-bodySm text-nc-content-gray-muted;
}

.nc-formula-dot-menu-fn {
  @apply font-mono text-nc-content-brand;
}

.nc-formula-dot-menu-kbd {
  @apply inline-flex items-center justify-center min-w-4 h-4 px-1 mr-1 rounded border-1 border-nc-border-gray-medium bg-nc-bg-default text-[10px] leading-none text-nc-content-gray-subtle2;
}

.nc-formula-dot-menu-footer {
  @apply flex items-center gap-3 px-3 py-2 border-t-1 border-nc-border-gray-light bg-nc-bg-gray-extralight text-[11px] text-nc-content-gray-subtle2;
}

.nc-formula-dot-menu-detail {
  @apply w-[240px] p-3 bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl;
  box-shadow: 0 8px 24px -6px rgba(var(--rgb-base), 0.12);
}

.nc-formula-dot-menu-code {
  @apply font-mono text-[11px] text-nc-content-brand;
  // break between tokens first; only a token wider than the panel splits
  overflow-wrap: anywhere;
  word-break: normal;
}

// no room beside the list on narrow screens
@media (max-width: 640px) {
  .nc-formula-dot-menu-detail {
    @apply hidden;
  }
}
</style>
