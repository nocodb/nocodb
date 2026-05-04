<script setup lang="ts">
import type { BookmarkLayout } from '~/composables/useBookmarkPrefs'

const { prefs, setLayout, setListColumns } = useBookmarkPrefs()

const isOpen = ref(false)

function pickLayout(l: BookmarkLayout) {
  setLayout(l)
}

function pickColumns(n: 1 | 2) {
  setListColumns(n)
}
</script>

<template>
  <NcDropdown
    v-model:visible="isOpen"
    :trigger="['click']"
    placement="bottomRight"
    overlay-class-name="nc-bookmark-settings-menu"
  >
    <NcButton type="text" size="small" class="!rounded-md" data-testid="nc-bookmark-settings-btn" @click.stop>
      <GeneralIcon icon="ncSettings" class="text-nc-content-gray-muted" />
    </NcButton>
    <template #overlay>
      <div class="nc-v2-settings">
        <div class="nc-v2-settings-section">
          <span class="nc-v2-settings-label">Layout</span>
          <div class="nc-v2-settings-segments">
            <button
              class="seg"
              :class="{ active: prefs.layout === 'list' }"
              data-testid="nc-bookmark-layout-list"
              @click="pickLayout('list')"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
                <path d="M3 4h10M3 8h10M3 12h10" />
              </svg>
              List
            </button>
            <button
              class="seg"
              :class="{ active: prefs.layout === 'card' }"
              data-testid="nc-bookmark-layout-card"
              @click="pickLayout('card')"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
                <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
                <rect x="8.5" y="2.5" width="5" height="5" rx="1" />
                <rect x="2.5" y="8.5" width="5" height="5" rx="1" />
                <rect x="8.5" y="8.5" width="5" height="5" rx="1" />
              </svg>
              Card
            </button>
          </div>
        </div>

        <div v-if="prefs.layout === 'list'" class="nc-v2-settings-section">
          <span class="nc-v2-settings-label">Columns</span>
          <div class="nc-v2-settings-segments">
            <button
              class="seg"
              :class="{ active: prefs.listColumns === 1 }"
              data-testid="nc-bookmark-list-cols-1"
              @click="pickColumns(1)"
            >
              1
            </button>
            <button
              class="seg"
              :class="{ active: prefs.listColumns === 2 }"
              data-testid="nc-bookmark-list-cols-2"
              @click="pickColumns(2)"
            >
              2
            </button>
          </div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-v2-settings {
  @apply flex flex-col gap-3 p-3 min-w-56;
}
.nc-v2-settings-section {
  @apply flex flex-col gap-2;
}
.nc-v2-settings-label {
  @apply text-captionXs uppercase tracking-wide font-semibold text-nc-content-gray-muted;
}
.nc-v2-settings-segments {
  @apply grid gap-1;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
}
.seg {
  @apply appearance-none border-1 border-nc-border-gray-medium rounded-md;
  @apply flex items-center justify-center gap-1.5;
  @apply text-bodySm text-nc-content-gray-muted bg-nc-bg-default;
  @apply px-2 py-1.5 cursor-pointer;
  @apply transition-colors;
  font-weight: 500;
}
.seg:hover {
  @apply bg-nc-bg-gray-light text-nc-content-gray;
}
.seg.active {
  background: color-mix(in srgb, var(--nc-content-brand) 12%, transparent);
  border-color: var(--nc-content-brand);
  color: var(--nc-content-brand);
}
</style>
