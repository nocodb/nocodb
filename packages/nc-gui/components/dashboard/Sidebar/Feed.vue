<script setup lang="ts">
const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const workspaceStore = useWorkspace()

const { navigateToFeed } = workspaceStore

const { isFeedPageOpened } = storeToRefs(workspaceStore)

const { isNewFeedAvailable } = useProductFeed()

const gotoFeed = () => navigateToFeed()
</script>

<template>
  <div
    v-if="isMiniSidebar"
    v-e="['c:nocodb:feed']"
    class="nc-mini-sidebar-btn-full-width"
    data-testid="nc-sidebar-product-feed"
    @click="gotoFeed"
  >
    <div
      class="nc-mini-sidebar-btn relative"
      :class="{
        active: isFeedPageOpened,
      }"
    >
      <div v-if="isNewFeedAvailable" class="flex justify-center items-center w-3 absolute top-0.5 right-0.5">
        <div class="w-2.5 h-2.5 pulsing-dot bg-nc-fill-red-medium border-2 border-white rounded-full"></div>
      </div>
      <GeneralIcon icon="megaPhone" class="h-4 w-4" />
    </div>
  </div>
  <NcButton
    v-else
    v-e="['c:nocodb:feed']"
    type="text"
    full-width
    size="xsmall"
    class="n!xs:hidden w-full !h-7 !rounded-md !pl-3 !pr-2"
    data-testid="nc-sidebar-product-feed"
    :centered="false"
    :class="{
      '!text-brand-600 !bg-brand-50 !hover:bg-brand-50 active': isFeedPageOpened,
      '!hover:(bg-gray-200 text-gray-700)': !isFeedPageOpened,
    }"
    @click="gotoFeed"
  >
    <div
      class="flex !w-full items-center gap-2"
      :class="{
        'font-semibold': isFeedPageOpened,
      }"
    >
      <div class="flex flex-1 w-full items-center gap-2">
        <GeneralIcon icon="megaPhone" class="!h-4" />
        <span class="">{{ $t('labels.whatsNew') }}!</span>
      </div>
      <div v-if="isNewFeedAvailable" class="flex justify-center items-center w-4">
        <div class="w-3 h-3 pulsing-dot bg-nc-fill-red-medium border-2 border-white rounded-full"></div>
      </div>
    </div>
  </NcButton>
</template>

<style scoped lang="scss">
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.pulsing-dot {
  animation: pulse 1.5s infinite ease-in-out;
}

:deep(.nc-btn-inner) {
  @apply !w-full;
}
</style>
