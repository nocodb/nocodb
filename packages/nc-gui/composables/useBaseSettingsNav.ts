import { BaseVersion, PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk'
import type { ShellRailGroup } from '~/components/shell/Rail.vue'

/** Manage, Create, Interfaces and the app's own settings. */
const CODE_PROJECT_HIDDEN_GROUPS = ['data', 'create', 'interfaces', 'app']

/** Admin rows with nothing to act on in a code project. */
const CODE_PROJECT_HIDDEN_SLUGS = [
  'workflows',
  'record-trash',
  'snapshots',
  'variables',
  'data-display',
  'migrate-to-v3',
  'migrate',
]

export interface BaseSettingsPaneMeta {
  /** The header band's title. Often longer than the rail label ("Members" → "Base Members"). */
  title: string
  description?: string
  docsHref?: string
}

/**
 * The base settings nav, as data.
 *
 * One source for the rail's rows, the header band's copy and the guard that
 * bounces a deep link to a pane this role or plan cannot reach. Those three used
 * to live in separate files — the sidebar menu owned the rows, the settings page
 * owned the panes — and had drifted apart on which gate each applied.
 */
export function useBaseSettingsNav() {
  const { t } = useI18n()

  const { isUIAllowed, environmentRestrictionReason, baseRoles } = useRoles()

  const { isMobileMode } = useGlobal()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const { isSharedBase, base, listingManagedAppId } = storeToRefs(useBase())

  const { apps, isAppsEnabled } = storeToRefs(useAppStore())

  const { isCodeProject } = useCodeProjects()

  const {
    isWsAuditEnabled,
    isEEFeatureBlocked,
    showEEFeatures,
    hideInterfaces,
    blockWorkflows,
    blockSync,
    blockBaseVariables,
    blockTrashSettings,
    getLimit,
    getFeature,
  } = useEeConfig()

  // Snapshots is limit-gated rather than feature-gated: a plan that grants none
  // gets the upgrade card in place of the pane. A plan that grants some but has
  // them all used is a different case — the pane stays, and creating one prompts.
  const blockSnapshotsPane = computed(() => getLimit(PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE) === 0)

  // ── App section ──────────────────────────────────────────────────────────

  const baseApp = computed(() => (base.value?.id ? apps.value.get(base.value.id) : undefined))

  // An install locks `appCreateOrEdit` — the app definition is the publisher's —
  // but its owner still has to address, staff and connect their own instance.
  const isAppInstall = computed(() => !!base.value?.managed_app_id && !base.value?.managed_app_master)

  // Resolved through Production when standing in a lane: a listing locks
  // Production, so the lane is where the publisher works and the lane's own row
  // carries neither `managed_app_id` nor `managed_app_master`.
  const isAppListing = computed(() => !!listingManagedAppId.value)

  // Publishing opens a lane, and an open lane restricts `appCreateOrEdit` on
  // Production — so without the restriction check this section disappears from
  // exactly the bases that have a store page.
  const isAppSectionVisible = computed(
    () =>
      isAppsEnabled.value &&
      (!!baseApp.value || isAppListing.value) &&
      !isMobileMode.value &&
      (isUIAllowed('appCreateOrEdit') ||
        !!environmentRestrictionReason('appCreateOrEdit') ||
        (isAppInstall.value && isUIAllowed('baseMiscSettings'))),
  )

  const appItems = computed(() =>
    isAppSectionVisible.value
      ? appSettingsNavFor(
          isAppInstall.value && !isUIAllowed('appCreateOrEdit'),
          isAppListing.value,
          !!baseApp.value,
          isFeatureEnabled(FEATURE_FLAG.MANAGED_APPS),
        )
      : [],
  )

  // ── Per-pane gates ───────────────────────────────────────────────────────

  // Scoped to the base's own roles, not `allRoles`: a workspace role must not
  // satisfy a base-level gate here. `ee/lib/acl.ts` grants the viewer catalog on
  // the base roles precisely because these two surfaces ask this way, so a bare
  // check would let a workspace owner with no standing on a private base in.
  const canSeeMembers = computed(() => isUIAllowed('newUser', { roles: baseRoles.value }) && !isSharedBase.value)

  const canSeeInterfaceMembers = computed(
    () =>
      isEeUI &&
      showEEFeatures.value &&
      !hideInterfaces.value &&
      isUIAllowed('interfaceUsersMatrix', { roles: baseRoles.value }) &&
      !!base.value?.id,
  )

  const canSeePermissions = computed(() => isEeUI && showEEFeatures.value && isUIAllowed('sourceCreate') && !!base.value?.id)

  const canSeeDataSources = computed(() => isUIAllowed('sourceCreate') && !!base.value?.id && !isMobileMode.value)

  const canSeeSyncs = computed(() => isEeUI && showEEFeatures.value && isUIAllowed('sourceCreate') && !isMobileMode.value)

  const canSeeIntegrations = computed(() => {
    if (isMobileMode.value || !base.value?.id) return false

    // Managers (sourceCreate) get the full surface; viewers get the linked
    // connections list, where per-user integrations offer their connect action.
    const skipBaseCheck = !!base.value?.is_lane_instance

    return isUIAllowed('sourceCreate', { skipBaseCheck }) || isUIAllowed('baseIntegrationList', { skipBaseCheck })
  })

  const canSeeApiTokens = computed(() => !isEEFeatureBlocked.value && isUIAllowed('manageBaseApiTokens') && !isMobileMode.value)

  const canSeeMcp = computed(() => isUIAllowed('manageMCP') && !!base.value?.id && !isMobileMode.value)

  const canSeeAutomations = computed(
    () =>
      isEeUI &&
      !blockWorkflows.value &&
      showEEFeatures.value &&
      isUIAllowed('workflowCreateOrEdit') &&
      isFeatureEnabled(FEATURE_FLAG.WORKFLOWS_TAB) &&
      !isMobileMode.value,
  )

  const canSeeAuditLog = computed(
    () => isEeUI && showEEFeatures.value && isWsAuditEnabled.value && isUIAllowed('baseAuditList') && !isMobileMode.value,
  )

  const canSeeTrashRetention = computed(
    () => isEeUI && showEEFeatures.value && isUIAllowed('baseTrashSettingsList') && !isMobileMode.value,
  )

  const canSeeSnapshots = computed(
    () =>
      isEeUI && showEEFeatures.value && isUIAllowed('baseMiscSettings') && isUIAllowed('manageSnapshot') && !isMobileMode.value,
  )

  const canSeeSkills = computed(() => isEeUI && showEEFeatures.value && isUIAllowed('baseSkillList') && !isMobileMode.value)

  const canSeeVariables = computed(() => isEeUI && showEEFeatures.value && isUIAllowed('baseVariableList') && !isMobileMode.value)

  // The rows that replaced the General pane. Each was a tab of its inner nav and
  // keeps that tab's gate.
  const canSeeGeneral = computed(() => !isSharedBase.value && !isMobileMode.value)

  const canSeeBaseType = computed(() => canSeeGeneral.value && isEeUI && showEEFeatures.value && isUIAllowed('manageBaseType'))

  const canSeeDataDisplay = computed(() => canSeeGeneral.value && isUIAllowed('baseMiscSettings'))

  const canSeeMigrateToV3 = computed(
    () =>
      canSeeGeneral.value &&
      isFeatureEnabled(FEATURE_FLAG.BASES_V3) &&
      base.value?.version === BaseVersion.V2 &&
      isUIAllowed('baseMiscSettings'),
  )

  // Granted per deal rather than sold by plan, so it hides instead of badging.
  const canSeeMigrate = computed(
    () =>
      canSeeGeneral.value &&
      isUIAllowed('baseMiscSettings') &&
      isUIAllowed('migrateBase') &&
      !!getFeature(PlanFeatureTypes.FEATURE_MIGRATE_BASE_EXPORT),
  )

  // ── The nav ──────────────────────────────────────────────────────────────
  //
  // No `feature` on any row: the rail does not advertise what the plan withholds.
  // A reader scanning their own settings should not meet a row of lock badges —
  // the pane says what is locked, once, when they ask for it. (The table Tools
  // rail does badge its rows; that is its own shipped call, not a default.)

  const navGroups = computed<ShellRailGroup[]>(() => {
    const groups: ShellRailGroup[] = [
      {
        key: 'invite',
        label: t('labels.baseNav.groupInvite'),
        items: [
          canSeeMembers.value && {
            slug: 'collaborator',
            ev: 'add-user',
            icon: 'ncUserPlus',
            testId: 'base-collaborator',
            title: t('labels.baseNav.members'),
            keywords: 'invite people users collaborators teams roles base access',
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
      {
        key: 'data',
        label: t('labels.baseNav.groupData'),
        items: [
          canSeePermissions.value && {
            slug: 'permissions',
            ev: 'permissions',
            icon: 'ncLock',
            testId: 'base-permissions',
            title: t('labels.baseNav.dataPermissionsNav'),
            keywords: 'permission table field column document docs visibility restrict lock access',
          },
          canSeeDataSources.value && {
            slug: 'data-source',
            ev: 'add-data-source',
            icon: 'ncDatabase',
            testId: 'base-data-source',
            title: t('labels.baseNav.databases'),
            keywords: 'data source database postgres mysql sqlite snowflake sql server external connection schema',
            info: t('labels.baseNav.databasesInfo'),
            logos: ['postgreSql', 'mysql', 'mssqlServer'],
          },
          canSeeSyncs.value && {
            slug: 'syncs',
            ev: 'syncs',
            icon: 'ncZap',
            testId: 'base-syncs',
            title: t('labels.baseNav.sync'),
            keywords: 'sync import pull schedule one-way external app hubspot jira zendesk',
            info: t('labels.baseNav.syncInfo'),
            logos: ['ncLogoHubspotColored', 'ncLogoJiraColored', 'ncLogoZendeskColored'],
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
      {
        key: 'create',
        label: t('labels.baseNav.groupCreate'),
        items: [
          canSeeApiTokens.value && {
            slug: 'api-tokens',
            ev: 'api-tokens',
            icon: 'ncKey',
            testId: 'base-api-tokens',
            title: t('labels.baseNav.apiTokens'),
            keywords: 'api token key secret rest automation external app',
          },
          canSeeMcp.value && {
            slug: 'mcp',
            ev: 'mcp',
            icon: 'mcp',
            testId: 'base-mcp',
            title: t('labels.baseNav.mcpServer'),
            keywords: 'mcp agent ai token endpoint claude',
            logos: ['ncLogoClaudeColored', 'ncLogoOpenAiColored', 'ncLogoGeminiAiColored'],
          },
          canSeeIntegrations.value && {
            slug: 'integrations',
            ev: 'integrations',
            icon: 'integration',
            testId: 'base-integrations',
            title: t('labels.baseNav.integrations'),
            keywords: 'credentials connection oauth api key slack gmail hubspot twilio google openai',
            logos: ['ncLogoSlackColored', 'ncLogoGmailColored', 'ncLogoHubspotColored', 'ncLogoTwilioColored'],
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
      {
        key: 'interfaces',
        label: t('labels.baseNav.groupInterfaces'),
        items: [
          canSeeInterfaceMembers.value && {
            slug: 'interface-members',
            ev: 'interface-members',
            icon: 'ncUsers',
            testId: 'base-interface-members',
            title: t('labels.baseNav.interfaceMembers'),
            keywords: 'invite interface app users members roles access',
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
      {
        // The long tail of the nav, and the part a base owner visits least. Folded
        // by default so the rows above it are not buried under it.
        key: 'admin',
        label: t('labels.baseNav.groupAdmin'),
        collapsible: true,
        items: [
          canSeeAutomations.value && {
            slug: 'workflows',
            ev: 'workflows',
            icon: 'ncAutomation',
            testId: 'base-workflows',
            title: t('labels.baseNav.automations'),
            keywords: 'workflow trigger action script run automation',
          },
          canSeeAuditLog.value && {
            slug: 'audits',
            ev: 'audits',
            icon: 'audit',
            testId: 'base-audit',
            title: t('labels.baseNav.auditLog'),
            keywords: 'audit history activity log who changed',
          },
          canSeeTrashRetention.value && {
            slug: 'record-trash',
            ev: 'record-trash',
            icon: 'ncHistory',
            testId: 'base-record-trash',
            title: t('labels.baseNav.trashRetention'),
            keywords: 'trash deleted records retention days recover restore',
          },
          canSeeSnapshots.value && {
            slug: 'snapshots',
            ev: 'snapshots',
            icon: 'ncLayers',
            testId: 'base-snapshots',
            title: t('labels.baseNav.snapshots'),
            keywords: 'snapshot backup restore point in time',
          },
          canSeeSkills.value && {
            slug: 'skills',
            ev: 'skills',
            icon: 'ncScript',
            testId: 'base-skills',
            title: t('labels.baseNav.aiSkills'),
            keywords: 'ai skill prompt assistant',
          },
          canSeeVariables.value && {
            slug: 'variables',
            ev: 'variables',
            icon: 'ncCode',
            testId: 'base-variables',
            title: t('labels.baseNav.variables'),
            keywords: 'variable environment secret value master inherited',
          },
          canSeeBaseType.value && {
            slug: 'base-type',
            ev: 'base-type',
            icon: 'ncBaseOutline',
            testId: 'base-access-tab',
            title: t('general.baseType'),
            keywords: 'general base type private public default access',
          },
          canSeeDataDisplay.value && {
            slug: 'data-display',
            ev: 'data-display',
            icon: 'ncEye',
            testId: 'visibility-tab',
            title: t('labels.dataDisplay'),
            keywords: 'general visibility data display null m2m junction empty filter app first',
          },
          canSeeMigrateToV3.value && {
            slug: 'migrate-to-v3',
            ev: 'migrate-to-v3',
            icon: 'ncArrowUpCircle',
            testId: 'migrate-to-v3-tab',
            title: t('labels.migrateToV3'),
            keywords: 'general migrate upgrade v3 version api',
          },
          canSeeMigrate.value && {
            slug: 'migrate',
            ev: 'migrate',
            icon: 'ncUpload',
            testId: 'migrate-tab',
            title: t('labels.baseNav.migrateToCloud'),
            keywords: 'general migrate move export cloud',
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
    ]

    if (appItems.value.length) {
      groups.push({
        key: 'app',
        label: t('labels.appSettings'),
        divider: true,
        items: appItems.value.map((item) => ({
          slug: item.tab,
          ev: item.tab,
          icon: item.icon,
          testId: `base-${item.testId}`,
          title: t(item.label),
          keywords: 'app',
        })),
      })
    }

    // A code project holds a repository, not data: there is nothing in it to
    // manage, build on, restore, display or migrate.
    const shown = isCodeProject(base.value)
      ? groups
          .filter((group) => !CODE_PROJECT_HIDDEN_GROUPS.includes(group.key))
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => !CODE_PROJECT_HIDDEN_SLUGS.includes(item.slug)),
          }))
      : groups

    return shown.filter((g) => g.items.length)
  })

  /** Every reachable slug, flattened — the deep-link guard's allow-list. */
  const availableTabs = computed(() => new Set(navGroups.value.flatMap((g) => g.items.map((i) => i.slug))))

  /** Where an unreachable deep link lands: the first row the reader actually has. */
  const firstAvailableTab = computed(() => navGroups.value[0]?.items[0]?.slug ?? 'collaborator')

  /**
   * Header-band copy. The title is often longer than the rail label, which has
   * the group heading above it to lean on — "Members" under INVITE reads as
   * "Base Members" once it is alone at the top of a pane.
   */
  const paneMeta = computed<Record<string, BaseSettingsPaneMeta>>(() => {
    const meta: Record<string, BaseSettingsPaneMeta> = {
      'collaborator': {
        title: t('labels.baseNav.membersPage'),
        description: t('labels.baseNav.desc.members'),
        docsHref: 'https://nocodb.com/docs/product-docs/roles-and-permissions',
      },
      'permissions': {
        title: t('labels.baseNav.dataPermissionsNav'),
        description: t('labels.baseNav.desc.permissions'),
        docsHref: 'https://nocodb.com/docs/product-docs/roles-and-permissions/table-permissions',
      },
      'data-source': {
        title: t('labels.baseNav.databases'),
        description: t('labels.baseNav.databasesInfo'),
        docsHref: 'https://nocodb.com/docs/product-docs/data-sources/connect-to-data-source',
      },
      'syncs': {
        title: t('labels.baseNav.sync'),
        description: t('labels.baseNav.syncInfo'),
        docsHref: 'https://nocodb.com/docs/product-docs/noco-sync',
      },
      'api-tokens': {
        title: t('labels.baseNav.apiTokens'),
        description: t('labels.baseNav.desc.apiTokens'),
        docsHref: 'https://nocodb.com/docs/product-docs/account-settings/api-tokens#create-api-token',
      },
      'mcp': {
        title: t('labels.baseNav.mcpServer'),
        description: t('labels.baseNav.desc.mcp'),
      },
      'integrations': {
        title: t('labels.baseNav.integrations'),
        description: t('labels.baseNav.desc.integrations'),
        docsHref: 'https://nocodb.com/docs/product-docs/integrations',
      },
      'interface-members': {
        title: t('labels.baseNav.interfaceMembersPage'),
        description: t('labels.baseNav.desc.interfaceMembers'),
      },
      'workflows': {
        title: t('labels.baseNav.automations'),
        description: t('labels.baseNav.desc.automations'),
      },
      'audits': {
        title: t('labels.baseNav.auditLog'),
        description: t('labels.baseNav.desc.auditLog'),
      },
      'record-trash': {
        title: t('labels.baseNav.trashRetention'),
        description: t('labels.baseNav.desc.trashRetention'),
        docsHref: 'https://nocodb.com/docs/product-docs/bases/trash-settings',
      },
      'snapshots': {
        title: t('labels.baseNav.snapshots'),
        description: t('labels.baseNav.desc.snapshots'),
      },
      'skills': {
        title: t('labels.baseNav.aiSkills'),
        description: t('labels.baseNav.desc.aiSkills'),
      },
      'variables': {
        title: t('labels.baseNav.variables'),
        description: t('labels.baseNav.desc.variables'),
      },
      'base-type': {
        title: t('general.baseType'),
        description: t('title.baseTypeTabSubtext'),
        docsHref: 'https://nocodb.com/docs/product-docs/bases/private-base',
      },
      'data-display': {
        title: t('labels.dataDisplay'),
        description: t('labels.visibilityConfigLabel'),
      },
      'migrate-to-v3': {
        title: t('labels.migrateToV3'),
        description: t('labels.baseNav.desc.migrateToV3'),
      },
      'migrate': {
        title: t('labels.baseNav.migrateToCloud'),
        description: t('labels.baseNav.desc.migrateToCloud'),
        docsHref: 'https://nocodb.com/docs/product/account-settings/cloud-enterprise-edition/oss-to-enterprise-migration',
      },
    }

    // App panes share one title — "App Settings · Theme" — so the band says which
    // app is being configured, not just which pane.
    for (const item of appSettingsNav) {
      meta[item.tab] = { title: `${t('labels.appSettings')} · ${t(item.label)}` }
    }

    return meta
  })

  return {
    navGroups,
    paneMeta,
    availableTabs,
    firstAvailableTab,
    blockSync,
    blockBaseVariables,
    blockTrashSettings,
    blockSnapshotsPane,
    appItems,
  }
}
