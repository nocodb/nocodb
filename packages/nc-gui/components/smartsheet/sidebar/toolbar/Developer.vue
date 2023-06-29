<script setup lang="ts">
const { isMobileMode } = useGlobal()

const { isUIAllowed } = useUIPermission()

const isPublicView = inject(IsPublicInj, ref(false))

const showApiSnippetDrawer = ref(false)
const showErd = ref(false)
const showWebhookDrawer = ref(false)
</script>

<template>
  <div class="flex flex-col px-3">
    <div
      v-if="!isMobileMode"
      v-e="['c:erd:open']"
      class="py-2 flex gap-2 items-center nc-view-action-erd button"
      @click="showErd = true"
    >
      <component :is="iconMap.erd" class="text-gray-500" />
      {{ $t('title.erdView') }}
    </div>
    <div v-e="['c:snippet:open']" class="py-2 flex gap-2 items-center button" @click="showApiSnippetDrawer = true">
      <component :is="iconMap.snippet" class="text-gray-500" />
      <!-- Get API Snippet -->
      {{ $t('activity.getApiSnippet') }}
    </div>
    <div
      v-if="isUIAllowed('webhook') && !isPublicView"
      v-e="['c:actions:webhook']"
      class="py-2 flex gap-2 items-center button"
      @click="showWebhookDrawer = true"
    >
      <component :is="iconMap.hook" class="text-gray-500" />
      {{ $t('objects.webhooks') }}
    </div>

    <LazySmartsheetToolbarErd v-model="showErd" />
    <LazySmartsheetApiSnippet v-model="showApiSnippetDrawer" />
    <LazyWebhookDrawer v-if="showWebhookDrawer" v-model="showWebhookDrawer" />
  </div>
</template>

<style lang="scss" scoped>
.button {
  @apply px-2 cursor-pointer hover:bg-gray-50 text-gray-700 rounded hover:text-black;
}
</style>
