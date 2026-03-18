<script lang="ts" setup>
interface Props {
  expiresAt?: string | null
  showAlways?: boolean
}

defineProps<Props>()
</script>

<template>
  <NcSpanHidden />
</template>
