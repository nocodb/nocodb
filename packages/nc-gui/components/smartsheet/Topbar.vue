<script setup lang="ts">
import { IsPublicInj, inject, ref, useSmartsheetStoreOrThrow, useViewsStore } from '#imports'

const { isGrid, isForm, isGallery, isKanban, isMap } = useSmartsheetStoreOrThrow()

const router = useRouter()
const route = router.currentRoute

const isPublic = inject(IsPublicInj, ref(false))

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isMobileMode } = storeToRefs(useConfigStore())

const isSharedBase = computed(() => route.value.params.typeOrId === 'base')
</script>

<template>
  <div
    class="nc-table-topbar h-20 py-1 flex gap-2 items-center border-b border-gray-200 overflow-hidden relative max-h-[var(--topbar-height)] min-h-[var(--topbar-height)] md:(pr-2 pl-2) xs:(px-1)"
    style="z-index: 7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <GeneralOpenLeftSidebarBtn />
      <LazySmartsheetToolbarViewInfo v-if="!isPublic" />

      <div class="flex-1" />

      <div
        v-if="!isSharedBase && !isMobileMode"
        class="absolute mx-auto transition-all duration-150 right-0 w-47.5"
        :class="{
          '-left-1/10': isLeftSidebarOpen,
          '-left-0': !isLeftSidebarOpen,
        }"
      >
        <SmartsheetTopbarSelectMode />
      </div>

      <GeneralApiLoader v-if="!isMobileMode" />

      <LazyGeneralShareProject
        v-if="(isForm || isGrid || isKanban || isGallery || isMap) && !isPublic && !isMobileMode"
        is-view-toolbar
      />

      <LazyGeneralLanguage
        v-if="isSharedBase"
        class="cursor-pointer text-lg hover:(text-black bg-gray-200) mr-0 p-1.5 rounded-md"
      />
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
