import type { Component } from 'vue'
import {
  BASE_INVITE_LINK_ROLES,
  InviteLinkScope,
  NcErrorType,
  OrderedProjectRoles,
  OrgUserRoles,
  ProjectRoles,
  RoleIcons,
  RoleLabels,
  ViewTypes,
  viewTypeAlias,
} from 'nocodb-sdk'
import type { PlanLimitExceededDetailsType, ProjectUserReqType, WorkspaceUserRoles } from 'nocodb-sdk'
import { DlgAirtableImport, DlgBaseDuplicate, DlgKeyboardShortcuts, DlgQuickImport, WorkspaceCreateProjectDlg } from '#components'
import { Language } from '#imports'
import { setI18nLanguage } from '~/plugins/a.i18n'
import type { CmdCommand } from '~/lib/types'
import type { CmdGlobalCommandsContext, CmdGlobalCommandsExt, CmdInviteScope } from '~/lib/cmdPaletteTypes'

/** Roles at or below the caller's own, as the invite dialogs offer them; `ordered` is strongest first. */
export function cmdRolesUpTo(offered: readonly string[], ordered: readonly string[], held?: Record<string, boolean> | null) {
  const own = Object.keys(held ?? {})
    .filter((role) => held?.[role])
    .map((role) => ordered.indexOf(role))
    .filter((index) => index >= 0)

  if (!own.length) return offered

  return offered.filter((role) => ordered.indexOf(role) >= Math.min(...own))
}

/** "create table invoices" / "new view Q3" → the kind word and the name; anything else is just a name. */
function parseCreateQuery(query: string): { name: string; kind?: string } {
  const match = query.match(
    /^(?:create|new|add)\s+(table|view|base|doc|document|page|dashboard|interface|workflow|script|agent|workspace)\s+(.+)$/i,
  )
  if (match) return { kind: match[1]!.toLowerCase(), name: match[2]!.trim() }
  return { name: query.replace(/^(?:create|new|add)\s+/i, '').trim() }
}

// `outline` icons keep the injected stroke; filled brand logos drop it.
const COMMUNITY_LINKS = [
  { id: 'forum', titleKey: 'title.forum', icon: 'ncDiscordForum', outline: true, url: 'https://community.nocodb.com/' },
  { id: 'discord', title: 'Discord', icon: 'ncDiscord', url: 'https://discord.gg/c7GEYrvFtT' },
  { id: 'youtube', titleKey: 'general.youtube', icon: 'ncYoutube', outline: true, url: 'https://www.youtube.com/@nocodb' },
  { id: 'twitter', title: 'X (Twitter)', icon: 'ncTwitter', url: 'https://twitter.com/NocoDB' },
  { id: 'reddit', title: 'Reddit', icon: 'ncReddit', url: 'https://www.reddit.com/r/NocoDB/' },
]

// The Help menu's API reference submenu (MiniSidebar/Help.vue).
const API_REFERENCE_LINKS = [
  { id: 'data-v3', titleKey: 'labels.dataApiV3', url: 'https://nocodb.com/apis/v3/data' },
  { id: 'meta-v3', titleKey: 'labels.metaApiV3', url: 'https://nocodb.com/apis/v3/meta' },
  { id: 'data-v2', titleKey: 'labels.dataApiV2', url: 'https://nocodb.com/apis/v2/data' },
  { id: 'meta-v2', titleKey: 'labels.metaApiV2', url: 'https://nocodb.com/apis/v2/meta' },
]

function withPriority(commands: CmdCommand[], priority: number) {
  return commands.map((command) => ({ priority, ...command }))
}

function openDialog(component: Component, props: Record<string, unknown> = {}) {
  const isOpen = ref(true)

  const { close } = useDialog(component, {
    ...props,
    'modelValue': isOpen,
    'onUpdate:modelValue': () => {
      isOpen.value = false
      close(300)
    },
  })
}

/**
 * Commands that exist on every screen, plus the base context. Mounted once by Cmd+K, which
 * gets the Tab → AI handoff back from it. `edition` builds the EE additions from this scope.
 */
export function useGlobalCommands(edition?: (ctx: CmdGlobalCommandsContext) => CmdGlobalCommandsExt) {
  const { t } = useI18n()

  const route = useRoute()

  const { signOut, lang: currentLang, isMobileMode, appInfo } = useGlobal()

  const { locale } = useI18n()

  const { navigationCommands, refreshCommandPalette } = useCommandPalette()

  const { setActiveCmdView, cmdK } = useCommand()

  const { selectedTheme, setTheme } = useTheme()

  const { isUIAllowed, environmentRestrictionReason, baseRoles, orgRoles } = useRoles()

  const { isCodeProject } = useCodeProjects()

  const { navGroups: baseSettingsGroups } = useBaseSettingsNav()

  const { copy } = useCopy()

  const openBaseSettings = useBaseSettingsLink()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { openedProject } = storeToRefs(useBases())

  const { $e, $api } = useNuxtApp()

  const tablesStore = useTablesStore()

  const { activeTable, activeTables } = storeToRefs(tablesStore)

  const viewsStore = useViewsStore()

  const { recentViews, allRecentViews, views, activeView } = storeToRefs(viewsStore)

  const {
    showRecordPlanLimitExceededModal,
    isPaymentEnabled,
    isOnPrem,
    showUserPlanLimitExceededModal,
    showOnPremLimitExceeded,
  } = useEeConfig()

  const basesStore = useBases()

  const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

  const { showShareModal } = storeToRefs(useShare())

  const inviteLinks = useInviteLinks()

  const cmdOrCtrlKey = isMac() ? 'Meta' : 'Ctrl'

  const sections = computed(() => ({
    recent: t('labels.commandPalette.sections.recent'),
    create: t('labels.commandPalette.sections.create'),
    goTo: t('labels.commandPalette.sections.goTo'),
    preferences: t('labels.commandPalette.sections.preferences'),
    settings: t('labels.commandPalette.sections.settings'),
    help: t('labels.commandPalette.sections.help'),
    account: t('labels.commandPalette.sections.account'),
    base: t('labels.commandPalette.sections.base'),
    workspace: t('labels.commandPalette.sections.workspace'),
    invite: t('labels.commandPalette.sections.invite'),
  }))

  /** Only set inside a base; `openedProject` falls back to the first base elsewhere. */
  const currentBase = computed(() => (route.params.baseId ? openedProject.value : undefined))

  const defaultSource = computed(() => currentBase.value?.sources?.[0])

  const ee: CmdGlobalCommandsExt = edition?.({ base: currentBase, sections, createView, inviteScopeCommands }) ?? {}

  const none = computed<CmdCommand[]>(() => [])

  // The user menu's Admin Panel link (EEMenuOption): super admins only, unless the edition says otherwise.
  const adminPanelPath = ee.adminPanelPath ?? computed(() => (orgRoles.value?.[OrgUserRoles.SUPER_ADMIN] ? '/admin' : undefined))

  const canCreateTable = computed(
    () => !!currentBase.value && !!defaultSource.value && isUIAllowed('tableCreate', { source: defaultSource.value }),
  )

  function createTable() {
    if (!currentBase.value?.id || !defaultSource.value?.id) return
    tablesStore.openTableCreateDialog({ baseId: currentBase.value.id, sourceId: defaultSource.value.id })
  }

  function createView(type: ViewTypes) {
    if (!activeTable.value?.id || !activeTable.value.base_id) return
    viewsStore.onOpenViewCreateModal({
      type,
      baseId: activeTable.value.base_id,
      tableId: activeTable.value.id,
      sourceId: activeTable.value.source_id,
    })
  }

  /** Mirrors the sidebar's Create view menu (TreeView/CreateViewBtn.vue), badges included. */
  function createViewOptions(): CmdCommand[] {
    const table = activeTable.value
    const source = currentBase.value?.sources?.find((s) => s.id === table?.source_id)
    const canCreateForm = !source?.is_data_readonly && table?.type !== 'view' && !table?.synced

    const option = (type: ViewTypes, extra: Partial<CmdCommand> = {}): CmdCommand => ({
      id: `view:create:${viewTypeAlias[type]}`,
      title: t(`objects.viewType.${viewTypeAlias[type]}`),
      icon: { type: 'view', viewType: type },
      run: () => createView(type),
      ...extra,
    })

    const options = [option(ViewTypes.GRID)]
    if (canCreateForm) options.push(option(ViewTypes.FORM))
    options.push(option(ViewTypes.GALLERY), option(ViewTypes.KANBAN), option(ViewTypes.CALENDAR))

    return [...options, ...(ee.viewCreateOptions?.(option, source?.type) ?? [])]
  }

  const createCommands = computed<CmdCommand[]>(() => {
    const commands: CmdCommand[] = []

    if (canCreateTable.value) {
      commands.push({
        id: 'table:create',
        title: t('labels.commandPalette.createTable'),
        section: sections.value.create,
        icon: { type: 'table' },
        keywords: ['new', 'add'],
        run: createTable,
      })
    }

    if (activeTable.value && isUIAllowed('viewCreateOrEdit')) {
      commands.push({
        id: 'view:create',
        title: t('labels.commandPalette.createView'),
        section: sections.value.create,
        icon: { type: 'view', viewType: ViewTypes.GRID },
        keywords: ['new', 'add'],
        searchChildren: true,
        children: createViewOptions,
      })
    }

    commands.push(...(ee.createCommands ?? none).value)

    if (isUIAllowed('baseCreate')) {
      commands.push({
        id: 'base:create',
        title: t('labels.commandPalette.createBase'),
        section: sections.value.create,
        icon: { type: 'base' },
        keywords: ['new', 'add', 'project'],
        run: () => openDialog(WorkspaceCreateProjectDlg, { workspaceId: activeWorkspaceId.value }),
      })
    }

    return commands
  })

  const goToCommands = computed<CmdCommand[]>(() => {
    const commands: CmdCommand[] = [...(ee.goToCommands ?? none).value]

    const bases = navigationCommands.value.filter((command) => command.id.startsWith('p-'))
    if (bases.length) {
      commands.push({
        id: 'base:go-to',
        title: t('labels.commandPalette.goToBase'),
        section: sections.value.goTo,
        icon: { type: 'base' },
        children: () => bases,
      })
    }

    if (currentBase.value && activeTables.value.length) {
      commands.push({
        id: 'table:go-to',
        title: t('labels.commandPalette.goToTable'),
        section: sections.value.goTo,
        icon: { type: 'table' },
        children: () =>
          activeTables.value.map((table) => ({
            id: `table:go-to:${table.id}`,
            title: table.title!,
            checked: table.id === activeTable.value?.id,
            icon: { type: 'table', icon: table.meta?.icon, synced: table.synced },
            run: () => tablesStore.openTable(table),
          })),
      })
    }

    if (activeTable.value && views.value.length > 1) {
      commands.push({
        id: 'view:go-to',
        title: t('labels.commandPalette.goToView'),
        section: sections.value.goTo,
        icon: { type: 'view', viewType: ViewTypes.GRID },
        children: () =>
          views.value.map((view) => ({
            id: `view:go-to:${view.id}`,
            title: view.title!,
            checked: view.id === activeView.value?.id,
            icon: { type: 'view', viewType: view.type, icon: view.meta?.icon },
            run: () =>
              viewsStore.navigateToView({ view, baseId: view.base_id!, tableId: view.fk_model_id!, doNotSwitchTab: true }),
          })),
      })
    }

    return commands
  })

  const recentCommands = computed<CmdCommand[]>(() =>
    recentViews.value
      .filter((recent) => recent.viewId !== activeView.value?.id)
      .slice(0, 5)
      .map((recent) => ({
        id: `recent:${recent.tableID}:${recent.viewId ?? ''}`,
        title: recent.viewName,
        hint: `${recent.baseName} / ${recent.tableName}`,
        section: sections.value.recent,
        icon: { type: 'view', viewType: recent.viewType },
        run: () => viewsStore.changeView({ viewId: recent.viewId ?? null, tableId: recent.tableID, baseId: recent.baseId }),
      })),
  )

  const preferenceCommands = computed<CmdCommand[]>(() => [
    {
      id: 'theme:change',
      title: t('labels.commandPalette.changeTheme'),
      section: sections.value.preferences,
      icon: { type: 'icon', name: 'ncMoon' },
      keywords: ['dark', 'light', 'mode', 'appearance'],
      searchChildren: true,
      children: () =>
        (
          [
            { value: 'system', title: t('general.system'), icon: 'ncMonitor' },
            { value: 'light', title: t('general.light'), icon: 'ncSun' },
            { value: 'dark', title: t('general.dark'), icon: 'ncMoon' },
          ] as const
        ).map((theme) => ({
          id: `theme:change:${theme.value}`,
          title: theme.title,
          icon: { type: 'icon', name: theme.icon },
          checked: selectedTheme.value === theme.value,
          run: () => setTheme(theme.value),
        })),
    },
    {
      id: 'sidebar:toggle',
      title: t('labels.commandPalette.toggleSidebar'),
      section: sections.value.preferences,
      icon: { type: 'icon', name: 'ncSidebar' },
      run: () => {
        isLeftSidebarOpen.value = !isLeftSidebarOpen.value
      },
    },
    {
      id: 'shortcuts:open',
      title: t('labels.commandPalette.keyboardShortcuts'),
      section: sections.value.preferences,
      icon: { type: 'icon', name: 'ncKeyboard' },
      run: () => openDialog(DlgKeyboardShortcuts),
    },
  ])

  const settingsCommands = computed<CmdCommand[]>(() => {
    const commands: CmdCommand[] = [
      {
        id: 'account:settings',
        title: t('labels.commandPalette.account.profile'),
        section: sections.value.settings,
        icon: { type: 'icon', name: 'ncUser' },
        keywords: ['account', 'settings', 'password', 'name'],
        run: () => navigateTo('/account/profile'),
      },
      {
        id: 'account:tokens',
        title: t('title.apiTokens'),
        section: sections.value.settings,
        icon: { type: 'icon', name: 'ncKey2' },
        keywords: ['api', 'token', 'key'],
        run: () => navigateTo('/account/tokens'),
      },
      {
        id: 'account:language',
        title: t('labels.commandPalette.account.changeLanguage'),
        section: sections.value.settings,
        icon: { type: 'icon', name: 'ncGlobe' },
        keywords: ['language', 'locale', 'translation'],
        searchChildren: true,
        // Same switch as the user menu's language list (general/language/Menu.vue).
        children: () =>
          (Object.entries(Language).sort() as [keyof typeof Language, string][]).map(([key, label]) => ({
            id: `account:language:${key}`,
            title: label,
            checked: key === locale.value,
            run: async () => {
              await setI18nLanguage(key)
              currentLang.value = key
            },
          })),
      },
    ]

    // The account sidebar's other pages, with its gates (pages/account/index.vue, EE overlay).
    commands.push({
      id: 'account:mcp',
      title: t('title.mcpServer'),
      section: sections.value.settings,
      icon: { type: 'icon', name: 'mcp' },
      keywords: ['account', 'model context protocol', 'ai'],
      run: () => navigateTo('/account/mcp'),
    })

    if (!isEeUI || (!appInfo.value.isCloud && !appInfo.value.disableEmailAuth)) {
      commands.push({
        id: 'account:password',
        title: t('title.resetPasswordMenu'),
        section: sections.value.settings,
        icon: { type: 'icon', name: 'ncLock' },
        keywords: ['account', 'change password'],
        run: () => navigateTo('/account/users/password-reset'),
      })
    }

    return [...commands, ...(ee.settingsCommands ?? none).value]
  })

  const helpCommands = computed<CmdCommand[]>(() => [
    {
      id: 'docs:search',
      title: t('labels.commandPalette.searchDocs'),
      section: sections.value.help,
      icon: { type: 'icon', name: 'ncFileSearch' },
      shortcut: [cmdOrCtrlKey, 'J'],
      run: () => setActiveCmdView('cmd-j'),
    },
    {
      id: 'recent:open',
      title: t('labels.commandPalette.recentViews'),
      section: sections.value.help,
      icon: { type: 'icon', name: 'ncClock' },
      shortcut: [cmdOrCtrlKey, 'L'],
      run: () => setActiveCmdView('cmd-l'),
    },
    {
      id: 'community:open',
      title: t('labels.commandPalette.community'),
      section: sections.value.help,
      icon: { type: 'icon', name: 'ncDiscord', class: 'stroke-transparent' },
      searchChildren: true,
      children: () =>
        COMMUNITY_LINKS.map((link) => ({
          id: `community:open:${link.id}`,
          title: link.titleKey ? t(link.titleKey) : link.title!,
          // Filled brand logos: drop the stroke Nuxt injects into every SVG.
          icon: { type: 'icon', name: link.icon, class: link.outline ? undefined : 'stroke-transparent' },
          run: () => navigateTo(link.url, { external: true, open: navigateToBlankTargetOpenOption }),
        })),
    },
    {
      id: 'help:docs',
      title: t('labels.documentation'),
      section: sections.value.help,
      icon: { type: 'icon', name: 'file' },
      keywords: ['help', 'guide', 'manual'],
      run: () => navigateTo('https://nocodb.com/docs/product-docs', { external: true, open: navigateToBlankTargetOpenOption }),
    },
    {
      id: 'help:apis',
      title: t('labels.commandPalette.apiReference'),
      section: sections.value.help,
      icon: { type: 'icon', name: 'ncCode' },
      keywords: ['api', 'rest', 'swagger', 'developer'],
      searchChildren: true,
      children: () =>
        API_REFERENCE_LINKS.map((link) => ({
          id: `help:apis:${link.id}`,
          title: t(link.titleKey),
          run: () => navigateTo(link.url, { external: true, open: navigateToBlankTargetOpenOption }),
        })),
    },
    ...(ee.helpCommands ?? none).value,
    ...(!isMobileMode.value
      ? [
          {
            id: 'help:changelog',
            title: t('general.changelog'),
            section: sections.value.help,
            icon: { type: 'icon', name: 'ncList' },
            keywords: ['whats new', 'release notes', 'updates'],
            run: () => navigateTo('https://nocodb.com/changelog', { external: true, open: navigateToBlankTargetOpenOption }),
          } satisfies CmdCommand,
        ]
      : []),
    {
      id: 'page:copy-link',
      title: t('labels.commandPalette.copyPageLink'),
      section: sections.value.help,
      icon: { type: 'icon', name: 'ncLink' },
      // Screens with an object have their own "Copy … link"; this covers the rest when searched.
      searchOnly: true,
      feedback: t('labels.commandPalette.copied'),
      run: () => copy(window.location.href),
    },
    ...(adminPanelPath.value
      ? [
          {
            id: 'account:admin-panel',
            title: t('labels.adminPanel'),
            section: sections.value.account,
            icon: { type: 'icon', name: 'controlPanel' },
            keywords: ['admin', 'instance', 'organisation', 'organization', 'users', 'license'],
            run: () => {
              ncBackRoute().set(route.fullPath)
              return navigateTo(adminPanelPath.value ?? '/admin')
            },
          } satisfies CmdCommand,
        ]
      : []),
    {
      id: 'account:logout',
      title: t('general.logout'),
      section: sections.value.account,
      icon: { type: 'icon', name: 'ncLogOut' },
      run: async () => {
        await signOut()
        window.location.reload()
      },
    },
  ])

  function roleRow(scope: CmdInviteScope, role: string, prefix: string) {
    return {
      id: `${prefix}:${role}`,
      title: scope.roleLabels?.[role] ?? t(`objects.roleType.${RoleLabels[role as keyof typeof RoleLabels]}`),
      hint: t(`objects.roleDescription.${role}`),
      icon: { type: 'icon' as const, name: RoleIcons[role as keyof typeof RoleIcons] },
    }
  }

  /** "Invite to X" (role → emails) and "Copy invite link" (role → link) for one scope. */
  function inviteScopeCommands(scope: CmdInviteScope): CmdCommand[] {
    // A seat/plan limit opens the upgrade modal the invite dialog shows; other errors stay inline.
    async function withPlanLimit(role: string, action: () => Promise<unknown>) {
      try {
        await action()
      } catch (e: unknown) {
        const errorInfo = await extractSdkResponseErrorMsgv2(e)
        if (errorInfo.error !== NcErrorType.ERR_PLAN_LIMIT_EXCEEDED || (!isPaymentEnabled.value && !isOnPrem.value)) throw e

        cmdK.value = false
        const details = errorInfo.details as PlanLimitExceededDetailsType
        if (isPaymentEnabled.value) {
          showUserPlanLimitExceededModal({
            details,
            role: role as WorkspaceUserRoles | ProjectRoles,
            workspaceId: scope.id === 'workspace' ? activeWorkspaceId.value : undefined,
          })
        } else {
          showOnPremLimitExceeded(details, 'invite-seat-limit')
        }
      }
    }

    const common = {
      section: sections.value.invite,
      priority: scope.priority,
      searchOnly: scope.searchOnly,
      hint: scope.kind,
    }

    const commands: CmdCommand[] = []

    if (scope.send && scope.roles.length) {
      commands.push({
        ...common,
        id: `${scope.id}:invite`,
        title: t('labels.commandPalette.invite.to', { name: scope.name }),
        icon: { type: 'icon', name: 'ncUserPlus' },
        keywords: ['invite', 'add', 'member', 'user', 'email', 'people', scope.id],
        children: () =>
          scope.roles.map((role) => ({
            ...roleRow(scope, role, `${scope.id}:invite`),
            feedback: t('labels.commandPalette.invite.sent'),
            edit: {
              value: '',
              placeholder: t('labels.commandPalette.invite.placeholder'),
              validate: (value: string) => {
                const emails = value.split(/[\s,;]+/).filter(Boolean)
                if (!emails.length) return t('labels.commandPalette.invite.invalidEmail')
                const invalid = emails.find((email) => !validateEmail(email))
                return invalid ? t('labels.commandPalette.invite.invalidEmailNamed', { email: invalid }) : undefined
              },
              submit: (value: string) => withPlanLimit(role, () => scope.send!(value.split(/[\s,;]+/).filter(Boolean), role)),
            },
          })),
      })
    }

    const target = scope.link
    if (target && scope.linkRoles?.length) {
      commands.push({
        ...common,
        id: `${scope.id}:invite-link`,
        title: t('labels.commandPalette.invite.copyLink', { name: scope.name }),
        icon: { type: 'icon', name: 'ncLink' },
        keywords: ['invite', 'link', 'share', 'join', 'url', scope.id],
        children: () =>
          scope.linkRoles!.map((role) => ({
            ...roleRow(scope, role, `${scope.id}:invite-link`),
            feedback: t('labels.commandPalette.invite.linkCopied'),
            run: () =>
              withPlanLimit(role, async () => {
                await inviteLinks.load(target)

                // Reuse a working link for this role, as the share hub does; mint one otherwise.
                let link = inviteLinks.links.value.find((l) => l.usable !== false && inviteLinks.linkGrant(l) === role)

                if (!link) {
                  link = (await inviteLinks.createLink(inviteLinks.grantBody(role), { toast: false, rethrow: true })) ?? undefined
                  if (!link) throw new Error(inviteLinks.error.value)

                  if (scope.id === 'workspace') $e('a:ws:invite:link:create', { scope: target.scope, role })
                  else if (scope.id === 'interface') $e('a:interface:invite:link:create', { scope: target.scope, role })
                  else $e('a:base:invite:link:create', { scope: target.scope, role })
                }

                await copy(inviteLinks.linkUrl(link))
              }),
          })),
      })
    }

    return commands
  }

  /** The innermost open scope leads (an interface's, from EE); the base invite follows. */
  const inviteCommands = computed<CmdCommand[]>(() => {
    const base = currentBase.value
    const scoped = ee.inviteCommands?.value ?? { interface: [], workspace: [] }
    const commands: CmdCommand[] = [...scoped.interface]

    if (base?.id) {
      const offered = BASE_INVITE_LINK_ROLES.filter((role) => isEeUI || role !== ProjectRoles.APP_USER)
      const roles = cmdRolesUpTo(offered, OrderedProjectRoles, baseRoles.value)

      commands.push(
        ...inviteScopeCommands({
          id: 'base',
          name: base.title ?? '',
          kind: sections.value.base,
          priority: scoped.interface.length ? CMD_PRIORITY.normal : CMD_PRIORITY.high,
          roles: isUIAllowed('userInvite') ? roles.filter((role) => role !== ProjectRoles.APP_USER) : [],
          send: async (emails, role) => {
            await $api.auth.baseUserAdd(base.id!, { email: emails.join(','), roles: role as ProjectUserReqType['roles'] })
          },
          link: isUIAllowed('baseInviteLinkCreate') ? { scope: InviteLinkScope.BASE, baseId: base.id } : undefined,
          linkRoles: roles,
        }),
      )
    }

    return [...commands, ...scoped.workspace]
  })

  useCommandProvider('global', 'global', () => ({
    commands: [
      ...inviteCommands.value,
      ...withPriority(recentCommands.value, CMD_PRIORITY.primary),
      ...withPriority(createCommands.value, CMD_PRIORITY.high),
      ...withPriority((ee.globalCommands ?? none).value, CMD_PRIORITY.normal),
      ...goToCommands.value,
      ...withPriority(preferenceCommands.value, CMD_PRIORITY.low),
      ...withPriority((ee.workspaceCommands ?? none).value, CMD_PRIORITY.normal),
      ...withPriority(settingsCommands.value, CMD_PRIORITY.low),
      ...withPriority(helpCommands.value, CMD_PRIORITY.low),
      ...navigationCommands.value,
      ...(ee.navigationCommands ?? none).value,
    ],
    fallbacks: (query) => {
      // A typed answer isn't also a name for a new table or a docs search.
      const answers = ee.queryFallbacks?.(query) ?? []
      return answers.length ? answers : [...namedCreateCommands(query), ...docsFallback(query)]
    },
  }))

  function docsFallback(query: string): CmdCommand[] {
    return [
      {
        id: 'docs:search-for',
        title: t('labels.commandPalette.searchDocsFor', { query }),
        section: sections.value.help,
        icon: { type: 'icon', name: 'ncFileSearch' },
        run: () => setActiveCmdView('cmd-j'),
      },
    ]
  }

  /** "Invoices" → Create table “Invoices”, … — only for openers that take an initial name. */
  function namedCreateCommands(query: string): CmdCommand[] {
    const { name, kind } = parseCreateQuery(query)
    if (!name) return []

    const commands: CmdCommand[] = []

    if ((!kind || kind === 'table') && canCreateTable.value) {
      commands.push({
        id: 'table:create-named',
        title: t('labels.commandPalette.create.tableNamed', { name }),
        section: sections.value.create,
        icon: { type: 'table' },
        run: () =>
          tablesStore.openTableCreateDialog({ baseId: currentBase.value!.id, sourceId: defaultSource.value!.id, title: name }),
      })
    }

    const table = activeTable.value
    if ((!kind || kind === 'view') && table?.id && table.base_id && isUIAllowed('viewCreateOrEdit')) {
      commands.push({
        id: 'view:create-named',
        title: t('labels.commandPalette.create.viewNamed', { name }),
        section: sections.value.create,
        icon: { type: 'view', viewType: ViewTypes.GRID },
        run: () =>
          viewsStore.onOpenViewCreateModal({
            type: ViewTypes.GRID,
            title: name,
            baseId: table.base_id!,
            tableId: table.id!,
            sourceId: table.source_id,
          }),
      })
    }

    if ((!kind || kind === 'base') && isUIAllowed('baseCreate')) {
      commands.push({
        id: 'base:create-named',
        title: t('labels.commandPalette.create.baseNamed', { name }),
        section: sections.value.create,
        icon: { type: 'base' },
        run: () => openDialog(WorkspaceCreateProjectDlg, { workspaceId: activeWorkspaceId.value, title: name }),
      })
    }

    return [...commands, ...(ee.namedCreateCommands?.(name, kind) ?? [])]
  }

  useCommandProvider('base', 'base', () => {
    const base = currentBase.value
    if (!base?.id) return { commands: [] }

    const commands: CmdCommand[] = []

    // A copy shows production's title (the server overlays it), so a rename there would be discarded.
    if (isUIAllowed('baseRename') && !base.is_lane_instance) {
      commands.push({
        id: 'base:rename',
        title: t('labels.commandPalette.renameBase'),
        section: sections.value.base,
        icon: { type: 'icon', name: 'rename' },
        edit: {
          value: base.title ?? '',
          validate: (value) => (value ? undefined : t('labels.commandPalette.renameTitleRequired')),
          submit: async (title) => {
            try {
              await basesStore.updateProject(base.id!, { title })
              allRecentViews.value = allRecentViews.value.map((recent) =>
                recent.baseId === base.id ? { ...recent, baseName: title } : recent,
              )
              $e('a:base:rename')
            } finally {
              refreshCommandPalette()
            }
          },
        },
      })
    }

    commands.push({
      id: 'base:copy-link',
      title: t('labels.commandPalette.copyBaseLink'),
      section: sections.value.base,
      icon: { type: 'icon', name: 'ncLink' },
      feedback: t('labels.commandPalette.copied'),
      run: () => copy(`${window.location.origin}/${base.fk_workspace_id ?? activeWorkspaceId.value}/${base.id}`),
    })

    // The settings rail's rows, with the rail's own gates (useBaseSettingsNav).
    const settingsRows = baseSettingsGroups.value.flatMap((group) =>
      group.items.map((item) => ({ ...item, groupLabel: group.label })),
    )

    if (settingsRows.length) {
      commands.push({
        id: 'base:settings',
        title: t('labels.commandPalette.base.settingsMenu'),
        section: sections.value.base,
        icon: { type: 'icon', name: 'settings' },
        keywords: ['configure', 'preferences'],
        searchChildren: true,
        children: () =>
          settingsRows.map((item) => ({
            id: `base:settings:${item.slug}`,
            title: item.title,
            hint: item.groupLabel || undefined,
            icon: { type: 'icon', name: item.icon },
            keywords: item.keywords?.split(' '),
            run: () => openBaseSettings(item.slug, { baseId: base.id }),
          })),
      })
    }

    // A code project holds a repository: nothing to import, duplicate or share as data.
    const hasData = !isCodeProject(base)
    const source = base.sources?.[0]
    const restrictionArgs = { base, source }

    // Mirrors the base menu's "Import data" submenu (TreeView/BaseOptions.vue).
    if (hasData && source && (source.enabled || (base.sources?.length ?? 0) > 1)) {
      const importOptions = (
        [
          { permission: 'airtableImport', type: 'airtable', title: t('labels.airtableBase'), icon: 'airtable' },
          { permission: 'csvImport', type: 'csv', title: t('labels.csvFile'), icon: 'ncFileTypeCsvSmall' },
          { permission: 'jsonImport', type: 'json', title: t('labels.jsonFile'), icon: 'ncFileTypeJson' },
          { permission: 'excelImport', type: 'excel', title: t('labels.microsoftExcel'), icon: 'ncFileTypeExcel' },
        ] as const
      ).filter(
        ({ permission }) =>
          isUIAllowed(permission, restrictionArgs) && !environmentRestrictionReason(permission, restrictionArgs),
      )

      if (importOptions.length) {
        commands.push({
          id: 'base:import',
          priority: CMD_PRIORITY.high,
          title: t('labels.commandPalette.base.importData'),
          section: sections.value.base,
          icon: { type: 'icon', name: 'ncDownload' },
          keywords: ['upload', 'airtable', 'csv', 'excel', 'json'],
          searchChildren: true,
          children: () =>
            importOptions.map((option) => ({
              id: `base:import:${option.type}`,
              title: option.title,
              icon: { type: 'icon', name: option.icon, class: 'stroke-transparent' },
              run: () => {
                if (showRecordPlanLimitExceededModal({ triggerSource: 'command-palette-import' })) return
                if (option.type === 'airtable') {
                  openDialog(DlgAirtableImport, { baseId: base.id, sourceId: source.id })
                } else {
                  openDialog(DlgQuickImport, { importType: option.type, baseId: base.id, sourceId: source.id })
                }
              },
            })),
        })
      }
    }

    commands.push(...(ee.baseCommands ?? none).value)

    if (
      hasData &&
      isUIAllowed('baseDuplicate', restrictionArgs) &&
      !environmentRestrictionReason('baseDuplicate', restrictionArgs)
    ) {
      commands.push({
        id: 'base:duplicate',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.base.duplicate'),
        section: sections.value.base,
        icon: { type: 'icon', name: 'duplicate' },
        keywords: ['copy', 'clone'],
        run: () => {
          if (showRecordPlanLimitExceededModal()) return
          openDialog(DlgBaseDuplicate, { base })
        },
      })
    }

    if (isUIAllowed('newUser')) {
      commands.push({
        id: 'base:members',
        priority: CMD_PRIORITY.high,
        title: t('labels.commandPalette.baseCollaborators'),
        section: sections.value.base,
        icon: { type: 'icon', name: 'users' },
        run: () => openBaseSettings('collaborator', { baseId: base.id }),
      })
    }

    if (isUIAllowed('baseShare')) {
      commands.push({
        id: 'base:share',
        priority: CMD_PRIORITY.high,
        title: t('labels.commandPalette.shareBase'),
        section: sections.value.base,
        icon: { type: 'icon', name: 'ncShare' },
        run: () => {
          showShareModal.value = true
        },
      })
    }

    commands.push({
      id: 'base:copy-id',
      priority: CMD_PRIORITY.low,
      title: t('labels.commandPalette.copyBaseId'),
      section: sections.value.base,
      icon: { type: 'icon', name: 'ncCopy' },
      feedback: t('labels.commandPalette.copied'),
      run: () => copy(base.id!),
    })

    return {
      context: { label: base.title!, icon: { type: 'base', color: parseProp(base.meta).iconColor } },
      commands,
    }
  })

  return {
    isAiAvailable: ee.isAiAvailable ?? computed(() => false),
    askAi: ee.askAi ?? ((_query: string) => {}),
    aiFallback: ee.aiFallback ?? ((_query: string): CmdCommand | undefined => undefined),
  }
}
