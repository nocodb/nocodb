<script setup lang="ts">
import { IsPublicInj, inject, ref, useSharedView, useSmartsheetStoreOrThrow, useUIPermission, useViewsStore } from '#imports'

const { isGrid, isForm, isGallery, isKanban, isMap } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useUIPermission()

const { allowCSVDownload } = useSharedView()
</script>

<template>
  <div
    class="nc-table-topbar h-20 py-1 flex gap-2 items-center pr-2 pl-2.5 border-b border-gray-200 overflow-hidden relative"
    :class="{ 'nc-table-toolbar-mobile': isMobileMode, 'h-[var(--topbar-height)]': !isMobileMode }"
    style="z-index: 7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <LazySmartsheetToolbarViewInfo v-if="!isPublic" />

      <div v-if="!isMobileMode" class="flex-1" />

      <div class="absolute mx-auto left-0 right-0 w-47.5"><SmartsheetTopbarSelectMode /></div>

      <GeneralApiLoader />

      <LazyGeneralShareProject v-if="(isForm || isGrid || isKanban || isGallery || isMap) && !isPublic" is-view-toolbar />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
