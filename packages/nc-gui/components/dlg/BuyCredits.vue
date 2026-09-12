<script lang="ts" setup>
interface Props {
  modelValue?: boolean
  details?: { available_credits?: number; period_end?: string }
  licenseId?: string
}

defineProps<Props>()

defineEmits(['update:modelValue'])
</script>

<template>
  <NcSpanHidden />
</template>
