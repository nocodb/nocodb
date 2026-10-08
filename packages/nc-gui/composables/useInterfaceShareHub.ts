import type { InviteLinkTarget } from './useInviteLinks'

/** CE stub: interfaces are EE-only, so the share modal never opens over one. */
export function useInterfaceShareHub() {
  return {
    isActive: computed(() => false),
    title: computed<string | undefined>(() => undefined),
    canInvite: computed(() => false),
    canInviteByEmail: computed(() => false),
    canCreateLink: computed(() => false),
    canManageMembers: computed(() => false),
    isBlocked: computed(() => false),
    linkTarget: computed<InviteLinkTarget | null>(() => null),
    inviteRoles: computed<string[]>(() => []),
    members: ref<{ email: string }[]>([]),
    showUpgrade: () => {},
    loadMemberCount: async (): Promise<number | null> => null,
    inviteByEmail: async (_emails: string[], _role: string) => {},
    openManageMembers: async (_opts?: { pages?: boolean }) => {},
  }
}
