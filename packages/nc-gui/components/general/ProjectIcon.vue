<script lang="ts" setup>
const { hoverable } = defineProps<{
  type?: string
  hoverable?: boolean
}>()
</script>

<template>
  <GeneralIcon
    icon="project"
    class="text-[#2824FB] nc-project-icon"
    :class="{
      'nc-project-icon-hoverable': hoverable,
    }"
  />
</template>

<style scoped>
.nc-project-icon {
  @apply text-xl;
}
.nc-project-icon-hoverable {
  @apply cursor-pointer !hover:bg-gray-200 !hover:bg-opacity-50;
}
</style>
