import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, shallowRef } from 'vue'
import { shallowMount } from '@vue/test-utils'

vi.mock('nocodb-sdk', () => ({
  UITypes: { Order: 'Order' },
  ViewLockType: {},
  ViewTypes: {},
  PermissionEntity: {},
  PermissionKey: {},
  isVirtualCol: vi.fn(),
}))
vi.mock('~/utils/dataUtils', () => ({ validateRowFilters: vi.fn() }))
vi.mock('~/lib/interfaceData', () => ({ isInterfaceSyntheticViewId: vi.fn() }))
vi.mock('~/utils/realtimeUtils', () => ({ dataEventSubscriptionKey: vi.fn() }))

const postOperation = vi.fn()
const list = vi.fn()
const error = vi.fn()
const sorts = ref<any[]>([])
const editable = ref(true)
const readonly = ref(false)
const source = ref({ id: 'source', is_data_readonly: false })
const columns = [
  { title: 'Task key', pk: true },
  { title: 'Order', uidt: 'Order' },
  { id: 'status', title: 'Status' },
]
let provideStore: any

afterEach(() => vi.unstubAllGlobals())

beforeEach(async () => {
  vi.clearAllMocks()
  sorts.value = []
  editable.value = true
  readonly.value = false
  source.value = { id: 'source', is_data_readonly: false }
  postOperation.mockResolvedValue(undefined)
  list.mockResolvedValue({ list: [] })
  const globals = {
    ref,
    computed,
    watch: vi.fn(),
    onBeforeUnmount: vi.fn(),
    provide: vi.fn(),
    inject: (key: string, fallback: unknown) => (key === 'ReadonlyInj' ? readonly : fallback),
    useInjectionState: (factory: any) => [factory, vi.fn()],
    storeToRefs: (store: any) => store,
    useI18n: () => ({ t: (key: string) => key }),
    useApi: () => ({ api: { dbViewRow: { list } } }),
    useBase: () => ({ base: ref({ id: 'base', fk_workspace_id: 'workspace', sources: [source.value] }), getBaseType: vi.fn() }),
    useNuxtApp: () => ({ $api: { internal: { postOperation } }, $e: vi.fn(), $ncSocket: {} }),
    useSmartsheetStoreOrThrow: () => ({
      sorts,
      nestedFilters: ref([]),
      eventBus: { on: vi.fn(), off: vi.fn() },
      xWhere: ref(''),
    }),
    useSharedView: () => ({ sharedView: ref({}) }),
    useRoles: () => ({
      isUIAllowed: (permission: string, args?: { source?: typeof source.value }) =>
        editable.value && (permission !== 'dataEdit' || (!!args?.source && !args.source.is_data_readonly)),
    }),
    useGlobal: () => ({ user: ref({}) }),
    useViewRowColorRender: () => ({ getEvaluatedRowMetaRowColorInfo: () => ({}) }),
    useMetas: () => ({ metas: ref({}) }),
    useEeConfig: () => ({ blockButtonVisibility: ref(true) }),
    useViewsStore: () => ({ updateViewMeta: vi.fn() }),
    extractPkFromRow: (row: Record<string, any>, fields: typeof columns) =>
      fields
        .filter((field) => field.pk)
        .map((field) => row[field.title])
        .join('___'),
    extractSdkResponseErrorMsg: async (cause: Error) => cause.message,
    message: { error },
  }
  for (const [key, value] of Object.entries(globals)) vi.stubGlobal(key, value)
  for (const key of ['IsPublicInj', 'InterfacePageDataInj', 'IsEmbeddedVizInj', 'SharedViewPasswordInj', 'ReadonlyInj']) {
    vi.stubGlobal(key, key)
  }
  provideStore = (await import('../composables/useKanbanViewStore')).useProvideKanbanViewStore
})

function setup(options: { shared?: boolean; adapter?: any; columns?: typeof columns; stack?: string | null } = {}) {
  const meta = ref({ id: 'table', base_id: 'base', source_id: 'source', columns: options.columns ?? columns })
  const store = provideStore(meta, ref({ id: 'view', view: { fk_grp_col_id: 'status' } }), options.shared, options.adapter)
  const stack = options.stack === undefined ? 'Todo' : options.stack
  store.formattedData.value.set(
    stack,
    ['a', 'b', 'c'].map((id) => ({ row: { 'Task key': id }, rowMeta: {} })),
  )
  store.countByStack.value.set(stack, 3)
  const ids = () => store.formattedData.value.get(stack).map((row: any) => row.row['Task key'])
  const move = (oldIndex: number, newIndex: number) => {
    const rows = store.formattedData.value.get(stack)
    const [element] = rows.splice(oldIndex, 1)
    rows.splice(newIndex, 0, element)
    return store.updateRecordOrder(stack, { element, oldIndex, newIndex })
  }
  return { store, stack, move, ids }
}

describe('Kanban manual record order', () => {
  it.each([
    [2, 0, 'c', 'a', ['c', 'a', 'b']],
    [0, 1, 'a', 'c', ['b', 'a', 'c']],
    [0, 2, 'a', null, ['b', 'c', 'a']],
  ])('persists move %i -> %i using the next card primary key', async (from, to, rowId, before, expected) => {
    const { move, ids } = setup()
    await move(from as number, to as number)
    expect(postOperation).toHaveBeenCalledWith(
      'workspace',
      'base',
      { operation: 'dataMove', tableId: 'table', rowId, before },
      {},
    )
    expect(ids()).toEqual(expected)
  })

  it('loads the next page before moving to the end of a partially loaded stack', async () => {
    const { store, stack, move, ids } = setup()
    store.countByStack.value.set(stack, 4)
    list.mockResolvedValue({ list: [{ 'Task key': 'd' }] })
    await move(0, 2)
    expect(list).toHaveBeenCalledWith('noco', 'base', 'table', 'view', expect.objectContaining({ offset: 3 }))
    expect(postOperation.mock.calls[0]?.[2]).toMatchObject({ rowId: 'a', before: 'd' })
    expect(ids()).toEqual(['b', 'c', 'a', 'd'])
  })

  it('supports the uncategorized stack', async () => {
    const { store, move } = setup({ stack: null })
    store.countByStack.value.set(null, 4)
    list.mockResolvedValue({ list: [{ 'Task key': 'd' }] })
    await move(0, 2)
    expect(list).toHaveBeenCalledWith('noco', 'base', 'table', 'view', expect.objectContaining({ where: '(Status,is,blank)' }))
    expect(postOperation.mock.calls[0]?.[2]).toMatchObject({ before: 'd' })
  })

  it.each(['empty page', 'failed page'])('does not use global end after an %s', async (scenario) => {
    const { store, stack, move, ids } = setup()
    store.countByStack.value.set(stack, 4)
    if (scenario === 'failed page') list.mockRejectedValue(new Error('offline'))
    await move(0, 2)
    expect(postOperation).not.toHaveBeenCalled()
    expect(ids()).toEqual(['a', 'b', 'c'])
    expect(error).toHaveBeenCalledOnce()
  })

  it('restores a failed move without discarding the newly loaded page', async () => {
    const { store, stack, move, ids } = setup()
    store.countByStack.value.set(stack, 4)
    list.mockResolvedValue({ list: [{ 'Task key': 'd' }] })
    postOperation.mockRejectedValue(new Error('offline'))
    await move(0, 2)
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
    expect(error).toHaveBeenCalledOnce()
  })

  it('does not write if a reload replaces the stack while loading the next page', async () => {
    const { store, stack, move, ids } = setup()
    store.countByStack.value.set(stack, 4)
    let finishPage!: (value: unknown) => void
    list.mockReturnValue(
      new Promise((resolve) => {
        finishPage = resolve
      }),
    )
    const pending = move(0, 2)
    expect(store.isReorderingCards.value).toBe(true)
    store.formattedData.value.set(
      stack,
      ['x', 'y', 'z'].map((id) => ({ row: { 'Task key': id }, rowMeta: {} })),
    )
    finishPage({ list: [{ 'Task key': 'd' }] })
    await pending
    expect(postOperation).not.toHaveBeenCalled()
    expect(ids()).toEqual(['x', 'y', 'z', 'd'])
    expect(store.isReorderingCards.value).toBe(false)
  })

  it('rejects overlapping moves while the first write is pending', async () => {
    const { store, move, ids } = setup()
    let finishWrite!: () => void
    postOperation.mockReturnValue(
      new Promise<void>((resolve) => {
        finishWrite = resolve
      }),
    )
    const pending = move(2, 0)
    expect(store.isReorderingCards.value).toBe(true)
    await move(1, 2)
    expect(postOperation).toHaveBeenCalledOnce()
    expect(ids()).toEqual(['c', 'a', 'b'])
    finishWrite()
    await pending
    expect(store.isReorderingCards.value).toBe(false)
  })

  it('does not mistake an unknown stack count for the global end', async () => {
    const { store, stack, move, ids } = setup()
    store.countByStack.value.delete(stack)
    await move(0, 2)
    expect(postOperation).not.toHaveBeenCalled()
    expect(ids()).toEqual(['a', 'b', 'c'])
  })

  it('routes the actual Kanban moved event to persistence without changing the grouping field', async () => {
    const { store, stack, ids } = setup()
    const updateOrSaveRow = vi.fn()
    const noOpHook = () => ({ on: vi.fn(), off: vi.fn(), trigger: vi.fn() })
    const globals = {
      reactive,
      shallowRef,
      createEventHook: noOpHook,
      useRouter: () => ({ currentRoute: ref({ query: {} }) }),
      useTheme: () => ({ isDark: ref(false), getColor: vi.fn() }),
      useViewColumnsOrThrow: () => ({ metaColumnById: computed(() => ({})) }),
      useCopy: () => ({ copy: vi.fn() }),
      useIsMounted: () => ({ isMounted: ref(false) }),
      useKanbanViewStoreOrThrow: () => ({ ...store, updateOrSaveRow }),
      useLoadingTrigger: () => ({ withLoading: (callback: any) => callback }),
      useViewRowColorRender: () => ({ isRowColouringEnabled: ref(false) }),
      useDebounceFn: (callback: any) => callback,
      useElementSize: () => ({ width: ref(1000) }),
      onMounted: vi.fn(),
    }
    for (const [key, value] of Object.entries(globals)) vi.stubGlobal(key, value)
    for (const key of [
      'MetaInj',
      'ActiveViewInj',
      'ReloadViewDataHookInj',
      'ReloadViewMetaHookInj',
      'OpenNewRecordFormHookInj',
      'IsLockedInj',
      'InterfaceExpandRecordInj',
      'InterfaceNewRecordFormInj',
      'RowHeightInj',
      'IsFormInj',
      'IsGalleryInj',
      'IsGridInj',
      'IsKanbanInj',
      'InterfaceClickIntoDetailsInj',
      'InterfaceShowRowExpandInj',
      'FieldsInj',
      'InterfaceKanbanThemeInj',
    ])
      vi.stubGlobal(key, key)
    const { default: Kanban } = await import('../components/smartsheet/KanbanOptimized.vue')
    // Run the real component setup/handler; unrelated card/dialog rendering is outside this regression.
    const wrapper = shallowMount({ ...Kanban, render: () => null })
    const rows = store.formattedData.value.get(stack)
    const [element] = rows.splice(0, 1)
    rows.splice(1, 0, element)
    await (wrapper.vm as any).$.setupState.onMoveAndPersistExpand({ moved: { element, oldIndex: 0, newIndex: 1 } }, stack, 0)
    expect(postOperation.mock.calls[0]?.[2]).toMatchObject({ rowId: 'a', before: 'c' })
    expect(updateOrSaveRow).not.toHaveBeenCalled()
    expect(ids()).toEqual(['b', 'a', 'c'])
    // Cross-stack moves must keep the existing grouping-field write and stack counts.
    rows.splice(1, 1)
    store.formattedData.value.set('Done', [element])
    await (wrapper.vm as any).$.setupState.onMove({ removed: { element } }, stack)
    await (wrapper.vm as any).$.setupState.onMove({ added: { element } }, 'Done')
    expect(element.row.Status).toBe('Done')
    expect(updateOrSaveRow).toHaveBeenCalledWith(element)
    expect(store.countByStack.value.get(stack)).toBe(2)
    expect(store.countByStack.value.get('Done')).toBe(1)
    expect(postOperation).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it.each(['sort', 'permission', 'readonly', 'source readonly', 'shared', 'interface', 'no order', 'no primary key'])(
    'disables manual order for %s and rolls back without writing',
    async (scenario) => {
      if (scenario === 'sort') sorts.value = [{ fk_column_id: 'title', direction: 'asc' }]
      if (scenario === 'permission') editable.value = false
      if (scenario === 'readonly') readonly.value = true
      if (scenario === 'source readonly') source.value.is_data_readonly = true
      const { store, move, ids } = setup({
        shared: scenario === 'shared',
        adapter: scenario === 'interface' ? {} : undefined,
        columns: columns.filter(
          (col) => !(scenario === 'no order' && col.uidt === 'Order') && !(scenario === 'no primary key' && col.pk),
        ),
      })
      expect(store.canReorderCards.value).toBe(false)
      await move(0, 2)
      expect(postOperation).not.toHaveBeenCalled()
      expect(ids()).toEqual(['a', 'b', 'c'])
    },
  )
})
