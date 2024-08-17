<script setup lang="ts">
const activeKey = ref('recents')
</script>

<template>
  <FeedHeader />
  <div class="flex gap-6 justify-center h-full">
    <FeedNavigation v-model:active-key="activeKey" class="flex-grow-1" />
    <div style="height: calc(100% - var(--topbar-height) - 32px)" class="overflow-y-auto w-full mt-8">
      <div>
        <FeedChangelog v-if="activeKey === 'changelog'" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
