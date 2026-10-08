import type { InviteLinkReqType, InviteLinkType, RoleLabels } from 'nocodb-sdk'
import {
  InviteLinkScope,
  OrderedProjectRoles,
  OrderedWorkspaceRoles,
  ProjectRoles,
  WorkspaceUserRoles,
  inviteLinkRolesFor,
} from 'nocodb-sdk'
import { getI18n } from '~/plugins/a.i18n'

export interface InviteLinkTarget {
  scope: InviteLinkScope
  baseId?: string
  /** Also required for an interface target: its ops are routed by workspace. */
  workspaceId?: string
  interfaceId?: string
  /**
   * Interface targets only: the caller's role in the links' base-role
   * vocabulary (`owner` for builders). Base and workspace read `useRoles`.
   */
  callerRole?: string | null
}

const basePath = (t: InviteLinkTarget) =>
  t.scope === InviteLinkScope.WORKSPACE
    ? `/api/v1/workspaces/${t.workspaceId}/invite-links`
    : `/api/v2/meta/bases/${t.baseId}/invite-links`

const sameTarget = (a: InviteLinkTarget | null, b: InviteLinkTarget) =>
  !!a &&
  a.scope === b.scope &&
  a.baseId === b.baseId &&
  a.workspaceId === b.workspaceId &&
  a.interfaceId === b.interfaceId &&
  a.callerRole === b.callerRole

/** Role names that differ by scope: an interface calls viewer "Read only", as its members page does. */
export function inviteLinkRoleLabels(scope?: InviteLinkScope | null): Partial<Record<string, string>> | undefined {
  if (scope !== InviteLinkScope.INTERFACE) return undefined

  const { t } = getI18n().global

  return { [ProjectRoles.VIEWER]: t('labels.readOnlyAccess') }
}

const isTargetComplete = (t: InviteLinkTarget) => {
  switch (t.scope) {
    case InviteLinkScope.WORKSPACE:
      return !!t.workspaceId
    case InviteLinkScope.INTERFACE:
      return !!(t.workspaceId && t.baseId && t.interfaceId)
    default:
      return !!t.baseId
  }
}

// createGlobalState, not createSharedComposable: the hub unmounts this screen
// every time it pushes into compose/links/edit, and a shared composable disposes
// with its last consumer — which reset the list mid-flow.
export const useInviteLinks = createGlobalState(() => {
  const { $api } = useNuxtApp()

  const { internalGet } = useInternalBatch()

  const { user } = useGlobal()

  const { baseRoles, workspaceRoles } = useRoles()

  const links = ref<InviteLinkType[]>([])

  const target = ref<InviteLinkTarget | null>(null)

  const isLoading = ref(false)

  const isLoaded = ref(false)

  const error = ref('')

  const scope = computed(() => target.value?.scope ?? InviteLinkScope.BASE)

  const isWorkspaceScope = computed(() => scope.value === InviteLinkScope.WORKSPACE)

  const isInterfaceScope = computed(() => scope.value === InviteLinkScope.INTERFACE)

  const roleLabels = computed(() => inviteLinkRoleLabels(scope.value))

  /** Weakest first, so a higher index is more power. */
  const orderedRoles = computed(() => [...(isWorkspaceScope.value ? OrderedWorkspaceRoles : OrderedProjectRoles)].reverse())

  /** The highest-ranked role the user actually holds in this scope; -1 when none is known. */
  const power = computed(() => {
    const callerRole = target.value?.callerRole

    const held = isInterfaceScope.value
      ? callerRole
        ? { [callerRole]: true }
        : null
      : isWorkspaceScope.value
      ? workspaceRoles.value
      : baseRoles.value

    return Math.max(-1, ...Object.keys(held || {}).map((r) => (held?.[r] ? orderedRoles.value.indexOf(r as never) : -1)))
  })

  /**
   * Owner is never handed out by a link. Beyond that, nobody is offered a role
   * above their own: the server refuses it anyway (assertRolePower), so listing
   * it would only be a button that fails.
   */
  const allowedRoles = computed(() => {
    const offered = [...inviteLinkRolesFor(scope.value)]

    if (power.value < 0) return offered

    return offered.filter((r) => orderedRoles.value.indexOf(r as never) <= power.value)
  })

  /**
   * Shown greyed out rather than hidden, the way the members dialog does it, so
   * the picker reads the same everywhere and the tooltip can say why. Owner
   * first, then the link roles above the caller's own, strongest first.
   */
  const disabledRoles = computed(() => {
    const owner = isWorkspaceScope.value ? WorkspaceUserRoles.OWNER : ProjectRoles.OWNER
    const above = inviteLinkRolesFor(scope.value).filter((r) => !allowedRoles.value.includes(r))

    // An interface has no owner to withhold.
    return (isInterfaceScope.value ? above : [owner, ...above]) as (keyof typeof RoleLabels)[]
  })

  const disabledRolesTooltip = computed(() => {
    const { t } = getI18n().global
    const owner = isWorkspaceScope.value ? WorkspaceUserRoles.OWNER : ProjectRoles.OWNER

    return Object.fromEntries(
      disabledRoles.value.map((r) => [
        r,
        r === owner ? t('tooltip.inviteLinkCannotGrantOwner') : t('tooltip.inviteLinkRoleAboveYours'),
      ]),
    ) as Record<keyof typeof RoleLabels, string>
  })

  /**
   * Editor is the sensible default and also the floor, but a workspace-scope
   * viewer who defaults to Editor gets a 403 from `assertRolePower` on the one
   * button the hub shows them. Fall back to the strongest role they may mint.
   */
  const defaultRole = computed(() => {
    const preferred = target.value?.scope === InviteLinkScope.WORKSPACE ? WorkspaceUserRoles.EDITOR : ProjectRoles.EDITOR

    const allowed = allowedRoles.value

    return allowed.includes(preferred as never) ? preferred : allowed[0] ?? preferred
  })

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

  /**
   * `error` always holds the last failure. The toast is for callers with
   * nowhere to put it -- a screen that can show the message beside the field
   * that caused it passes `toast: false` and renders `error` itself.
   */
  async function request<T>(fn: () => Promise<T>, { toast = true } = {}): Promise<T | null> {
    error.value = ''

    try {
      return await fn()
    } catch (e: any) {
      error.value = await extractSdkResponseErrorMsg(e)

      if (toast) message.error(error.value)

      return null
    }
  }

  /** Interface links ride the internal API, so an interface member with no base role can reach them. */
  async function interfaceGet(t: InviteLinkTarget) {
    return {
      data: await internalGet(t.workspaceId!, t.baseId!, {
        operation: 'interfaceInviteLinkList',
        interfaceId: t.interfaceId,
      }),
    }
  }

  async function interfacePost(
    t: InviteLinkTarget,
    operation: 'interfaceInviteLinkCreate' | 'interfaceInviteLinkUpdate' | 'interfaceInviteLinkDelete',
    payload: Record<string, any>,
  ) {
    return {
      data: await $api.internal.postOperation(
        t.workspaceId!,
        t.baseId!,
        { operation },
        { interfaceId: t.interfaceId, ...payload },
      ),
    }
  }

  async function load(next: InviteLinkTarget, force = false) {
    if (!force && isLoaded.value && sameTarget(target.value, next)) return

    if (!isTargetComplete(next)) return

    // Switching target must not leave the previous target's links on screen.
    if (!sameTarget(target.value, next)) {
      links.value = []
      isLoaded.value = false
    }

    target.value = next
    isLoading.value = true

    const res = await request(() =>
      next.scope === InviteLinkScope.INTERFACE ? interfaceGet(next) : $api.instance.get(basePath(next)),
    )

    links.value = res?.data?.list ?? []
    isLoaded.value = true
    isLoading.value = false
  }

  async function createLink(body?: Partial<InviteLinkReqType>, opts?: { toast?: boolean }) {
    if (!target.value) return null

    const t = target.value

    const link = {
      role: defaultRole.value,
      email_domain: defaultEmailDomain.value,
      ...body,
    } as InviteLinkReqType

    const res = await request(
      () =>
        t.scope === InviteLinkScope.INTERFACE
          ? interfacePost(t, 'interfaceInviteLinkCreate', { link })
          : $api.instance.post(basePath(t), link),
      opts,
    )

    if (!res?.data) return null

    links.value = [...links.value, res.data]

    return res.data as InviteLinkType
  }

  async function saveLink(id: string, patch: Partial<InviteLinkReqType>, opts?: { toast?: boolean }) {
    if (!target.value || !id) return null

    const t = target.value

    const res = await request(
      () =>
        t.scope === InviteLinkScope.INTERFACE
          ? interfacePost(t, 'interfaceInviteLinkUpdate', { linkId: id, link: patch })
          : $api.instance.patch(`${basePath(t)}/${id}`, patch),
      opts,
    )

    if (!res?.data) return null

    // The response omits the token, so keep the one already held or the row
    // loses its copyable URL.
    links.value = links.value.map((l) => (l.id === id ? { ...l, ...res.data, token: res.data.token ?? l.token } : l))

    return res.data as InviteLinkType
  }

  async function deleteLink(id: string) {
    if (!target.value || !id) return false

    const t = target.value

    const res = await request(() =>
      t.scope === InviteLinkScope.INTERFACE
        ? interfacePost(t, 'interfaceInviteLinkDelete', { linkId: id })
        : $api.instance.delete(`${basePath(t)}/${id}`),
    )

    if (!res) return false

    links.value = links.value.filter((l) => l.id !== id)

    return true
  }

  /**
   * Sign-out has to call this. `createGlobalState` is a VueUse singleton, not a
   * Pinia store, so the `pn._s` dispose loop in `signOut` never reaches it --
   * and `links` holds raw redeemable tokens, which would otherwise be handed to
   * whoever signs in next in the same tab.
   */
  function reset() {
    links.value = []
    target.value = null
    isLoading.value = false
    isLoaded.value = false
    error.value = ''
  }

  return {
    links,
    target,
    isLoading,
    isLoaded,
    error,
    reset,
    allowedRoles,
    disabledRoles,
    disabledRolesTooltip,
    roleLabels,
    defaultRole,
    defaultEmailDomain,
    linkUrl,
    load,
    createLink,
    saveLink,
    deleteLink,
  }
})
