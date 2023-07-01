<script setup lang="ts">
const { isMobileMode } = useGlobal()

const { isUIAllowed } = useUIPermission()

const isPublicView = inject(IsPublicInj, ref(false))

const showApiSnippetDrawer = ref(false)
const showErd = ref(false)
</script>

<template>
  <div class="flex flex-col px-3 nc-sidebar-md">
    <div
      v-if="!isMobileMode"
      v-e="['c:erd:open']"
      class="py-2 flex gap-2 items-center nc-view-action-erd button"
      @click="showErd = true"
    >
      <component :is="iconMap.erd" class="text-gray-600" />
      {{ $t('title.erdView') }}
    </div>
    <div v-e="['c:snippet:open']" class="py-2 flex gap-2 items-center button" @click="showApiSnippetDrawer = true">
      <component :is="iconMap.snippet" class="text-gray-600" />
      <!-- Get API Snippet -->
      {{ $t('activity.getApiSnippet') }}
    </div>
    <SmartsheetSidebarToolbarWebhook v-if="isUIAllowed('webhook') && !isPublicView" />

    <LazySmartsheetToolbarErd v-model="showErd" />
    <LazySmartsheetApiSnippet v-model="showApiSnippetDrawer" />
  </div>
</template>

<style lang="scss" scoped>
.button {
  @apply px-2 cursor-pointer hover:bg-gray-50 text-gray-700 rounded hover:text-black;
}
</style>
