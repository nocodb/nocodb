<script setup lang="ts">
const { project } = storeToRefs(useProject())
const { openedLayoutSidebarNode } = storeToRefs(useDashboardStore())
</script>

<template>
  <LayoutsView v-if="project?.id && openedLayoutSidebarNode" />
</template>

<style>
.site-layout-background {
  background: #fff;
}
</style>
