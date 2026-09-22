<script lang="ts" setup>
// Top-right of the modal, not in the header band.
//
// Closing belongs to the surface, not to the pane — sitting it in the header's
// action row put it beside buttons it has nothing to do with, and left a divider
// standing between them to say so. In the corner it reads as chrome, and the
// row is free for the pane's own actions.
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
    class="nc-shell-close !absolute top-3 right-3 z-20"
    :data-testid="testid"
    @click="emits('close')"
  >
    <GeneralIcon icon="close" class="!h-4 !w-4" />
  </NcButton>
</template>
