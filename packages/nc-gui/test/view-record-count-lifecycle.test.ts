import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, h, inject, nextTick, onScopeDispose, ref, watch } from 'vue'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import type { Ref } from 'vue'
import type { TableType, ViewType } from 'nocodb-sdk'
import { OrgUserRoles, ViewTypes, WorkspaceUserRoles } from 'nocodb-sdk'
import { useViewRecordCount } from '~/composables/useViewRecordCount'

const projectRoleKey = Symbol('ProjectRoleInj')
const projectKey = Symbol('ProjectInj')
const publicKey = Symbol('IsPublicInj')
const mounted: ReturnType<typeof mount>[] = []
let countApi: ReturnType<typeof vi.fn>
let allowed: Ref<boolean>
let role: Ref<Record<string, boolean> | string[] | undefined>
let user: Ref<Record<string, unknown>>
let isPublic: Ref<boolean>
let view: Ref<ViewType>
let table: Ref<TableType>
let visible: Ref<boolean>
let pinia: ReturnType<typeof createPinia>
let token: Ref<string>
let orgRoles: Ref<Record<string, boolean>>
let base: Ref<{ id: string; workspace_role?: string }>

function renderCount() {
  const wrapper = mount(
    defineComponent({
      setup() {
        const { count } = useViewRecordCount(view, table, visible)
        return () => h('span', count.value === undefined ? 'unknown' : String(count.value))
      },
    }),
    { global: { provide: { [projectRoleKey]: role, [projectKey]: base, [publicKey]: isPublic } } },
  )
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  countApi = vi.fn().mockResolvedValue({ count: 2 })
  allowed = ref(true)
  role = ref({ viewer: true })
  orgRoles = ref({})
  base = ref({ id: 'crm' })
  user = ref({ id: 'reader-1', roles: {}, base_roles: { viewer: true } })
  token = ref('test-session')
  isPublic = ref(false)
  visible = ref(true)
  view = ref({ id: 'missing-invoice', type: ViewTypes.GRID, meta: { recordCount: { showCount: true } } })
  table = ref({ id: 'jobs', base_id: 'crm' })
  for (const [name, implementation] of Object.entries({ computed, inject, nextTick, onScopeDispose, ref, watch })) {
    vi.stubGlobal(name, implementation)
  }
  vi.stubGlobal('ProjectRoleInj', projectRoleKey)
  vi.stubGlobal('ProjectInj', projectKey)
  vi.stubGlobal('IsPublicInj', publicKey)
  vi.stubGlobal('NOCO', 'noco')
  vi.stubGlobal('useNuxtApp', () => ({ $api: { dbViewRow: { count: countApi } } }))
  vi.stubGlobal('useGlobal', () => ({ user, token }))
  vi.stubGlobal('useRoles', () => ({ isUIAllowed: () => allowed.value, orgRoles }))
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  disposePinia(pinia)
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('sidebar view count lifecycle', () => {
  it('counts the saved view for a reader without passing active-view search or filter state', async () => {
    const wrapper = renderCount()
    await flushPromises()
    expect(countApi).toHaveBeenCalledExactlyOnceWith('noco', 'crm', 'jobs', 'missing-invoice')
    expect(wrapper.text()).toBe('2')
  })

  it('does not query opted-out, invisible, public, form, or unreadable views', async () => {
    view.value.meta = {}
    const wrapper = renderCount()
    await flushPromises()
    expect(countApi).not.toHaveBeenCalled()
    view.value.meta = { recordCount: { showCount: true } }
    visible.value = false
    await flushPromises()
    expect(countApi).not.toHaveBeenCalled()
    visible.value = true
    isPublic.value = true
    await flushPromises()
    expect(countApi).not.toHaveBeenCalled()
    isPublic.value = false
    view.value.type = ViewTypes.FORM
    await flushPromises()
    expect(countApi).not.toHaveBeenCalled()
    view.value.type = ViewTypes.GRID
    allowed.value = false
    await flushPromises()
    expect(countApi).not.toHaveBeenCalled()
    expect(wrapper.text()).toBe('unknown')
  })

  it('does not borrow the active base role while the node role is absent', async () => {
    role.value = undefined
    const wrapper = renderCount()
    await flushPromises()
    expect(countApi).not.toHaveBeenCalled()
    expect(wrapper.text()).toBe('unknown')
    role.value = { viewer: true }
    await flushPromises()
    expect(countApi).toHaveBeenCalledTimes(1)
  })

  it('tolerates an empty role list without requesting any data', async () => {
    role.value = []
    const wrapper = renderCount()
    await flushPromises()
    expect(countApi).not.toHaveBeenCalled()
    expect(wrapper.text()).toBe('unknown')
  })

  it('counts for a superadmin with role-less sidebar data and hides the result when that privilege is removed', async () => {
    role.value = undefined
    orgRoles.value = { [OrgUserRoles.SUPER_ADMIN]: true }
    const wrapper = renderCount()
    await flushPromises()
    expect(countApi).toHaveBeenCalledExactlyOnceWith('noco', 'crm', 'jobs', 'missing-invoice')
    expect(wrapper.text()).toBe('2')
    orgRoles.value = {}
    await flushPromises()
    expect(wrapper.text()).toBe('unknown')
    await vi.advanceTimersByTimeAsync(48 * 60 * 60 * 1000)
    expect(countApi).toHaveBeenCalledTimes(1)
  })

  it('counts inherited permissions only from the target base workspace', async () => {
    role.value = undefined
    base.value = { id: 'another-base', workspace_role: WorkspaceUserRoles.OWNER }
    const wrapper = renderCount()
    await flushPromises()
    expect(countApi).not.toHaveBeenCalled()
    base.value.id = 'crm'
    await flushPromises()
    expect(wrapper.text()).toBe('2')
    expect(countApi).toHaveBeenCalledTimes(1)
  })

  it('shares a request across consumers and refreshes after one day by default', async () => {
    renderCount()
    renderCount()
    await flushPromises()
    expect(countApi).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000 - 1)
    expect(countApi).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(countApi).toHaveBeenCalledTimes(2)
  })

  it('pauses refresh in hidden tabs and resumes when the count is due', async () => {
    renderCount()
    await flushPromises()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    expect(countApi).toHaveBeenCalledTimes(1)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(countApi).toHaveBeenCalledTimes(2)
  })

  it('clears the prior user count and ignores their response after an identity change', async () => {
    let finish!: (result: { count: number }) => void
    countApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = renderCount()
    await flushPromises()
    user.value = { id: 'reader-2', roles: {}, base_roles: { viewer: true } }
    await flushPromises()
    expect(wrapper.text()).toBe('2')
    finish({ count: 999 })
    await flushPromises()
    expect(wrapper.text()).toBe('2')
    expect(countApi).toHaveBeenCalledTimes(2)
  })

  it('stops querying and hides the badge after read access is revoked', async () => {
    const wrapper = renderCount()
    await flushPromises()
    expect(wrapper.text()).toBe('2')
    allowed.value = false
    role.value = { 'no-access': true }
    await flushPromises()
    expect(wrapper.text()).toBe('unknown')
    await vi.advanceTimersByTimeAsync(48 * 60 * 60 * 1000)
    expect(countApi).toHaveBeenCalledTimes(1)
  })

  it('stops timers when the last node is unmounted', async () => {
    const wrapper = renderCount()
    await flushPromises()
    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)
    await vi.advanceTimersByTimeAsync(48 * 60 * 60 * 1000)
    expect(countApi).toHaveBeenCalledTimes(1)
  })

  it('keeps the cached count when a table is collapsed and reopened before refresh is due', async () => {
    const first = renderCount()
    await flushPromises()
    first.unmount()
    mounted.splice(mounted.indexOf(first), 1)
    await vi.advanceTimersByTimeAsync(60 * 1000)
    const reopened = renderCount()
    await flushPromises()
    expect(reopened.text()).toBe('2')
    expect(countApi).toHaveBeenCalledTimes(1)
  })

  it('does not reuse a collapsed view count after its base role changes', async () => {
    const first = renderCount()
    await flushPromises()
    first.unmount()
    mounted.splice(mounted.indexOf(first), 1)
    role.value = { editor: true }
    let finish!: (result: { count: number }) => void
    countApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const reopened = renderCount()
    await flushPromises()
    expect(reopened.text()).toBe('unknown')
    expect(countApi).toHaveBeenCalledTimes(2)
    finish({ count: 10 })
    await flushPromises()
    expect(reopened.text()).toBe('10')
  })
})
