<script setup lang="ts">
const { isDark } = useTheme()

// Same vector mark in both themes — colored on light, monochrome light-gray in dark mode.
// Size is set by the caller via classes (e.g. `!h-7 !w-7`), like any other GeneralIcon.
const icon = computed<IconMapKey>(() => (isDark.value ? 'nocodb1Dark' : 'nocodb1'))
</script>

<template>
  <GeneralIcon :icon="icon" class="nc-nocodb-logo select-none" />
</template>
