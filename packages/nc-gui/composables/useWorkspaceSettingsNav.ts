import type { ShellRailGroup } from '~/components/shell/Rail.vue'

export interface WsSettingsPaneMeta {
  title: string
  description?: string
  docsHref?: string
}

/**
 * The workspace settings nav, as data — one source for the rail's rows, the
 * header band's copy and the deep-link allow-list, like `useBaseSettingsNav`.
 *
 * Visibility comes from `useWorkspaceTabVisibility`, which the org admin panel
 * reads too, so the two surfaces cannot drift on who sees what.
 */
export function useWorkspaceSettingsNav() {
  const { t } = useI18n()

  const { isUIAllowed } = useRoles()

  const { activeWorkspace } = storeToRefs(useWorkspace())

  const { showEEFeatures, isWsAuditEnabled, blockWorkspaceSso, blockTeamsManagement } = useEeConfig()

  const { wsTabVisibility } = useWorkspaceTabVisibility(activeWorkspace)

  // The General page's sections, each keeping the gate it had there.
  const canSeeGeneral = computed(() => wsTabVisibility.value.settings)

  const canSeeSkills = computed(() => canSeeGeneral.value && showEEFeatures.value)

  const canSeeSecurity = computed(() => canSeeGeneral.value && showEEFeatures.value && isUIAllowed('workspaceManage'))

  const navGroups = computed<ShellRailGroup[]>(() => {
    const v = wsTabVisibility.value

    const groups: ShellRailGroup[] = [
      {
        key: 'people',
        label: t('labels.wsNav.groupPeople'),
        items: [
          v.collaborators && {
            slug: 'members',
            icon: 'ncUserPlus',
            testId: 'ws-members',
            title: t('labels.members'),
            keywords: 'invite people users collaborators roles workspace access',
          },
          v.teams && {
            slug: 'teams',
            icon: 'ncBuilding',
            testId: 'ws-teams',
            title: t('general.teams'),
            keywords: 'team group members roles',
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
      {
        key: 'connect',
        label: t('labels.wsNav.groupConnect'),
        items: [
          v.integrations && {
            slug: 'integrations',
            icon: 'integration',
            testId: 'ws-integrations',
            title: t('general.integrations'),
            keywords: 'credentials connection oauth api key environment slack gmail hubspot openai',
            logos: ['ncLogoSlackColored', 'ncLogoGmailColored', 'ncLogoHubspotColored', 'ncLogoTwilioColored'],
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
      {
        key: 'billing',
        label: t('labels.wsNav.groupBilling'),
        items: [
          v.billing && {
            slug: 'billing',
            icon: 'ncDollarSign',
            testId: 'ws-billing',
            title: t('general.billing'),
            keywords: 'plan subscription invoice payment upgrade credits seats',
          },
          v.usage && {
            slug: 'usage',
            icon: 'ncBarChart2',
            testId: 'ws-usage',
            title: t('general.usage'),
            keywords: 'limits plan records storage',
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
      {
        // Everything about the workspace itself, in one group: its identity and
        // AI defaults first, then oversight, then the irreversible actions last.
        key: 'admin',
        label: t('labels.wsNav.groupAdmin'),
        items: [
          canSeeGeneral.value && {
            slug: 'general',
            icon: 'ncSettings',
            testId: 'ws-general',
            title: t('general.general'),
            keywords: 'appearance name rename icon image logo',
          },
          canSeeSkills.value && {
            slug: 'skills',
            icon: 'ncScript',
            testId: 'ws-skills',
            title: t('labels.aiSkills'),
            keywords: 'ai skill prompt assistant',
          },
          canSeeSecurity.value && {
            slug: 'security',
            icon: 'ncShield',
            testId: 'ws-security',
            title: t('labels.enableTwoFactor'),
            keywords: 'security two factor 2fa mfa force authentication',
          },
          v.audits && {
            slug: 'audits',
            icon: 'audit',
            testId: 'ws-audits',
            title: t('title.audits'),
            keywords: 'audit history activity log who changed',
          },
          v.sso && {
            slug: 'sso',
            icon: 'sso',
            testId: 'ws-sso',
            title: t('title.sso'),
            keywords: 'sso saml oidc single sign on login identity provider',
          },
          canSeeGeneral.value && {
            slug: 'danger-zone',
            icon: 'ncAlertTriangle',
            testId: 'ws-danger-zone',
            title: t('labels.dangerZone'),
            keywords: 'delete leave workspace',
          },
        ].filter(Boolean) as ShellRailGroup['items'],
      },
    ]

    return groups.filter((g) => g.items.length)
  })

  const availableTabs = computed(() => new Set(navGroups.value.flatMap((g) => g.items.map((i) => i.slug as WsSettingsSlug))))

  const firstAvailableTab = computed(() => (navGroups.value[0]?.items[0]?.slug as WsSettingsSlug | undefined) ?? null)

  const paneMeta = computed<Record<WsSettingsSlug, WsSettingsPaneMeta>>(() => ({
    'members': {
      title: t('labels.wsNav.membersPage'),
      description: t('labels.wsNav.desc.members'),
      docsHref: 'https://nocodb.com/docs/product-docs/collaboration/workspace-collaboration',
    },
    'teams': {
      title: t('general.teams'),
      description: t('labels.wsNav.desc.teams'),
      docsHref: 'https://nocodb.com/docs/product-docs/collaboration/teams',
    },
    'integrations': {
      title: t('general.integrations'),
      description: t('labels.wsNav.desc.integrations'),
      docsHref: 'https://nocodb.com/docs/product-docs/integrations',
    },
    'general': {
      title: t('general.general'),
      description: t('labels.wsNav.desc.general'),
    },
    'skills': {
      title: t('labels.aiSkills'),
      description: t('labels.wsNav.desc.skills'),
    },
    'security': {
      title: t('labels.enableTwoFactor'),
      description: t('labels.wsNav.desc.security'),
    },
    'danger-zone': {
      title: t('labels.dangerZone'),
      description: t('labels.wsNav.desc.dangerZone'),
    },
    'billing': {
      title: t('general.billing'),
      description: t('labels.wsNav.desc.billing'),
      docsHref: 'https://nocodb.com/docs/product-docs/workspaces/billing',
    },
    'usage': {
      title: t('general.usage'),
      description: t('labels.wsNav.desc.usage'),
    },
    'audits': {
      title: t('title.audits'),
      description: t('labels.wsNav.desc.audits'),
    },
    'sso': {
      title: t('title.sso'),
      description: t('labels.wsNav.desc.sso'),
      docsHref: 'https://nocodb.com/docs/product-docs/account-settings/authentication#single-sign-on-sso',
    },
  }))

  return {
    navGroups,
    paneMeta,
    availableTabs,
    firstAvailableTab,
    isWsAuditEnabled,
    blockWorkspaceSso,
    blockTeamsManagement,
  }
}
