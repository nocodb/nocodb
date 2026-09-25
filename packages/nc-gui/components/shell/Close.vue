<script lang="ts" setup>
// Top-right of the modal, not in the header band.
//
// Closing belongs to the surface, not to the pane -- sitting it in the header's
// action row put it beside buttons it has nothing to do with, and left a divider
// standing between them to say so. In the corner it reads as chrome, and the
// row is free for the pane's own actions.
//
// Its offset tracks `ShellHeader`'s top padding (pt-4 / sm:pt-8) so it lands on
// the same line as the title and the pane's primary action instead of floating
// 20px above them.
interface Props {
  /** Kept per-shell so existing selectors still resolve. */
  testid?: string
}

withDefaults(defineProps<Props>(), {
  testid: 'nc-tools-shell-close',
})

const emits = defineEmits<{
  close: []
}>()
</script>

<template>
  <NcButton
    size="small"
    type="text"
    class="nc-shell-close !absolute top-4 sm:top-8 -mt-0.5 right-3 z-20"
    :data-testid="testid"
    @click="emits('close')"
  >
    <GeneralIcon icon="close" class="!h-4 !w-4" />
  </NcButton>
</template>
