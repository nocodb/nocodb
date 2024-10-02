<script setup lang="ts">
const activeKey = ref('recents')
</script>

<template>
  <FeedHeader />

  <FeedNavigation v-model:active-key="activeKey" />
</template>

<style scoped lang="scss"></style>
