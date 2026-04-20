<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { PlanFeatureTypes, ProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
  tab?: ProjectPageType
  showOverviewTab?: boolean
  showEmptySkeleton?: boolean
}>()

const { hideSidebar, isBaseSettingsFullPage, activeSidebarTab } = storeToRefs(useSidebarStore())

const { integrations } = useProvideIntegrationViewStore()

const basesStore = useBases()

const { openedProject, activeProjectId, basesUser, bases, basesTeams } = storeToRefs(basesStore)
const { activeTable } = storeToRefs(useTablesStore())
const workspaceStore = useWorkspace()
const { activeWorkspace, isTeamsEnabled } = storeToRefs(workspaceStore)

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isSharedBase, isPrivateBase } = storeToRefs(useBase())

const { $e, $api } = useNuxtApp()

const {
  blockTableAndFieldPermissions,
  showUpgradeToUseTableAndFieldPermissions,
  blockSync,
  showUpgradeToUseSync,
  isWsAuditEnabled,
  isEEFeatureBlocked,
  showEEFeatures,
} = useEeConfig()

const currentBase = computedAsync(async () => {
  let base
  if (props.baseId) {
    base = bases.value.get(props.baseId)
    if (!base) base = await $api.base.read(props.baseId!)
  } else {
    base = openedProject.value
  }

  return base
})

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed, baseRoles, isBaseRolesLoaded } = useRoles()

const { base } = storeToRefs(useBase())

const { projectPageTab: _projectPageTab } = storeToRefs(useConfigStore())

const { isMobileMode, appInfo } = useGlobal()

const baseSettingsState = ref('')

const userCount = computed(() => {
  // if private base and don't have owner permission then return
  if (base.value?.default_role && !baseRoles.value?.[ProjectRoles.OWNER]) {
    return
  }

  if (activeProjectId.value) {
    const teamsCount = !isAdminPanel.value && isTeamsEnabled.value ? basesTeams.value.get(activeProjectId.value)?.length ?? 0 : 0
    const usersCount = activeProjectId.value
      ? basesUser.value.get(activeProjectId.value)?.filter((user) => !user?.deleted)?.length ?? 0
      : 0

    return teamsCount + usersCount
  }

  return 0
})

const isOverviewTabVisible = computed(() => isUIAllowed('projectOverviewTab'))

const isAuditsTabVisible = computed(
  () => isEeUI && !isAdminPanel.value && isWsAuditEnabled.value && isUIAllowed('baseAuditList') && showEEFeatures.value,
)

const isIntegrationsTabVisible = computed(() => !isMobileMode.value && isUIAllowed('sourceCreate'))

const isWorkflowsTabVisible = computed(
  () =>
    isEeUI &&
    appInfo.value?.ee &&
    isFeatureEnabled(FEATURE_FLAG.WORKFLOWS_TAB) &&
    isUIAllowed('workflowCreateOrEdit') &&
    !isMobileMode.value &&
    showEEFeatures.value,
)

// Get actual workflow count
const workflowStore = useWorkflowStore()
const { activeBaseWorkflows } = storeToRefs(workflowStore)

const workflowCount = computed(() => {
  return activeBaseWorkflows.value?.length ?? 0
})

const projectPageTab = computed({
  get() {
    if (props.showOverviewTab) return 'overview'

    return _projectPageTab.value
  },
  set(value) {
    if (value === 'permissions' && showEEFeatures.value && showUpgradeToUseTableAndFieldPermissions()) {
      return
    }

    if (value === 'syncs' && showEEFeatures.value && showUpgradeToUseSync()) {
      return
    }

    if (value === 'audits' && !isAuditsTabVisible.value) {
      return
    }

    if (value === 'workflows' && !isWorkflowsTabVisible.value) {
      return
    }

    _projectPageTab.value = value
  },
})

watch(
  () => route.value.query?.page,
  async (newVal, oldVal) => {
    // When tab is controlled by route path (admin pages), skip query-based logic
    if (props.tab || props.showOverviewTab) return

    if (!('baseId' in route.value.params)) return
    // if (route.value.name !== 'index-typeOrId-baseId-index-index') return

    // Wait for base roles to be loaded before checking if the overview tab is visible
    await until(() => isBaseRolesLoaded.value).toBeTruthy()

    /**
     * We are waiting for base role load and their might be the case that,
     * on navigating to different page this watch get called which will overwrite projectPageTab value and navigateToProjectPage fn get called
     */
    if (['viewId', 'workflowId', 'scriptId', 'dashboardId'].some((key) => route.value.params[key])) {
      return
    }

    // In mobile mode we only show collaborator tab
    if (isMobileMode.value && newVal !== 'collaborator') {
      projectPageTab.value = 'collaborator'
      return
    }

    if (newVal && newVal !== oldVal) {
      if (isEeUI && newVal === 'syncs' && !blockSync.value) {
        projectPageTab.value = 'syncs'
      } else if (newVal === 'data-source') {
        projectPageTab.value = 'data-source'
      } else if (newVal === 'integrations' && isIntegrationsTabVisible.value) {
        projectPageTab.value = 'integrations'
      } else if (newVal === 'overview' && isOverviewTabVisible.value) {
        projectPageTab.value = 'overview'
      } else if (newVal === 'permissions' && !blockTableAndFieldPermissions.value && isEeUI) {
        projectPageTab.value = 'permissions'
      } else if (newVal === 'base-settings') {
        projectPageTab.value = 'base-settings'
      } else if (newVal === 'audits' && isAuditsTabVisible.value) {
        projectPageTab.value = 'audits'
      } else if (newVal === 'workflows' && isWorkflowsTabVisible.value) {
        projectPageTab.value = 'workflows'
      } else if (newVal === 'mcp') {
        projectPageTab.value = 'mcp'
      } else if (newVal === 'snapshots' && isEeUI) {
        projectPageTab.value = 'snapshots'
      } else if (newVal === 'record-trash' && isEeUI) {
        projectPageTab.value = 'record-trash'
      } else {
        projectPageTab.value = 'collaborator'
      }
      return
    }

    if (isAdminPanel.value || !isOverviewTabVisible.value) {
      projectPageTab.value = 'collaborator'
    } else {
      projectPageTab.value = 'overview'
    }
  },
  { immediate: true },
)

const { navigateToProjectPage } = useBase()

const { t } = useI18n()

const settingsPageTitle = computed(() => {
  const tabTitles: Record<string, string> = {
    'collaborator': t('labels.addUserToBase'),
    'permissions': t('labels.dataPermissions'),
    'docs-permissions': t('labels.docsPermissions'),
    'mcp': t('title.mcpServer'),
    'syncs': t('labels.manageSyncs'),
    'snapshots': t('labels.manageSnapshots'),
    'record-trash': t('trash.settings'),
    'data-source': t('labels.addDataSource'),
    'integrations': t('labels.baseIntegrations'),
    'base-settings': t('general.general'),
    'audits': t('title.audits'),
    'workflows': t('objects.workflows'),
    'overview': activeSidebarTab.value === 'workflows' ? t('objects.workflows') : t('general.data'),
  }
  return tabTitles[projectPageTab.value] || ''
})

watch(projectPageTab, () => {
  if (props.showOverviewTab) return

  $e(`a:project:view:tab-change:${projectPageTab.value}`)

  // When tab is controlled by route path (settings pages), navigate to clean URL
  if (props.tab) {
    const slug = settingsTabToSlug[projectPageTab.value] || projectPageTab.value
    const wsId = route.value.params.typeOrId

    const baseId = route.value.params.baseId
    navigateTo(`/${wsId}/${baseId}/settings/${slug}`)
    return
  }

  // Overview tab is rendered inline on the base root page — no navigation needed
  if (projectPageTab.value === 'overview') return

  navigateToProjectPage({
    page: projectPageTab.value as any,
  })
})

// Sync tab prop changes (e.g., navigating between admin sub-pages)
watch(
  () => props.tab,
  (newTab) => {
    if (newTab) {
      projectPageTab.value = newTab
    }
  },
  {
    immediate: true,
  },
)

watch(
  () => [currentBase.value?.id, currentBase.value?.title],
  () => {
    if (activeTable.value?.title) return

    useTitle(`${currentBase.value?.title ?? activeWorkspace.value?.title ?? 'NocoDB'}`)
  },
  {
    immediate: true,
  },
)

watch(
  () => currentBase.value?.id,
  () => {
    /**
     * When the current base ID changes, reset the integrations array.
     * This ensures that the integration data is cleared, allowing it to be reloaded
     * properly when opening the create/edit source modal with the updated base.
     */
    integrations.value = []
  },
  { immediate: true },
)

const isSettingsSidebar = computed(() => !!props.tab)

provide(IsSettingsSidebarInj, isSettingsSidebar)

onMounted(async () => {
  await until(() => !!currentBase.value?.id).toBeTruthy()
  if (props.tab) {
    projectPageTab.value = props.tab
  }
})

onMounted(() => {
  if (!isBaseSettingsFullPage.value) {
    hideSidebar.value = false
  }
})

onBeforeUnmount(() => {
  if (isBaseSettingsFullPage.value) {
    isBaseSettingsFullPage.value = false
    hideSidebar.value = false
  }
})

// Exit full-page mode when navigating away from a settings page
watch(
  () => route.value.query?.page,
  (newPage) => {
    if (!newPage && isBaseSettingsFullPage.value) {
      isBaseSettingsFullPage.value = false
      hideSidebar.value = false
    }
  },
)
</script>

<template>
  <div class="h-full nc-base-view">
    <!-- Full-page breadcrumb header (when entering base settings from admin menu) -->
    <template v-if="isBaseSettingsFullPage && !isAdminPanel">
      <div class="min-w-0 p-2 h-[var(--topbar-height)] border-b-1 border-nc-border-gray-medium flex items-center gap-2">
        <GeneralOpenLeftSidebarBtn v-if="isMobileMode" />
        <div class="flex-1 nc-breadcrumb nc-no-negative-margin pl-1">
          <div class="nc-breadcrumb-item capitalize truncate">
            {{ currentBase?.title }}
          </div>
          <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
          <h1 class="nc-breadcrumb-item active truncate">
            {{ $t('labels.settings') }}
          </h1>
        </div>
      </div>
    </template>

    <!-- Normal topbar -->
    <div
      v-else-if="!isAdminPanel"
      class="flex flex-row px-2 py-2 gap-3 justify-between w-full border-b-1 border-nc-border-gray-medium"
      :class="{ 'nc-table-toolbar-mobile': isMobileMode, 'h-[var(--topbar-height)]': !isMobileMode }"
    >
      <div class="flex-1 max-w-full md:max-w-[calc(100%_-_100px)] flex flex-row items-center gap-x-3">
        <GeneralOpenLeftSidebarBtn />
        <div v-if="!showEmptySkeleton" class="flex flex-row items-center h-full gap-x-2 px-2 min-w-0">
          <template v-if="props.tab">
            <span class="font-semibold text-sm text-nc-content-gray truncate">
              {{ settingsPageTitle }}
            </span>
          </template>
          <template v-else>
            <GeneralProjectIcon
              :color="parseProp(currentBase?.meta).iconColor"
              :type="currentBase?.type"
              :managed-app="{
                managed_app_master: currentBase?.managed_app_master,
                managed_app_id: currentBase?.managed_app_id,
              }"
              class="h-6 w-6 md:(h-4 w-4) flex-none"
            />
            <NcTooltip
              class="flex font-bold text-base md:text-sm capitalize truncate max-w-150 text-nc-content-gray"
              show-on-truncate-only
            >
              <template #title> {{ currentBase?.title }}</template>
              <span class="truncate">
                {{ currentBase?.title }}
              </span>
            </NcTooltip>
            <NcBadge
              v-if="isPrivateBase"
              size="xs"
              class="!text-bodySm !bg-nc-bg-gray-medium !text-nc-content-gray-subtle2"
              color="gray"
              :border="false"
            >
              <GeneralIcon icon="ncLock" class="w-3.5 h-3.5 mr-1" />
              {{ $t('general.private') }}
            </NcBadge>
          </template>
        </div>
      </div>
      <div v-if="!showEmptySkeleton && !isMobileMode" class="flex items-center gap-2">
        <SmartsheetTopbarManagedAppStatus />
        <SmartsheetTopbarSandboxStatus />
        <LazyGeneralShareProject v-if="!props.tab" />
      </div>
    </div>
    <div
      v-if="!showEmptySkeleton"
      class="flex nc-base-view-tab overflow-hidden"
      :style="{
        height: 'calc(100% - var(--topbar-height))',
      }"
    >
      <NcTabs
        v-model:active-key="projectPageTab"
        class="w-full h-full"
        :class="{ 'hide-tabs': props.tab || showOverviewTab }"
        :tab-bar-style="props.tab || showOverviewTab ? { display: 'none' } : undefined"
      >
        <template #leftExtra>
          <div class="w-3"></div>
        </template>
        <a-tab-pane
          v-if="showOverviewTab || (!isAdminPanel && !props.tab && isOverviewTabVisible && !isMobileMode)"
          key="overview"
          class="nc-project-overview-tab-content"
        >
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__overview">
              <GeneralIcon :icon="activeSidebarTab === 'workflows' ? 'ncAutomation' : 'ncMultiCircle'" />
              <div>{{ activeSidebarTab === 'workflows' ? $t('objects.workflows') : $t('general.data') }}</div>
            </div>
          </template>
          <ProjectOverview />
        </a-tab-pane>
        <!-- <a-tab-pane v-if="defaultBase" key="erd" tab="Base ERD" force-render class="pt-4 pb-12">
          <ErdView :source-id="defaultBase!.id" class="!h-full" />
        </a-tab-pane> -->
        <a-tab-pane v-if="isUIAllowed('newUser', { roles: baseRoles }) && !isSharedBase" key="collaborator">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__access-settings">
              <GeneralIcon icon="users" />
              <div>{{ $t('labels.members') }}</div>
              <div
                v-if="userCount"
                class="tab-info"
                :class="{
                  'bg-primary-selected': projectPageTab === 'collaborator',
                  'bg-nc-bg-gray-extralight': projectPageTab !== 'collaborator',
                }"
              >
                {{ userCount }}
              </div>
            </div>
          </template>
          <ProjectAccessSettings :base-id="currentBase?.id" />
        </a-tab-pane>
        <a-tab-pane v-if="isWorkflowsTabVisible && base.id" key="workflows">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__workflows">
              <GeneralIcon icon="ncAutomation" />
              <div>{{ $t('objects.workflows') }}</div>
              <div
                v-if="workflowCount"
                class="tab-info"
                :class="{
                  'bg-primary-selected': projectPageTab === 'workflows',
                  'bg-nc-bg-gray-extralight': projectPageTab !== 'workflows',
                }"
              >
                {{ workflowCount }}
              </div>
            </div>
          </template>
          <ProjectWorkflowsList :base-id="base.id" />
        </a-tab-pane>
        <a-tab-pane v-if="isEeUI && isUIAllowed('sourceCreate') && base.id && showEEFeatures" key="permissions">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__permissions">
              <GeneralIcon icon="ncLock" />
              <div>{{ $t('general.permissions') }}</div>
              <LazyPaymentUpgradeBadge
                :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS"
                :feature-enabled-callback="() => !isEEFeatureBlocked"
                remove-click
              />
            </div>
          </template>
          <DashboardSettingsPermissions v-model:state="baseSettingsState" :base-id="base.id" />
        </a-tab-pane>
        <a-tab-pane
          v-if="isEeUI && isUIAllowed('sourceCreate') && base.id && !isMobileMode && showEEFeatures"
          key="docs-permissions"
        >
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__docs-permissions">
              <GeneralIcon icon="ncFileText" />
              <div>{{ $t('labels.docsPermissions') }}</div>
              <LazyPaymentUpgradeBadge
                :feature="PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS"
                :feature-enabled-callback="() => !isEEFeatureBlocked"
                remove-click
              />
            </div>
          </template>
          <DashboardSettingsDocsPermissions v-model:state="baseSettingsState" :base-id="base.id" />
        </a-tab-pane>
        <a-tab-pane v-if="isUIAllowed('sourceCreate') && base.id && !isMobileMode" key="data-source">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__data-sources">
              <GeneralIcon icon="ncDatabase" />
              <div>{{ $t('labels.dataSources') }}</div>
              <div
                v-if="base.sources?.length"
                class="tab-info"
                :class="{
                  'bg-primary-selected': projectPageTab === 'data-source',
                  'bg-nc-bg-gray-extralight': projectPageTab !== 'data-source',
                }"
              >
                {{ base.sources.length }}
              </div>
            </div>
          </template>
          <DashboardSettingsDataSources v-model:state="baseSettingsState" :base-id="base.id" class="max-h-full" />
        </a-tab-pane>
        <a-tab-pane v-if="isIntegrationsTabVisible && base.id" key="integrations">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__integrations">
              <GeneralIcon icon="integration" />
              <div>{{ $t('labels.baseIntegrations') }}</div>
            </div>
          </template>
          <DashboardSettingsBaseIntegrations :base-id="base.id" />
        </a-tab-pane>
        <a-tab-pane v-if="isEeUI && isUIAllowed('sourceCreate') && base.id && !isMobileMode && showEEFeatures" key="syncs">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__syncs">
              <GeneralIcon icon="ncZap" />
              <div>Syncs</div>
              <LazyPaymentUpgradeBadge
                :feature="PlanFeatureTypes.FEATURE_SYNC"
                :feature-enabled-callback="() => !isEEFeatureBlocked"
                remove-click
              />
            </div>
          </template>
          <ProjectSync v-if="!blockSync" :base-id="base.id" class="max-h-full" />
        </a-tab-pane>
        <a-tab-pane v-if="isAuditsTabVisible" key="audits" class="w-full">
          <template #tab>
            <div class="tab-title" data-testid="nc-workspace-settings-tab-audits">
              <GeneralIcon icon="audit" class="h-4 w-4" />
              {{ $t('title.audits') }}
            </div>
          </template>
          <WorkspaceAudits v-if="currentBase?.id && projectPageTab === 'audits'" :base-id="currentBase?.id" />
          <div v-else>&nbsp;</div>
        </a-tab-pane>
        <a-tab-pane v-if="isUIAllowed('manageMCP') && base.id && !isMobileMode" key="mcp">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__mcp">
              <GeneralIcon icon="mcp" />
              <div>{{ $t('title.mcpServer') }}</div>
            </div>
          </template>
          <div class="p-6 h-full max-h-full overflow-auto nc-scrollbar-thin">
            <DashboardSettingsBaseMCP />
          </div>
        </a-tab-pane>
        <a-tab-pane
          v-if="isEeUI && showEEFeatures && isUIAllowed('recordTrashSettingsList') && base.id && !isMobileMode"
          key="record-trash"
        >
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__record-trash">
              <GeneralIcon icon="ncTrash2" />
              <div>{{ $t('trash.settings') }}</div>
            </div>
          </template>
          <div class="p-6 h-full max-h-full overflow-auto nc-scrollbar-thin">
            <DashboardSettingsBaseTrash />
          </div>
        </a-tab-pane>
        <a-tab-pane
          v-if="
            isEeUI &&
            isUIAllowed('baseMiscSettings') &&
            isUIAllowed('manageSnapshot') &&
            base.id &&
            !isMobileMode &&
            showEEFeatures
          "
          key="snapshots"
        >
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__snapshots">
              <GeneralIcon icon="camera" />
              <div>{{ $t('general.snapshots') }}</div>
            </div>
          </template>
          <div class="p-6 h-full max-h-full overflow-auto nc-scrollbar-thin">
            <DashboardSettingsBaseSnapshots />
          </div>
        </a-tab-pane>
        <a-tab-pane v-if="!isSharedBase && !isMobileMode" key="base-settings">
          <template #tab>
            <div class="tab-title" data-testid="proj-view-tab__base-settings">
              <GeneralIcon icon="ncSettings" />
              <div>{{ $t('general.general') }}</div>
            </div>
          </template>
          <DashboardSettingsBase :base-id="base.id!" class="max-h-full" />
        </a-tab-pane>
      </NcTabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-tabs-content) {
  @apply !h-full;
}
:deep(.ant-tabs-nav) {
  @apply !mb-0 !pl-0;
}
:deep(.nc-project-overview-tab-content.ant-tabs-tabpane) {
  @apply !h-full;
}

.tab-title {
  @apply flex flex-row items-center gap-x-1.5 px-1 py-[1px] text-[13px];

  :deep(svg) {
    @apply h-3.5 w-3.5 !text-current;
  }
}
:deep(.ant-tabs-tab) {
  @apply pt-1.5 pb-2;

  & + .ant-tabs-tab {
    @apply !ml-0;
  }
}

.tab-info {
  @apply flex pl-1.25 px-1.5 py-0.75 rounded-md text-xs;
}

.hide-tabs {
  :deep(.ant-tabs-nav) {
    @apply !hidden;
  }

  :deep(.ant-tabs-content) {
    > .ant-tabs-tabpane > div {
      @apply nc-content-max-w mx-auto;
    }
  }
}
</style>
