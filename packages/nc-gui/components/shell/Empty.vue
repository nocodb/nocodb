<script lang="ts" setup>
// The one empty state for a shell list pane: picture and one line. No action --
// every pane that has a primary action already offers it in the header, and
// repeating it in the middle of the pane gave the screen two identical buttons.
// Panes pass a different line for "nothing here yet" and "nothing matched".
interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="nc-shell-empty px-2 py-6 flex flex-col items-center gap-6 text-center" data-testid="nc-shell-empty">
    <!-- Desaturated on purpose: an empty pane is a resting state. -->
    <img src="~assets/img/placeholder/no-search-result-found.png" class="nc-shell-empty-art !w-[240px] flex-none" :alt="title" />
    <div class="max-w-md text-bodyDefaultSm text-nc-content-gray-muted">{{ title }}</div>
  </div>
</template>

<style lang="scss" scoped>
.nc-shell-empty-art {
  filter: grayscale(1);
  opacity: 0.55;
}
</style>
