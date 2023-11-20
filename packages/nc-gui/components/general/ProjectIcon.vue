<script lang="ts" setup>
const { hoverable } = defineProps<{
  type?: string
  hoverable?: boolean
}>()
</script>

<template>
  <GeneralIcon
    icon="project"
    class="text-[#2824FB] base"
    :class="{
      'nc-base-icon-hoverable': hoverable,
    }"
  />
</template>

<style scoped>
.nc-base-icon {
  @apply text-xl;
}
.nc-base-icon-hoverable {
  @apply cursor-pointer !hover:bg-gray-200 !hover:bg-opacity-50;
}
</style>
