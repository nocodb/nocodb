<script setup lang="ts">
function toggleGeodataFeature() {
  geodataToggleState.show = !geodataToggleState.show
  localStorage.setItem('geodataToggleState', JSON.stringify(geodataToggleState.show))
}
</script>

<template>
  <a-tooltip placement="bottomRight">
    <template #title>
      <span> Toggle GeoData </span>
    </template>
    <mdi-map-marker class="cursor-pointer" data-testid="toggle-geodata-feature-icon" @click="toggleGeodataFeature" />
  </a-tooltip>
</template>
