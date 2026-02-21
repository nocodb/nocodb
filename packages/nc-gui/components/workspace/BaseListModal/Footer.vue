<template>
  <div
    class="flex items-center gap-4 p-4 border-t border-nc-border-gray-medium text-xs text-nc-content-gray-muted dark:bg-nc-bg-gray-extralight"
  >
    <div class="flex items-center gap-1">
      <kbd class="nc-keyboard-shortcut">Tab</kbd>
      <span>{{ $t('labels.navigate') }}</span>
    </div>
    <div class="flex items-center gap-1">
      <kbd class="nc-keyboard-shortcut">Enter</kbd>
      <span>{{ $t('labels.select') }}</span>
    </div>
    <div class="flex items-center gap-1">
      <kbd class="nc-keyboard-shortcut">Esc</kbd>
      <span>{{ $t('general.close') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-keyboard-shortcut {
  @apply px-2 py-1 bg-nc-bg-gray-light rounded border-1 border-nc-border-gray-medium text-tiny;
}
</style>
