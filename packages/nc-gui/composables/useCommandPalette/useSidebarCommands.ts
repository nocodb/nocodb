import type { CmdCommand } from '~/lib/types'

interface SidebarNavItem {
  key: string
  icon: string
  label: string
  disabled?: boolean
  active?: boolean
  onClick?: () => void
}

/**
 * Cmd+K for the mini sidebar (rail or dock): its sections (same items, gates and clicks), the logo's
 * workspace home, and the notifications dropdown. `isBookmarksFlyoutOpen` is for the EE bookmarks entry.
 */
export function useSidebarCommands(deps: {
  key: string
  items: Ref<SidebarNavItem[]>
  isItemActive: (item: SidebarNavItem) => boolean
  isNotificationOpen: Ref<boolean>
  isBookmarksFlyoutOpen: Ref<boolean>
}) {
  const { t } = useI18n()

  const route = useRoute()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const notificationStore = useNotification()

  const { unreadCount } = toRefs(notificationStore)

  // Opens the dropdown directly; deferred so the palette has closed first.
  useCommandProvider(`notifications:${deps.key}`, 'global', () => ({
    commands: [
      {
        id: 'workspace:notifications',
        title: t('labels.commandPalette.workspace.notifications'),
        section: t('labels.commandPalette.sections.workspace'),
        icon: { type: 'icon', name: 'ncBell' },
        keywords: ['inbox', 'mentions', 'unread', 'activity', 'notification', 'settings'],
        run: () => setTimeout(() => (deps.isNotificationOpen.value = true), 0),
      },
      // The dropdown's "Mark all as read"; its store call throws on failure instead of toasting.
      ...(unreadCount.value
        ? [
            {
              id: 'workspace:notifications:mark-all-read',
              title: t('activity.markAllAsRead'),
              section: t('labels.commandPalette.sections.workspace'),
              icon: { type: 'icon' as const, name: 'ncCheckCircle' },
              keywords: ['notifications', 'inbox', 'clear'],
              feedback: t('labels.commandPalette.markedAsRead'),
              run: () => notificationStore.markAllAsRead({}),
            },
          ]
        : []),
    ],
  }))

  useCommandProvider(`sections:${deps.key}`, 'global', () => {
    const section = t('labels.commandPalette.sections.goTo')
    const keywords = ['go', 'section', 'sidebar', 'switch']

    const commands: CmdCommand[] = deps.items.value
      .filter((item) => !item.disabled)
      .map((item) => ({
        id: `section:${item.key}`,
        title: t('labels.commandPalette.goToSection', { section: item.label }),
        section,
        icon: { type: 'icon', name: item.icon },
        keywords,
        checked: deps.isItemActive(item),
        run: () => item.onClick?.(),
      }))

    // The logo: back to the workspace home. A code project's rail has its own "Home" (the factory).
    if (activeWorkspaceId.value) {
      const railHasHome = deps.items.value.some((item) => item.key === 'home')
      commands.unshift({
        id: 'section:workspace-home',
        title: t('labels.commandPalette.goToSection', { section: railHasHome ? t('objects.workspace') : t('general.home') }),
        section,
        icon: { type: 'icon', name: 'ncHome' },
        keywords: [...keywords, 'workspace'],
        checked: !route.params.baseId,
        run: () => navigateTo(`/${activeWorkspaceId.value}`),
      })
    }

    return { commands }
  })
}
