<script lang="ts" setup>
const { isGrid, isForm, isGallery, isKanban, isMap, isCalendar } = useSmartsheetStoreOrThrow()

const router = useRouter()
const route = router.currentRoute

const isPublic = inject(IsPublicInj, ref(false))

const { isViewsLoading } = storeToRefs(useViewsStore())

const { isMobileMode } = storeToRefs(useConfigStore())

const { appInfo } = useGlobal()

const { toggleExtensionPanel, isPanelExpanded, extensionsEgg, onEggClick } = useExtensions()

const isSharedBase = computed(() => route.value.params.typeOrId === 'base')

const topbarBreadcrumbItemWidth = computed(() => {
  if (!isSharedBase.value && !isMobileMode.value) {
    return 'calc(\(100% - 167px - 24px\) / 2)'
  } else if (isMobileMode.value) {
    return 'calc(75% - 12px)'
  } else {
    return 'calc(\(100% - 12px\) / 2)'
  }
})
</script>

<template>
  <div
    class="nc-table-topbar py-2 border-b-1 border-gray-200 flex gap-3 items-center justify-between overflow-hidden relative h-[var(--topbar-height)] max-h-[var(--topbar-height)] min-h-[var(--topbar-height)] md:(px-2) xs:(px-1)"
    style="z-index: 7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <div
        class="flex items-center gap-3 min-w-[300px]"
        :style="{
          width: topbarBreadcrumbItemWidth,
        }"
      >
        <GeneralOpenLeftSidebarBtn />
        <LazySmartsheetToolbarViewInfo v-if="!isPublic" />
      </div>

      <div v-if="!isSharedBase && !isMobileMode">
        <SmartsheetTopbarSelectMode />
      </div>

      <div class="flex items-center justify-end gap-3 flex-1">
        <GeneralApiLoader v-if="!isMobileMode" />

        <div
          v-if="extensionsEgg"
          class="flex items-center px-2 py-1 border-1 rounded-lg h-8 xs:(h-10 ml-0) ml-1 border-gray-200 cursor-pointer font-weight-600 text-sm select-none"
          :class="{ 'bg-brand-50 text-brand-500': isPanelExpanded }"
          @click="toggleExtensionPanel"
        >
          <GeneralIcon icon="puzzle" class="w-4 h-4" :class="{ 'border-l-1 border-transparent': isPanelExpanded }" />
          <span
            class="overflow-hidden trasition-all duration-200"
            :class="{ 'w-[0px] invisible': isPanelExpanded, 'ml-2 w-[74px]': !isPanelExpanded }"
          >
            Extensions
          </span>
        </div>
        <div v-else-if="!extensionsEgg" class="w-[15px] h-[15px] cursor-pointer" @dblclick="onEggClick" />

        <LazyGeneralShareProject
          v-if="(isForm || isGrid || isKanban || isGallery || isMap || isCalendar) && !isPublic && !isMobileMode"
          is-view-toolbar
        />

        <LazyGeneralLanguage
          v-if="isSharedBase && !appInfo.ee"
          class="cursor-pointer text-lg hover:(text-black bg-gray-200) mr-0 p-1.5 rounded-md"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
