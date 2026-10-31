import { userLocalStorageInfoManager } from '#imports'
import type { RecentItem } from '~/lib/types'
import type { CmdUsage } from '~/utils/commandPaletteUtils'

const MAX_RECENT_ITEMS = 50

const MAX_USAGE_ENTRIES = 200

export const useCommand = createSharedComposable(() => {
  // Command palette states
  const cmdK = ref(false)
  const cmdL = ref(false)
  const cmdJ = ref(false)

  /** What Cmd+K's "Search docs for …" hands Cmd+J to search; Cmd+J takes it once on open. */
  const docsQuery = ref('')

  // Command palette refs
  const commandPalette = ref()

  const { user } = useGlobal()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  /** Recently opened non-view objects for Cmd+L; persisted per user and workspace like recent views. */
  const recentItems = ref<RecentItem[]>([])

  watch(
    () => [user.value?.id, activeWorkspaceId.value] as const,
    ([userId, workspaceId], prev) => {
      // Signed out, or someone else signed in: clear before loading, so only this user's list merges.
      if (!userId || (prev && prev[0] !== userId)) recentItems.value = []
      if (!userId || !workspaceId) return
      const saved: RecentItem[] = userLocalStorageInfoManager.get(userId, workspaceId, 'recentItems') ?? []
      const seen = new Set(recentItems.value.map((item) => `${item.kind}:${item.id}`))
      recentItems.value = [...recentItems.value, ...saved.filter((item) => !seen.has(`${item.kind}:${item.id}`))]
    },
    { immediate: true },
  )

  watch(
    recentItems,
    (items) => {
      const userId = user.value?.id
      const workspaceId = activeWorkspaceId.value
      if (!userId || !workspaceId) return
      userLocalStorageInfoManager.set(
        userId,
        workspaceId,
        'recentItems',
        items.filter((item) => item.workspaceId === workspaceId).slice(0, 20),
      )
    },
    { deep: true },
  )

  /** Cmd+K command runs, per user and workspace. */
  const commandUsage = ref<CmdUsage>({})

  watch(
    () => [user.value?.id, activeWorkspaceId.value] as const,
    ([userId, workspaceId]) => {
      if (!userId || !workspaceId) return
      commandUsage.value = userLocalStorageInfoManager.get(userId, workspaceId, 'commandUsage') ?? {}
    },
    { immediate: true },
  )

  /**
   * Set the active command view
   */
  const setActiveCmdView = (cmd: CommandPaletteType) => {
    if (cmd === 'cmd-k') {
      cmdK.value = true
      cmdL.value = false
      cmdJ.value = false
    } else if (cmd === 'cmd-l') {
      cmdL.value = true
      cmdK.value = false
      cmdJ.value = false
    } else if (cmd === 'cmd-j') {
      cmdK.value = false
      cmdL.value = false
      cmdJ.value = true
    } else {
      cmdL.value = false
      cmdK.value = false
      cmdJ.value = false
    }
  }

  /**
   * Open command palette (Cmd+K)
   */
  const openCommandPalette = () => {
    commandPalette.value?.open?.()
  }

  /**
   * Close command palette
   */
  const closeCommandPalette = () => {
    commandPalette.value?.close?.()
  }

  function recordRecentItem(item: Omit<RecentItem, 'viewedAt'>) {
    recentItems.value = [
      { ...item, viewedAt: new Date().toISOString() },
      ...recentItems.value.filter((existing) => existing.kind !== item.kind || existing.id !== item.id),
    ].slice(0, MAX_RECENT_ITEMS)
  }

  function recordCommandUse(id: string) {
    const now = Date.now()
    const next: CmdUsage = {
      ...commandUsage.value,
      [id]: { count: (commandUsage.value[id]?.count ?? 0) + 1, lastUsed: now },
    }
    const ids = Object.keys(next)
    // Over the cap, the least-used (by decayed count) go first.
    commandUsage.value =
      ids.length > MAX_USAGE_ENTRIES
        ? Object.fromEntries(
            ids
              .sort((a, b) => getCmdFrecency(next, b, now) - getCmdFrecency(next, a, now))
              .slice(0, MAX_USAGE_ENTRIES)
              .map((key) => [key, next[key]!]),
          )
        : next

    const userId = user.value?.id
    const workspaceId = activeWorkspaceId.value
    if (userId && workspaceId) userLocalStorageInfoManager.set(userId, workspaceId, 'commandUsage', commandUsage.value)
  }

  return {
    // State
    cmdK,
    cmdL,
    cmdJ,
    commandPalette,
    recentItems,
    docsQuery,
    commandUsage,

    // Methods
    setActiveCmdView,
    openCommandPalette,
    closeCommandPalette,
    recordRecentItem,
    recordCommandUse,
  }
})
