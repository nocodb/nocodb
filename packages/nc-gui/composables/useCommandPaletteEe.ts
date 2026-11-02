import { type BaseType, OrgUserRoles } from 'nocodb-sdk'
import type { CmdCommand } from '~/lib/types'

/** Cmd+K's EE parts (EE creates, sync, doc/interface search, Tab → AI, Cmd+L recording). CE has none. */
export function useCommandPaletteEe(_options: {
  base: Ref<BaseType | undefined>
  createSection: Ref<string>
  baseSection: Ref<string>
}) {
  const { orgRoles } = useRoles()

  return {
    // The user menu's Admin Panel link (EEMenuOption): super admins only.
    adminPanelPath: computed(() => (orgRoles.value?.[OrgUserRoles.SUPER_ADMIN] ? '/admin' : undefined)),
    createCommands: computed<CmdCommand[]>(() => []),
    baseCommands: computed<CmdCommand[]>(() => []),
    globalCommands: computed<CmdCommand[]>(() => []),
    namedCreateCommands: (_name: string, _kind?: string): CmdCommand[] => [],
    navigationCommands: computed<CmdCommand[]>(() => []),
    isAiAvailable: computed(() => false),
    askAi: (_query: string) => {},
    aiFallback: (_query: string): CmdCommand | undefined => undefined,
  }
}
