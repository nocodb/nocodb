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
</script>

<template>
  <div
    class="nc-table-topbar h-11 pt-3 flex gap-3 items-center overflow-hidden relative max-h-[var(--topbar-height)] min-h-[var(--topbar-height)] md:(px-2) xs:(px-1 py-3 border-b-1 border-gray-200)"
    :class="{
      'pb-2 border-b-1 border-gray-200': isForm
    }"
    style="z-index: 7"
  >
    <template v-if="isViewsLoading">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <GeneralOpenLeftSidebarBtn />
      <LazySmartsheetToolbarViewInfo v-if="!isPublic" />

      <div v-if="!isSharedBase && !isMobileMode">
        <SmartsheetTopbarSelectMode />
      </div>
      <div class="flex-1" />

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
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
