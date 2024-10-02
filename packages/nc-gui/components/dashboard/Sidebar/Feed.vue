<script setup lang="ts">
const { navigateToFeed } = useWorkspace()

const gotoFeed = async () => {
  await navigateToFeed()
}
</script>

<template>
  <div class="px-2 py-2">
    <div class="flex items-center py-1.5 cursor-pointer px-3 hover:bg-gray-100 bg-[#F0F3FF] rounded-md gap-3" @click="gotoFeed">
      <GeneralIcon class="text-yellow-500" icon="magic" />
      <span class="text-[#2952CC] font-semibold"> What’s New! </span>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
