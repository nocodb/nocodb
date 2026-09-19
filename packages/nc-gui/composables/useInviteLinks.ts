import type { InviteLinkReqType, InviteLinkType } from 'nocodb-sdk'
import { InviteLinkScope, ProjectRoles, WorkspaceUserRoles, inviteLinkRolesFor } from 'nocodb-sdk'

export interface InviteLinkTarget {
  scope: InviteLinkScope
  baseId?: string
  workspaceId?: string
}

const basePath = (t: InviteLinkTarget) =>
  t.scope === InviteLinkScope.WORKSPACE
    ? `/api/v1/workspaces/${t.workspaceId}/invite-links`
    : `/api/v2/meta/bases/${t.baseId}/invite-links`

const sameTarget = (a: InviteLinkTarget | null, b: InviteLinkTarget) =>
  !!a && a.scope === b.scope && a.baseId === b.baseId && a.workspaceId === b.workspaceId

// createGlobalState, not createSharedComposable: the hub unmounts this screen
// every time it pushes into compose/links/edit, and a shared composable disposes
// with its last consumer — which reset the list mid-flow.
export const useInviteLinks = createGlobalState(() => {
  const { $api } = useNuxtApp()

  const { user } = useGlobal()

  const links = ref<InviteLinkType[]>([])

  const target = ref<InviteLinkTarget | null>(null)

  const isLoading = ref(false)

  const isLoaded = ref(false)

  const error = ref('')

  /** Owner is never handed out by a link; it is granted to a named person. */
  const allowedRoles = computed(() => [...inviteLinkRolesFor(target.value?.scope ?? InviteLinkScope.BASE)])

  const defaultRole = computed(() =>
    target.value?.scope === InviteLinkScope.WORKSPACE ? WorkspaceUserRoles.EDITOR : ProjectRoles.EDITOR,
  )

  /**
   * A new link starts restricted to the creator's own domain, which is almost
   * always who they mean. A consumer address tells us nothing about who they
   * work with, so those start open instead.
   */
  const defaultEmailDomain = computed(() => inviteLinkDefaultDomain(user.value?.email))

  /**
   * The join URL carries the raw token, so it only ever comes from a response
   * to someone allowed to manage links. A link fetched without one cannot be
   * copied, which is the correct failure.
   */
  function linkUrl(link: InviteLinkType) {
    if (!link?.token) return ''

    return `${window.location.origin}/invite/${link.token}`
  }

  async function request<T>(fn: () => Promise<T>): Promise<T | null> {
    error.value = ''

    try {
      return await fn()
    } catch (e: any) {
      error.value = await extractSdkResponseErrorMsg(e)
      message.error(error.value)

      return null
    }
  }

  async function load(next: InviteLinkTarget, force = false) {
    if (!force && isLoaded.value && sameTarget(target.value, next)) return

    if (next.scope === InviteLinkScope.WORKSPACE ? !next.workspaceId : !next.baseId) return

    // Switching target must not leave the previous target's links on screen.
    if (!sameTarget(target.value, next)) {
      links.value = []
      isLoaded.value = false
    }

    target.value = next
    isLoading.value = true

    const res = await request(() => $api.instance.get(basePath(next)))

    links.value = res?.data?.list ?? []
    isLoaded.value = true
    isLoading.value = false
  }

  async function createLink(body?: Partial<InviteLinkReqType>) {
    if (!target.value) return null

    const res = await request(() =>
      $api.instance.post(basePath(target.value!), {
        role: defaultRole.value,
        email_domain: defaultEmailDomain.value,
        ...body,
      } as InviteLinkReqType),
    )

    if (!res?.data) return null

    links.value = [...links.value, res.data]

    return res.data as InviteLinkType
  }

  async function saveLink(id: string, patch: Partial<InviteLinkReqType>) {
    if (!target.value || !id) return null

    const res = await request(() => $api.instance.patch(`${basePath(target.value!)}/${id}`, patch))

    if (!res?.data) return null

    // The response omits the token, so keep the one already held or the row
    // loses its copyable URL.
    links.value = links.value.map((l) => (l.id === id ? { ...l, ...res.data, token: res.data.token ?? l.token } : l))

    return res.data as InviteLinkType
  }

  async function deleteLink(id: string) {
    if (!target.value || !id) return false

    const res = await request(() => $api.instance.delete(`${basePath(target.value!)}/${id}`))

    if (!res) return false

    links.value = links.value.filter((l) => l.id !== id)

    return true
  }

  return {
    links,
    target,
    isLoading,
    isLoaded,
    error,
    allowedRoles,
    defaultRole,
    defaultEmailDomain,
    linkUrl,
    load,
    createLink,
    saveLink,
    deleteLink,
  }
})
