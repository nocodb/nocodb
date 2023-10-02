<script setup lang="ts">
const { base } = storeToRefs(useBase())
const { openedLayoutSidebarNode } = storeToRefs(useDashboardStore())
</script>

<template>
  <LayoutsView v-if="base?.id && openedLayoutSidebarNode" />
</template>

<style>
.site-layout-background {
  background: #fff;
}
</style>
