<script lang="ts" setup>
import { PlanFeatureTypes } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const basesStore = useBases()
const { resolvedProject } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()
const { activeSidebarTab, isLeftSidebarOpen } = storeToRefs(sidebarStore)

const { isSharedBase } = storeToRefs(useBase())

const baseRole = inject(ProjectRoleInj)!

const { isMobileMode } = useGlobal()

const { isUIAllowed, environmentRestrictionReason, baseRoles, loadRoles } = useRoles()

const { isFeatureEnabled } = useBetaFeatureToggle()

const {
  isWsAuditEnabled,
  showUpgradeToUseTableAndFieldPermissions,
  showUpgradeToUseDocumentPermissions,
  showUpgradeToUseSync,
  showUpgradeToUseSnapshots,
  showUpgradeToUseTrashSettings,
  showUpgradeToUseBaseVariables,
  blockTrashSettings,
  blockBaseVariables,
  isEEFeatureBlocked,
  showEEFeatures,
  hideInterfaces,
  blockWorkflows,
} = useEeConfig()

const navigateToBaseSettings = (page: string) => {
  if (
    page === 'permissions' &&
    showUpgradeToUseTableAndFieldPermissions({ triggerSource: 'base-settings-table-field-permissions' })
  )
    return
  if (page === 'docs-permissions' && showUpgradeToUseDocumentPermissions({ triggerSource: 'base-settings-doc-permissions' }))
    return
  if (page === 'syncs' && showUpgradeToUseSync({ triggerSource: 'base-settings-sync' })) return
  if (page === 'snapshots' && isEEFeatureBlocked.value) {
    showUpgradeToUseSnapshots({ triggerSource: 'base-settings-snapshots' })
    return
  }
  if (page === 'record-trash' && blockTrashSettings.value) {
    showUpgradeToUseTrashSettings({ triggerSource: 'base-settings-trash' })
    return
  }
  if (page === 'variables' && blockBaseVariables.value) {
    showUpgradeToUseBaseVariables({ triggerSource: 'base-settings-base-variables' })
    return
  }

  const baseId = resolvedProject.value?.id
  if (!baseId) return

  const wsId = route.value.params.typeOrId
  const slug = settingsTabToSlug[page] || page
  navigateTo(`/${wsId}/${baseId}/settings/${slug}`)

  if (isMobileMode.value) {
    isLeftSidebarOpen.value = false
  }
}

const activeBaseSettingsTab = computed(() => {
  if (activeSidebarTab.value !== 'settings') return ''
  const page = route.value.params.page as string

  return page ? baseSettingsSlugToTab[page] || '' : 'members'
})

// Use injected base role for immediate permission checks; load full roles in background
const effectiveRoles = computed(() => baseRoles.value ?? baseRole.value)

const { apps, isAppsEnabled } = storeToRefs(useAppStore())

// The base's app, if it has one. Empty in CE (stub store), so the section drops
// out there without a second gate.
const baseApp = computed(() => (resolvedProject.value?.id ? apps.value.get(resolvedProject.value.id) : undefined))

// An install locks `appCreateOrEdit` — the app definition is the publisher's —
// but its owner still has to address, staff and connect their own instance.
const isAppInstall = computed(() => !!resolvedProject.value?.managed_app_id && !resolvedProject.value?.managed_app_master)

const isAppListing = computed(() => !!resolvedProject.value?.managed_app_id && !!resolvedProject.value?.managed_app_master)

// A listing on its own is enough: a base can be published with nothing to serve,
// and its store page is still the publisher's to edit.
//
// Publishing opens a lane, and an open lane restricts `appCreateOrEdit` on
// Production — so without the restriction check this section disappears from
// exactly the bases that have a store page. Same compensation `project/View.vue`
// makes; the panes themselves stay read-only there.
const isAppSettingsVisible = computed(
  () =>
    isAppsEnabled.value &&
    (!!baseApp.value || isAppListing.value) &&
    !isMobileMode.value &&
    (isUIAllowed('appCreateOrEdit', { roles: effectiveRoles.value }) ||
      !!environmentRestrictionReason('appCreateOrEdit', { roles: effectiveRoles.value, base: resolvedProject.value }) ||
      (isAppInstall.value && isUIAllowed('baseMiscSettings', { roles: effectiveRoles.value }))),
)

const appSettingsItems = computed(() =>
  appSettingsNavFor(
    isAppInstall.value && !isUIAllowed('appCreateOrEdit', { roles: effectiveRoles.value }),
    isAppListing.value,
    !!baseApp.value,
    isFeatureEnabled(FEATURE_FLAG.MANAGED_APPS),
  ),
)

const isIntegrationsMenuVisible = computed(() => {
  if (isMobileMode.value) return false
  // Managers (sourceCreate) get the full surface; viewers get the linked
  // connections list, where per-user integrations offer their connect action.
  return (
    isUIAllowed('sourceCreate', {
      roles: effectiveRoles.value,
      skipBaseCheck: !!resolvedProject.value?.is_lane_instance,
    }) ||
    isUIAllowed('baseIntegrationList', {
      roles: effectiveRoles.value,
      skipBaseCheck: !!resolvedProject.value?.is_lane_instance,
    })
  )
})

// Nav item gates, lifted out of the template so a group heading can hide itself
// when everything under it is gated off (roles, edition and mobile all prune items).
const canSeeMembers = computed(() => isUIAllowed('newUser', { roles: effectiveRoles.value }))

const canSeeInterfaceMembers = computed(
  () =>
    isEeUI &&
    isUIAllowed('interfaceUsersMatrix', { roles: effectiveRoles.value }) &&
    showEEFeatures.value &&
    !hideInterfaces.value,
)

const canSeePermissions = computed(
  () => isEeUI && isUIAllowed('sourceCreate', { roles: effectiveRoles.value }) && showEEFeatures.value,
)

const canSeeDataSources = computed(() => isUIAllowed('sourceCreate', { roles: effectiveRoles.value }) && !isMobileMode.value)

const canSeeSyncs = computed(
  () => isEeUI && isUIAllowed('sourceCreate', { roles: effectiveRoles.value }) && !isMobileMode.value && showEEFeatures.value,
)

const canSeeAutomations = computed(
  () =>
    isEeUI &&
    !blockWorkflows.value &&
    showEEFeatures.value &&
    isUIAllowed('workflowCreateOrEdit', { roles: effectiveRoles.value }) &&
    isFeatureEnabled(FEATURE_FLAG.WORKFLOWS_TAB) &&
    !isMobileMode.value,
)

const canSeeAiSkills = computed(
  () => isEeUI && isUIAllowed('baseSkillList', { roles: effectiveRoles.value }) && !isMobileMode.value && showEEFeatures.value,
)

const canSeeMcp = computed(() => isUIAllowed('manageMCP', { roles: effectiveRoles.value }) && !isMobileMode.value)

const canSeeVariables = computed(
  () => isUIAllowed('baseVariableList', { roles: effectiveRoles.value }) && !isMobileMode.value && showEEFeatures.value,
)

const canSeeAuditLog = computed(
  () =>
    isEeUI &&
    isUIAllowed('baseAuditList', { roles: effectiveRoles.value }) &&
    isWsAuditEnabled.value &&
    !isMobileMode.value &&
    showEEFeatures.value,
)

const canSeeTrashRetention = computed(
  () =>
    isEeUI &&
    isUIAllowed('baseTrashSettingsList', { roles: effectiveRoles.value }) &&
    !isMobileMode.value &&
    showEEFeatures.value,
)

const canSeeSnapshots = computed(
  () =>
    isEeUI &&
    showEEFeatures.value &&
    isUIAllowed('baseMiscSettings', { roles: effectiveRoles.value }) &&
    isUIAllowed('manageSnapshot', { roles: effectiveRoles.value }) &&
    !isMobileMode.value,
)

const canSeeGeneral = computed(
  () => !isSharedBase.value && isUIAllowed('baseMiscSettings', { roles: effectiveRoles.value }) && !isMobileMode.value,
)

const showAccessGroup = computed(() => canSeeMembers.value || canSeeInterfaceMembers.value || canSeePermissions.value)

const showDataGroup = computed(() => canSeeDataSources.value || isIntegrationsMenuVisible.value || canSeeSyncs.value)

const showAutomationGroup = computed(
  () => canSeeAutomations.value || canSeeAiSkills.value || canSeeMcp.value || canSeeVariables.value,
)

const showAdminGroup = computed(
  () => canSeeAuditLog.value || canSeeTrashRetention.value || canSeeSnapshots.value || canSeeGeneral.value,
)

// Load base roles in background if not already loaded
onMounted(() => {
  const baseId = resolvedProject.value?.id
  if (baseId) {
    loadRoles(baseId).catch(() => {})
  }
})
</script>

<template>
  <div class="nc-project-home-section">
    <template v-if="showAccessGroup">
      <div class="nc-settings-section-header">{{ $t('labels.baseNav.groupAccess') }}</div>
      <NcSidebarMenuItem
        v-if="canSeeMembers"
        v-e="['c:settings:base:add-user']"
        icon="users"
        data-testid="base-collaborator"
        :active="activeBaseSettingsTab === 'collaborator'"
        @click="navigateToBaseSettings('collaborator')"
      >
        {{ $t('labels.baseNav.members') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeeInterfaceMembers"
        v-e="['c:settings:base:interface-members']"
        icon="ncUsers"
        data-testid="base-interface-members"
        :active="activeBaseSettingsTab === 'interface-members'"
        @click="navigateToBaseSettings('interface-members')"
      >
        {{ $t('labels.baseNav.interfaceMembers') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeePermissions"
        v-e="['c:settings:base:permissions']"
        icon="ncLock"
        data-testid="base-permissions"
        :active="activeBaseSettingsTab === 'permissions'"
        @click="navigateToBaseSettings('permissions')"
      >
        {{ $t('labels.baseNav.dataPermissions') }}
        <template #extraRight>
          <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS" remove-click />
        </template>
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeePermissions"
        v-e="['c:settings:base:docs-permissions']"
        icon="ncFileText"
        data-testid="base-docs-permissions"
        :active="activeBaseSettingsTab === 'docs-permissions'"
        @click="navigateToBaseSettings('docs-permissions')"
      >
        {{ $t('labels.baseNav.docsPermissions') }}
        <template #extraRight>
          <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS" remove-click />
        </template>
      </NcSidebarMenuItem>
    </template>

    <template v-if="showDataGroup">
      <div class="nc-settings-section-header nc-settings-section-header-group">{{ $t('labels.baseNav.groupData') }}</div>
      <NcSidebarMenuItem
        v-if="canSeeDataSources"
        v-e="['c:settings:base:add-data-source']"
        icon="ncDatabase"
        data-testid="base-data-source"
        :active="activeBaseSettingsTab === 'data-source'"
        @click="navigateToBaseSettings('data-source')"
      >
        {{ $t('labels.baseNav.dataSources') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="isIntegrationsMenuVisible"
        v-e="['c:settings:base:integrations']"
        icon="integration"
        data-testid="base-integrations"
        :active="activeBaseSettingsTab === 'integrations'"
        @click="navigateToBaseSettings('integrations')"
      >
        {{ $t('labels.baseNav.integrations') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeeSyncs"
        v-e="['c:settings:base:syncs']"
        icon="ncZap"
        data-testid="base-syncs"
        :active="activeBaseSettingsTab === 'syncs'"
        @click="navigateToBaseSettings('syncs')"
      >
        {{ $t('labels.baseNav.syncs') }}
        <template #extraRight>
          <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_SYNC" remove-click />
        </template>
      </NcSidebarMenuItem>
    </template>

    <template v-if="showAutomationGroup">
      <div class="nc-settings-section-header nc-settings-section-header-group">{{ $t('labels.baseNav.groupAutomation') }}</div>
      <NcSidebarMenuItem
        v-if="canSeeAutomations"
        v-e="['c:settings:base:workflows']"
        icon="ncAutomation"
        data-testid="base-workflows"
        :active="activeBaseSettingsTab === 'workflows'"
        @click="navigateToBaseSettings('workflows')"
      >
        {{ $t('labels.baseNav.automations') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeeAiSkills"
        v-e="['c:settings:base:skills']"
        icon="ncScript"
        data-testid="base-skills"
        :active="activeBaseSettingsTab === 'skills'"
        @click="navigateToBaseSettings('skills')"
      >
        {{ $t('labels.baseNav.aiSkills') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeeMcp"
        v-e="['c:settings:base:mcp']"
        icon="mcp"
        data-testid="base-mcp"
        :active="activeBaseSettingsTab === 'mcp'"
        @click="navigateToBaseSettings('mcp')"
      >
        {{ $t('labels.baseNav.mcpServer') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeeVariables"
        v-e="['c:settings:base:variables']"
        icon="ncSettings"
        data-testid="base-variables"
        :active="activeBaseSettingsTab === 'variables'"
        @click="navigateToBaseSettings('variables')"
      >
        {{ $t('labels.baseNav.variables') }}
        <template #extraRight>
          <LazyPaymentUpgradeBadge
            :feature="PlanFeatureTypes.FEATURE_BASE_VARIABLES"
            :feature-enabled-callback="() => !blockBaseVariables"
          />
        </template>
      </NcSidebarMenuItem>
    </template>

    <template v-if="showAdminGroup">
      <div class="nc-settings-section-header nc-settings-section-header-group">{{ $t('labels.baseNav.groupAdmin') }}</div>
      <NcSidebarMenuItem
        v-if="canSeeAuditLog"
        v-e="['c:settings:base:audits']"
        icon="audit"
        data-testid="base-audit"
        :active="activeBaseSettingsTab === 'audits'"
        @click="navigateToBaseSettings('audits')"
      >
        {{ $t('labels.baseNav.auditLog') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeeTrashRetention"
        v-e="['c:settings:base:record-trash']"
        icon="ncTrash2"
        data-testid="base-record-trash"
        :active="activeBaseSettingsTab === 'record-trash'"
        @click="navigateToBaseSettings('record-trash')"
      >
        {{ $t('labels.baseNav.trashRetention') }}
        <template #extraRight>
          <LazyPaymentUpgradeBadge
            :feature="PlanFeatureTypes.FEATURE_TRASH_SETTINGS"
            :feature-enabled-callback="() => !blockTrashSettings"
          />
        </template>
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeeSnapshots"
        v-e="['c:settings:base:snapshots']"
        icon="camera"
        data-testid="base-snapshots"
        :active="activeBaseSettingsTab === 'snapshots'"
        @click="navigateToBaseSettings('snapshots')"
      >
        {{ $t('labels.baseNav.snapshots') }}
        <template #extraRight>
          <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" />
        </template>
      </NcSidebarMenuItem>
      <NcSidebarMenuItem
        v-if="canSeeGeneral"
        v-e="['c:settings:base:more']"
        icon="ncMoreHorizontal"
        data-testid="base-settings"
        :active="activeBaseSettingsTab === 'base-settings'"
        @click="navigateToBaseSettings('base-settings')"
      >
        {{ $t('labels.baseNav.general') }}
      </NcSidebarMenuItem>
    </template>

    <!-- App settings — one app per base, so its settings are a second section
         here rather than a separate surface inside the app console. -->
    <template v-if="isAppSettingsVisible">
      <div class="nc-settings-section-header nc-settings-section-header-app">
        {{ $t('labels.appSettings') }}
      </div>
      <NcSidebarMenuItem
        v-for="item in appSettingsItems"
        :key="item.tab"
        v-e="[`c:settings:${item.tab}`]"
        :icon="item.icon"
        :data-testid="`base-${item.testId}`"
        :active="activeBaseSettingsTab === item.tab"
        @click="navigateToBaseSettings(item.tab)"
      >
        {{ $t(item.label) }}
      </NcSidebarMenuItem>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-settings-section-header {
  @apply px-3 pt-3 pb-1 font-semibold text-nc-content-gray-muted uppercase tracking-wide;
  font-size: 13px;
}

// Groups after the first need air between them and the previous group's last item.
.nc-settings-section-header-group {
  @apply mt-2;
}

// Second section in the same scroll column — a rule separates it from the base's.
.nc-settings-section-header-app {
  @apply mt-3 pt-4 border-t border-nc-border-gray-medium;
}
</style>
