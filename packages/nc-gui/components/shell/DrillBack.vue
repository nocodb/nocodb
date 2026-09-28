<script lang="ts" setup>
// Step back out of a pane's own drill-in. Distinct from ShellBack, which leaves the pane entirely.
interface Props {
  /** Where it returns to. Omit for icon-only, when the row already names the place. */
  label?: string
  testid?: string
}

withDefaults(defineProps<Props>(), {
  testid: 'nc-shell-drill-back',
})

const emits = defineEmits<{
  back: []
}>()
</script>

<template>
  <NcButton
    type="secondary"
    size="small"
    text-color="primary"
    class="nc-shell-drill-back flex-none !bg-nc-bg-brand !border-transparent hover:!bg-nc-brand-100"
    :data-testid="testid"
    :aria-label="label ?? $t('general.back')"
    @click="emits('back')"
  >
    <div class="flex items-center gap-1">
      <GeneralIcon icon="ncArrowLeft" class="!h-4 !w-4" />
      <span v-if="label">{{ label }}</span>
    </div>
  </NcButton>
</template>
