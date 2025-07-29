<script setup lang="ts">
const { toggleTheme, isDark } = useTheme()
</script>

<template>
  <div v-e="['c:nocodb:theme']" class="nc-mini-sidebar-btn-full-width" data-testid="nc-sidebar-theme">
    <div class="nc-mini-sidebar-btn relative" @click="toggleTheme">
      <GeneralIcon :icon="isDark ? 'ncMoon' : 'ncSun'" class="h-4 w-4" />
    </div>
  </div>
</template>
