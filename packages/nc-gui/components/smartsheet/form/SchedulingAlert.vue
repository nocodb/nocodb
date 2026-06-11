<script lang="ts" setup>
interface Props {
  startsAt?: string | null
  expiresAt?: string | null
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
