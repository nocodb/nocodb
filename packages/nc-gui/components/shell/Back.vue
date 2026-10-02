<script lang="ts" setup>
// Shares a line with ShellClose in the opposite corner — both are ways out of the surface, not pane content.
interface Props {
  /** Kept per-shell so existing selectors still resolve. */
  testid?: string
  /** Sit in the parent's flex row instead of the top-left corner. */
  inline?: boolean
}

withDefaults(defineProps<Props>(), {
  testid: 'nc-tools-shell-back',
})

const emits = defineEmits<{
  back: []
}>()
</script>

<template>
  <NcButton
    size="small"
    type="text"
    class="nc-shell-back"
    :class="{ '!absolute top-3 left-3 z-20': !inline }"
    :data-testid="testid"
    :aria-label="$t('general.back')"
    @click="emits('back')"
  >
    <GeneralIcon icon="ncArrowLeft" class="!h-4 !w-4" />
  </NcButton>
</template>
