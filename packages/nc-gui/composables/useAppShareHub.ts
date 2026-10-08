import type { InviteLinkTarget, InviteLinkTeam } from './useInviteLinks'

/** CE stub: apps are EE-only, so the share modal never opens over one. */
export function useAppShareHub() {
  return {
    isActive: computed(() => false),
    title: computed<string | undefined>(() => undefined),
    canInvite: computed(() => false),
    canInviteByEmail: computed(() => false),
    canCreateLink: computed(() => false),
    canManageMembers: computed(() => false),
    canSharePublic: computed(() => false),
    linkTarget: computed<InviteLinkTarget | null>(() => null),
    teams: computed<InviteLinkTeam[]>(() => []),
    members: ref<{ email: string }[]>([]),
    load: async () => {},
    loadMemberCount: async (): Promise<number | null> => null,
    inviteByEmail: async (_emails: string[], _teamId: string) => {},
    openManageMembers: async () => {},
  }
}
