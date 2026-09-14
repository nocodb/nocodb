<script lang="ts" setup>
const router = useRouter()
const route = router.currentRoute

const basesStore = useBases()
const { resolvedProject } = storeToRefs(basesStore)

const sidebarStore = useSidebarStore()
const { activeSidebarTab, isLeftSidebarOpen } = storeToRefs(sidebarStore)

const { isSharedBase } = storeToRefs(useBase())

const baseRole = inject(ProjectRoleInj)!

const { isMobileMode } = useGlobal()

const { t } = useI18n()

const { isUIAllowed, environmentRestrictionReason, baseRoles, loadRoles } = useRoles()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isWsAuditEnabled, isEEFeatureBlocked, showEEFeatures, hideInterfaces, blockWorkflows } = useEeConfig()

const navigateToBaseSettings = (page: string) => {
  if (page === 'snapshots' && isEEFeatureBlocked.value) {
    showUpgradeToUseSnapshots({ triggerSource: 'base-settings-snapshots' })
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

const searchQuery = ref('')

// The nav as data, so one filter can drive search across every group including
// the app section. `keywords` carry what a page contains but does not say in its
// label — searching "null" or "private" has to land on General.
const navGroups = computed(() => {
  const groups: {
    key: string
    label: string
    divider?: boolean
    items: {
      tab: string
      ev: string
      icon: string
      testId: string
      label: string
      keywords?: string
      info?: string
    }[]
  }[] = [
    {
      key: 'invite',
      label: t('labels.baseNav.groupInvite'),
      items: [
        {
          tab: 'collaborator',
          ev: 'add-user',
          icon: 'users',
          testId: 'base-collaborator',
          label: t('labels.baseNav.members'),
          keywords: 'invite people users collaborators teams roles base access',
          visible: canSeeMembers.value,
        },
      ].filter((i) => i.visible),
    },
    {
      key: 'data',
      label: t('labels.baseNav.groupData'),
      items: [
        {
          tab: 'permissions',
          ev: 'permissions',
          icon: 'ncLock',
          testId: 'base-permissions',
          label: t('labels.baseNav.dataPermissionsNav'),
          keywords: 'permission table field column document docs visibility restrict lock access',
          visible: canSeePermissions.value,
        },
        {
          tab: 'data-source',
          ev: 'add-data-source',
          icon: 'ncDatabase',
          testId: 'base-data-source',
          label: t('labels.baseNav.databases'),
          keywords: 'data source database postgres mysql sqlite snowflake external connection schema',
          info: t('labels.baseNav.databasesInfo'),
          visible: canSeeDataSources.value,
        },
        {
          tab: 'syncs',
          ev: 'syncs',
          icon: 'ncZap',
          testId: 'base-syncs',
          label: t('labels.baseNav.sync'),
          keywords: 'sync import pull schedule one-way external app',
          info: t('labels.baseNav.syncInfo'),
          visible: canSeeSyncs.value,
        },
      ].filter((i) => i.visible),
    },
    {
      key: 'interfaces',
      label: t('labels.baseNav.groupInterfaces'),
      items: [
        {
          tab: 'interface-members',
          ev: 'interface-members',
          icon: 'ncUsers',
          testId: 'base-interface-members',
          label: t('labels.baseNav.interfaceMembers'),
          keywords: 'invite interface app users members roles access',
          visible: canSeeInterfaceMembers.value,
        },
      ].filter((i) => i.visible),
    },
    {
      key: 'connectivity',
      label: t('labels.baseNav.groupConnectivity'),
      items: [
        {
          tab: 'integrations',
          ev: 'integrations',
          icon: 'integration',
          testId: 'base-integrations',
          label: t('labels.baseNav.integrations'),
          keywords: 'credentials connection oauth api key slack google openai',
          visible: isIntegrationsMenuVisible.value,
        },
        {
          tab: 'mcp',
          ev: 'mcp',
          icon: 'mcp',
          testId: 'base-mcp',
          label: t('labels.baseNav.mcpServer'),
          keywords: 'mcp agent ai token endpoint claude',
          visible: canSeeMcp.value,
        },
      ].filter((i) => i.visible),
    },
    {
      key: 'admin',
      label: t('labels.baseNav.groupAdmin'),
      items: [
        {
          tab: 'workflows',
          ev: 'workflows',
          icon: 'ncAutomation',
          testId: 'base-workflows',
          label: t('labels.baseNav.automations'),
          keywords: 'workflow trigger action script run automation',
          visible: canSeeAutomations.value,
        },
        {
          tab: 'audits',
          ev: 'audits',
          icon: 'audit',
          testId: 'base-audit',
          label: t('labels.baseNav.auditLog'),
          keywords: 'audit history activity log who changed',
          visible: canSeeAuditLog.value,
        },
        {
          tab: 'record-trash',
          ev: 'record-trash',
          icon: 'ncTrash2',
          testId: 'base-record-trash',
          label: t('labels.baseNav.trashRetention'),
          keywords: 'trash deleted records retention days recover restore',
          visible: canSeeTrashRetention.value,
        },
        {
          tab: 'snapshots',
          ev: 'snapshots',
          icon: 'camera',
          testId: 'base-snapshots',
          label: t('labels.baseNav.snapshots'),
          keywords: 'snapshot backup restore point in time',
          visible: canSeeSnapshots.value,
        },
        {
          tab: 'skills',
          ev: 'skills',
          icon: 'ncScript',
          testId: 'base-skills',
          label: t('labels.baseNav.aiSkills'),
          keywords: 'ai skill prompt assistant',
          visible: canSeeAiSkills.value,
        },
        {
          tab: 'variables',
          ev: 'variables',
          icon: 'ncSettings',
          testId: 'base-variables',
          label: t('labels.baseNav.variables'),
          keywords: 'variable environment secret value master inherited',
          visible: canSeeVariables.value,
        },
        {
          tab: 'base-settings',
          ev: 'more',
          icon: 'ncMoreHorizontal',
          testId: 'base-settings',
          label: t('labels.baseNav.general'),
          keywords: 'general base type private public data display null m2m junction empty filter',
          visible: canSeeGeneral.value,
        },
      ].filter((i) => i.visible),
    },
  ]

  if (isAppSettingsVisible.value) {
    groups.push({
      key: 'app',
      label: t('labels.appSettings'),
      divider: true,
      items: appSettingsItems.value.map((item) => ({
        tab: item.tab,
        ev: item.tab,
        icon: item.icon,
        testId: item.testId,
        label: t(item.label),
        keywords: 'app',
      })),
    })
  }

  return groups.filter((g) => g.items.length)
})

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return navGroups.value

  return navGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || group.label.toLowerCase().includes(q) || (item.keywords ?? '').includes(q),
      ),
    }))
    .filter((group) => group.items.length)
})

const hasResults = computed(() => filteredGroups.value.length > 0)

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
    <div class="nc-settings-search">
      <a-input
        v-model:value="searchQuery"
        type="text"
        :placeholder="$t('labels.baseNav.searchPlaceholder')"
        class="nc-input-sm nc-input-shadow"
        data-testid="nc-settings-search"
        allow-clear
      >
        <template #prefix>
          <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1 text-nc-content-gray-muted" />
        </template>
      </a-input>
    </div>

    <template v-for="group in filteredGroups" :key="group.key">
      <div
        class="nc-settings-section-header"
        :class="{
          'nc-settings-section-header-group': group.key !== filteredGroups[0].key && !group.divider,
          'nc-settings-section-header-app': group.divider,
        }"
      >
        {{ group.label }}
      </div>
      <NcSidebarMenuItem
        v-for="item in group.items"
        :key="item.tab"
        v-e="[`c:settings:base:${item.ev}`]"
        :icon="item.icon"
        :data-testid="`base-${item.testId}`"
        :active="activeBaseSettingsTab === item.tab"
        @click="navigateToBaseSettings(item.tab)"
      >
        {{ item.label }}
        <template v-if="item.info" #extraRight>
          <NcTooltip :title="item.info" placement="right" :arrow="false" class="nc-nav-info">
            <GeneralIcon icon="ncInfo" class="flex-none text-nc-content-gray-muted" />
          </NcTooltip>
        </template>
      </NcSidebarMenuItem>
    </template>

    <div v-if="!hasResults" class="nc-settings-no-results" data-testid="nc-settings-search-empty">
      {{ $t('labels.baseNav.searchEmpty', { query: searchQuery }) }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Supplementary, so it stays out of the way until the row is hovered. Opacity
// rather than v-if, so revealing it never shifts the row's layout. :deep is
// required — NcTooltip's root element carries no scope attribute.
:deep(.nc-nav-info) {
  @apply opacity-0 transition-opacity duration-150;
}

.nc-sidebar-menu-item:hover :deep(.nc-nav-info) {
  @apply opacity-100;
}

.nc-settings-search {
  @apply px-3 pt-2 pb-1;
}

.nc-settings-no-results {
  @apply px-3 py-6 text-center text-nc-content-gray-muted text-bodySm;
}

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
