<script setup lang="ts">
const props = defineProps<{
  item: any
}>()

const icon = useAttachmentIcon(() => props.item.title, props.item.mimetype)
</script>

<template>
  <GeneralIcon :icon="icon" class="text-white" />
</template>
