<script setup lang="ts">
import type { ColumnType, TableSyncType, TableType, ViewType } from 'nocodb-sdk'
import {
  NcErrorType,
  PlanFeatureTypes,
  PlanTitles,
  TableSyncMappingRole,
  TableSyncOnDeleteAction,
  TableSyncTrigger,
  UITypes,
  ViewTypes,
  isLinksOrLTAR,
  isSystemColumn,
} from 'nocodb-sdk'

interface Props {
  value: boolean
  baseId: string
  sync?: TableSyncType
}

const props = defineProps<Props>()

const emits = defineEmits<{
  (e: 'update:value', value: boolean): void
  (e: 'syncCreated', jobId: string): void
  (e: 'saved'): void
}>()

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { dashboardUrl } = useDashboard()

const route = useRoute()

const { blockTableSyncAuto, getPlanTitle } = useEeConfig()

const tableSyncStore = useTableSyncStore()

const { createSync, updateSync, loadSyncs, resolveLink, fetchSourceSchema, activeBaseSyncs: activeBaseSyncsFn } = tableSyncStore

const activeBaseSyncs = computed(() => activeBaseSyncsFn(props.baseId))

const vOpen = useVModel(props, 'value', emits)

const isEditMode = computed(() => !!props.sync)

const mainMapping = computed(() => props.sync?.mappings?.find((m) => m.role === TableSyncMappingRole.Main))

const form = reactive({
  title: '',
  sourceWorkspaceId: '',
  sourceBaseId: '',
  sourceTableId: '',
  sourceViewId: '',
  // Default to automatic unless the plan gates it — then fall back to manual.
  syncTrigger: (blockTableSyncAuto.value ? TableSyncTrigger.Manual : TableSyncTrigger.Realtime) as TableSyncTrigger,
  // Default to MarkDeleted (Airtable parity) — avoids data loss when source filters change.
  onDeleteAction: TableSyncOnDeleteAction.MarkDeleted as TableSyncOnDeleteAction,
})

const isSaving = ref(false)

const saveError = ref<string | null>(null)

const titleError = computed(() => {
  const v = form.title.trim()
  if (!v) return t('labels.titleRequired')
  const duplicate = activeBaseSyncs.value.some((s) => s.id !== props.sync?.id && s.title === v)
  return duplicate ? t('msg.error.syncTitleAlreadyExists') : ''
})

const sourceTable = ref<TableType | null>(null)

const sourceColumns = computed<ColumnType[]>(() => sourceTable.value?.columns ?? [])

const isLoadingSourceColumns = ref(false)

// Column ids visible in the picked source view. `null` = not loaded yet (or no
// view selected) — treated as "show all" so the list never flashes empty while
// loading. The backend only ever syncs columns visible in the chosen grid view,
// so the field selector must mirror that: columns hidden in the view are not
// syncable and must not be offered for selection.
const visibleSourceColIds = ref<Set<string> | null>(null)

const selectFieldsEnabled = ref(false)

const excludedFieldTitles = ref<Set<string>>(new Set())

const linkViewByColumn = ref<Record<string, string>>({})

// Views of each linked source table, keyed by table id — served by the
// sync/share-authorized source-schema reads. When present, the per-link view
// picker uses these instead of self-fetching: the linked tables aren't in the
// user's stores (the modal lives in the dest base) and may not be readable
// via their own ACL at all. Empty in browse-mode create, where the user picked
// their own base and the picker's store fetch works.
const linkedViewsByTableId = ref<Record<string, ViewType[]>>({})

type SourceInputMode = 'browse' | 'paste'

const inputMode = ref<SourceInputMode>('browse')

const pasteForm = reactive({
  url: '',
  password: '',
  isResolving: false,
  isResolved: false,
  passwordRequired: false,
  resolvedSummary: '' as string,
  error: '' as string,
})

const isInitializing = ref(false)

// Snapshot of the titles already synced at edit-mode mount — used to detect
// removals on save and warn the user before dropping destination columns.
const originalIncludedTitles = ref<Set<string>>(new Set())

// Snapshot of the source view at edit-mode mount — used to detect re-bind
// and trigger the password prompt + backend's full-resync when the user
// swaps the source view.
const originalSourceViewId = ref<string>('')

// Password the user supplies when re-binding to a password-protected view.
// Verified server-side; not stored client-side beyond submit.
const editSourceViewPassword = ref<string>('')

// Edit-mode-only: the source table the sync was bound to no longer exists
// (deleted upstream). The destination schema is structurally tied to that
// table, so the sync can't be repaired — the only fix is to delete it.
const sourceTableMissing = ref(false)

// Edit-mode-only: the sync-authorized source-schema fetch failed for a reason
// other than a deleted source (network, etc.). With no source columns loaded,
// the field selector can't be trusted — so we disable it and, crucially, never
// send a (now-empty) `selected_fields` on save, which would drop every synced
// column. See `performUpdate`.
const sourceSchemaLoadFailed = ref(false)

// Edit-mode-only: the sync exists but its Main mapping row is missing
// (data integrity issue). Same recovery path as `sourceTableMissing` —
// can't be repaired in-place, only deleted.
const mainMappingMissing = computed(() => isEditMode.value && !mainMapping.value)

const isSyncBroken = computed(() => sourceTableMissing.value || mainMappingMissing.value)

const isBrokenSyncDeleteOpen = ref(false)

const UNSYNCABLE_UIDTS = new Set<string>([UITypes.Barcode, UITypes.QrCode, UITypes.Button])

interface SelectableField {
  title: string
  uidt: string
  column: ColumnType
  locked: boolean
  lockReason?: string
  linkedTableId?: string
  notSyncable?: boolean
}

const filterSourceTable = (table: TableType) => !table.synced

const filterSourceView = (view: ViewType) => view.type === ViewTypes.GRID

// Non-allow_sync views remain selectable; when picked, the inline
// "Enable sync" banner below offers a one-click toggle so the user can
// enable allow_sync without leaving the modal.
const sourceViewItemFlags = (view: ViewType) =>
  view.allow_sync ? { disabled: false } : { disabled: false, tooltip: t('tooltip.enableAllowSyncOnView') }

const supportedDocs = [
  { title: t('labels.gettingStartedWithSync'), href: 'https://nocodb.com/docs/product-docs/noco-sync' },
  { title: t('labels.settingUpNocoDBSync'), href: 'https://nocodb.com/docs/product-docs/noco-sync#add-new-sync' },
  { title: t('labels.troubleshootNocoDBSync'), href: 'https://nocodb.com/docs/product-docs/noco-sync#how-sync-works' },
]

const sourceViewChangedInEdit = computed(() => {
  if (!isEditMode.value) return false
  return !!originalSourceViewId.value && form.sourceViewId !== originalSourceViewId.value
})

const pickedSourceView = computed<ViewType | null>(() => {
  if (!form.sourceViewId || !sourceTable.value?.views) return null
  return sourceTable.value.views.find((v) => v.id === form.sourceViewId) ?? null
})

const editSourceViewPasswordRequired = computed(() => {
  if (!sourceViewChangedInEdit.value) return false
  return !!pickedSourceView.value?.password
})

const editSourceViewInvalidReason = computed<string>(() => {
  if (!sourceViewChangedInEdit.value) return ''
  const v = pickedSourceView.value
  if (!v) return t('msg.error.sourceViewNotFound')
  if (v.type !== ViewTypes.GRID) return t('tooltip.gridViewRequiredForSync')
  // allow_sync=off is handled by the dedicated banner with an inline
  // Enable CTA — don't duplicate the error here.
  return ''
})

const sourceViewNeedsAllowSync = computed(() => {
  // Hide in paste-mode of create — the link-resolve step already rejects
  // views without allow_sync and there's no sourceTable to introspect.
  if (!isEditMode.value && inputMode.value !== 'browse') return false
  return !!pickedSourceView.value && !pickedSourceView.value.allow_sync
})

const canSubmit = computed(() => {
  if (titleError.value) return false
  if (!form.title.trim()) return false
  if (isEditMode.value) {
    // Broken source: only the delete-sync CTA is actionable, never the
    // normal Save flow.
    if (isSyncBroken.value) return false
    if (editSourceViewInvalidReason.value) return false
    // Block save when the bound (or newly-picked) source view still has
    // allow_sync=off — the banner with the Enable CTA is the next step.
    if (sourceViewNeedsAllowSync.value) return false
    if (editSourceViewPasswordRequired.value && !editSourceViewPassword.value.trim()) return false
    return true
  }
  const sourceReady = !!form.sourceBaseId && !!form.sourceTableId && !!form.sourceViewId
  if (inputMode.value === 'paste' && !pasteForm.isResolved) return false
  return sourceReady
})

const eligibleFields = computed<SelectableField[]>(() => {
  return (
    sourceColumns.value
      .filter((col) => !!col.title && !!col.uidt && !isSystemColumn(col))
      // Only fields visible in the picked view are syncable. PV is always synced
      // (and can't be hidden in a grid view) so it's never filtered out. While the
      // view columns load (`visibleSourceColIds === null`) fall back to showing all.
      .filter((col) => col.pv || !visibleSourceColIds.value || (!!col.id && visibleSourceColIds.value.has(col.id)))
      .map<SelectableField>((col) => {
        const linkedTableId = isLinksOrLTAR(col)
          ? (col.colOptions as { fk_related_model_id?: string })?.fk_related_model_id
          : undefined
        if (UNSYNCABLE_UIDTS.has(col.uidt!)) {
          return {
            title: col.title!,
            uidt: col.uidt!,
            column: col,
            locked: true,
            lockReason: t('labels.fieldTypeNotSyncable'),
            linkedTableId,
            notSyncable: true,
          }
        }
        if (col.pv) {
          return {
            title: col.title!,
            uidt: col.uidt!,
            column: col,
            locked: true,
            lockReason: t('labels.primaryFieldAlwaysSync'),
            linkedTableId,
          }
        }
        return { title: col.title!, uidt: col.uidt!, column: col, locked: false, linkedTableId }
      })
  )
})

const togglableFields = computed(() => eligibleFields.value.filter((f) => !f.locked))

// The titles that will be synced after the user submits — mirrors the
// backend's "will include" rule (PV always; everything else only if the
// "select specific" switch is off OR not in excluded).
const currentIncludedTitles = computed<Set<string>>(() => {
  const s = new Set<string>()
  for (const f of eligibleFields.value) {
    if (f.notSyncable) continue
    if (f.locked) {
      // PV is always synced; "not syncable" was already filtered above so
      // any remaining locked field is a PV.
      s.add(f.title)
      continue
    }
    if (!selectFieldsEnabled.value) {
      s.add(f.title)
      continue
    }
    if (!excludedFieldTitles.value.has(f.title)) s.add(f.title)
  }
  return s
})

const removedFields = computed<SelectableField[]>(() => {
  if (!isEditMode.value) return []
  const removed: SelectableField[] = []
  for (const f of eligibleFields.value) {
    if (originalIncludedTitles.value.has(f.title) && !currentIncludedTitles.value.has(f.title)) {
      removed.push(f)
    }
  }
  return removed
})

const hasRemovedLink = computed(() => removedFields.value.some((f) => !!f.linkedTableId))

const isEnablingAllowSync = ref(false)

// Monotonic token so rapid (sourceTableId, sourceBaseId) flips don't let a
// stale fetch overwrite `sourceTable` with the wrong table's columns.
let loadColumnsToken = 0

const loadSourceColumns = async (tableId: string) => {
  if (!tableId || !form.sourceBaseId || !activeWorkspaceId.value) {
    sourceTable.value = null
    return
  }
  const token = ++loadColumnsToken
  isLoadingSourceColumns.value = true
  // Browse mode reads via the user's own ACL — the link-view picker self-fetches
  // there, so drop any sync-authorized lists from a previous resolve/edit load.
  linkedViewsByTableId.value = {}
  try {
    const res: TableType = await $api.internal.getOperation(activeWorkspaceId.value, form.sourceBaseId, {
      operation: 'tableGet',
      tableId,
    })
    if (token !== loadColumnsToken) return
    sourceTable.value = res ?? null
    sourceTableMissing.value = false
  } catch (e: any) {
    if (token !== loadColumnsToken) return
    // ERR_TABLE_NOT_FOUND in edit mode = source table was deleted upstream.
    // The destination schema is structurally tied to it, so the sync can't
    // be repaired — flip into broken state and let the user delete it.
    // Other errors (network etc.) still surface as a toast.
    const detail = await extractSdkResponseErrorMsgv2(e as Error & { response: any })
    if (isEditMode.value && detail.error === NcErrorType.ERR_TABLE_NOT_FOUND) {
      sourceTableMissing.value = true
    } else {
      message.error(detail.message || (await extractSdkResponseErrorMsg(e)))
    }
    sourceTable.value = null
  } finally {
    if (token === loadColumnsToken) isLoadingSourceColumns.value = false
  }
}

// Monotonic token so rapid view flips don't let a stale fetch overwrite
// `visibleSourceColIds` with the wrong view's visibility set.
let loadViewColumnsToken = 0

const loadViewVisibleColumns = async (viewId: string) => {
  if (!viewId || !form.sourceBaseId || !activeWorkspaceId.value) {
    visibleSourceColIds.value = null
    return
  }
  const token = ++loadViewColumnsToken
  try {
    const res = await $api.internal.getOperation(activeWorkspaceId.value, form.sourceBaseId, {
      operation: 'viewColumnList',
      viewId,
    })
    if (token !== loadViewColumnsToken) return
    const list = (res?.list ?? []) as Array<{ fk_column_id?: string; show?: boolean | number }>
    visibleSourceColIds.value = new Set(list.filter((c) => !!c.show && !!c.fk_column_id).map((c) => c.fk_column_id!))
  } catch (e: any) {
    if (token !== loadViewColumnsToken) return
    // Non-fatal — fall back to "show all" so the selector still works. The
    // backend remains the source of truth and will drop any hidden field anyway.
    visibleSourceColIds.value = null
  }
}

// Edit-mode source loader. Reads the source table's columns + the bound
// view's visible-column ids through the SYNC's authorization (the share view)
// instead of `tableGet`/`viewColumnList`, which enforce base-level ACL on the
// source base. The importing user often has no access to that base (the whole
// point of sync-from-shared-view), so the ACL-guarded path 403s — leaving the
// field selector blank and risking a destructive empty `selected_fields` on
// save. This endpoint mirrors the backend's createSync/updateSync source reads.
const loadSourceSchema = async (syncId: string) => {
  if (!activeWorkspaceId.value) return
  isLoadingSourceColumns.value = true
  try {
    const res = await fetchSourceSchema(props.baseId, syncId)
    if (!res) {
      sourceSchemaLoadFailed.value = true
      sourceTable.value = null
      visibleSourceColIds.value = null
      linkedViewsByTableId.value = {}
      return
    }
    if (res.source_table_missing) {
      // Drives the broken-source recovery banner — replaces the old reliance on
      // a tableGet ERR_TABLE_NOT_FOUND, which no longer fires now that the
      // source is read via the sync rather than the user's base access.
      sourceTableMissing.value = true
      sourceTable.value = null
      visibleSourceColIds.value = null
      linkedViewsByTableId.value = {}
      return
    }
    sourceTableMissing.value = false
    sourceSchemaLoadFailed.value = false
    sourceTable.value = {
      id: form.sourceTableId,
      base_id: form.sourceBaseId,
      columns: res.columns,
      views: res.views,
    } as TableType
    visibleSourceColIds.value = new Set(res.visible_source_column_ids ?? [])
    linkedViewsByTableId.value = res.linked_views ?? {}
  } catch (e: any) {
    sourceSchemaLoadFailed.value = true
    sourceTable.value = null
    visibleSourceColIds.value = null
    linkedViewsByTableId.value = {}
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoadingSourceColumns.value = false
  }
}

const enableAllowSyncOnSource = async () => {
  if (!form.sourceViewId || !form.sourceBaseId || !activeWorkspaceId.value) return
  if (isEnablingAllowSync.value) return
  isEnablingAllowSync.value = true
  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value,
      form.sourceBaseId,
      { operation: 'viewUpdate', viewId: form.sourceViewId },
      { allow_sync: true },
    )
    if (form.sourceTableId) {
      await loadSourceColumns(form.sourceTableId)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isEnablingAllowSync.value = false
  }
}

const isFieldChecked = (title: string) => {
  const field = eligibleFields.value.find((f) => f.title === title)
  if (field?.notSyncable) return false
  return !excludedFieldTitles.value.has(title)
}

const onLinkViewChange = (columnTitle: string, viewId: string | undefined | null) => {
  if (viewId) {
    linkViewByColumn.value = { ...linkViewByColumn.value, [columnTitle]: viewId }
  } else if (linkViewByColumn.value[columnTitle]) {
    const { [columnTitle]: _removed, ...rest } = linkViewByColumn.value
    linkViewByColumn.value = rest
  }
}

const toggleField = (field: SelectableField) => {
  if (field.locked) return
  const next = new Set(excludedFieldTitles.value)
  if (next.has(field.title)) next.delete(field.title)
  else next.add(field.title)
  // linkViewByColumn entries stay sticky here; stale ones get stripped at submit time.
  excludedFieldTitles.value = next
}

const setInputMode = (m: SourceInputMode) => {
  if (isEditMode.value) return
  inputMode.value = m
}

watch(
  () => form.sourceBaseId,
  () => {
    if (isEditMode.value || isInitializing.value) return
    saveError.value = null
    form.sourceTableId = ''
    form.sourceViewId = ''
    if (inputMode.value === 'browse' && form.sourceBaseId && activeWorkspaceId.value) {
      form.sourceWorkspaceId = activeWorkspaceId.value
    }
  },
)

watch(
  () => form.sourceTableId,
  async (v) => {
    if (isEditMode.value || isInitializing.value) return
    saveError.value = null
    form.sourceViewId = ''
    excludedFieldTitles.value = new Set()
    linkViewByColumn.value = {}
    selectFieldsEnabled.value = false
    sourceTable.value = null
    visibleSourceColIds.value = null
    await loadSourceColumns(v)
  },
)

watch(
  () => form.sourceViewId,
  async () => {
    if (isInitializing.value) return
    saveError.value = null
    await loadViewVisibleColumns(form.sourceViewId)
  },
)

watch(
  () => form.title,
  () => {
    if (isInitializing.value) return
    saveError.value = null
  },
)

// Keep link-view picks sticky across the toggle — submit only sends entries
// for included fields, so a stale entry can't leak in. Clearing them on
// toggle-off would silently destroy edit-mode picks loaded from the server.
watch(selectFieldsEnabled, (v) => {
  if (isInitializing.value) return
  saveError.value = null
  if (!v) excludedFieldTitles.value = new Set()
})

watch(inputMode, () => {
  if (isEditMode.value || isInitializing.value) return
  form.sourceWorkspaceId = ''
  form.sourceBaseId = ''
  form.sourceTableId = ''
  form.sourceViewId = ''
  excludedFieldTitles.value = new Set()
  linkViewByColumn.value = {}
  selectFieldsEnabled.value = false
  sourceTable.value = null
  visibleSourceColIds.value = null
  pasteForm.isResolved = false
  pasteForm.resolvedSummary = ''
  pasteForm.error = ''
  pasteForm.passwordRequired = false
  pasteForm.password = ''
})

// Invalidate the previous resolve as soon as the user edits the URL — keeps the
// "Resolved" indicator from lingering on a now-stale value.
watch(
  () => pasteForm.url,
  () => {
    if (isEditMode.value || isInitializing.value) return
    pasteForm.isResolved = false
    pasteForm.error = ''
    pasteForm.passwordRequired = false
    pasteForm.password = ''
  },
)

// Close the form on navigation (e.g. the upgrade flow redirects to /pricing) —
// NcModal doesn't dismiss on route change, so it would otherwise linger.
watch(
  () => route.fullPath,
  () => {
    if (vOpen.value) vOpen.value = false
  },
)

const resolvePastedLink = async () => {
  if (isEditMode.value) return
  if (!pasteForm.url.trim()) return
  pasteForm.error = ''
  pasteForm.isResolved = false
  pasteForm.resolvedSummary = ''
  pasteForm.isResolving = true
  try {
    const res = await resolveLink(props.baseId, {
      url: pasteForm.url.trim(),
      ...(pasteForm.password ? { password: pasteForm.password } : {}),
    })
    if (!res) {
      pasteForm.error = t('msg.error.failedToResolveLink')
      return
    }
    pasteForm.passwordRequired = false
    isInitializing.value = true
    try {
      form.sourceWorkspaceId = res.workspace_id
      form.sourceBaseId = res.base_id
      form.sourceTableId = res.table_id
      form.sourceViewId = res.view_id
      await nextTick()
    } finally {
      isInitializing.value = false
    }
    pasteForm.isResolved = true
    pasteForm.resolvedSummary = `${res.base_id} / ${res.table_id} / ${res.view_id}`
    sourceTableMissing.value = res.source_table_missing
    sourceTable.value = res.source_table_missing
      ? null
      : ({
          id: res.table_id,
          base_id: res.base_id,
          columns: res.columns,
          views: res.views,
        } as TableType)
    visibleSourceColIds.value = res.source_table_missing ? null : new Set(res.visible_source_column_ids ?? [])
    linkedViewsByTableId.value = res.source_table_missing ? {} : res.linked_views ?? {}
  } catch (e: any) {
    // Backend's allow_sync=false rejection bubbles up verbatim — guides the user to fix it source-side.
    const errMsg = (await extractSdkResponseErrorMsg(e)) || t('msg.error.failedToResolveLink')
    // Password challenge: the backend returns a 403 with "password" in the message
    // when the source view is password-protected and the supplied (or missing) password is wrong.
    if (/password/i.test(errMsg)) {
      pasteForm.passwordRequired = true
      // Don't surface the error on the first probe — wait until the user provides a password.
      pasteForm.error = pasteForm.password ? errMsg : ''
    } else {
      pasteForm.error = errMsg
    }
  } finally {
    pasteForm.isResolving = false
  }
}

const closeModal = () => {
  $e(isEditMode.value ? 'c:table-sync:edit:close' : 'c:table-sync:create:close')
  // Defensive: don't let passwords linger in component state across reopens.
  editSourceViewPassword.value = ''
  pasteForm.password = ''
  vOpen.value = false
}

// Triggered from the "source table deleted" banner. The sync can't be
// repaired because the destination schema is bound to the missing source
// table — the only sensible recovery is to delete it. Defer to the regular
// delete confirmation dialog so the user gets the same drop-tables /
// convert-to-plain choice as a normal delete.
const openBrokenSyncDelete = () => {
  if (!props.sync) return
  $e('c:table-sync:delete-broken')
  isBrokenSyncDeleteOpen.value = true
}

const onBrokenSyncDeleted = () => {
  emits('saved')
  vOpen.value = false
}

const performCreate = async () => {
  isSaving.value = true
  saveError.value = null
  try {
    // null = "sync all + future" on the backend; non-null array = explicit allow-list.
    let selectedFields: string[] | null = null
    let activeLinkViews: Record<string, string> | undefined
    if (selectFieldsEnabled.value) {
      selectedFields = eligibleFields.value
        .filter((f) => !f.notSyncable && !excludedFieldTitles.value.has(f.title))
        .map((f) => f.title)
      const active: Record<string, string> = {}
      for (const [title, viewId] of Object.entries(linkViewByColumn.value)) {
        if (!excludedFieldTitles.value.has(title)) active[title] = viewId
      }
      if (Object.keys(active).length) activeLinkViews = active
    }

    const created = await createSync(props.baseId, {
      title: form.title.trim(),
      ...(form.sourceWorkspaceId ? { source_workspace_id: form.sourceWorkspaceId } : {}),
      source_base_id: form.sourceBaseId,
      source_table_id: form.sourceTableId,
      source_view_id: form.sourceViewId,
      selected_fields: selectedFields,
      ...(activeLinkViews ? { link_view_by_column: activeLinkViews } : {}),
      sync_trigger: form.syncTrigger,
      on_delete_action: form.onDeleteAction,
      source_input_mode: inputMode.value,
    })
    emits('syncCreated', created?.sync_job_id || '')
    vOpen.value = false
  } catch (e: any) {
    saveError.value = (await extractSdkResponseErrorMsg(e)) || e?.message || t('msg.error.failedToCreateSync')
  } finally {
    isSaving.value = false
  }
}

const performUpdate = async () => {
  if (!props.sync) return
  isSaving.value = true
  saveError.value = null
  try {
    // Mirror createSync's serialization: null = sync all + future,
    // non-null array = explicit allow-list. The backend diffs this against
    // the sync's current selected_fields and applies the column delta.
    let selectedFields: string[] | null = null
    const activeLinkViews: Record<string, string> = {}
    if (selectFieldsEnabled.value) {
      selectedFields = eligibleFields.value
        .filter((f) => !f.notSyncable && !excludedFieldTitles.value.has(f.title))
        .map((f) => f.title)
    }
    for (const [title, viewId] of Object.entries(linkViewByColumn.value)) {
      if (selectFieldsEnabled.value && excludedFieldTitles.value.has(title)) continue
      activeLinkViews[title] = viewId
    }

    // If the source schema couldn't load, `eligibleFields` is empty and
    // `selectedFields` would serialize to `[]` — which the backend reads as
    // "sync nothing" and drops every synced column. Omit the field patch
    // entirely so reconcileFields leaves the current selection untouched; the
    // non-field settings (title/trigger/on-delete) still save.
    // Always send link_view_by_column alongside selected_fields — the backend's
    // reconcileFields treats undefined as `{}` and would otherwise drop the
    // link-view bindings restored on edit-mode mount.
    const fieldPatch = sourceSchemaLoadFailed.value
      ? {}
      : { selected_fields: selectedFields, link_view_by_column: activeLinkViews }

    await updateSync(props.baseId, props.sync.id, {
      title: form.title.trim(),
      sync_trigger: form.syncTrigger,
      on_delete_action: form.onDeleteAction,
      ...fieldPatch,
      ...(sourceViewChangedInEdit.value
        ? {
            source_view_id: form.sourceViewId,
            ...(editSourceViewPassword.value.trim() ? { password: editSourceViewPassword.value } : {}),
          }
        : {}),
    })
    emits('saved')
    vOpen.value = false
  } catch (e: any) {
    saveError.value = (await extractSdkResponseErrorMsg(e)) || e?.message
  } finally {
    isSaving.value = false
  }
}

const { showWarningModal } = useNcConfirmModal()

const confirmRemovalsThenUpdate = async () => {
  const titles = removedFields.value.map((f) => f.title)
  const titleList = titles.join(', ')
  const linkNote = hasRemovedLink.value ? `\n\n${t('msg.warning.removeSyncedLinkFieldDropsJunctionShadow')}` : ''
  showWarningModal({
    title: t('labels.confirmRemoveSyncedFields'),
    content: `${t('msg.warning.removeSyncedFieldsDropsColumns', { fields: titleList })}${linkNote}`,
    okText: t('general.remove'),
    showCancelBtn: true,
    okCallback: async () => {
      await performUpdate()
    },
  })
}

const submit = async () => {
  if (!canSubmit.value || isSaving.value) return
  if (isEditMode.value) {
    if (removedFields.value.length > 0) {
      await confirmRemovalsThenUpdate()
      return
    }
    await performUpdate()
    return
  }
  await performCreate()
}

const applyEditModeInitialValues = async () => {
  if (!props.sync) return
  isInitializing.value = true
  try {
    form.title = props.sync.title
    form.syncTrigger = props.sync.sync_trigger
    form.onDeleteAction = props.sync.on_delete_action
    inputMode.value = props.sync.source_input_mode === 'paste' ? 'paste' : 'browse'

    const mapping = mainMapping.value
    if (mapping) {
      form.sourceWorkspaceId = mapping.source_workspace_id
      form.sourceBaseId = mapping.source_base_id
      form.sourceTableId = mapping.source_table_id
      form.sourceViewId = mapping.source_view_id
      originalSourceViewId.value = mapping.source_view_id

      // Paste-mode edit needs a value in the URL field — reconstruct the
      // share URL from the stored uuid so the user sees the original link.
      if (inputMode.value === 'paste' && mapping.source_uuid) {
        pasteForm.url = `${dashboardUrl.value}/nc/view/${mapping.source_uuid}`
      }

      // Read the source table's columns AND the bound view's visible-column
      // ids in one sync-authorized call (see `loadSourceSchema`). Both feed the
      // eligibleFields-derived snapshots below, so hidden columns don't leak
      // into excluded/included sets on edit.
      await loadSourceSchema(props.sync.id)
    }

    // Derive link-view picks from LinkedShadow mappings: each shadow's
    // source_view_id is the view that was picked for every LTAR column on
    // the main source whose linked table matches the shadow's source_table_id.
    // The form has no other way to know what's currently bound, so without
    // this the user opens edit, sees empty link-view dropdowns, hits save,
    // and the backend's reconcileFields wipes the bindings.
    const linkedShadowByTableId = new Map<string, string>()
    for (const m of props.sync.mappings ?? []) {
      if (m.role === TableSyncMappingRole.LinkedShadow && m.source_view_id) {
        linkedShadowByTableId.set(m.source_table_id, m.source_view_id)
      }
    }
    if (linkedShadowByTableId.size) {
      const restored: Record<string, string> = {}
      for (const col of sourceColumns.value) {
        if (!col.title || !isLinksOrLTAR(col)) continue
        const linkedTableId = (col.colOptions as { fk_related_model_id?: string })?.fk_related_model_id
        if (!linkedTableId) continue
        const viewId = linkedShadowByTableId.get(linkedTableId)
        if (viewId) restored[col.title] = viewId
      }
      linkViewByColumn.value = restored
    }

    // selected_fields = null means "sync all"; non-null means a custom subset.
    if (props.sync.selected_fields !== null) {
      selectFieldsEnabled.value = true
      const selected = new Set(props.sync.selected_fields)
      excludedFieldTitles.value = new Set(
        eligibleFields.value.filter((f) => !f.locked && !selected.has(f.title)).map((f) => f.title),
      )
    }

    // Snapshot what's currently synced — anything missing from this set at
    // submit time triggers a confirm modal because removing it drops the
    // corresponding destination column.
    const initiallyIncluded = new Set<string>()
    for (const f of eligibleFields.value) {
      if (f.notSyncable) continue
      if (f.locked) {
        initiallyIncluded.add(f.title)
        continue
      }
      if (props.sync.selected_fields === null || props.sync.selected_fields.includes(f.title)) {
        initiallyIncluded.add(f.title)
      }
    }
    originalIncludedTitles.value = initiallyIncluded
  } finally {
    isInitializing.value = false
  }
}

onMounted(async () => {
  await loadSyncs(props.baseId)
  if (isEditMode.value) {
    await applyEditModeInitialValues()
    return
  }
  if (!form.title) {
    const existing = new Set(activeBaseSyncs.value.map((s) => s.title))
    let candidate = t('labels.syncedTable')
    let i = 2
    while (existing.has(candidate)) {
      candidate = `${t('labels.syncedTable')} ${i++}`
    }
    form.title = candidate
  }
})
</script>

<template>
  <NcModal v-model:visible="vOpen" centered size="lg" wrap-class-name="nc-modal-table-sync-form" @keydown.esc="closeModal">
    <template #header>
      <div class="flex w-full items-center pl-4 pr-3 py-3 justify-between">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <GeneralIcon class="text-nc-content-brand h-5 w-5" icon="ncZap" />
          <div class="text-base font-weight-700 truncate">
            {{ isEditMode ? $t('labels.editSync') : $t('labels.createSyncTable') }}
          </div>
        </div>

        <div class="flex justify-end items-center gap-3 flex-1">
          <NcButton
            v-e="[isEditMode ? 'c:table-sync:edit:cancel' : 'c:table-sync:create:cancel']"
            type="secondary"
            size="small"
            data-testid="nc-table-sync-cancel"
            @click.stop="closeModal"
          >
            {{ $t('general.cancel') }}
          </NcButton>

          <NcTooltip :disabled="canSubmit && !saveError">
            <template #title>
              {{ saveError || $t('tooltip.fillRequiredFields') }}
            </template>
            <NcButton
              v-e="[isEditMode ? 'c:table-sync:edit:submit' : 'c:table-sync:create:submit']"
              type="primary"
              size="small"
              :data-testid="isEditMode ? 'nc-table-sync-edit-save' : 'nc-table-sync-create'"
              :disabled="!canSubmit"
              :loading="isSaving"
              @click="submit"
            >
              {{ isEditMode ? $t('general.save') : $t('general.create') }}
            </NcButton>
          </NcTooltip>

          <NcButton
            v-e="[isEditMode ? 'c:table-sync:edit:close' : 'c:table-sync:create:close']"
            type="text"
            size="small"
            data-testid="nc-table-sync-close"
            @click.stop="closeModal"
          >
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="h-[calc(100%_-_57px)] flex">
      <div class="flex-1 h-full nc-scrollbar-thin relative">
        <div class="flex flex-col py-6 px-6 md:px-8 max-w-[768px] w-full min-w-[600px] mx-auto gap-8">
          <section class="flex flex-col gap-3">
            <div class="text-base font-weight-700 text-nc-content-gray">
              {{ $t('labels.general') }}
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-bodyDefaultSm text-nc-content-gray-subtle">
                {{ $t('labels.syncName') }} <span class="text-nc-content-red">*</span>
              </label>
              <a-input
                v-model:value="form.title"
                class="nc-input nc-input-sm nc-input-shadow"
                :placeholder="$t('placeholder.enterSyncName')"
                data-testid="nc-table-sync-title"
              />
              <div v-if="titleError" class="text-bodySm text-nc-content-red">{{ titleError }}</div>
            </div>
          </section>

          <a-divider class="!m-0" />

          <section class="flex flex-col gap-4">
            <div class="text-base font-weight-700 text-nc-content-gray">
              {{ $t('general.source') }}
            </div>

            <!-- Broken-sync recovery state: either the source table was
                 deleted upstream, or the sync's main mapping row is missing.
                 The dest schema is structurally tied to the original source,
                 so the only sensible action in either case is to delete. -->
            <div
              v-if="isEditMode && isSyncBroken"
              class="flex flex-col gap-3 p-4 border-1 border-nc-border-red rounded-lg bg-nc-bg-red-light"
              data-testid="nc-table-sync-source-missing"
            >
              <div class="flex items-start gap-2">
                <GeneralIcon icon="alertTriangle" class="text-nc-content-red h-4 w-4 mt-0.5 flex-none" />
                <div class="flex flex-col gap-1 min-w-0">
                  <div class="text-bodyDefaultSm font-weight-600 text-nc-content-gray">
                    {{ sourceTableMissing ? $t('msg.error.syncSourceTableDeleted') : $t('msg.error.syncMainMappingMissing') }}
                  </div>
                  <div class="text-bodySm text-nc-content-gray-muted">
                    {{
                      sourceTableMissing ? $t('msg.error.syncSourceTableDeletedDesc') : $t('msg.error.syncMainMappingMissingDesc')
                    }}
                  </div>
                </div>
              </div>
              <div class="flex justify-end">
                <NcButton
                  v-e="['c:table-sync:delete-broken']"
                  type="danger"
                  size="small"
                  data-testid="nc-table-sync-delete-broken"
                  @click="openBrokenSyncDelete"
                >
                  {{ $t('labels.deleteSync') }}
                </NcButton>
              </div>
            </div>

            <div v-if="!isSyncBroken" class="grid grid-cols-2 gap-3">
              <div
                v-e="['c:table-sync:source-mode', { mode: 'browse' }]"
                class="flex flex-col p-3 border-1 rounded-lg gap-1"
                :class="{
                  'cursor-pointer': !isEditMode,
                  'cursor-not-allowed': isEditMode,
                  'border-nc-border-brand !shadow-selected': inputMode === 'browse' && !isEditMode,
                  'border-nc-border-gray-extradark !shadow-disabled': inputMode === 'browse' && isEditMode,
                  'border-nc-border-gray-medium': inputMode !== 'browse' && !isEditMode,
                  'hover:shadow-hover': inputMode !== 'browse' && !isEditMode,
                  'border-nc-border-gray-medium opacity-60': inputMode !== 'browse' && isEditMode,
                }"
                data-testid="nc-table-sync-source-mode-browse"
                @click="setInputMode('browse')"
              >
                <div class="flex items-center justify-between">
                  <div class="text-nc-content-gray font-weight-600 text-caption">{{ $t('labels.sourceModeBrowse') }}</div>
                  <GeneralIcon v-if="inputMode === 'browse'" icon="ncCheckCircle" class="text-nc-content-brand h-4 w-4" />
                </div>
                <div class="text-nc-content-gray-muted text-bodySm">{{ $t('labels.sourceModeBrowseDesc') }}</div>
              </div>

              <div
                v-e="['c:table-sync:source-mode', { mode: 'paste' }]"
                class="flex flex-col p-3 border-1 rounded-lg gap-1"
                :class="{
                  'cursor-pointer': !isEditMode,
                  'cursor-not-allowed': isEditMode,
                  'border-nc-border-brand !shadow-selected': inputMode === 'paste' && !isEditMode,
                  'border-nc-border-gray-extradark !shadow-disabled': inputMode === 'paste' && isEditMode,
                  'border-nc-border-gray-medium': inputMode !== 'paste' && !isEditMode,
                  'hover:shadow-hover': inputMode !== 'paste' && !isEditMode,
                  'border-nc-border-gray-medium opacity-60': inputMode !== 'paste' && isEditMode,
                }"
                data-testid="nc-table-sync-source-mode-paste"
                @click="setInputMode('paste')"
              >
                <div class="flex items-center justify-between">
                  <div class="text-nc-content-gray font-weight-600 text-caption">{{ $t('labels.sourceModePasteLink') }}</div>
                  <GeneralIcon v-if="inputMode === 'paste'" icon="ncCheckCircle" class="text-nc-content-brand h-4 w-4" />
                </div>
                <div class="text-nc-content-gray-muted text-bodySm">{{ $t('labels.sourceModePasteLinkDesc') }}</div>
              </div>
            </div>

            <template v-if="!isSyncBroken && inputMode === 'browse'">
              <NcListBaseSelector
                v-model:value="form.sourceBaseId"
                :disabled="isEditMode"
                data-testid="nc-table-sync-base"
                force-layout="vertical"
              >
                <template #label>
                  <span class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('labels.base') }}</span>
                </template>
              </NcListBaseSelector>

              <div class="grid grid-cols-2 gap-3">
                <NcListTableSelector
                  :key="`tbl-${form.sourceBaseId}`"
                  v-model:value="form.sourceTableId"
                  :base-id="form.sourceBaseId || undefined"
                  :filter-table="filterSourceTable"
                  :disabled="isEditMode || !form.sourceBaseId"
                  force-layout="vertical"
                  data-testid="nc-table-sync-table"
                >
                  <template #label>
                    <span class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('objects.table') }}</span>
                  </template>
                </NcListTableSelector>

                <NcListViewSelector
                  :key="`vw-${form.sourceTableId}`"
                  v-model:value="form.sourceViewId"
                  :table-id="form.sourceTableId || undefined"
                  :base-id="form.sourceBaseId || undefined"
                  :filter-view="filterSourceView"
                  :item-flags="sourceViewItemFlags"
                  :disabled="!form.sourceTableId || isLoadingSourceColumns"
                  force-layout="vertical"
                  data-testid="nc-table-sync-view"
                >
                  <template #label>
                    <span class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('objects.view') }}</span>
                  </template>
                </NcListViewSelector>
              </div>

              <div
                v-if="sourceViewNeedsAllowSync"
                class="flex items-start justify-between gap-3 p-3 border-1 border-nc-border-orange rounded-lg bg-nc-bg-orange-light"
                data-testid="nc-table-sync-view-not-shared-banner"
              >
                <div class="flex items-start gap-2 min-w-0 flex-1">
                  <GeneralIcon icon="alertTriangle" class="text-nc-content-orange-dark h-4 w-4 mt-0.5 flex-none" />
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <div class="text-bodyDefaultSm font-weight-600 text-nc-content-gray">
                      {{ $t('msg.sourceViewNotShared') }}
                    </div>
                    <div class="text-bodySm text-nc-content-gray-muted">
                      {{ $t('msg.sourceViewNotSharedDesc') }}
                    </div>
                  </div>
                </div>
                <NcButton
                  v-e="['c:table-sync:enable-allow-sync']"
                  size="small"
                  type="secondary"
                  :loading="isEnablingAllowSync"
                  data-testid="nc-table-sync-enable-allow-sync"
                  @click="enableAllowSyncOnSource"
                >
                  {{ $t('labels.enableSync') }}
                </NcButton>
              </div>

              <!-- Edit-only: when the user picks a different view for re-bind,
                   surface password input (if the new view is protected),
                   any blocking validation error, and an info hint that the
                   re-bind will trigger a full resync. -->
              <div
                v-if="isEditMode && editSourceViewInvalidReason"
                class="flex items-start gap-2 text-bodySm text-nc-content-red"
                data-testid="nc-table-sync-edit-view-invalid"
              >
                <GeneralIcon icon="alertTriangle" class="h-3.5 w-3.5 mt-0.5 flex-none" />
                <span>{{ editSourceViewInvalidReason }}</span>
              </div>

              <div v-if="isEditMode && editSourceViewPasswordRequired" class="flex flex-col gap-1.5">
                <label class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('labels.password') }}</label>
                <a-input-password
                  v-model:value="editSourceViewPassword"
                  class="nc-input nc-input-sm nc-input-shadow"
                  autocomplete="new-password"
                  :placeholder="$t('placeholder.password.enter')"
                  data-testid="nc-table-sync-edit-view-password"
                />
              </div>

              <div
                v-if="isEditMode && sourceViewChangedInEdit && !editSourceViewInvalidReason"
                class="flex items-start gap-2 text-bodySm text-nc-content-gray-muted"
              >
                <GeneralIcon icon="info" class="h-3.5 w-3.5 mt-0.5 flex-none" />
                <span>{{ $t('msg.info.sourceViewRebindResync') }}</span>
              </div>
            </template>

            <template v-else-if="!isSyncBroken">
              <div class="flex flex-col gap-1.5">
                <label class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('labels.sharedViewLink') }}</label>
                <a-input
                  v-model:value="pasteForm.url"
                  class="nc-input nc-input-sm nc-input-shadow"
                  placeholder="https://…/nc/view/…"
                  :disabled="isEditMode"
                  data-testid="nc-table-sync-paste-url"
                  @blur="resolvePastedLink"
                  @press-enter="resolvePastedLink"
                />
              </div>

              <div v-if="!isEditMode && pasteForm.passwordRequired && !pasteForm.isResolved" class="flex flex-col gap-1.5">
                <label class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('labels.password') }}</label>
                <a-input-password
                  v-model:value="pasteForm.password"
                  class="nc-input nc-input-sm nc-input-shadow"
                  autocomplete="new-password"
                  :placeholder="$t('placeholder.password.enter')"
                  :disabled="isEditMode"
                  data-testid="nc-table-sync-paste-password"
                  @blur="resolvePastedLink"
                  @press-enter="resolvePastedLink"
                />
              </div>

              <div
                v-if="!isEditMode && (pasteForm.isResolving || pasteForm.isResolved || pasteForm.error)"
                class="flex items-center gap-2 text-bodySm"
              >
                <template v-if="pasteForm.isResolving">
                  <GeneralLoader class="flex-none" />
                  <span class="text-nc-content-gray-muted">{{ $t('labels.resolving') }}…</span>
                </template>
                <template v-else-if="pasteForm.error">
                  <GeneralIcon icon="alertTriangle" class="text-nc-content-red h-4 w-4 flex-none" />
                  <span class="text-nc-content-red">{{ pasteForm.error }}</span>
                </template>
                <template v-else-if="pasteForm.isResolved">
                  <GeneralIcon icon="ncCheckCircle" class="text-nc-content-brand h-4 w-4 flex-none" />
                  <NcTooltip show-on-truncate-only class="truncate text-nc-content-gray-muted">
                    {{ $t('labels.resolvedSource') }}: {{ pasteForm.resolvedSummary }}
                  </NcTooltip>
                </template>
              </div>
            </template>

            <div v-if="!isSyncBroken" class="flex flex-col gap-1.5">
              <label class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('labels.fieldsToSync') }}</label>
              <div class="text-bodySm text-nc-content-gray-muted">{{ $t('labels.allFieldsAreSyncedByDefault') }}</div>
              <div
                class="flex items-center justify-between gap-3 px-3 py-2 border-1 border-nc-border-gray-medium rounded-lg"
                :class="{ 'opacity-60 cursor-not-allowed': !form.sourceTableId || sourceSchemaLoadFailed }"
                data-testid="nc-table-sync-fields-toggle"
              >
                <div class="flex items-center gap-2">
                  <NcSwitch
                    v-model:checked="selectFieldsEnabled"
                    size="small"
                    :disabled="!form.sourceTableId || isLoadingSourceColumns || sourceSchemaLoadFailed"
                  />
                  <span class="text-caption text-nc-content-gray">{{ $t('labels.selectSpecificFieldsToSync') }}</span>
                </div>
              </div>

              <div
                v-if="selectFieldsEnabled"
                class="flex flex-col border-1 border-nc-border-gray-medium rounded-lg max-h-64 overflow-auto nc-scrollbar-thin"
                data-testid="nc-table-sync-fields-list"
              >
                <div v-if="isLoadingSourceColumns" class="flex items-center justify-center px-3 py-4">
                  <GeneralLoader />
                </div>

                <template v-else-if="eligibleFields.length">
                  <div
                    v-for="(field, idx) in eligibleFields"
                    :key="field.title"
                    class="flex flex-col gap-2 px-3 py-2"
                    :class="[idx !== 0 ? 'border-t-1 border-nc-border-gray-medium' : '']"
                    :data-testid="`nc-table-sync-field-${field.title}`"
                  >
                    <div
                      class="flex items-center justify-between gap-3"
                      :class="field.locked ? 'cursor-not-allowed' : 'cursor-pointer'"
                      @click="toggleField(field)"
                    >
                      <div class="flex items-center gap-2 min-w-0 flex-1">
                        <NcTooltip :disabled="!field.locked || !field.lockReason" :title="field.lockReason" placement="top">
                          <span class="inline-flex">
                            <NcCheckbox
                              :checked="isFieldChecked(field.title)"
                              :disabled="field.locked"
                              @click.stop
                              @change="toggleField(field)"
                            />
                          </span>
                        </NcTooltip>
                        <SmartsheetHeaderIcon :column="field.column" class="flex-none !mx-0 !text-nc-content-gray-muted" />
                        <NcTooltip show-on-truncate-only class="truncate text-caption text-nc-content-gray">
                          {{ field.title }}
                        </NcTooltip>
                      </div>
                    </div>

                    <div v-if="field.linkedTableId && isFieldChecked(field.title)" class="pl-7 flex flex-col gap-1" @click.stop>
                      <NcListViewSelector
                        :key="`lvw-${field.title}-${field.linkedTableId}`"
                        :value="linkViewByColumn[field.title] || ''"
                        :table-id="field.linkedTableId"
                        :base-id="form.sourceBaseId || undefined"
                        :views="linkedViewsByTableId[field.linkedTableId]"
                        :filter-view="filterSourceView"
                        :item-flags="sourceViewItemFlags"
                        force-layout="vertical"
                        disable-label
                        allow-clear
                        :data-testid="`nc-table-sync-link-view-${field.title}`"
                        @update:value="onLinkViewChange(field.title, $event)"
                      />
                      <div
                        v-if="!linkViewByColumn[field.title]"
                        class="flex items-start gap-1.5 text-bodySm text-nc-content-gray-muted"
                      >
                        <GeneralIcon icon="info" class="flex-none h-3.5 w-3.5 mt-0.5" />
                        <span>{{ $t('labels.linkNoViewAutoPickInfo') }}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="!togglableFields.length"
                    class="px-3 py-2 text-bodySm text-nc-content-gray-muted border-t-1 border-nc-border-gray-medium"
                  >
                    {{ $t('labels.primaryFieldAlwaysSync') }}
                  </div>
                </template>

                <div v-else class="px-3 py-3 text-bodySm text-nc-content-gray-muted">
                  {{ $t('labels.noFieldsAvailableToSelect') }}
                </div>
              </div>
            </div>
          </section>

          <a-divider v-if="!isSyncBroken" class="!m-0" />

          <section v-if="!isSyncBroken" class="flex flex-col gap-4">
            <div class="text-base font-weight-700 text-nc-content-gray">
              {{ $t('labels.syncSettings') }}
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-bodyDefaultSm text-nc-content-gray-subtle">{{ $t('labels.syncMethod') }}</label>
              <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO">
                <template #default="{ click }">
                  <div class="grid grid-cols-2 gap-3">
                    <div
                      v-e="['c:table-sync:trigger', { trigger: TableSyncTrigger.Realtime }]"
                      class="flex flex-col p-3 border-1 rounded-lg gap-2 cursor-pointer"
                      :class="
                        form.syncTrigger === TableSyncTrigger.Realtime
                          ? 'border-nc-border-brand !shadow-selected'
                          : 'border-nc-border-gray-medium hover:shadow-hover'
                      "
                      data-testid="nc-table-sync-method-auto"
                      @click="
                        click(PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO, () => (form.syncTrigger = TableSyncTrigger.Realtime))
                      "
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <div class="text-nc-content-gray font-weight-600 text-caption">{{ $t('labels.automatically') }}</div>
                          <LazyPaymentUpgradeBadge
                            :feature="PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO"
                            :content="
                              $t('upgrade.upgradeToUseAutomaticSyncSubtitle', { plan: getPlanTitle(PlanTitles.BUSINESS) })
                            "
                          />
                        </div>
                        <GeneralIcon
                          v-if="form.syncTrigger === TableSyncTrigger.Realtime"
                          icon="ncCheckCircle"
                          class="text-nc-content-brand h-4 w-4"
                        />
                      </div>
                      <div class="text-nc-content-gray-muted text-bodySm">{{ $t('labels.automaticallyDesc') }}</div>
                    </div>

                    <div
                      v-e="['c:table-sync:trigger', { trigger: TableSyncTrigger.Manual }]"
                      class="flex flex-col p-3 border-1 rounded-lg gap-2 cursor-pointer"
                      :class="
                        form.syncTrigger === TableSyncTrigger.Manual
                          ? 'border-nc-border-brand !shadow-selected'
                          : 'border-nc-border-gray-medium hover:shadow-hover'
                      "
                      data-testid="nc-table-sync-method-manual"
                      @click="form.syncTrigger = TableSyncTrigger.Manual"
                    >
                      <div class="flex items-center justify-between">
                        <div class="text-nc-content-gray font-weight-600 text-caption">{{ $t('labels.manually') }}</div>
                        <GeneralIcon
                          v-if="form.syncTrigger === TableSyncTrigger.Manual"
                          icon="ncCheckCircle"
                          class="text-nc-content-brand h-4 w-4"
                        />
                      </div>
                      <div class="text-nc-content-gray-muted text-bodySm">{{ $t('labels.manuallyDesc') }}</div>
                    </div>
                  </div>
                </template>
              </PaymentUpgradeBadgeProvider>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-bodyDefaultSm text-nc-content-gray-subtle">
                {{ $t('labels.recordsDeletedInSourceWillBe') }}
              </label>
              <div class="flex flex-col border-1 border-nc-border-gray-medium rounded-lg overflow-hidden">
                <div
                  v-e="['c:table-sync:on-delete', { action: TableSyncOnDeleteAction.Delete }]"
                  class="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  :class="{ 'bg-nc-bg-gray-extralight': form.onDeleteAction === TableSyncOnDeleteAction.Delete }"
                  @click="form.onDeleteAction = TableSyncOnDeleteAction.Delete"
                >
                  <div class="nc-radio" :data-checked="form.onDeleteAction === TableSyncOnDeleteAction.Delete">
                    <div class="nc-radio-dot"></div>
                  </div>
                  <span class="text-caption text-nc-content-gray">{{ $t('labels.deletedInMirroredTable') }}</span>
                </div>
                <div class="border-t-1 border-nc-border-gray-medium"></div>
                <div
                  v-e="['c:table-sync:on-delete', { action: TableSyncOnDeleteAction.MarkDeleted }]"
                  class="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  :class="{ 'bg-nc-bg-gray-extralight': form.onDeleteAction === TableSyncOnDeleteAction.MarkDeleted }"
                  @click="form.onDeleteAction = TableSyncOnDeleteAction.MarkDeleted"
                >
                  <div class="nc-radio" :data-checked="form.onDeleteAction === TableSyncOnDeleteAction.MarkDeleted">
                    <div class="nc-radio-dot"></div>
                  </div>
                  <span class="text-caption text-nc-content-gray">{{ $t('labels.retainedInMirroredTable') }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <NcModalSupportedDocsSidebar>
        <NcModalSupportedDocs :docs="supportedDocs" />
      </NcModalSupportedDocsSidebar>
    </div>

    <ProjectSyncTableDelete
      v-if="props.sync && isBrokenSyncDeleteOpen"
      v-model:value="isBrokenSyncDeleteOpen"
      :base-id="props.baseId"
      :sync="props.sync"
      @deleted="onBrokenSyncDeleted"
    />
  </NcModal>
</template>

<style lang="scss">
.nc-modal-table-sync-form {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>

<style scoped lang="scss">
.nc-radio {
  @apply border-1 min-w-4 w-4 h-4 flex items-center justify-center rounded-full border-nc-border-gray-medium;

  &[data-checked='true'] {
    @apply bg-nc-brand-500 border-nc-brand-500;

    .nc-radio-dot {
      @apply block bg-nc-bg-default w-1.5 h-1.5 min-w-1.5 rounded-full;
    }
  }

  &[data-checked='false'] {
    .nc-radio-dot {
      @apply hidden;
    }
  }
}
</style>
