import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { OrgUserRoles, ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import { resolveViewRecordCountRoles } from '~/utils/viewRecordCountRoles'
import { useViewRecordCountRoles } from '~/composables/useViewRecordCountRoles'

const projectRoleKey = Symbol('ProjectRoleInj')
const projectKey = Symbol('ProjectInj')
const orgRoles = ref<Record<string, boolean>>({})
let wrapper: ReturnType<typeof mount> | undefined

beforeEach(() => {
  orgRoles.value = {}
  vi.stubGlobal('ProjectRoleInj', projectRoleKey)
  vi.stubGlobal('ProjectInj', projectKey)
  vi.stubGlobal('useRoles', () => ({
    orgRoles,
    // These belong to a different active base/workspace and must not be borrowed.
    baseRoles: ref({ [ProjectRoles.OWNER]: true }),
    workspaceRoles: ref({ [WorkspaceUserRoles.OWNER]: true }),
  }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('saved view count scoped roles', () => {
  it('recognizes the instance superadmin when Base.list omits per-user roles', () => {
    expect(resolveViewRecordCountRoles('', undefined, { [OrgUserRoles.SUPER_ADMIN]: true })).toEqual({
      [OrgUserRoles.SUPER_ADMIN]: true,
    })
  })

  it('does not grant base access from other organization roles', () => {
    expect(resolveViewRecordCountRoles(undefined, undefined, { [OrgUserRoles.CREATOR]: true })).toEqual({})
  })

  it('maps the target workspace role only when direct base permission is absent or inherited', () => {
    for (const direct of [undefined, '', [], ProjectRoles.INHERIT]) {
      expect(resolveViewRecordCountRoles(direct, WorkspaceUserRoles.OWNER, {})).toEqual({ [ProjectRoles.OWNER]: true })
    }
    expect(resolveViewRecordCountRoles(ProjectRoles.INHERIT, WorkspaceUserRoles.EDITOR, {})).toEqual({
      [ProjectRoles.EDITOR]: true,
    })
  })

  it('preserves explicit viewer and no-access restrictions instead of elevating them to workspace owner', () => {
    for (const direct of [ProjectRoles.VIEWER, ProjectRoles.NO_ACCESS]) {
      expect(resolveViewRecordCountRoles(direct, WorkspaceUserRoles.OWNER, {})).toEqual({ [direct]: true })
    }
  })

  it('ignores disabled roles and does not map unknown workspace roles', () => {
    expect(
      resolveViewRecordCountRoles(
        { [ProjectRoles.OWNER]: false },
        { [WorkspaceUserRoles.OWNER]: false, unknown: true },
        { [OrgUserRoles.SUPER_ADMIN]: false },
      ),
    ).toEqual({})
  })

  it('normalizes a scoped role list without borrowing other roles', () => {
    expect(resolveViewRecordCountRoles([ProjectRoles.EDITOR], WorkspaceUserRoles.OWNER, {})).toEqual({
      [ProjectRoles.EDITOR]: true,
    })
  })

  it('requires the injected base identity to match and reacts to role changes', async () => {
    const base = ref({ id: 'other-base', workspace_role: WorkspaceUserRoles.OWNER })
    const role = ref<string | undefined>(ProjectRoles.VIEWER)
    wrapper = mount(
      defineComponent({
        setup() {
          const roles = useViewRecordCountRoles(ref('target-base'), ref({ [ProjectRoles.OWNER]: true }))
          return () => h('span', JSON.stringify(roles.value))
        },
      }),
      { global: { provide: { [projectKey]: base, [projectRoleKey]: role } } },
    )
    expect(wrapper.text()).toBe('{}')
    base.value.id = 'target-base'
    await nextTick()
    expect(JSON.parse(wrapper.text())).toEqual({ [ProjectRoles.VIEWER]: true })
    role.value = ProjectRoles.NO_ACCESS
    await nextTick()
    expect(JSON.parse(wrapper.text())).toEqual({ [ProjectRoles.NO_ACCESS]: true })
  })

  it('keeps missing sidebar roles denied even if an active toolbar role was supplied', () => {
    wrapper = mount(
      defineComponent({
        setup() {
          const roles = useViewRecordCountRoles(ref('target-base'), ref({ [ProjectRoles.OWNER]: true }))
          return () => h('span', JSON.stringify(roles.value))
        },
      }),
      { global: { provide: { [projectKey]: ref({ id: 'target-base' }), [projectRoleKey]: ref(undefined) } } },
    )
    expect(wrapper.text()).toBe('{}')
  })

  it('retains the active toolbar fallback only when there is no sidebar scope', () => {
    wrapper = mount(
      defineComponent({
        setup() {
          const roles = useViewRecordCountRoles(ref('target-base'), ref({ [ProjectRoles.EDITOR]: true }))
          return () => h('span', JSON.stringify(roles.value))
        },
      }),
    )
    expect(JSON.parse(wrapper.text())).toEqual({ [ProjectRoles.EDITOR]: true })
  })

  it.each([
    [ProjectRoles.VIEWER, WorkspaceUserRoles.OWNER],
    [ProjectRoles.EDITOR, WorkspaceUserRoles.VIEWER],
    [ProjectRoles.NO_ACCESS, WorkspaceUserRoles.OWNER],
  ])('preserves toolbar role %s over workspace role %s when the base page provides ProjectInj', (direct, workspace) => {
    wrapper = mount(
      defineComponent({
        setup() {
          const roles = useViewRecordCountRoles(ref('target-base'), ref({ [direct]: true }))
          return () => h('span', JSON.stringify(roles.value))
        },
      }),
      { global: { provide: { [projectKey]: ref({ id: 'target-base', workspace_role: workspace }) } } },
    )
    expect(JSON.parse(wrapper.text())).toEqual({ [direct]: true })
  })
})
