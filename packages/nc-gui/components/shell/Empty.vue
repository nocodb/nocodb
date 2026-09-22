<script lang="ts" setup>
// The one empty state for a shell list pane: picture, one line, optionally the
// same primary action the header offers. Panes pass a different line for
// "nothing here yet" and "nothing matched the search".
interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="nc-shell-empty px-2 py-6 flex flex-col items-center gap-6 text-center" data-testid="nc-shell-empty">
    <img src="~assets/img/placeholder/no-search-result-found.png" class="!w-[164px] flex-none" :alt="title" />
    <div class="max-w-md text-bodyDefaultSm text-nc-content-gray-muted">{{ title }}</div>
    <slot name="action" />
  </div>
</template>
