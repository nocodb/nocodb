import type { ComputedRef, Ref } from 'vue'
import {
  KANBAN_SUMMARY_COLUMN_KEY,
  KANBAN_SUMMARY_COUNT,
  KanbanStackType,
  RelationTypes,
  UITypes,
  ViewLockType,
  ViewTypes,
  getKanbanStackType,
  isKanbanJunctionLink,
  isKanbanSummaryFnValid,
  isOrderCol,
  isPrimitiveValue,
  kanbanSummaryFromView,
  kanbanSummaryToView,
} from 'nocodb-sdk'
import type {
  Api,
  ColumnType,
  DataPayload,
  FilterType,
  KanbanStackSummary,
  KanbanType,
  LinkToAnotherRecordType,
  SelectOptionType,
  SelectOptionsType,
  TableType,
  ViewType,
} from 'nocodb-sdk'
import { validateRowFilters } from '~/utils/dataUtils'
import type { InterfacePageDataApi } from '~/lib/interfaceData'
import { isInterfaceSyntheticViewId } from '~/lib/interfaceData'
import {
  dataEventSubscriptionKey,
  isUnlistedRowsChange,
  previousViewMembership,
  schedulePeerTableReload,
  unloadedRowCountChange,
} from '~/utils/realtimeUtils'
import { runOneQueueOne } from '~/utils/runQueued'

// `label`: display name of a user / linked-record stack, whose `title` is the user id / record id
// `title` is null for the Uncategorized stack
type GroupingFieldColOptionsType = Omit<SelectOptionType, 'title'> & {
  title?: string | null
  collapsed: boolean
  label?: string
  /** A removed member's user stack: shows its cards, but can't take new ones */
  readonly?: boolean
}

// Linked records loaded as stacks per page
const LINK_STACK_PAGE_SIZE = 50

const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (
    meta: Ref<TableType | KanbanType | undefined>,
    viewMeta: Ref<ViewType | KanbanType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
    shared = false,
    providedInterfaceDataApi?: InterfacePageDataApi,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const addNewStackId = 'addNewStack'

    const uncategorizedStackId = 'uncategorized'

    const { t } = useI18n()

    const { api } = useApi()

    const baseStore = useBase()

    const { base } = storeToRefs(baseStore)

    const { getBaseType } = baseStore

    const { $e, $api, $ncSocket, $eventBus } = useNuxtApp()

    const {
      sorts,
      nestedFilters,
      eventBus,
      xWhere,
      rowMatchesSearchAndUrl,
      hasClientSideRowFilters,
      isViewerScopedView,
      rowMatchesViewerScopedFilters,
    } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData, fetchSharedViewGroupedData, fetchBulkAggregatedData } = useSharedView()

    const { isUIAllowed } = useRoles()

    const { user } = useGlobal()

    /**
     * In shared view mode, `isPublic` will still be false because both
     * `useProvideSmartsheetStore` and `provide(IsPublicInj)` are called at the same
     * component level, so the inject doesn't see the provided value.
     */
    const isPublic = shared ? ref(shared) : inject(IsPublicInj, ref(false))

    /**
     * Present when mounted inside an interface page — grouped/list/CRUD calls
     * are routed through the adapter and view-meta writes are kept local-only
     * (the synthetic interface view is never persisted). Like `shared` above,
     * the interface wrapper provides the adapter at the SAME component level
     * it calls this provider, so inject can't see it — it passes the adapter
     * as an argument instead.
     */
    const interfaceDataApi = providedInterfaceDataApi ?? inject(InterfacePageDataInj, undefined)

    /** Embedded as a dashboard view-widget card — space-adaptive behavior below. */
    const isEmbeddedViz = inject(IsEmbeddedVizInj, ref(false))

    const password = ref<string | null>(null)

    const { getEvaluatedRowMetaRowColorInfo } = useViewRowColorRender()

    const { setMeta, metas, getMeta, getMetaByKey } = useMetas()

    const basesStore = useBases()

    const { basesUser } = storeToRefs(basesStore)

    const { blockButtonVisibility } = useEeConfig()

    const buttonFilterColumns = computed(() => {
      // Conditional button visibility is a paid feature (FEATURE_BUTTON_VISIBILITY) — unavailable in
      // CE/OSS and on plans without it. When blocked, ignore any persisted filters so buttons always render.
      if (blockButtonVisibility.value) return []
      if (!meta.value?.columns) return []
      return (meta.value as TableType).columns!.filter(
        (col) => col.uidt === UITypes.Button && (col.colOptions as any)?.filters?.length,
      )
    })

    const evaluateButtonVisibility = (row: Record<string, any>): Record<string, boolean> | undefined => {
      if (!buttonFilterColumns.value.length) return undefined

      const columns = (meta.value as TableType)?.columns as ColumnType[]
      if (!columns) return undefined

      const client = getBaseType((meta.value as TableType)?.source_id)
      const result: Record<string, boolean> = {}

      for (const col of buttonFilterColumns.value) {
        const filters = (col.colOptions as any)?.filters as FilterType[]
        if (!filters?.length) continue

        const isValid = validateRowFilters(filters, row, columns, client, metas.value, (meta.value as TableType)?.base_id, {
          currentUser: user.value?.id ? { id: user.value.id, email: user.value.email } : undefined,
        })

        if (!isValid) {
          result[col.id!] = true
        }
      }

      return Object.keys(result).length ? result : undefined
    }

    const viewStore = useViewsStore()

    const { updateViewMeta } = viewStore

    provide(SharedViewPasswordInj, password)

    // kanban view meta data
    const kanbanMetaData = computed(() => {
      if (isPublic.value) {
        return sharedView.value?.view as KanbanType
      } else {
        return viewMeta.value?.view
      }
    })

    // formattedData structure
    // {
    //   [val1] : [
    //     {row: {...}, oldRow: {...}, rowMeta: {...}},
    //     {row: {...}, oldRow: {...}, rowMeta: {...}},
    //     ...
    //   ],
    //   [val2] : [
    //     {row: {...}, oldRow: {...}, rowMeta: {...}},
    //     {row: {...}, oldRow: {...}, rowMeta: {...}},
    //     ...
    //   ],
    // }
    const formattedData = ref<Map<string | null, Row[]>>(new Map<string | null, Row[]>())

    // countByStack structure
    // {
    //   "uncategorized": 0,
    //   [val1]: 10,
    //   [val2]: 20
    // }
    const countByStack = ref<Map<string | null, number>>(new Map<string | null, number>())

    // Windowed loading is the default: the Kanban board loads grouped data one visible window of
    // stacks at a time via loadKanbanDataForStacks() instead of fetching every group upfront, so the
    // `watch(groupingFieldColumn)` below never fires a bulk load before the board mounts.
    // KanbanOptimized flips it off for public/shared boards (the shared-view endpoint can't filter
    // groups). Stores provided dormantly by non-kanban views never load either way — their view has
    // no `fk_grp_col_id`, so that watcher has nothing to fire on.
    const useWindowedKanbanLoad = ref(true)

    // Stack titles whose grouped data (rows + count) has been fetched, so windowed loads can skip them.
    const loadedStacks = ref<Set<string | null>>(new Set<string | null>())

    const groupingFieldColumn = computed(() => {
      if (!meta.value?.columns || !kanbanMetaData.value?.fk_grp_col_id) return undefined

      // Interface mounts (including anonymous public shares, where the public
      // route provides `IsPublicInj=true` and VizWrapper's own same-level
      // `provide(IsPublicInj, false)` can't override it) carry the grouping
      // column on the synthetic meta with `fk_grp_col_id` on the view — NOT the
      // classic shared-view embedded `groupingFieldColumn` meta (the synthetic
      // view's `meta` is `{}`). Resolve via the columns lookup, mirroring
      // `loadKanbanData`'s `interfaceDataApi`-first branch.
      if (isPublic.value && !interfaceDataApi) {
        return parseProp(sharedView.value?.meta).groupingFieldColumn as ColumnType
      } else {
        return (meta.value.columns as ColumnType[]).find((f) => f.id === kanbanMetaData.value.fk_grp_col_id)
      }
    })

    const groupingField = computed(() => groupingFieldColumn.value?.title ?? '')

    // How cards are stacked: by select option (default), by user, or by linked record
    const stackType = computed(
      () => getKanbanStackType(groupingFieldColumn.value, { junctionLinks: true }) ?? KanbanStackType.SingleSelect,
    )

    const isSelectStack = computed(() => stackType.value === KanbanStackType.SingleSelect)

    const linkColOptions = computed(() =>
      stackType.value === KanbanStackType.Link ? (groupingFieldColumn.value?.colOptions as LinkToAnotherRecordType) : undefined,
    )

    const relatedBaseId = computed(
      () => linkColOptions.value?.fk_related_base_id || (meta.value as TableType | undefined)?.base_id,
    )

    const relatedTableMeta = computed<TableType | undefined>(() =>
      linkColOptions.value?.fk_related_model_id
        ? getMetaByKey(relatedBaseId.value, linkColOptions.value.fk_related_model_id)
        : undefined,
    )

    // A link kept in a junction table: no foreign key here, so stacks filter on the linked record's id
    const isJunctionLinkStack = computed(
      () =>
        stackType.value === KanbanStackType.Link &&
        !!groupingFieldColumn.value &&
        isKanbanJunctionLink(groupingFieldColumn.value),
    )

    // The foreign key a link stack groups by, filtered on when loading a stack's cards
    const linkFkColumnId = computed(() => (isJunctionLinkStack.value ? undefined : linkColOptions.value?.fk_child_column_id))

    const stackUsers = computed(() => {
      if (stackType.value !== KanbanStackType.User) return []
      const baseId = (meta.value as TableType | undefined)?.base_id
      const users: (User & { deleted?: boolean })[] = baseId ? basesUser.value.get(baseId) ?? [] : []
      return users.filter((u) => !u.deleted)
    })

    // Linked records offered as stacks, paged
    const linkStackRecords = ref<{ key: string; label: string; row: Record<string, any> }[]>([])

    const hasMoreLinkStacks = ref(false)

    const isLinkStacksLoading = ref(false)

    function getLinkedRecordKey(value: unknown): string | null {
      const record = ncIsArray(value) ? value[0] : value
      if (!ncIsObject(record)) return null
      const pk = relatedTableMeta.value?.columns
        ? extractPkFromRow(record as Record<string, any>, relatedTableMeta.value.columns)
        : (record as Record<string, any>).Id ?? (record as Record<string, any>).id
      return pk === null || pk === undefined || pk === '' ? null : `${pk}`
    }

    function getLinkedRecordLabel(record: Record<string, any>, key: string) {
      const pv = relatedTableMeta.value?.columns?.find((c) => c.pv)
      // Without the linked table's meta (shared views), a link value holds just its id and display value
      const label = pv?.title
        ? record[pv.title]
        : Object.entries(record).find(([k, v]) => !['Id', 'id'].includes(k) && isPrimitiveValue(v))?.[1]
      // A blank display value falls back to the id, as an empty one does
      return label === null || label === undefined || `${label}`.trim() === '' ? key : `${label}`
    }

    /** A grouped-data key as a stack key: linked record ids can come back as numbers. */
    function toStackKey(key: unknown): string | null {
      if (ncIsNumber(key)) return `${key}`
      return ncIsString(key) && key.length ? key : null
    }

    /** The stack a card sits in: option title, user id, or linked record id; null for Uncategorized. */
    function getRowStackKey(row?: Record<string, any>): string | null {
      const value = row?.[groupingField.value]

      if (stackType.value === KanbanStackType.User) {
        const user = ncIsArray(value) ? value[0] : value
        const id = ncIsObject(user) ? (user as { id?: string }).id : user
        return ncIsString(id) && id.length ? id : null
      }

      if (stackType.value === KanbanStackType.Link) return getLinkedRecordKey(value)

      return ncIsString(value) && value.length ? value : null
    }

    /** The grouping-field cell value that puts a card into a stack. */
    function getStackCellValue(stackKey: string | null) {
      if (stackKey === null || stackKey === '') return null

      if (stackType.value === KanbanStackType.User) {
        const user = stackUsers.value.find((u) => u.id === stackKey)
        return [{ id: stackKey, email: user?.email, display_name: user?.display_name }]
      }

      if (stackType.value === KanbanStackType.Link) {
        const record = linkStackRecords.value.find((r) => r.key === stackKey)?.row
        if (record) return record
        const pk = relatedTableMeta.value?.columns?.find((c) => c.pk)
        return { [pk?.title ?? 'Id']: stackKey }
      }

      return stackKey
    }

    async function loadLinkStacks({ reset = false }: { reset?: boolean } = {}) {
      const colOptions = linkColOptions.value
      // Shared views and interface pages can't list the linked table: their stacks come from the cards
      const relatedBase = relatedBaseId.value
      if (!colOptions?.fk_related_model_id || !relatedBase || isPublic.value || interfaceDataApi || isLinkStacksLoading.value)
        return

      isLinkStacksLoading.value = true
      try {
        await getMeta({ baseId: relatedBase, tableIdOrTitle: colOptions.fk_related_model_id })

        const offset = reset ? 0 : linkStackRecords.value.length
        const res = await $api.dbDataTableRow.list(colOptions.fk_related_model_id, {
          offset,
          limit: LINK_STACK_PAGE_SIZE,
        })

        const page = (res?.list ?? []).flatMap((row: Record<string, any>) => {
          const key = getLinkedRecordKey(row)
          return key === null ? [] : [{ key, label: getLinkedRecordLabel(row, key), row }]
        })

        linkStackRecords.value = reset ? page : [...linkStackRecords.value, ...page]
        hasMoreLinkStacks.value = res?.pageInfo?.isLastPage === false
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isLinkStacksLoading.value = false
      }
    }

    // User / link stacks some record sits in, with a label when the group-by gives one: covers stacks
    // the board doesn't list itself (a removed member, a linked record past the loaded pages)
    const usedStackKeys = ref<Map<string, string | undefined>>(new Map())

    /** Group-by column for a user / link stack: the user field, or the foreign key a link owns. */
    const stackGroupByColumnName = computed(() => {
      if (stackType.value === KanbanStackType.User) return groupingField.value
      if (stackType.value === KanbanStackType.Link) {
        return (meta.value?.columns as ColumnType[] | undefined)?.find((c) => c.id === linkFkColumnId.value)?.title
      }
      return undefined
    })

    function toStackKeyGroup(value: unknown): { key: string | null; label?: string } {
      if (stackType.value === KanbanStackType.User) {
        const user = ncIsArray(value) ? value[0] : value
        if (!ncIsObject(user)) return { key: ncIsString(user) && user.length ? user : null }
        const { id, display_name, email } = user as { id?: string; display_name?: string; email?: string }
        return { key: ncIsString(id) && id.length ? id : null, label: display_name || email || undefined }
      }
      return { key: toStackKey(value) }
    }

    /** Stack key → record count of a junction link stack: the group-by API would group by display value. */
    async function fetchJunctionStackKeyCounts(
      where?: string,
    ): Promise<Map<string | null, { count: number; label?: string }> | undefined> {
      const columnId = groupingFieldColumn.value?.id
      if (isPublic.value || interfaceDataApi || !columnId || !base?.value?.id || !meta.value?.id || !viewMeta.value?.id) return

      try {
        const groupData = await api.dbViewRow.groupedDataList(
          'noco',
          base.value.id!,
          meta.value!.id!,
          viewMeta.value!.id!,
          columnId,
          {
            where,
            limit: 1,
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
          },
          {},
        )

        const groups = new Map<string | null, { count: number; label?: string }>()
        for (const group of groupData ?? []) {
          const key = toStackKey(group.key)
          const record = (group.value?.list?.[0] as Record<string, any> | undefined)?.[groupingField.value]
          const label = key !== null && ncIsObject(record) ? getLinkedRecordLabel(record, key) : undefined
          groups.set(key, { count: group.value?.pageInfo?.totalRows ?? 0, label })
        }
        return groups
      } catch {
        // Too many linked records to group in one request: callers treat the answer as unknown
        return undefined
      }
    }

    /** Stack key → record count of a user / link stack, from the group-by API; paged past the server's limit. */
    async function fetchStackKeyCounts(
      where?: string,
    ): Promise<Map<string | null, { count: number; label?: string }> | undefined> {
      if (isJunctionLinkStack.value) return fetchJunctionStackKeyCounts(where)

      const columnName = stackGroupByColumnName.value
      if (isPublic.value || interfaceDataApi || !columnName || !base?.value?.id || !meta.value?.id || !viewMeta.value?.id) return

      const groups = new Map<string | null, { count: number; label?: string }>()
      const pageSize = 100
      for (let page = 0; page < 20; page++) {
        const response = await api.dbViewRow.groupBy('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
          where,
          column_name: columnName,
          limit: pageSize,
          offset: page * pageSize,
          ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
        })
        for (const group of response?.list ?? []) {
          const { key, label } = toStackKeyGroup(group[columnName])
          groups.set(key, { count: (groups.get(key)?.count ?? 0) + (+group.count || 0), label })
        }
        if (response?.pageInfo?.isLastPage !== false) return groups
      }
      // More distinct stacks than we page through: callers treat the answer as unknown
      return undefined
    }

    async function loadUsedStackKeys() {
      if (isSelectStack.value) {
        usedStackKeys.value = new Map()
        return
      }
      const columnId = groupingFieldColumn.value?.id
      try {
        const groups = await fetchStackKeyCounts()
        // Superseded by a stacking-field change
        if (groupingFieldColumn.value?.id !== columnId) return
        const used = new Map<string, string | undefined>()
        for (const [key, { count, label }] of groups ?? []) {
          if (key !== null && count > 0) used.set(key, label)
        }
        usedStackKeys.value = used
      } catch (e: any) {
        console.error('Failed to load kanban stacks in use', e)
      }
    }

    /**
     * Interface mounts: stack meta (incl. collapse state) is per-viewer ephemeral. The synthetic
     * interface view is rebuilt from the page config on every recompute and is never persisted,
     * so meta written onto it (or through the views store) is lost/no-op. This store-scoped ref
     * survives those recomputes; it resets on remount by design.
     */
    const interfaceLocalStackMeta = ref<Record<string, GroupingFieldColOptionsType[]>>({})

    // stack meta in object format
    const stackMetaObj = computed(() => {
      const metaObj = parseProp(kanbanMetaData.value?.meta) || {}

      // overlay the ephemeral per-viewer stack meta over whatever the synthetic view carries
      if (interfaceDataApi) {
        return { ...metaObj, ...interfaceLocalStackMeta.value }
      }

      return metaObj
    })

    // User / link stacks: candidates are the base members / loaded linked records, plus any stack
    // a loaded card sits in (e.g. a removed member). Labels are derived, never stored.
    const derivedStackCandidates = computed(() => {
      const candidates = new Map<string, string>()

      if (stackType.value === KanbanStackType.User) {
        for (const user of stackUsers.value) {
          if (user.id) candidates.set(user.id, user.display_name || user.email || t('labels.unknownUser'))
        }
      } else {
        for (const record of linkStackRecords.value) candidates.set(record.key, record.label)
      }

      for (const [key, rows] of formattedData.value) {
        if (key === null || candidates.has(key) || !rows.length) continue
        const value = rows[0]!.row[groupingField.value]
        const item = ncIsArray(value) ? value[0] : value
        let label = key
        if (stackType.value === KanbanStackType.User) {
          const user = item as { display_name?: string; email?: string } | undefined
          label = user?.display_name || user?.email || t('labels.unknownUser')
        } else if (ncIsObject(item)) {
          label = getLinkedRecordLabel(item as Record<string, any>, key)
        }
        candidates.set(key, label)
      }

      // Stacks with records the board doesn't list; labelled from the group-by, else from their cards once loaded
      for (const [key, label] of usedStackKeys.value) {
        // A removed user can come back without an email
        if (!candidates.has(key))
          candidates.set(key, label ?? (stackType.value === KanbanStackType.User ? t('labels.unknownUser') : key))
      }

      return candidates
    })

    function stackColorIndex(key: string) {
      let hash = 0
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
      return Math.abs(hash) % enumColor.light.length
    }

    function getDerivedStackOptions(stackMeta: GroupingFieldColOptionsType[] | undefined) {
      const metaById = new Map((Array.isArray(stackMeta) ? stackMeta : []).map((stack) => [stack.id, stack]))
      let maxOrder = Math.max(0, ...[...metaById.values()].map((stack) => stack.order || 0))

      const options: GroupingFieldColOptionsType[] = [
        metaById.get(uncategorizedStackId) ?? {
          id: uncategorizedStackId,
          title: null,
          order: 0,
          color: '#6A7184',
          collapsed: false,
        },
      ]

      // Empty while base members load: nothing is read-only until they do
      const memberIds =
        stackType.value === KanbanStackType.User && stackUsers.value.length
          ? new Set(stackUsers.value.map((user) => user.id))
          : undefined

      for (const [key, label] of derivedStackCandidates.value) {
        const saved = metaById.get(key)
        options.push({
          id: key,
          title: key,
          label,
          ...(memberIds && !memberIds.has(key) ? { readonly: true } : {}),
          // Derived from the key, so an unsaved stack keeps its colour as stacks come and go
          color: saved?.color ?? enumColor.light[stackColorIndex(key)],
          order: saved?.order ?? ++maxOrder,
          collapsed: saved?.collapsed ?? false,
        })
      }

      return options.sort((a, b) => (a.order || 0) - (b.order || 0))
    }

    /**
     * Stack meta to persist for the grouping field. User / link stacks drop their derived labels and
     * keep saved entries of stacks not currently listed (linked records past the loaded pages).
     */
    function buildStackMeta(stacks: GroupingFieldColOptionsType[]) {
      if (isSelectStack.value) return stacks

      const listed = new Set(stacks.map((stack) => stack.id))
      const saved = stackMetaObj.value[kanbanMetaData.value?.fk_grp_col_id as string]
      const unlisted = (Array.isArray(saved) ? saved : []).filter((stack: GroupingFieldColOptionsType) => !listed.has(stack.id))

      return [...stacks.map(({ label: _label, readonly: _readonly, ...stack }) => stack), ...unlisted]
    }

    // grouping field column options - e.g. title, fk_column_id, color etc
    const groupingFieldColOptions = computed(() => {
      if (!groupingFieldColumn.value?.id) return []

      if (!isSelectStack.value) return getDerivedStackOptions(stackMetaObj.value[groupingFieldColumn.value.id])

      const columnId = groupingFieldColumn.value.id
      const columnOptions = (groupingFieldColumn.value.colOptions as SelectOptionsType)?.options ?? []

      // Check if we have valid stack meta
      const stackMeta = stackMetaObj.value[columnId]

      if (!Array.isArray(stackMeta) || stackMeta.length === 0) {
        // Missing or invalid stack meta - rebuild locally
        const rebuiltOptions: GroupingFieldColOptionsType[] = []

        // Add uncategorized stack first
        rebuiltOptions.push({
          id: uncategorizedStackId,
          title: null,
          order: 0,
          color: '#6A7184',
          collapsed: false,
        })

        // Add column options
        columnOptions.forEach((option, index) => {
          rebuiltOptions.push({
            ...option,
            order: index + 1,
            collapsed: false,
          })
        })

        // Try to persist if user has permissions (fire and forget)
        if (!isPublic.value && !interfaceDataApi && isUIAllowed('viewCreateOrEdit', { skipSourceCheck: true })) {
          nextTick(() => {
            updateKanbanMeta({
              meta: {
                ...stackMetaObj.value,
                [columnId]: rebuiltOptions,
              },
            }).catch(() => {
              // Silently fail - continue with local rebuild
            })
          })
        }

        return rebuiltOptions.sort((a, b) => (a.order || 0) - (b.order || 0))
      }

      // Valid stack meta exists - sync with column options
      // Use Map/Set lookups instead of findIndex/includes so this stays O(n) — high-cardinality
      // grouping fields (e.g. a SingleSelect with thousands of options) would otherwise make this
      // computed O(n²) and freeze the main thread on every recompute.
      const syncedOptions = [...stackMeta]
      let needsSync = false

      const idxById = new Map<string, number>()
      let maxOrder = 0
      syncedOptions.forEach((stack, idx) => {
        idxById.set(stack.id, idx)
        if ((stack.order || 0) > maxOrder) maxOrder = stack.order || 0
      })

      // Update existing options with latest column data
      for (const option of columnOptions) {
        const idx = idxById.get(option.id)
        if (idx !== undefined) {
          // Check if select option properties changed
          const existing = syncedOptions[idx]
          if (existing.title !== option.title || existing.color !== option.color) {
            syncedOptions[idx] = {
              ...existing,
              title: option.title,
              color: option.color,
            }
            needsSync = true
          }
        } else {
          // New option - add with proper order
          maxOrder += 1
          syncedOptions.push({
            ...option,
            order: maxOrder,
            collapsed: false,
          })
          idxById.set(option.id, syncedOptions.length - 1)
          needsSync = true
        }
      }

      // Remove deleted options (except uncategorized)
      const columnOptionIds = new Set(columnOptions.map((opt) => opt.id))
      const filteredOptions = syncedOptions.filter((stack) => stack.id === uncategorizedStackId || columnOptionIds.has(stack.id))

      if (filteredOptions.length !== syncedOptions.length) {
        needsSync = true
      }

      // Persist changes if needed and allowed
      if (needsSync && !isPublic.value && !interfaceDataApi && isUIAllowed('viewCreateOrEdit', { skipSourceCheck: true })) {
        nextTick(() => {
          updateKanbanMeta({
            meta: {
              ...stackMetaObj.value,
              [columnId]: filteredOptions,
            },
          }).catch(() => {
            // Silently fail
          })
        })
      }

      return filteredOptions.sort((a, b) => (a.order || 0) - (b.order || 0))
    })

    const shouldScrollToRight = ref(false)

    const formatData = (
      list: Record<string, any>[],
      evaluateRowMetaRowColorInfoCallback?: (row: Record<string, any>) => RowMetaRowColorInfo,
      evaluateButtonVisibilityCallback?: (row: Record<string, any>) => Record<string, boolean> | undefined,
    ) =>
      list.map((row) => {
        const buttonDisabled = evaluateButtonVisibilityCallback?.(row)
        return {
          row: { ...row },
          oldRow: { ...row },
          rowMeta: {
            ...(evaluateRowMetaRowColorInfoCallback?.(row) ?? {}),
            ...(buttonDisabled ? { buttonDisabled } : {}),
          },
        }
      })

    async function loadKanbanData() {
      // In windowed mode the optimised Kanban drives loading per visible stack window via
      // loadKanbanDataForStacks(), so the bulk "fetch every group" load is intentionally skipped.
      // Interface mounts never enable windowed mode (the adapter has no per-stack grouped fetch),
      // so they always fall through to the full load below.
      if (useWindowedKanbanLoad.value) return

      if (
        (!base?.value?.id || !meta.value?.id || !viewMeta?.value?.id || !groupingFieldColumn?.value?.id) &&
        !isPublic.value &&
        !interfaceDataApi
      )
        return

      const newFormattedData = new Map<string | null, Row[]>()
      const newCountByStack = new Map<string | null, number>()

      let groupData

      if (interfaceDataApi) {
        // Stacking column is resolved server-side from the viz config
        groupData = await interfaceDataApi.fetchGroupedData({
          sortsArr: sorts.value,
          filtersArr: nestedFilters.value,
          where: xWhere.value,
        })
      } else if (isPublic.value) {
        groupData = await fetchSharedViewGroupedData(groupingFieldColumn!.value!.id!, {
          sortsArr: sorts.value,
          filtersArr: nestedFilters.value,
          include_row_color: true,
          where: xWhere.value,
        })
      } else {
        groupData = await api.dbViewRow.groupedDataList(
          'noco',
          base.value.id!,
          meta.value!.id!,
          viewMeta.value!.id!,
          groupingFieldColumn!.value!.id!,
          { where: xWhere.value, include_row_color: true, include_button_filter_columns: true },
          {},
        )
      }

      for (const data of groupData ?? []) {
        const key = toStackKey(data.key)
        newFormattedData.set(key, formatData(data.value.list, getEvaluatedRowMetaRowColorInfo, evaluateButtonVisibility))
        newCountByStack.set(key, data.value.pageInfo.totalRows || 0)
      }

      formattedData.value = newFormattedData
      countByStack.value = newCountByStack

      autoCollapseEmptyStacks()
    }

    /**
     * Embedded view widgets (dashboard cards) — space is scarce, so ANY stack
     * with no records starts COLLAPSED, not just Uncategorized. One-shot per
     * binding and interface-only, where stack meta is store-local + ephemeral
     * (`updateKanbanMeta`'s interface branch): a viewer's manual expand is
     * never re-collapsed by later reloads, and nothing persists for others.
     */
    let hasAutoCollapsedEmptyStacks = false
    function autoCollapseEmptyStacks() {
      if (!isEmbeddedViz.value || !interfaceDataApi || hasAutoCollapsedEmptyStacks) return

      const options = groupingFieldColOptions.value
      // Counts and the grouping options resolve independently (the synthetic
      // meta is async) — the watcher below re-runs this until both are ready.
      if (!options.length || !countByStack.value.size) return
      hasAutoCollapsedEmptyStacks = true

      const stackMeta = options.map((stack) => {
        const key = stack.id === uncategorizedStackId ? null : stack.title
        const count = countByStack.value.get(key) ?? 0

        return !stack.collapsed && count === 0 ? { ...stack, collapsed: true } : stack
      })

      if (stackMeta.every((stack, i) => stack === options[i])) return

      updateKanbanMeta({
        meta: {
          ...stackMetaObj.value,
          [kanbanMetaData.value.fk_grp_col_id!]: buildStackMeta(stackMeta),
        },
      })
    }

    watch([countByStack, () => groupingFieldColOptions.value.length], () => autoCollapseEmptyStacks())

    const filerDuplicateRecords = (existingRecords: Row[], newRecords: Row[]) => {
      const existingRecordsMap = (existingRecords || []).reduce((acc, curr) => {
        const primaryKey = extractPkFromRow(curr.row, meta!.value!.columns as ColumnType[])
        if (primaryKey) {
          acc[primaryKey] = curr
        }
        return acc
      }, {} as Record<string, Row>)

      return (newRecords || []).filter(({ row }) => {
        const primaryKey = extractPkFromRow(row, meta!.value!.columns as ColumnType[])
        if (primaryKey && existingRecordsMap[primaryKey]) {
          return false
        }
        return true
      })
    }

    // Bumped by a board reset, so a stack load that started before it doesn't write over it
    let stackLoadGeneration = 0
    // The user's own card moves: an in-place refresh that started before one, or lands mid-drag,
    // would write the card back where it was, so it defers to a rerun instead.
    let localMoveCount = 0
    let pendingLocalMoves = 0
    let isCardDragActive = false
    let isInPlaceWriteDeferred = false
    // Set once the debounced refresh exists below
    let scheduleStackRefresh = () => {}

    // Optimised Kanban: load grouped data (rows + count) for only the given stacks, merging into the
    // existing maps. `optionsArrJson` restricts the server-side group-by to just these titles (the
    // backend already honours it for both data and count under opt=true), so a board with thousands
    // of stacks fetches a handful at a time as the user scrolls instead of all of them upfront.
    async function loadKanbanDataForStacks(
      stackTitles: (string | null)[],
      { reset = false, loadedCounts }: { reset?: boolean; loadedCounts?: Map<string | null, number> } = {},
    ) {
      // Interface mounts never take this path — the adapter's fetchGroupedData has no per-stack
      if (
        (!base?.value?.id || !meta.value?.id || !viewMeta?.value?.id || !groupingFieldColumn?.value?.id) &&
        !isPublic.value &&
        !interfaceDataApi
      )
        return

      const localMoves = localMoveCount
      if (reset) {
        stackLoadGeneration++
        formattedData.value = new Map<string | null, Row[]>()
        countByStack.value = new Map<string | null, number>()
        loadedStacks.value = new Set<string | null>()
      }
      const generation = stackLoadGeneration

      // De-duplicate and skip stacks already fetched (or in-flight, since we mark them eagerly below).
      const toLoad = [...new Set(stackTitles)].filter((title) => !loadedStacks.value.has(title))
      if (!toLoad.length) return

      // Mark eagerly so overlapping scroll-driven calls don't refetch the same stacks.
      toLoad.forEach((title) => loadedStacks.value.add(title))

      const optionsArrJson = JSON.stringify(toLoad)

      try {
        let groupData

        if (interfaceDataApi) {
          // Stacking column is resolved server-side from the viz config; `stackTitles`
          // narrows the group-by to this window (same role as `optionsArrJson` below).
          groupData = await interfaceDataApi.fetchGroupedData({
            sortsArr: sorts.value,
            filtersArr: nestedFilters.value,
            where: xWhere.value,
            stackTitles: toLoad,
          })
        } else if (isPublic.value) {
          groupData = await fetchSharedViewGroupedData(groupingFieldColumn!.value!.id!, {
            sortsArr: sorts.value,
            filtersArr: nestedFilters.value,
            include_row_color: true,
            where: xWhere.value,
            optionsArrJson,
          })
        } else {
          groupData = await api.dbViewRow.groupedDataList(
            'noco',
            base.value.id!,
            meta.value!.id!,
            viewMeta.value!.id!,
            groupingFieldColumn!.value!.id!,
            { where: xWhere.value, include_row_color: true, include_button_filter_columns: true, opt: 'true', optionsArrJson },
            {},
          )
        }

        const fetchedRows = new Map<string | null, Row[]>()
        const fetchedCounts = new Map<string | null, number>()

        for (const data of groupData ?? []) {
          const key = toStackKey(data.key)
          fetchedRows.set(key, formatData(data.value.list, getEvaluatedRowMetaRowColorInfo, evaluateButtonVisibility))
          fetchedCounts.set(key, data.value.pageInfo.totalRows || 0)
        }

        // Fetched past the first page before the swap, so scrolled-in cards never drop out
        if (loadedCounts) {
          await Promise.all(
            [...fetchedRows].map(async ([title, rows]) => {
              // Capped at the stack's new total: a stack that shrank has no rows past it
              const target = Math.min(loadedCounts.get(title) ?? 0, fetchedCounts.get(title) ?? 0)
              if (target <= rows.length) return
              const more = await fetchStackRows(title, { offset: rows.length, limit: target - rows.length })
              if (more) fetchedRows.set(title, [...rows, ...filerDuplicateRecords(rows, more)])
            }),
          )
        }

        // A reset meanwhile (e.g. a renamed option) reloaded the board: this fetch is stale
        if (generation !== stackLoadGeneration) return

        if (loadedCounts && (isCardDragActive || pendingLocalMoves > 0 || localMoves !== localMoveCount)) {
          isInPlaceWriteDeferred = true
          if (!isCardDragActive) scheduleStackRefresh()
          return
        }

        // Merged onto the live maps: stacks another load wrote meanwhile stay
        const newFormattedData = new Map(formattedData.value)
        const newCountByStack = new Map(countByStack.value)
        fetchedRows.forEach((rows, key) => newFormattedData.set(key, rows))
        fetchedCounts.forEach((count, key) => newCountByStack.set(key, count))

        formattedData.value = newFormattedData
        countByStack.value = newCountByStack
      } catch (e) {
        // Allow a retry on the next scroll if the fetch failed.
        toLoad.forEach((title) => loadedStacks.value.delete(title))
        throw e
      }
    }

    async function fetchStackRows(
      stackTitle: string | null,
      params: Parameters<Api<any>['dbViewRow']['list']>[4] = {},
    ): Promise<Row[] | undefined> {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value && !interfaceDataApi) return
      let where = `(${groupingField.value},eq,${stackTitle})`
      if (stackTitle === null) {
        where = `(${groupingField.value},is,blank)`
      }
      if (stackType.value === KanbanStackType.User) {
        where = stackTitle === null ? `(${groupingField.value},blank)` : `(${groupingField.value},eq,${stackTitle})`
      } else if (isJunctionLinkStack.value) {
        // `.Id` filters a link by the linked record's id rather than its display value
        where = stackTitle === null ? `(${groupingField.value},blank)` : `(${groupingField.value}.Id,eq,${stackTitle})`
      } else if (stackType.value === KanbanStackType.Link) {
        // Filtered on the foreign key itself: the link column filters on the display value
        where = stackTitle === null ? `(${linkFkColumnId.value},null)` : `(${linkFkColumnId.value},eq,${stackTitle})`
      }

      if (xWhere.value) {
        where = `${where} and ${xWhere.value}`
      }

      const response = interfaceDataApi
        ? await interfaceDataApi.fetchList({
            offset: params.offset,
            limit: params.limit,
            where,
            sortsArr: sorts.value,
            filtersArr: nestedFilters.value,
          })
        : !isPublic.value
        ? await api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...params,
            ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            where,
            include_row_color: true,
            include_button_filter_columns: true,
          })
        : await fetchSharedViewData({
            ...params,
            sortsArr: sorts.value,
            filtersArr: nestedFilters.value,
            offset: params.offset,
            where,
          })

      return formatData(response!.list!, getEvaluatedRowMetaRowColorInfo, evaluateButtonVisibility)
    }

    // Titles of every stack holding a row in the current scope, across the whole board — the
    // windowed load only knows the counts of stacks it has fetched. Shared views load every stack.
    async function fetchNonEmptyStackTitles(): Promise<Set<string | null> | undefined> {
      if (!isSelectStack.value) {
        const groups = await fetchStackKeyCounts(xWhere.value)
        if (!groups) return
        return new Set([...groups].filter(([, { count }]) => count > 0).map(([key]) => key))
      }

      if (isPublic.value || !groupingField.value) return
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !interfaceDataApi) return

      const params = { where: xWhere.value, column_name: groupingField.value, limit: groupingFieldColOptions.value.length + 1 }

      const response = interfaceDataApi
        ? await interfaceDataApi.fetchGroupBy({ ...params, sortsArr: sorts.value, filtersArr: nestedFilters.value })
        : await api.dbViewRow.groupBy('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...params,
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
          })

      // The server clamps `limit` (NC_DB_QUERY_LIMIT_MAX, 100 on cloud): a cut-off list can't say which stacks miss
      if (response?.pageInfo?.isLastPage === false) return

      const titles = new Set<string | null>()
      for (const group of response?.list ?? []) {
        if (!+group.count) continue
        const key = group[groupingField.value]
        titles.add(typeof key === 'string' && key.length ? key : null)
      }
      return titles
    }

    async function loadMoreKanbanData(stackTitle: string | null, params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      const rows = await fetchStackRows(stackTitle, params)
      if (!rows) return

      formattedData.value.set(stackTitle, [
        ...formattedData.value.get(stackTitle)!,
        ...filerDuplicateRecords(formattedData.value.get(stackTitle)!, rows),
      ])
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id) return

      // interface mode: the views store can't reach the synthetic view (it isn't registered there,
      // and it is rebuilt from the page config on every recompute), so hold stack meta in the
      // store-local ref instead — per-viewer, ephemeral, never persisted over the network
      if (interfaceDataApi) {
        if (updateObj.meta !== undefined) {
          interfaceLocalStackMeta.value = { ...interfaceLocalStackMeta.value, ...parseProp(updateObj.meta) }
        }
        return
      }

      // Check if user can update based on role OR personal view ownership
      const isPersonalViewOwner = viewMeta.value.lock_type === ViewLockType.Personal && viewMeta.value.owned_by === user.value?.id

      const canUpdate = isUIAllowed('viewCreateOrEdit', { skipSourceCheck: true }) || isPersonalViewOwner

      await updateViewMeta(viewMeta.value.id, ViewTypes.KANBAN, updateObj, {
        skipNetworkCall: isPublic.value || !canUpdate,
      })
    }

    const updateStackProperty = async (stackIdx: number, updates: Partial<GroupingFieldColOptionsType>) => {
      const stackMeta = [...groupingFieldColOptions.value]
      stackMeta[stackIdx] = { ...stackMeta[stackIdx], ...updates }

      const updatedStackMetaObj = {
        ...stackMetaObj.value,
        [kanbanMetaData.value.fk_grp_col_id!]: buildStackMeta(stackMeta),
      }

      await updateKanbanMeta({
        meta: updatedStackMetaObj,
      })
    }

    const updateAllStacksProperty = async (
      updates: (stack: GroupingFieldColOptionsType, index: number) => Partial<GroupingFieldColOptionsType> | null,
    ) => {
      const stackMeta = groupingFieldColOptions.value.map((stack, index) => {
        const stackUpdates = updates(stack, index)
        return stackUpdates ? { ...stack, ...stackUpdates } : stack
      })

      const updatedStackMetaObj = {
        ...stackMetaObj.value,
        [kanbanMetaData.value.fk_grp_col_id!]: buildStackMeta(stackMeta),
      }

      await updateKanbanMeta({
        meta: updatedStackMetaObj,
      })
    }

    async function insertRow(row: Record<string, any>, rowIndex = formattedData.value.get(null)!.length) {
      try {
        const insertObj = (meta?.value?.columns as ColumnType[]).reduce((o: Record<string, any>, col) => {
          if (!col.ai && row?.[col.title as string] !== null) {
            o[col.title!] = row?.[col.title as string]
          }
          return o
        }, {})

        const insertedData = interfaceDataApi
          ? await interfaceDataApi.insertRow(insertObj)
          : await $api.dbViewRow.create(
              NOCO,
              metaValue?.base_id ?? (base?.value.id as string),
              meta.value?.id as string,
              viewMeta?.value?.id as string,
              insertObj,
            )

        formattedData.value.get(null)?.splice(rowIndex ?? 0, 1, {
          row: insertedData,
          rowMeta: {
            ...getEvaluatedRowMetaRowColorInfo(insertedData),
            buttonDisabled: evaluateButtonVisibility(insertedData),
          },
          oldRow: { ...insertedData },
        })

        return insertedData
      } catch (error: any) {
        message.error(await extractSdkResponseErrorMsg(error))
      }
    }

    /** `notify: false` (Cmd+K) throws the error message instead of toasting it. */
    async function updateRowProperty(toUpdate: Row, property: string, { notify = true }: { notify?: boolean } = {}) {
      try {
        const id = extractPkFromRow(toUpdate.row, meta?.value?.columns as ColumnType[])

        const updatedRowData = interfaceDataApi
          ? await interfaceDataApi.updateRow(id, { [property]: toUpdate.row[property] })
          : await $api.dbViewRow.update(
              NOCO,
              meta.value?.base_id ?? (base?.value.id as string),
              meta.value?.id as string,
              viewMeta?.value?.id as string,
              encodeURIComponent(id),
              {
                [property]: toUpdate.row[property],
              },
              // todo:
              // {
              //   query: { ignoreWebhook: !saved }
              // }
            )

        /** update row data(to sync formula and other related columns) */
        Object.assign(toUpdate.row, updatedRowData)
        Object.assign(toUpdate.oldRow, updatedRowData)
        Object.assign(toUpdate.rowMeta, getEvaluatedRowMetaRowColorInfo(updatedRowData))
        toUpdate.rowMeta.buttonDisabled = evaluateButtonVisibility(updatedRowData)
        markStackSummariesStale()

        return updatedRowData
      } catch (e: any) {
        const errorMsg = `${t('msg.error.rowUpdateFailed')} ${await extractSdkResponseErrorMsg(e)}`
        if (!notify) throw new Error(errorMsg)
        message.error(errorMsg)
      }
    }

    /** Relinks a card stacked by a belongs-to / one-to-one link to the record its stack names. */
    async function updateRowLink(toUpdate: Row) {
      const column = groupingFieldColumn.value
      const colOptions = linkColOptions.value
      const toKey = getRowStackKey(toUpdate.row)
      const fromKey = getRowStackKey(toUpdate.oldRow)
      if (!column?.id || !colOptions || toKey === fromKey) return

      const rowId = extractPkFromRow(toUpdate.row, meta.value?.columns as ColumnType[]) as string
      const refRowId = (toKey ?? fromKey)!

      if (interfaceDataApi) {
        const op = toKey === null ? interfaceDataApi.nestedUnlink : interfaceDataApi.nestedLink
        await op?.({ rowId, columnId: column.id, refRowIds: [refRowId] })
      } else {
        const op = toKey === null ? $api.dbTableRow.nestedRemove : $api.dbTableRow.nestedAdd
        await op(
          NOCO,
          meta.value?.base_id ?? (base.value.id as string),
          meta.value?.id as string,
          encodeURIComponent(rowId),
          colOptions.type as Parameters<typeof $api.dbTableRow.nestedAdd>[4],
          column.id,
          encodeURIComponent(refRowId),
        )
      }

      toUpdate.oldRow[groupingField.value] = toUpdate.row[groupingField.value]

      // One-to-one: the linked record had one card, which the server just unlinked
      if (toKey !== null && colOptions.type === RelationTypes.ONE_TO_ONE) moveDisplacedCardsToUncategorized(toKey, rowId)
    }

    function moveDisplacedCardsToUncategorized(stackKey: string, keptRowId: string) {
      const columns = meta.value?.columns as ColumnType[]
      const stackRows = formattedData.value.get(stackKey) ?? []
      const displaced = stackRows.filter((row) => `${extractPkFromRow(row.row, columns)}` !== `${keptRowId}`)
      if (!displaced.length) return

      for (const row of displaced) {
        row.row[groupingField.value] = null
        row.oldRow[groupingField.value] = null
      }
      formattedData.value.set(
        stackKey,
        stackRows.filter((row) => !displaced.includes(row)),
      )
      countByStack.value.set(stackKey, Math.max(0, (countByStack.value.get(stackKey) ?? 0) - displaced.length))
      if (formattedData.value.has(null)) formattedData.value.set(null, [...displaced, ...formattedData.value.get(null)!])
      countByStack.value.set(null, (countByStack.value.get(null) ?? 0) + displaced.length)
    }

    /** Persists a card's stack: the grouping cell for a select / user field, the link for a link field. */
    async function saveRowStack(toUpdate: Row, { notify = true }: { notify?: boolean } = {}) {
      if (stackType.value !== KanbanStackType.Link) {
        return updateRowProperty(toUpdate, groupingField.value, { notify })
      }

      try {
        await updateRowLink(toUpdate)
      } catch (e: any) {
        const errorMsg = `${t('msg.error.rowUpdateFailed')} ${await extractSdkResponseErrorMsg(e)}`
        if (!notify) throw new Error(errorMsg)
        message.error(errorMsg)
      }
    }

    async function updateOrSaveRow(row: Row) {
      localMoveCount++
      pendingLocalMoves++
      try {
        if (row.rowMeta.new) {
          await insertRow(row.row, formattedData.value.get(row.row.title!)!.indexOf(row))
        } else {
          await saveRowStack(row)
        }
      } finally {
        pendingLocalMoves--
      }
    }

    /**
     * Persist a card's position (writes the table's `nc_order` column) so a within-stack drag
     * survives a reload. `beforeRow` is the card the dragged card should sit
     * before, or null to move it to the end. Skipped when the order can't be manually controlled
     * (interface/public views, or an active sort re-sorts on the next fetch anyway).
     */
    async function updateRecordOrder(row: Row, beforeRow: Row | null) {
      localMoveCount++
      if (interfaceDataApi || isPublic.value || sorts.value?.length) return
      if (!base.value?.id || !meta.value?.id) return
      // moveRecord needs an order column (absent on e.g. external-source tables).
      if (!meta.value.columns?.some((c) => isOrderCol(c))) return

      pendingLocalMoves++
      try {
        const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
        const beforeRowId = beforeRow ? extractPkFromRow(beforeRow.row, meta.value?.columns as ColumnType[]) : null

        await $api.internal.postOperation(
          base.value.fk_workspace_id!,
          meta.value?.base_id ?? (base.value.id as string),
          {
            operation: 'dataMove',
            tableId: meta.value.id as string,
            rowId,
            before: beforeRowId,
          } as any,
          undefined,
        )
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        pendingLocalMoves--
      }
    }

    async function deleteStack(stackTitle: string, _stackIdx: number) {
      if (!viewMeta?.value?.id || !groupingFieldColumn.value) return
      try {
        // merge the to-be-deleted stack into the uncategorized stack
        formattedData.value.set(null, [...formattedData.value.get(null)!, ...formattedData.value.get(stackTitle)!])
        countByStack.value.set(null, (countByStack.value.get(null) || 0) + (countByStack.value.get(stackTitle) || 0))
        formattedData.value.delete(stackTitle)
        countByStack.value.delete(stackTitle)

        const newOptions = (groupingFieldColumn.value.colOptions as SelectOptionsType).options.filter(
          (o) => o.title !== stackTitle,
        )
        const cdf = groupingFieldColumn.value.cdf ? groupingFieldColumn.value.cdf.replace(/^'/, '').replace(/'$/, '') : null
        const newMeta = await $api.internal.postOperation(
          base.value!.fk_workspace_id!,
          meta.value?.base_id ?? (base.value!.id as string),
          {
            operation: 'columnUpdate',
            columnId: groupingFieldColumn.value.id as string,
          },
          {
            ...groupingFieldColumn.value,
            colOptions: {
              options: newOptions,
            },
            cdf: cdf === stackTitle ? null : cdf,
          },
        )
        await setMeta(newMeta)

        $e('a:kanban:delete-stack')
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    function addEmptyRow(addAfter = formattedData.value.get(null)!.length) {
      formattedData.value.get(null)!.splice(addAfter, 0, {
        row: {},
        oldRow: {},
        rowMeta: { new: true },
      })
      return formattedData.value.get(null)![addAfter]
    }

    function addOrEditStackRow(row: Row, isNewRow: boolean, rowIndex?: number) {
      markStackSummariesStale()
      const stackTitle = getRowStackKey(row.row)
      const oldStackTitle = getRowStackKey(row.oldRow)

      // A new record saved without a stack stays in Uncategorized; count it now that it exists.
      if (isNewRow && !stackTitle && !oldStackTitle) {
        countByStack.value.set(null, (countByStack.value.get(null) || 0) + 1)
        return
      }

      // if the update happen on linked table, do not attempt to update stack
      if (!stackTitle || oldStackTitle) {
        return
      }
      if (isNewRow) {
        // add a new record
        if (stackTitle) {
          // push the row to target stack
          if (rowIndex !== undefined) {
            formattedData.value.get(stackTitle)!.splice(rowIndex, 0, row)
          } else {
            formattedData.value.get(stackTitle)!.push(row)
          }
          // increase the current count in the target stack by 1
          countByStack.value.set(stackTitle, countByStack.value.get(stackTitle)! + 1)
          // clear the one under uncategorized since we don't reload the view
          removeRowFromUncategorizedStack()
        } else {
          // data will be still in Uncategorized stack
          // no action is required
        }
      } else {
        // update existing record
        const targetPrimaryKey = extractPkFromRow(row.row, meta!.value!.columns as ColumnType[])
        const idxToUpdateOrDelete = formattedData.value
          .get(oldStackTitle)!
          .findIndex((ele) => extractPkFromRow(ele.row, meta!.value!.columns as ColumnType[]) === targetPrimaryKey)
        if (idxToUpdateOrDelete !== -1) {
          if (stackTitle !== oldStackTitle) {
            // remove old row from countByStack & formattedData
            countByStack.value.set(oldStackTitle, countByStack.value.get(oldStackTitle)! - 1)
            const updatedRow = formattedData.value.get(oldStackTitle)!
            updatedRow.splice(idxToUpdateOrDelete, 1)
            formattedData.value.set(oldStackTitle, updatedRow)

            // add new row to countByStack & formattedData
            countByStack.value.set(stackTitle, countByStack.value.get(stackTitle)! + 1)

            if (rowIndex !== undefined) {
              const targetStack = formattedData.value.get(stackTitle)!
              targetStack.splice(rowIndex, 0, row)
              formattedData.value.set(stackTitle, targetStack)
            } else {
              formattedData.value.set(stackTitle, [...formattedData.value.get(stackTitle)!, row])
            }
          } else {
            // update the row in formattedData
            const updatedRow = formattedData.value.get(stackTitle)!

            if (rowIndex !== undefined) {
              updatedRow.splice(idxToUpdateOrDelete, 1)
              updatedRow.splice(rowIndex, 0, row)
            } else {
              updatedRow[idxToUpdateOrDelete] = row
            }

            formattedData.value.set(oldStackTitle, updatedRow)
          }
        }
      }
    }

    function removeRowFromTargetStack(row: Row) {
      // primary key of Row to be deleted
      const targetPrimaryKey = extractPkFromRow(row.row, meta!.value!.columns as ColumnType[])
      // stack title of Row to be deleted
      const stackTitle = getRowStackKey(row.row)
      // remove target row from formattedData
      formattedData.value.set(
        stackTitle,
        formattedData.value
          .get(stackTitle)!
          .filter((ele) => extractPkFromRow(ele.row, meta!.value!.columns as ColumnType[]) !== targetPrimaryKey),
      )
      // decrease countByStack of target stack by 1
      countByStack.value.set(stackTitle, countByStack.value.get(stackTitle)! - 1)
    }

    function removeRowFromUncategorizedStack() {
      // interface adapter mode supports CRUD — only bail in plain public shared views
      if (isPublic.value && !interfaceDataApi) return
      // remove the unsaved draft; it was never counted
      formattedData.value.get(null)!.pop()
    }

    async function deleteRow(row: Row) {
      try {
        if (!row.rowMeta.new) {
          const id = extractPkFromRow(row.row, meta?.value?.columns)

          const deleted = await deleteRowById(id as string)
          if (!deleted) {
            return
          }
        }

        // remove deleted row from state
        removeRowFromTargetStack(row)
      } catch (e: any) {
        message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    async function deleteRowById(id: string) {
      if (!id) {
        throw new Error("Delete not allowed for table which doesn't have primary Key")
      }

      const res: any = interfaceDataApi
        ? await interfaceDataApi.deleteRow(id)
        : await $api.dbViewRow.delete(
            'noco',
            meta.value?.base_id ?? (base.value.id as string),
            meta.value?.id as string,
            viewMeta.value?.id as string,
            encodeURIComponent(id),
          )

      if (res.message) {
        message.info(
          `Record delete failed: ${`Unable to delete record with ID ${id} because of the following:
              \n${res.message.join('\n')}.\n
              Clear the data first & try again`})}`,
        )
        return false
      }
      return true
    }

    /**
     * This is used to update the rowMeta color info when the row colour info is updated
     */
    const smartsheetStoreEventHandler = (event: SmartsheetStoreEvents) => {
      if (![SmartsheetStoreEvents.TRIGGER_RE_RENDER, SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE].includes(event)) {
        return
      }

      const groupKeys = Array.from(formattedData.value.keys())

      groupKeys.forEach((key) => {
        const formattedDataCopy = formattedData.value.get(key) ?? []

        if (!formattedDataCopy.length) return

        formattedDataCopy.forEach((row) => {
          Object.assign(row.rowMeta, getEvaluatedRowMetaRowColorInfo(row.row))
          row.rowMeta.buttonDisabled = evaluateButtonVisibility(row.row)
        })

        formattedData.value.set(key, formattedDataCopy)
      })
    }

    eventBus.on(smartsheetStoreEventHandler)

    // Keyed on value: a meta refetch replaces the column object without changing the stacks.
    // Option colours are read from groupingFieldColOptions, so a colour-only edit needs no reload.
    const groupingFieldKey = computed(() => {
      const col = groupingFieldColumn.value
      if (!col) return undefined
      const options = ((col.colOptions as SelectOptionsType | undefined)?.options ?? []).map((option) => [
        option.id,
        option.title,
      ])
      return JSON.stringify([col.id, col.title, col.uidt, stackType.value, options])
    })

    watch(groupingFieldKey, () => {
      loadKanbanData()
    })

    // A new stacking field: the loaded cards are keyed by the old field's stacks, so drop them and
    // let the board load its window again
    watch(
      () => groupingFieldColumn.value?.id,
      (columnId, oldColumnId) => {
        if (!oldColumnId || columnId === oldColumnId || !useWindowedKanbanLoad.value) return
        stackLoadGeneration++
        formattedData.value = new Map<string | null, Row[]>()
        countByStack.value = new Map<string | null, number>()
        loadedStacks.value = new Set<string | null>()
      },
    )

    watch(
      () => (linkColOptions.value ? `${groupingFieldColumn.value?.id}:${linkColOptions.value.fk_related_model_id}` : null),
      (key) => {
        linkStackRecords.value = []
        hasMoreLinkStacks.value = false
        if (key) loadLinkStacks({ reset: true })
      },
      { immediate: true },
    )

    watch(
      () => (isSelectStack.value ? null : `${groupingFieldColumn.value?.id}:${viewMeta.value?.id}`),
      () => loadUsedStackKeys(),
      { immediate: true },
    )

    watch(
      () => (stackType.value === KanbanStackType.User && !isPublic.value ? (meta.value as TableType)?.base_id : undefined),
      (baseId) => {
        if (baseId) basesStore.getBaseUsers({ baseId }).catch(() => {})
      },
      { immediate: true },
    )

    const activeDataListener = ref<string | null>(null)

    // Saved view filters → trust the server's matchedViewIds. Ad-hoc URL `where` + toolbar search
    // → server can't know them, so AND them in client-side via rowMatchesSearchAndUrl.
    const recordPassesViewFilter = (data: DataPayload) => {
      // An `@me` view: the server's list never includes it, so its filters are evaluated here.
      if (isViewerScopedView.value) {
        if (!rowMatchesViewerScopedFilters(data.payload)) return false
      } else if (
        !isInterfaceSyntheticViewId(viewMeta.value?.id) &&
        Array.isArray(data.matchedViewIds) &&
        !data.matchedViewIds.includes(viewMeta.value?.id as string)
      ) {
        return false
      }
      return rowMatchesSearchAndUrl(data.payload)
    }

    // Refetches the loaded stacks (cards and counts) over what's on screen, keeping scrolled-in cards.
    // One runs at a time: a call during a run queues one rerun, which reads the counts it left.
    // Only the stacks on screen refetch in place; the board sets this from its scroll window.
    let visibleStackTitles: () => (string | null)[] | undefined = () => undefined
    // Same getter, reactive — stack totals load for the window on screen.
    const visibleStackTitlesSource = shallowRef<() => (string | null)[]>()
    const setVisibleStackTitles = (titles: () => (string | null)[]) => {
      visibleStackTitles = titles
      visibleStackTitlesSource.value = titles
    }

    // ---- Stack summary ("Summarize") ----

    // Native views read the kanban row's `summary_*` columns; interface vizzes
    // stamp `stack_summary` onto the same fields of the synthetic view.
    const stackSummary = computed(() => kanbanSummaryFromView(kanbanMetaData.value))

    const summaryMetaColumn = computed(() => {
      const id = stackSummary.value?.fk_column_id
      return id ? ((meta.value?.columns ?? []) as ColumnType[]).find((c) => c.id === id) : undefined
    })

    // A field hidden from this viewer (shared view / interface) isn't in the meta;
    // the server sends its display info along with the totals.
    const hiddenSummaryColumn = ref<ColumnType>()

    const stackSummaryColumn = computed(
      () =>
        summaryMetaColumn.value ??
        (hiddenSummaryColumn.value?.id === stackSummary.value?.fk_column_id ? hiddenSummaryColumn.value : undefined),
    )

    // Checked again on read: a formula's result can change without its own field being edited.
    // A field the viewer can't see is left to the server, which serves only the saved summary.
    const activeStackSummary = computed(() => {
      const summary = stackSummary.value
      if (!summary) return null
      if (summary.fn === KANBAN_SUMMARY_COUNT) return summary
      if (summaryMetaColumn.value) return isKanbanSummaryFnValid(summary.fn, summaryMetaColumn.value) ? summary : null
      return isPublic.value || interfaceDataApi ? summary : null
    })

    const isStackSummaryInvalid = computed(() => !!stackSummary.value && !activeStackSummary.value)

    const needsServerSummary = computed(() => !!activeStackSummary.value && activeStackSummary.value.fn !== KANBAN_SUMMARY_COUNT)

    // Count reads `countByStack`; the other functions fill this from the server.
    const summaryByStack = ref<Map<string | null, unknown>>(new Map())

    // A board can have thousands of stacks: totals load for the ones on screen, a
    // batch per request, and refetch only for stacks whose cards changed.
    const SUMMARY_BATCH_SIZE = 50
    const freshSummaryStacks = new Set<string | null>()
    const summaryInFlight = new Set<string | null>()
    // Per-stack record counts last seen, so a count change marks just that stack stale.
    const summaryCounts = new Map<string | null, number>()
    let summaryGeneration = 0
    // Bumped by every data change, so a batch in flight across one stays stale.
    let summaryChangeCount = 0

    const visibleWindowTitles = computed(() => visibleStackTitlesSource.value?.() ?? [...countByStack.value.keys()])

    async function fetchStackSummaries(titles: (string | null)[]) {
      const summary = activeStackSummary.value
      if (!needsServerSummary.value || !summary?.fk_column_id || !groupingField.value || !titles.length) return

      const generation = summaryGeneration
      const changeCountAtStart = summaryChangeCount
      const aggregation = [{ field: summary.fk_column_id, type: summary.fn }]
      // A link stack buckets on its foreign key: the link column's gb_eq compares the display value
      const fkId = linkFkColumnId.value
      const stackWhere = (title: string | null) => {
        // A junction link has no foreign key: `.Id` filters on the linked record's id
        if (isJunctionLinkStack.value) {
          return title === null ? `(${groupingField.value},blank)` : `(${groupingField.value}.Id,eq,${title})`
        }
        if (fkId) return title === null ? `(${fkId},null)` : `(${fkId},eq,${title})`
        return title === null ? `(${groupingField.value},gb_null)` : `(${groupingField.value},gb_eq,${title})`
      }

      titles.forEach((title) => summaryInFlight.add(title))
      try {
        for (let i = 0; i < titles.length; i += SUMMARY_BATCH_SIZE) {
          const batch = titles.slice(i, i + SUMMARY_BATCH_SIZE)
          const startCounts = batch.map((title) => summaryCounts.get(title))
          const startChangeCount = summaryChangeCount
          const aliasMapper = new AliasMapper()
          const buckets = batch.map((title) => ({ alias: aliasMapper.generateAlias(title), where: stackWhere(title) }))

          let response: Record<string, any> | undefined
          if (interfaceDataApi) {
            response = await interfaceDataApi.fetchBulkAggregate?.({
              aggregation,
              where: xWhere.value,
              filtersArr: nestedFilters.value,
              bulkFilterList: buckets,
            })
          } else if (isPublic.value) {
            response = await fetchBulkAggregatedData({ aggregation, where: xWhere.value }, buckets)
          } else {
            response = await $api.internal.postOperation(
              meta.value!.fk_workspace_id!,
              meta.value!.base_id!,
              {
                operation: 'bulkAggregate',
                tableId: meta.value!.id,
                viewId: viewMeta.value!.id,
                baseId: meta.value!.base_id!,
                aggregation,
              },
              buckets.map((bucket) => ({
                ...bucket,
                where: xWhere.value ? `${xWhere.value}~and${bucket.where}` : bucket.where,
                ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
              })),
            )
          }

          if (generation !== summaryGeneration) return

          const hiddenColumn = response?.[KANBAN_SUMMARY_COLUMN_KEY] as ColumnType | undefined
          if (hiddenColumn?.id) hiddenSummaryColumn.value = hiddenColumn
          const valueKey = hiddenColumn?.title ?? stackSummaryColumn.value?.title

          const next = new Map(summaryByStack.value)
          await aliasMapper.process(response ?? {}, (title, value: Record<string, unknown>) => {
            next.set(title as string | null, (valueKey ? value?.[valueKey] : undefined) ?? Object.values(value ?? {})[0] ?? null)
          })
          summaryByStack.value = next

          // A stack whose cards changed mid-request stays stale and refetches.
          batch.forEach((title, idx) => {
            if (summaryChangeCount === startChangeCount && summaryCounts.get(title) === startCounts[idx]) {
              freshSummaryStacks.add(title)
            }
          })
        }
      } catch {
        // Totals are secondary to the board: a failed fetch leaves the last values.
      } finally {
        titles.forEach((title) => summaryInFlight.delete(title))
        // Data changed mid-request: these stacks were skipped then, fetch them now.
        if (generation === summaryGeneration && summaryChangeCount !== changeCountAtStart) loadVisibleStackSummaries()
      }
    }

    function loadVisibleStackSummaries() {
      if (!needsServerSummary.value) return
      const known = new Set(countByStack.value.keys())
      const missing = visibleWindowTitles.value.filter(
        (title) => known.has(title) && !freshSummaryStacks.has(title) && !summaryInFlight.has(title),
      )
      if (missing.length) fetchStackSummaries(missing)
    }

    // Long enough that one request covers a scroll's pauses; maxWait keeps a continuous scroll loading.
    const scheduleVisibleSummaryLoad = useDebounceFn(loadVisibleStackSummaries, 400, { maxWait: 1200 })

    // Moves, adds, deletes and newly loaded stacks change counts: only those stacks go stale.
    // Value edits don't, so the edit paths call markStackSummariesStale() themselves.
    const markChangedStacksStale = useDebounceFn(() => {
      if (!needsServerSummary.value) return
      for (const [title, count] of countByStack.value) {
        if (summaryCounts.get(title) !== count) {
          summaryCounts.set(title, count)
          freshSummaryStacks.delete(title)
        }
      }
      loadVisibleStackSummaries()
    }, 300)

    // New summary, search or filters: every total is meaningless now.
    function resetStackSummaries() {
      summaryGeneration++
      freshSummaryStacks.clear()
      summaryInFlight.clear()
      summaryCounts.clear()
      summaryByStack.value = new Map()
      hiddenSummaryColumn.value = undefined
      markChangedStacksStale()
    }

    function markStackSummariesStale() {
      if (!needsServerSummary.value) return
      summaryChangeCount++
      freshSummaryStacks.clear()
      scheduleVisibleSummaryLoad()
    }

    function getStackSummaryValue(stackTitle: string | null) {
      if (!activeStackSummary.value) return undefined
      return activeStackSummary.value.fn === KANBAN_SUMMARY_COUNT
        ? countByStack.value.get(stackTitle) ?? 0
        : summaryByStack.value.get(stackTitle)
    }

    /** Native view only — interface summaries live in the viz config, set by the builder. */
    async function saveStackSummary(summary: KanbanStackSummary | null) {
      if (interfaceDataApi) return
      await updateKanbanMeta(kanbanSummaryToView(summary))
    }

    // A string key: a view save replaces the summary object, but only a real change resets.
    watch(
      () =>
        JSON.stringify([
          activeStackSummary.value?.fn,
          activeStackSummary.value?.fk_column_id,
          xWhere.value,
          nestedFilters.value ?? [],
        ]),
      resetStackSummaries,
    )

    // Counts only — a Map of numbers is cheap to watch; the cards themselves aren't walked.
    watch(
      () => (needsServerSummary.value ? [...countByStack.value].join('\n') : ''),
      () => markChangedStacksStale(),
    )

    watch(visibleWindowTitles, () => scheduleVisibleSummaryLoad())

    const refreshLoadedStacksInPlace = runOneQueueOne(async () => {
      try {
        if (!useWindowedKanbanLoad.value) return await loadKanbanData()

        // Stacks off screen go stale and refetch when they scroll back into view
        const visible = new Set(visibleStackTitles() ?? loadedStacks.value)
        const loaded = [...loadedStacks.value]
        loaded.filter((title) => !visible.has(title)).forEach((title) => loadedStacks.value.delete(title))

        const loadedCounts = new Map(
          loaded.filter((title) => visible.has(title)).map((title) => [title, formattedData.value.get(title)?.length ?? 0]),
        )
        loadedCounts.forEach((_, title) => loadedStacks.value.delete(title))
        await loadKanbanDataForStacks([...loadedCounts.keys()], { loadedCounts })
      } catch (e) {
        console.error('Failed to refresh kanban stacks', e)
      }
    })

    // Capped, so a steady stream of peer moves can't keep the counts stale; every client on the board
    // gets the same event, so each waits a little longer of its own.
    const refreshJitterMs = Math.random() * 1000
    const refreshLoadedStacks = useDebounceFn(refreshLoadedStacksInPlace, 500 + refreshJitterMs, {
      maxWait: 5000 + refreshJitterMs,
    })
    scheduleStackRefresh = () => {
      refreshLoadedStacks()
    }

    // The board's own drag: a deferred in-place write runs once it ends
    const setCardDragActive = (active: boolean) => {
      isCardDragActive = active
      if (!active && isInPlaceWriteDeferred) {
        isInPlaceWriteDeferred = false
        refreshLoadedStacks()
      }
    }

    const getStackKey = (row: Record<string, any>): string | null => getRowStackKey(row)

    const handleDataEvent = (data: DataPayload) => {
      const { id, action, payload, before } = data

      // The summary field may be hidden from this viewer, so the cards can look
      // unchanged when it moved: refetch the totals on screen on any change.
      markStackSummariesStale()

      if (action === 'bulk') {
        if (isUnlistedRowsChange(data)) {
          schedulePeerTableReload($eventBus.smartsheetStoreEventBus, meta?.value?.id)
          return
        }
        if (Array.isArray(data.rows)) {
          for (const row of data.rows) handleDataEvent(row)
        }
        return
      }

      // TODO: @mertmit handle filters and sort for newly added and updated records
      if (action === 'add') {
        try {
          const isValidationFailed = !recordPassesViewFilter(data)

          if (isValidationFailed) {
            return
          }

          const stackKey = getRowStackKey(payload)

          const newRow: Row = {
            row: payload,
            oldRow: { ...payload },
            rowMeta: {
              new: false,
              ...getEvaluatedRowMetaRowColorInfo(payload),
              buttonDisabled: evaluateButtonVisibility(payload),
            },
          }

          if (!formattedData.value.has(stackKey)) {
            formattedData.value.set(stackKey, [])
            countByStack.value.set(stackKey, 0)
          }

          const stackRows = formattedData.value.get(stackKey)!

          if (before) {
            const beforeIndex = stackRows.findIndex((row) => {
              const pk = extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])
              return pk && `${pk}` === `${before}`
            })
            if (beforeIndex !== -1) {
              stackRows.splice(beforeIndex, 0, newRow)
            } else {
              stackRows.push(newRow)
            }
          } else {
            stackRows.push(newRow)
          }

          countByStack.value.set(stackKey, (countByStack.value.get(stackKey) || 0) + 1)
          formattedData.value.set(stackKey, [...stackRows])
        } catch (e) {
          console.error('Failed to add row to kanban on socket event', e)
        }
      } else if (action === 'update') {
        try {
          const isValidationFailed = !recordPassesViewFilter(data)
          const isLoaded = [...formattedData.value.values()].some((rows) =>
            rows.some((row) => `${extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])}` === `${id}`),
          )

          // Unloaded card: the counts move only if it entered or left the view, and its stack is
          // known only while the grouping field kept its value.
          if (!isLoaded) {
            const countChange = unloadedRowCountChange(
              previousViewMembership(
                data.prevMatchedViewIds,
                viewMeta.value?.id,
                hasClientSideRowFilters.value,
                isViewerScopedView.value,
              ),
              isValidationFailed ? 'out' : 'in',
            )
            const stackKept = !!data.changedFields && !data.changedFields.includes(groupingField.value)

            if (countChange === 'none' && (isValidationFailed || stackKept)) return
            // Moved between stacks: the event has no old value, so the stack it left is unknown
            if (countChange === 'none') {
              refreshLoadedStacks()
              return
            }
            if (countChange === 'remove') {
              const stackKey = getStackKey(payload)
              if (stackKept && countByStack.value.has(stackKey)) {
                countByStack.value.set(stackKey, Math.max((countByStack.value.get(stackKey) || 0) - 1, 0))
              }
              return
            }
          }

          if (isValidationFailed) {
            handleDataEvent({ ...data, action: 'delete' })
            return
          }

          let found = null
          let foundStackKey = null
          let foundIndex = -1

          // Find the row across all stacks
          for (const [stackKey, rows] of formattedData.value.entries()) {
            const index = rows.findIndex((row) => {
              const pk = extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])
              return pk && `${pk}` === `${id}`
            })
            if (index !== -1) {
              found = rows[index]
              foundStackKey = stackKey
              foundIndex = index
              break
            }
          }

          if (!found) {
            handleDataEvent({ ...data, action: 'add' })
            return
          }

          const oldStackKey = foundStackKey
          const newStackKey = getRowStackKey(payload)

          // Update row data
          Object.assign(found.row, payload)
          Object.assign(found.oldRow, payload)
          Object.assign(found.rowMeta, getEvaluatedRowMetaRowColorInfo(payload))
          found.rowMeta.buttonDisabled = evaluateButtonVisibility(payload)
          found.rowMeta.changed = false

          // Handle stack change
          if (oldStackKey !== newStackKey) {
            // Remove from old stack
            const oldStackRows = formattedData.value.get(oldStackKey)!
            oldStackRows.splice(foundIndex, 1)
            formattedData.value.set(oldStackKey, [...oldStackRows])
            countByStack.value.set(oldStackKey, (countByStack.value.get(oldStackKey) || 0) - 1)

            // Add to new stack
            if (!formattedData.value.has(newStackKey)) {
              formattedData.value.set(newStackKey, [])
              countByStack.value.set(newStackKey, 0)
            }

            const newStackRows = formattedData.value.get(newStackKey)!
            newStackRows.push(found)
            formattedData.value.set(newStackKey, [...newStackRows])
            countByStack.value.set(newStackKey, (countByStack.value.get(newStackKey) || 0) + 1)
          } else {
            // Row stays in same stack
            const stackRows = formattedData.value.get(foundStackKey)!
            stackRows[foundIndex] = found
            formattedData.value.set(foundStackKey, [...stackRows])
          }
        } catch (e) {
          console.error('Failed to update row in kanban on socket event', e)
        }
      } else if (action === 'delete') {
        try {
          for (const [stackKey, rows] of formattedData.value.entries()) {
            const index = rows.findIndex((row) => {
              const pk = extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])
              return pk && `${pk}` === `${id}`
            })
            if (index !== -1) {
              const stackRows = formattedData.value.get(stackKey)!
              stackRows.splice(index, 1)
              formattedData.value.set(stackKey, [...stackRows])
              countByStack.value.set(stackKey, Math.max((countByStack.value.get(stackKey) || 0) - 1, 0))
              break
            }
          }
        } catch (e) {
          console.error('Failed to delete row from kanban on socket event', e)
        }
      } else if (action === 'reorder') {
        // A sort decides the order, not nc_order.
        if (sorts.value?.length) return

        try {
          const pkOf = (row: Row) => `${extractPkFromRow(row.row, meta?.value?.columns as ColumnType[])}`
          const reload = (stackKey: string | null) =>
            reloadStack(stackKey).catch((e) => console.error('Failed to reload kanban stack on reorder', e))

          for (const [stackKey, rows] of formattedData.value.entries()) {
            const index = rows.findIndex((row) => pkOf(row) === `${id}`)
            if (index === -1) continue

            const stackRows = [...rows]
            const [moved] = stackRows.splice(index, 1)
            const beforeIndex = before ? stackRows.findIndex((row) => pkOf(row) === `${before}`) : -1

            if (beforeIndex !== -1) {
              stackRows.splice(beforeIndex, 0, moved!)
              formattedData.value.set(stackKey, stackRows)
            } else if (!before && rows.length >= (countByStack.value.get(stackKey) ?? 0)) {
              stackRows.push(moved!)
              formattedData.value.set(stackKey, stackRows)
            } else {
              // `before` isn't in this stack's loaded cards: it may be in another stack, past this one's
              // window, or outside this view (order is table-wide), so the slot here is unknown.
              reload(stackKey)
            }
            return
          }

          // The card isn't loaded, but it now sits before a loaded card of its stack, so it's inside the window.
          const stackKey = getRowStackKey(payload)
          if (before && formattedData.value.get(stackKey)?.some((row) => pkOf(row) === `${before}`)) reload(stackKey)
        } catch (e) {
          console.error('Failed to reorder row in kanban on socket event', e)
        }
      }
    }

    async function reloadStack(stackKey: string | null) {
      markStackSummariesStale()
      if (!useWindowedKanbanLoad.value) return loadKanbanData()

      // Refetching resets the stack to its first page; top it back up so scrolled-in cards stay.
      const loadedCount = formattedData.value.get(stackKey)?.length ?? 0
      loadedStacks.value.delete(stackKey)
      await loadKanbanDataForStacks([stackKey])

      const reloadedCount = formattedData.value.get(stackKey)?.length ?? 0
      if (loadedCount > reloadedCount) {
        await loadMoreKanbanData(stackKey, { offset: reloadedCount, limit: loadedCount - reloadedCount })
      }
    }

    watch(
      meta,
      (newMeta, oldMeta) => {
        if (newMeta?.fk_workspace_id && newMeta?.base_id && newMeta?.id) {
          if (oldMeta?.id && oldMeta.id === newMeta.id) return

          // Clean up existing listeners
          if (activeDataListener.value) {
            $ncSocket.offMessage(activeDataListener.value)
          }

          // Set up data event listener
          activeDataListener.value = $ncSocket.onMessage(dataEventSubscriptionKey(newMeta, interfaceDataApi), handleDataEvent)
        }
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      eventBus.off(smartsheetStoreEventHandler)

      if (activeDataListener.value) {
        $ncSocket.offMessage(activeDataListener.value)
      }
    })

    return {
      loadKanbanData,
      loadKanbanDataForStacks,
      useWindowedKanbanLoad,
      loadedStacks,
      fetchNonEmptyStackTitles,
      loadMoreKanbanData,
      refreshLoadedStacksInPlace,
      setVisibleStackTitles,
      setCardDragActive,
      updateKanbanMeta,
      kanbanMetaData,
      formattedData,
      countByStack,
      groupingField,
      groupingFieldColOptions,
      groupingFieldColumn,
      updateOrSaveRow,
      updateRowProperty,
      saveRowStack,
      stackType,
      isSelectStack,
      getRowStackKey,
      getStackCellValue,
      buildStackMeta,
      loadLinkStacks,
      loadUsedStackKeys,
      hasMoreLinkStacks,
      isLinkStacksLoading,
      updateRecordOrder,
      addEmptyRow,
      addOrEditStackRow,
      deleteStack,
      removeRowFromUncategorizedStack,
      shouldScrollToRight,
      deleteRow,
      stackMetaObj,
      addNewStackId,
      updateStackProperty,
      updateAllStacksProperty,
      stackSummary,
      stackSummaryColumn,
      activeStackSummary,
      isStackSummaryInvalid,
      getStackSummaryValue,
      saveStackSummary,
      uncategorizedStackId,
    }
  },
  'kanban-view-store',
)

export { useProvideKanbanViewStore, useKanbanViewStore }

export function useKanbanViewStoreOrThrow() {
  const kanbanViewStore = useKanbanViewStore()

  if (kanbanViewStore == null) throw new Error('Please call `useProvideKanbanViewStore` on the appropriate parent component')

  return kanbanViewStore
}
