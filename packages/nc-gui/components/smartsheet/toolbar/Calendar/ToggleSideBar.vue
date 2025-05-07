<script setup lang="ts">
const { showSideMenu } = useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()
const { isMobileMode } = useGlobal()

const toggleSideMenu = () => {
  $e('c:calendar:toggle-sidebar', showSideMenu.value)
  showSideMenu.value = !showSideMenu.value
}
</script>

<template>
  <NcTooltip hide-on-click placement="left">
    <template #title> {{ $t('activity.toggleSidebar') }}</template>
    <NcButton
      :shadow="false"
      data-testid="nc-calendar-side-bar-btn"
      size="small"
      type="secondary"
      class="!border-0"
      @click="toggleSideMenu"
    >
      <component :is="iconMap.sidebar" class="h-4 w-4 text-gray-600 transition-all" />
    </NcButton>
  </NcTooltip>
</template>

<style scoped lang="scss"></style>
