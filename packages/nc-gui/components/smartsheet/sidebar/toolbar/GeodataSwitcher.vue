<script setup lang="ts">
async function toggleGeodataFeature() {
  geodataToggleState.show = !geodataToggleState.show
}
</script>

<template>
  <a-tooltip placement="bottomRight">
    <template #title>
      <span> Toggle GeoData </span>
    </template>
    <mdi-map-marker class="cursor-pointer" @click="toggleGeodataFeature" />
  </a-tooltip>
</template>
