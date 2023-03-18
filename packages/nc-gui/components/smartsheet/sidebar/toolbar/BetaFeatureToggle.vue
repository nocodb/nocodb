<script setup lang="ts">
const { toggleBetaFeature } = useBetaFeatureToggle()
</script>

<template>
  <a-tooltip placement="bottomRight">
    <template #title>
      <span> Toggle Beta Features </span>
    </template>
    <mdi-test-tube class="cursor-pointer" data-testid="beta-feature-toggle-icon" @click="toggleBetaFeature" />
  </a-tooltip>
</template>
