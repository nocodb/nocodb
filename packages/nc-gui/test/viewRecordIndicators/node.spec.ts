import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type VueWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import ViewNode from 'nocodb:ViewNode.vue'
import { ViewLockType, ViewTypes } from 'nocodb-sdk'
import { ProjectInj, TreeViewInj, countRequest, useViewsStore, user } from './fixtures/core-context'

const wrappers: VueWrapper[] = []
const passThrough = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  },
})
const nativeInput = defineComponent({
  props: ['value'],
  emits: ['update:value'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs,
        value: props.value,
        onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
      })
  },
})
const UI = {
  AInput: nativeInput,
  ...Object.fromEntries(
    [
      'NcTooltip',
      'LazyGeneralEmojiPicker',
      'GeneralViewIcon',
      'GeneralIcon',
      'NcButton',
      'NcDropdown',
      'GeneralUserIcon',
      'SmartsheetToolbarViewActionMenu',
    ].map((name) => [name, passThrough]),
  ),
}

function renderView(indicators?: { showCount: boolean; boldNonEmpty: boolean; refreshAmount: number; refreshUnit: 'days' }) {
  const wrapper = mount(ViewNode, {
    props: {
      view: {
        id: 'view-1',
        title: 'Needs attention',
        fk_model_id: 'table-1',
        base_id: 'base-1',
        source_id: 'source-1',
        type: ViewTypes.GRID,
        lock_type: ViewLockType.Collaborative,
        meta: indicators ? { sidebarIndicators: indicators } : {},
      },
      table: { id: 'table-1', base_id: 'base-1', source_id: 'source-1' },
      onValidate: () => true,
    },
    global: {
      components: UI,
      directives: { e: {} },
      mocks: { $t: (key: string) => key },
      provide: {
        [ProjectInj as symbol]: ref({ id: 'base-1', sources: [{ id: 'source-1', is_meta: true }] }),
        [TreeViewInj as symbol]: { openViewDescriptionDialog() {} },
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  user.value = { id: 'test-user', email: 'unit@example.invalid' }
  countRequest.mockReset().mockResolvedValue({ count: 2 })
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await flushPromises()
})

describe('original saved-view sidebar render baseline', () => {
  it('renders the actual title and makes no optional count request by default', async () => {
    const wrapper = renderView()
    await flushPromises()
    expect(wrapper.get('[data-testid="sidebar-view-title"]').text()).toBe('Needs attention')
    expect(countRequest).not.toHaveBeenCalled()
  })

  it('renders a configured matching-record count', async () => {
    const wrapper = renderView({ showCount: true, boldNonEmpty: false, refreshAmount: 1, refreshUnit: 'days' })
    await flushPromises()
    expect(wrapper.find('[data-testid="sidebar-view-record-count"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="sidebar-view-record-count"]').text()).toBe('2')
  })

  it('bolds an inactive configured view when its count is positive', async () => {
    const wrapper = renderView({ showCount: false, boldNonEmpty: true, refreshAmount: 1, refreshUnit: 'days' })
    await flushPromises()
    expect(wrapper.get('[data-testid="sidebar-view-title"]').classes()).toContain('font-bold')
  })
})

describe('actual saved-view indicator rendering', () => {
  const settings = () => ({ showCount: true, boldNonEmpty: true, refreshAmount: 1, refreshUnit: 'days' as const })

  it('uses its own saved view/base/table and the existing SDK argument order', async () => {
    useViewsStore().activeView = { id: 'another-view' }
    const wrapper = renderView(settings())
    await wrapper.setProps({
      view: { ...wrapper.props('view'), id: 'owned-view', base_id: 'owned-base', fk_model_id: 'owned-table' },
    })
    await flushPromises()
    const last = countRequest.mock.calls.at(-1)!
    expect(last.slice(0, 5)).toEqual(['noco', 'owned-base', 'owned-table', 'owned-view', undefined])
    expect((last[5] as { signal: AbortSignal }).signal.aborted).toBe(false)
  })

  it('shows ready zero and does not highlight it', async () => {
    countRequest.mockResolvedValueOnce({ count: 0 })
    const wrapper = renderView(settings())
    await flushPromises()
    const badge = wrapper.get('[data-testid="sidebar-view-record-count"]')
    expect(badge.text()).toBe('0')
    expect(badge.attributes('data-state')).toBe('ready')
    expect(wrapper.get('[data-testid="sidebar-view-title"]').classes()).not.toContain('font-bold')
  })

  it('separates pending from zero and later renders the actual result', async () => {
    let resolve!: (value: { count: number }) => void
    countRequest.mockImplementationOnce(
      () =>
        new Promise((_resolve) => {
          resolve = _resolve
        }),
    )
    const wrapper = renderView(settings())
    await flushPromises()
    expect(wrapper.get('[data-testid="sidebar-view-record-count"]').text()).toBe('…')
    expect(wrapper.get('[data-testid="sidebar-view-record-count"]').attributes('data-state')).toBe('loading')
    resolve({ count: 0 })
    await flushPromises()
    expect(wrapper.get('[data-testid="sidebar-view-record-count"]').text()).toBe('0')
  })

  it('shows unavailable on failure without stale positive styling', async () => {
    countRequest.mockRejectedValueOnce(new Error('offline'))
    const wrapper = renderView(settings())
    await flushPromises()
    const badge = wrapper.get('[data-testid="sidebar-view-record-count"]')
    expect(badge.text()).toBe('—')
    expect(badge.attributes('data-state')).toBe('error')
    expect(wrapper.get('[data-testid="sidebar-view-title"]').classes()).not.toContain('font-bold')
  })

  it('keeps active-view color while each preference changes independently', async () => {
    useViewsStore().activeView = { id: 'view-1' }
    const wrapper = renderView(settings())
    await flushPromises()
    let title = wrapper.get('[data-testid="sidebar-view-title"]')
    expect(title.classes()).toContain('font-bold')
    expect(title.classes()).toContain('text-nc-content-brand-disabled')
    await wrapper.setProps({
      view: { ...wrapper.props('view'), meta: { sidebarIndicators: { ...settings(), boldNonEmpty: false } } },
    })
    title = wrapper.get('[data-testid="sidebar-view-title"]')
    expect(title.classes()).toContain('font-medium')
    expect(title.classes()).toContain('text-nc-content-brand-disabled')
    expect(title.classes()).not.toContain('font-bold')
    expect(countRequest).toHaveBeenCalledTimes(1)
    await wrapper.setProps({
      view: { ...wrapper.props('view'), meta: { sidebarIndicators: { ...settings(), showCount: false } } },
    })
    expect(wrapper.find('[data-testid="sidebar-view-record-count"]').exists()).toBe(false)
    expect(title.classes()).toContain('font-bold')
    expect(countRequest).toHaveBeenCalledTimes(1)
  })

  it('does not refetch after an unrelated icon metadata change', async () => {
    const wrapper = renderView(settings())
    await flushPromises()
    await wrapper.setProps({ view: { ...wrapper.props('view'), meta: { icon: 'book', sidebarIndicators: settings() } } })
    await flushPromises()
    expect(countRequest).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="sidebar-view-record-count"]').text()).toBe('2')
  })
})
