<script setup lang="ts">
const { prefs, setListColumns } = useBookmarkPrefs()

const isOpen = ref(false)

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
      <div class="nc-bookmark-settings">
        <div class="nc-bookmark-settings-section">
          <span class="nc-bookmark-settings-label">Columns</span>
          <div class="nc-bookmark-settings-segments">
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
.nc-bookmark-settings {
  @apply flex flex-col gap-3 p-3 min-w-56;
}
.nc-bookmark-settings-section {
  @apply flex flex-col gap-2;
}
.nc-bookmark-settings-label {
  @apply text-captionXs uppercase tracking-wide font-semibold text-nc-content-gray-muted;
}
.nc-bookmark-settings-segments {
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
