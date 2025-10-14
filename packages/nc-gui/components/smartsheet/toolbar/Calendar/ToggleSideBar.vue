<script setup lang="ts">
const { showSideMenu } = useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()

const toggleSideMenu = () => {
  $e('c:calendar:toggle-sidebar', showSideMenu.value)
  showSideMenu.value = !showSideMenu.value
}
</script>

<template>
  <NcTooltip hide-on-click placement="left">
    <template #title> {{ $t('activity.toggleSidebar') }}</template>
    <NcButton :shadow="false" data-testid="nc-calendar-side-bar-btn" size="xs" type="text" class="!px-1" @click="toggleSideMenu">
      <GeneralIcon icon="sidebar" class="h-4 w-4 text-nc-content-subtle2 transition-all" />
    </NcButton>
  </NcTooltip>
</template>
