<script setup lang="ts">
defineProps<{
  icon: string
  text: string
  first?: boolean
  last?: boolean
}>()
</script>

<template>
  <div
    class="static-widget p-3 border-1 flex-1 border-nc-border-gray-medium flex flex-col justify-center items-center gap-3 cursor-pointer"
    :class="{ first, last }"
  >
    <img :src="icon" class="w-10 h-10" />
    <div class="text-center text-nc-content-gray text-[13px] font-bold leading-[18px]">{{ text }}</div>
  </div>
</template>

<style scoped lang="scss">
.static-widget {
  &.first {
    @apply rounded-[8px_0_0_8px] border-r-0;
  }
  &.last {
    @apply rounded-[0_8px_8px_0] border-l-0;
  }
  &:hover {
    @apply bg-nc-bg-gray-extralight;
  }
}
</style>
