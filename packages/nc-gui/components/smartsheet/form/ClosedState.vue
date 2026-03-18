<script lang="ts" setup>
interface Props {
  mode: 'not-started' | 'expired'
  startsAt?: string | null
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
