<script lang="ts" setup>
// Not auto-imported, unlike most of @vueuse/core's surface.
import { useStorage } from '@vueuse/core'

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

const { $e } = useNuxtApp()

const { isUIAllowed, environmentRestrictionReason, baseRoles, loadRoles } = useRoles()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isWsAuditEnabled, isEEFeatureBlocked, showEEFeatures, hideInterfaces, blockWorkflows } = useEeConfig()

const navigateToBaseSettings = (page: string) => {
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

// Only where fine-grained (base-scoped) tokens actually work — licensed on-prem
// and cloud. On CE / unlicensed on-prem tokens are org-wide only, so a
// base-level token surface would be meaningless (isEEFeatureBlocked mirrors the
// wizard's isFineGrainedEnabled).
const canSeeBaseApiTokens = computed(
  () => !isEEFeatureBlocked.value && isUIAllowed('manageBaseApiTokens', { roles: effectiveRoles.value }) && !isMobileMode.value,
)

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
    collapsible?: boolean
    items: {
      tab: string
      ev: string
      icon: string
      testId: string
      label: string
      keywords?: string
      info?: string
      /** Client marks shown at the row's right edge — an invitation to connect. */
      logos?: string[]
    }[]
  }[] = [
    {
      key: 'invite',
      label: t('labels.baseNav.groupInvite'),
      items: [
        {
          tab: 'collaborator',
          ev: 'add-user',
          icon: 'ncUserPlus',
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
          keywords: 'data source database postgres mysql sqlite snowflake sql server external connection schema',
          info: t('labels.baseNav.databasesInfo'),
          logos: ['postgreSql', 'mysql', 'mssqlServer'],
          visible: canSeeDataSources.value,
        },
        {
          tab: 'syncs',
          ev: 'syncs',
          icon: 'ncZap',
          testId: 'base-syncs',
          label: t('labels.baseNav.sync'),
          keywords: 'sync import pull schedule one-way external app hubspot jira zendesk',
          info: t('labels.baseNav.syncInfo'),
          logos: ['ncLogoHubspotColored', 'ncLogoJiraColored', 'ncLogoZendeskColored'],
          visible: canSeeSyncs.value,
        },
      ].filter((i) => i.visible),
    },
    {
      key: 'create',
      label: t('labels.baseNav.groupCreate'),
      items: [
        {
          tab: 'api-tokens',
          ev: 'api-tokens',
          icon: 'ncKey',
          testId: 'base-api-tokens',
          label: t('labels.baseNav.apiTokens'),
          keywords: 'api token key secret rest automation external app',
          visible: canSeeBaseApiTokens.value,
        },
        {
          tab: 'mcp',
          ev: 'mcp',
          icon: 'mcp',
          testId: 'base-mcp',
          label: t('labels.baseNav.mcpServer'),
          keywords: 'mcp agent ai token endpoint claude',
          logos: ['ncLogoClaudeColored', 'ncLogoOpenAiColored', 'ncLogoGeminiAiColored'],
          visible: canSeeMcp.value,
        },
        {
          tab: 'integrations',
          ev: 'integrations',
          icon: 'integration',
          testId: 'base-integrations',
          label: t('labels.baseNav.integrations'),
          keywords: 'credentials connection oauth api key slack gmail hubspot twilio google openai',
          logos: ['ncLogoSlackColored', 'ncLogoGmailColored', 'ncLogoHubspotColored', 'ncLogoTwilioColored'],
          visible: isIntegrationsMenuVisible.value,
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
      // The long tail of the nav, and the part a base owner visits least. Folded
      // by default so the eight rows above it are not buried under it.
      key: 'admin',
      label: t('labels.baseNav.groupAdmin'),
      collapsible: true,
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
          icon: 'ncHistory',
          testId: 'base-record-trash',
          label: t('labels.baseNav.trashRetention'),
          keywords: 'trash deleted records retention days recover restore',
          visible: canSeeTrashRetention.value,
        },
        {
          tab: 'snapshots',
          ev: 'snapshots',
          icon: 'ncLayers',
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
          icon: 'ncCode',
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
        testId: `base-${item.testId}`,
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

/** Remembered across bases and sessions: whether to fold is a habit, not a per-base fact. */
const openGroups = useStorage<Record<string, boolean>>('nc-base-settings-open-groups', {})

/**
 * A collapsible group still opens itself when it has to: while a search is
 * running, hiding a matching row would make the search look broken, and a
 * folded group holding the page you are on would leave the nav with nothing
 * marked active.
 */
function isGroupOpen(group: { key: string; collapsible?: boolean; items: { tab: string }[] }) {
  if (!group.collapsible) return true

  if (searchQuery.value.trim()) return true

  if (group.items.some((i) => i.tab === activeBaseSettingsTab.value)) return true

  return !!openGroups.value[group.key]
}

function toggleGroup(group: { key: string; collapsible?: boolean; items: { tab: string }[] }) {
  if (!group.collapsible) return

  $e('c:settings:base:group-toggle', { group: group.key, open: !isGroupOpen(group) })

  openGroups.value = { ...openGroups.value, [group.key]: !isGroupOpen(group) }
}

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
      <component
        :is="group.collapsible ? 'button' : 'div'"
        class="nc-settings-section-header"
        :class="{
          'nc-settings-section-header-group': group.key !== filteredGroups[0].key && !group.divider,
          'nc-settings-section-header-app': group.divider,
          'nc-settings-section-header-toggle': group.collapsible,
        }"
        :type="group.collapsible ? 'button' : undefined"
        :aria-expanded="group.collapsible ? isGroupOpen(group) : undefined"
        :data-testid="group.collapsible ? `nc-settings-group-${group.key}` : undefined"
        @click="toggleGroup(group)"
      >
        <span>{{ group.label }}</span>
        <GeneralIcon
          v-if="group.collapsible"
          icon="chevronDown"
          class="nc-settings-section-chevron"
          :class="{ '-rotate-90': !isGroupOpen(group) }"
        />
      </component>
      <NcSidebarMenuItem
        v-for="item in (isGroupOpen(group) ? group.items : [])"
        :key="item.tab"
        v-e="[`c:settings:base:${item.ev}`]"
        :icon="item.icon"
        :data-testid="item.testId"
        :active="activeBaseSettingsTab === item.tab"
        @click="navigateToBaseSettings(item.tab)"
      >
        {{ item.label }}
        <template v-if="item.info || item.logos" #extraRight>
          <div v-if="item.logos" class="nc-nav-logos">
            <span
              v-for="(logo, logoIdx) in item.logos"
              :key="logo"
              class="nc-nav-logo"
              :style="{ zIndex: item.logos.length - logoIdx }"
            >
              <GeneralIcon :icon="logo" />
            </span>
          </div>
          <NcTooltip v-if="item.info" :title="item.info" placement="right" :arrow="false" class="nc-nav-info">
            <GeneralIcon icon="ncInfo" class="nc-nav-info-icon flex-none" />
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
// The client marks sit at the row's right edge as an invitation to connect.
// Grey at rest so a row full of brand colour doesn't shout over its own label,
// then they bloom into colour when the row is hovered or open.
.nc-nav-logos {
  @apply flex items-center flex-none;
  filter: grayscale(1);
  opacity: 0.7;
  // 200ms matches NcSidebarMenuItem's own transition-all, so the marks bloom in
  // step with the row surface instead of arriving ahead of it.
  transition: filter 200ms ease, opacity 200ms ease;
}

// Each mark gets its own chip so the overlap reads as a stack — these logos are
// not circular, so overlapping the bare glyphs would crop them into each other.
//
// The chip is filled with the row's own surface rather than a fixed colour, so
// it carves the mark out of the row instead of sitting on it as a light block.
// That surface changes with the row's state, hence the variable.
.nc-sidebar-menu-item {
  --nc-nav-chip-surface: var(--color-sidebar-bg);

  &.active {
    --nc-nav-chip-surface: var(--color-brand-50);
  }

  // Same selector shape as NcSidebarMenuItem's own hover rule on purpose: there
  // `:hover:not(.disabled)` outranks `.active`, so a hovered selected row goes
  // grey. A plain `:hover` here ties with `.active` and loses to it, leaving
  // brand-tinted chips sitting on a grey row.
  &:hover:not(.disabled) {
    --nc-nav-chip-surface: var(--color-gray-200);
  }
}

[theme='dark'] .nc-sidebar-menu-item.active {
  --nc-nav-chip-surface: var(--color-gray-200);
}

// 22px chip around a 16px mark leaves 3px each side, and the overlap has to stay
// under that or the next chip's fill bites into the previous glyph — the brand
// marks' white backplate used to hide that, and no longer does. At -0.5 (2px)
// there is 1px of clearance and the group spans 62px against the 26px chip's 70.
.nc-nav-logo {
  @apply relative flex items-center justify-center h-[22px] w-[22px] rounded-full -ml-0.5;
  background: var(--nc-nav-chip-surface);
  // The row fades its own surface over 200ms (NcSidebarMenuItem's transition-all).
  // Without this the chip swapped colour on the first frame, so for the rest of
  // the fade it sat on the row as a visibly different disc.
  transition: background-color 200ms ease;

  &:first-child {
    @apply ml-0;
  }

  :deep(svg) {
    @apply h-4 w-4;
  }

  // Most brand marks ship an opaque white backplate (a full-canvas
  // `<rect rx="2" fill="white">`) which reads as a square tile inside the chip.
  :deep(svg > rect:first-child) {
    fill: transparent;
  }
}

.nc-sidebar-menu-item:hover .nc-nav-logos,
.nc-sidebar-menu-item.active .nc-nav-logos {
  filter: grayscale(0);
  opacity: 1;
}

// Always visible, but quiet enough to sit beside the brand marks without
// competing — disabled-grey at 12px, lifting slightly on hover.
:deep(.nc-nav-info) {
  // Pulls back against the row's own gap-2, so the hint sits close to the marks
  // it annotates rather than drifting toward the row edge.
  @apply -ml-1 transition-opacity duration-150 opacity-80;
}

.nc-sidebar-menu-item:hover :deep(.nc-nav-info) {
  @apply opacity-100;
}

// Nested inside :deep() on purpose: NcSidebarMenuItem sizes every descendant
// svg at 16px from its own scoped block, which outranks a bare class selector.
:deep(.nc-nav-info .nc-nav-info-icon) {
  @apply h-3 w-3 text-nc-content-gray-disabled;
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

// A foldable heading is a control, so it takes the whole row as its hit target
// and picks up the same hover the rows below it use.
.nc-settings-section-header-toggle {
  @apply w-full flex items-center justify-between gap-1 text-left cursor-pointer bg-transparent border-0;
  // Only the font family, which a <button> swaps for the UA's own. Every other
  // type property is left to the base class: `inherit` takes the parent's value
  // rather than this class's, which is how the heading first lost its uppercase
  // and then its 13px.
  font-family: inherit;

  &:hover {
    @apply text-nc-content-gray-subtle2;
  }
}

.nc-settings-section-chevron {
  @apply flex-none h-3.5 w-3.5 transition-transform duration-200;
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
