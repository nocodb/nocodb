<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
})
</script>

<template>
  <div>
    <div>
      <div class="w-full h-full nc-container">
        <WorkspaceEmptyPlaceholder buttons />
      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-container {
  height: 100vh;
  flex: 1 1 100%;
}
</style>
