<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed } = useRoles()

const { isViewsLoading, openedViewsTab } = storeToRefs(useViewsStore())

const { activeScriptId } = storeToRefs(useScriptStore())

const { activeDashboardId, isEditingDashboard } = storeToRefs(useDashboardStore())

const { activeWorkflowId, activeWorkflowHasDraftChanges } = storeToRefs(useWorkflowStore())

const isPublic = inject(IsPublicInj, ref(false))

const { isMobileMode } = storeToRefs(useConfigStore())

const { appInfo } = useGlobal()

const { toggleExtensionPanel, isPanelExpanded } = useExtensions()

const { openTrash, trashUnavailableReason } = useRecordTrash()

const { t } = useI18n()

const trashUnavailableMessage = computed(() => {
  switch (trashUnavailableReason.value) {
    case 'external':
      return t('trash.notAvailableExternal')
    case 'pending':
      return t('trash.notAvailablePending')
    case 'disabled':
      return t('trash.autoExpiryDisabled')
    case 'license':
      return t('trash.notAvailableLicense')
    default:
      return ''
  }
})

const { resolvedProject } = storeToRefs(useBases())

const isHistoryMenuOpen = ref(false)

function openSnapshots() {
  const baseId = resolvedProject.value?.id
  const wsId = route.value.params.typeOrId
  if (!baseId || !wsId) return
  navigateTo(`/${wsId}/${baseId}/settings/snapshots`)
}

const { toggleActionPanel, isPanelExpanded: isActionPanelExpanded, isViewActionsEnabled } = useActionPane()

const { isPanelExpanded: isChatPanelExpanded } = useChatPanel()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isEEFeatureBlocked, blockExtensions, showUpgradeToUseExtensions } = useEeConfig()

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
      'bg-nc-bg-brand': isEditingDashboard || activeWorkflowHasDraftChanges,
    }"
    class="nc-table-topbar py-2 border-b-1 border-nc-border-gray-medium flex gap-3 items-center justify-between overflow-hidden relative h-[var(--topbar-height)] max-h-[var(--topbar-height)] min-h-[var(--topbar-height)] md:(px-2) xs:(px-1)"
    style="z-index: 7"
  >
    <template v-if="isViewsLoading && !activeScriptId && !activeDashboardId && !activeWorkflowId">
      <a-skeleton-input :active="true" class="!w-44 !h-4 ml-2 !rounded overflow-hidden" />
    </template>
    <template v-else>
      <div
        class="flex items-center gap-3 md:min-w-[300px]"
        :style="{
          width: topbarBreadcrumbItemWidth,
        }"
      >
        <GeneralOpenLeftSidebarBtn />
        <LazySmartsheetToolbarViewInfo v-if="!isPublic && !activeScriptId && !activeDashboardId && !activeWorkflowId" />
        <LazySmartsheetTopbarScriptInfo v-if="!isPublic && activeScriptId" />
        <LazySmartsheetTopbarDashboardInfo v-if="!isPublic && activeDashboardId" />
        <LazySmartsheetTopbarWorkflowInfo v-if="!isPublic && activeWorkflowId" />
      </div>

      <div v-if="!isSharedBase && !isMobileMode && !activeScriptId && !activeDashboardId && !activeWorkflowId">
        <SmartsheetTopbarSelectMode />
      </div>
      <div v-else-if="activeDashboardId || activeWorkflowId">
        <SmartsheetTopbarEditingState />
      </div>

      <div class="flex items-center justify-end gap-2 flex-1">
        <GeneralApiLoader v-if="!isMobileMode && !activeScriptId && !activeDashboardId" />

        <!-- Managed App Status -->
        <LazySmartsheetTopbarManagedAppStatus v-if="!isSharedBase && !isMobileMode" />

        <!-- Sandbox Status -->
        <LazySmartsheetTopbarSandboxStatus v-if="!isSharedBase && !isMobileMode" />

        <LazySmartsheetTopbarCollaboratorPresence
          v-if="!isPublic && !isSharedBase && !isMobileMode && openedViewsTab === 'view' && appInfo.ee"
        />

        <NcDropdown
          v-if="
            isEeUI &&
            !isSharedBase &&
            !activeScriptId &&
            !activeDashboardId &&
            !activeWorkflowId &&
            openedViewsTab === 'view' &&
            !isMobileMode
          "
          v-model:visible="isHistoryMenuOpen"
          placement="bottomRight"
        >
          <NcTooltip :disabled="isHistoryMenuOpen" placement="bottom">
            <template #title>{{ $t('labels.history') }}</template>
            <NcButton
              v-e="['c:topbar:history-menu']"
              type="text"
              size="small"
              class="nc-topbar-history-btn"
              :class="{ '!bg-nc-bg-brand !text-nc-content-brand': isHistoryMenuOpen }"
              data-testid="nc-topbar-history-btn"
            >
              <GeneralIcon icon="ncHistory" class="w-4 h-4 !stroke-transparent" />
            </NcButton>
          </NcTooltip>
          <template #overlay>
            <NcMenu variant="medium" class="min-w-40">
              <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_EE_CORE">
                <template #default="{ click }">
                  <NcMenuItem
                    data-testid="nc-topbar-history-menu-snapshots"
                    @click="
                      click(
                        PlanFeatureTypes.FEATURE_EE_CORE,
                        isEeUI
                          ? () => {
                              isHistoryMenuOpen = false
                              openSnapshots()
                            }
                          : undefined,
                      )
                    "
                  >
                    <div v-e="['c:topbar:history-menu:snapshots']" class="flex gap-2 items-center w-full">
                      <GeneralIcon icon="camera" class="text-nc-content-gray-subtle2" />
                      <div class="flex-1">{{ $t('labels.snapshots') }}</div>
                      <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_EE_CORE" show-as-lock />
                    </div>
                  </NcMenuItem>
                </template>
              </PaymentUpgradeBadgeProvider>
              <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_EE_CORE">
                <template #default="{ click }">
                  <NcTooltip :disabled="!trashUnavailableReason || trashUnavailableReason === 'license'" placement="left">
                    <template #title>{{ trashUnavailableMessage }}</template>
                    <NcMenuItem
                      :disabled="!!trashUnavailableReason && trashUnavailableReason !== 'license'"
                      data-testid="nc-topbar-history-menu-trash"
                      @click="
                        click(
                          PlanFeatureTypes.FEATURE_EE_CORE,
                          trashUnavailableReason
                            ? undefined
                            : () => {
                                isHistoryMenuOpen = false
                                openTrash()
                              },
                        )
                      "
                    >
                      <div v-e="['c:topbar:history-menu:trash']" class="flex gap-2 items-center w-full">
                        <GeneralIcon
                          icon="ncTrash2"
                          class="text-nc-content-gray-subtle2"
                          :class="{
                            '!text-nc-content-gray-disabled': trashUnavailableReason && trashUnavailableReason !== 'license',
                          }"
                        />
                        <div class="flex-1">{{ $t('labels.trash') }}</div>
                        <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_EE_CORE" show-as-lock />
                      </div>
                    </NcMenuItem>
                  </NcTooltip>
                </template>
              </PaymentUpgradeBadgeProvider>
            </NcMenu>
          </template>
        </NcDropdown>

        <NcTooltip
          v-if="
            (isEeUI || isFeatureEnabled(FEATURE_FLAG.EXTENSIONS)) &&
            !isSharedBase &&
            !activeScriptId &&
            !activeDashboardId &&
            !activeWorkflowId &&
            openedViewsTab === 'view' &&
            !isMobileMode
          "
          placement="bottom"
        >
          <template #title>{{ $t('general.extensions') }}</template>
          <NcButton
            v-e="['c:extension-toggle']"
            type="text"
            size="small"
            class="nc-topbar-extension-btn"
            :class="{ '!bg-nc-bg-brand !text-nc-content-brand': isPanelExpanded }"
            data-testid="nc-topbar-extension-btn"
            @click="blockExtensions && !isPanelExpanded ? showUpgradeToUseExtensions() : toggleExtensionPanel()"
          >
            <GeneralIcon :icon="isPanelExpanded ? 'ncPuzzleSolid' : 'ncPuzzleOutline'" class="w-4 h-4 !stroke-transparent" />
          </NcButton>
        </NcTooltip>

        <NcButton
          v-if="
            !isSharedBase &&
            !activeScriptId &&
            !activeDashboardId &&
            !activeWorkflowId &&
            openedViewsTab === 'view' &&
            !isMobileMode &&
            isViewActionsEnabled &&
            !isEEFeatureBlocked
          "
          v-e="['c:action-toggle']"
          type="secondary"
          size="small"
          class="nc-topbar-action-btn"
          :class="{ '!bg-nc-bg-brand !hover:bg-nc-brand-100/70 !text-nc-content-brand': isActionPanelExpanded }"
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
              class="overflow-hidden transition-all duration-200"
              :class="{
                'w-[0px] invisible': isActionPanelExpanded || isChatPanelExpanded,
                'ml-1 w-[54px]': !isActionPanelExpanded && !isChatPanelExpanded,
              }"
            >
              {{ $t('general.actions') }}
            </span>
          </div>
        </NcButton>

        <div v-if="!isSharedBase" class="flex gap-2 items-center empty:hidden">
          <LazySmartsheetTopbarDashboardState v-if="activeDashboardId && isUIAllowed('dashboardEdit')" />
          <LazySmartsheetTopbarScriptAction v-if="activeScriptId && appInfo.ee" />
          <LazySmartsheetTopbarWorkflowAction v-if="activeWorkflowId && appInfo.ee" />
        </div>

        <DashboardMiniSidebarTheme v-if="isSharedBase" placement="bottom" render-as-btn button-class="h-8 w-8" />

        <LazySmartsheetTopbarShareProject v-if="!activeScriptId && !activeWorkflowId" />

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
