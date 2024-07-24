<script setup lang="ts">
interface Props {
  src: string
}

const props = defineProps<Props>()
</script>

<template>
  <iframe :src="props.src" width="100%" height="100%"></iframe>
</template>

<style scoped lang="scss"></style>
