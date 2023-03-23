<template>
  <div>
    <div>
  <div class="w-full h-full nc-container">
  <WorkspaceWelcomeScreen/>
  </div>
  </div>
  </div>
</template>
<script lang="ts" setup>

definePageMeta({
  hideHeader: true,
})

const { isOpen, toggle } = useSidebar('nc-left-sidebar')
</script>

<style scoped>
.nc-container {
  height: 100vh;
  flex: 1 1 100%;
}
</style>
