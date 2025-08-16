<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute

const { isUIAllowed } = useRoles()

const { isViewsLoading, openedViewsTab } = storeToRefs(useViewsStore())

const { activeAutomationId } = storeToRefs(useAutomationStore())

const { activeDashboardId, isEditingDashboard } = storeToRefs(useDashboardStore())

const isPublic = inject(IsPublicInj, ref(false))

const { isMobileMode } = storeToRefs(useConfigStore())

const { appInfo } = useGlobal()

const { toggleExtensionPanel, isPanelExpanded } = useExtensions()

const { toggleActionPanel, isPanelExpanded: isActionPanelExpanded, isViewActionsEnabled } = useActionPane()

const { isFeatureEnabled } = useBetaFeatureToggle()

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
    :class="{
      'bg-nc-bg-brand': isEditingDashboard,
    }"
    class="nc-table-topbar py-2 border-b-1 border-nc-border-gray-medium flex gap-3 items-center justify-between overflow-hidden relative h-[var(--topbar-height)] max-h-[var(--topbar-height)] min-h-[var(--topbar-height)] md:(px-2) xs:(px-1)"
    style="z-index: 7"
  >
    <template v-if="isViewsLoading && !activeAutomationId && !activeDashboardId">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <div
        class="flex items-center gap-3 min-w-[calc(100%_-_62px)] md:min-w-[300px]"
        :style="{
          width: topbarBreadcrumbItemWidth,
        }"
      >
        <GeneralOpenLeftSidebarBtn />
        <LazySmartsheetToolbarViewInfo v-if="!isPublic && !activeAutomationId && !activeDashboardId" />
        <LazySmartsheetTopbarAutomationInfo v-if="!isPublic && activeAutomationId" />
        <LazySmartsheetTopbarDashboardInfo v-if="!isPublic && activeDashboardId" />
      </div>

      <div v-if="!isSharedBase && !isMobileMode && !activeAutomationId && !activeDashboardId">
        <SmartsheetTopbarSelectMode />
      </div>
      <div v-else-if="activeDashboardId">
        <SmartsheetTopbarEditingState />
      </div>

      <div class="flex items-center justify-end gap-2 flex-1">
        <GeneralApiLoader v-if="!isMobileMode && !activeAutomationId && !activeDashboardId" />

        <NcButton
          v-if="
            (appInfo.isOnPrem || isEeUI || isFeatureEnabled(FEATURE_FLAG.EXTENSIONS)) &&
            !isSharedBase &&
            !activeAutomationId &&
            !activeDashboardId &&
            openedViewsTab === 'view' &&
            !isMobileMode
          "
          v-e="['c:extension-toggle']"
          type="secondary"
          size="small"
          class="nc-topbar-extension-btn"
          :class="{ '!bg-brand-50 !hover:bg-brand-100/70 !text-brand-500': isPanelExpanded }"
          data-testid="nc-topbar-extension-btn"
          @click="toggleExtensionPanel"
        >
          <div class="flex items-center justify-center min-w-[28.69px]">
            <GeneralIcon
              :icon="isPanelExpanded ? 'ncPuzzleSolid' : 'ncPuzzleOutline'"
              class="w-4 h-4 !stroke-transparent"
              :class="{ 'border-l-1 border-transparent': isPanelExpanded }"
            />
            <span
              class="overflow-hidden trasition-all duration-200"
              :class="{ 'w-[0px] invisible': isPanelExpanded, 'ml-1 w-[74px]': !isPanelExpanded }"
            >
              {{ $t('general.extensions') }}
            </span>
          </div>
        </NcButton>

        <NcButton
          v-if="
            !isSharedBase &&
            !activeAutomationId &&
            !activeDashboardId &&
            openedViewsTab === 'view' &&
            !isMobileMode &&
            isViewActionsEnabled
          "
          v-e="['c:action-toggle']"
          type="secondary"
          size="small"
          class="nc-topbar-action-btn"
          :class="{ '!bg-brand-50 !hover:bg-brand-100/70 !text-brand-500': isActionPanelExpanded }"
          data-testid="nc-topbar-action-btn"
          @click="toggleActionPanel"
        >
          <div class="flex items-center justify-center min-w-[28.69px]">
            <GeneralIcon
              :icon="isActionPanelExpanded ? 'play' : 'play'"
              class="w-4 h-4 !stroke-transparent"
              :class="{ 'border-l-1 border-transparent': isActionPanelExpanded }"
            />
            <span
              class="overflow-hidden trasition-all duration-200"
              :class="{ 'w-[0px] invisible': isActionPanelExpanded, 'ml-1 w-[54px]': !isActionPanelExpanded }"
            >
              {{ $t('general.actions') }}
            </span>
          </div>
        </NcButton>

        <div v-if="!isSharedBase" class="flex gap-2 items-center empty:hidden">
          <LazySmartsheetTopbarDashboardState v-if="activeDashboardId && isUIAllowed('dashboardEdit')" />
          <LazySmartsheetTopbarScriptAction v-if="activeAutomationId && appInfo.ee" />
        </div>
        <LazySmartsheetTopbarShareProject v-if="!activeAutomationId" />

        <div v-if="isSharedBase">
          <LazyGeneralLanguage
            button
            class="cursor-pointer text-lg hover:(text-nc-content-gray-extreme bg-nc-bg-gray-medium) mr-0 p-1.5 rounded-md"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nc-table-toolbar-mobile {
  @apply flex-wrap h-auto py-2;
}
</style>
