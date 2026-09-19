import { ProjectRoles } from 'nocodb-sdk'

export interface MockInviteLink {
  id: string
  role: ProjectRoles
  anyEmail: boolean
  domain: string
}

/**
 * MOCK. There is no shareable join link in the backend.
 *
 * `invite_token` is minted per invited email, expires in 24h and is consumed at
 * signup — it is a magic link for one named person, not a join link. Nothing
 * here talks to the server: the list lives in memory and dies on reload, and the
 * URL it renders resolves to nothing.
 *
 * Before this reaches users the invite-link screens must either be backed by a
 * real token endpoint (table, create/revoke, public join route, expiry, scope)
 * or be removed. Tracked in `.claude/branches/invite-ux/plan.md`.
 */
// createGlobalState, not createSharedComposable: the hub unmounts this screen
// every time it pushes into compose/links/edit, and a shared composable disposes
// with its last consumer — which reset the list mid-flow.
export const useInviteLinks = createGlobalState(() => {
  const newId = () => Math.random().toString(36).slice(2, 8)

  const links = ref<MockInviteLink[]>([{ id: newId(), role: ProjectRoles.EDITOR, anyEmail: true, domain: '' }])

  const linkUrl = (link: MockInviteLink) => `${window.location.origin}/invite/${link.id}`

  function createLink() {
    const link: MockInviteLink = { id: newId(), role: ProjectRoles.EDITOR, anyEmail: true, domain: '' }
    links.value.push(link)

    return links.value.length - 1
  }

  function saveLink(index: number, patch: Partial<MockInviteLink>) {
    if (!links.value[index]) return

    links.value[index] = { ...links.value[index], ...patch }
  }

  function deleteLink(index: number) {
    // The hub always shows one link, so the last one cannot be removed.
    if (links.value.length <= 1) return

    links.value.splice(index, 1)
  }

  return { links, linkUrl, createLink, saveLink, deleteLink }
})
