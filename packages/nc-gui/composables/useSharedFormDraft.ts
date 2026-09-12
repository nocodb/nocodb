import dayjs from 'dayjs'
import type { ColumnType, SelectOptionsType } from 'nocodb-sdk'
import { UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import type { FormDraft, FormDraftField } from '../helpers/FormDraftStorageManager'
import { formDraftStorageManager } from '../helpers/FormDraftStorageManager'

const SAVE_DEBOUNCE_MS = 500

/**
 * Field types we never persist to / restore from the draft.
 * - Attachment: `File` objects aren't serialisable.
 * - LTAR / Links: pointed-at rows in another table may have been deleted.
 * - System / readonly / computed: never editable in the form payload.
 */
const NON_DRAFTABLE_UITYPES = new Set<string>([
  UITypes.Attachment,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
  UITypes.Formula,
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  UITypes.Order,
  UITypes.ID,
  UITypes.ForeignKey,
  UITypes.AutoNumber,
  UITypes.Count,
  UITypes.SpecificDBType,
])

const NUMERIC_UITYPES = new Set<string>([UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Duration])

const DATE_UITYPES = new Set<string>([UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year])

export type FormDraftColumn = ColumnType & {
  show?: boolean | number | null
  read_only?: boolean
  permissions?: { isAllowedToEdit?: boolean }
}

interface UseSharedFormDraftOptions {
  sharedViewUuid: Ref<string | undefined>
  columns: Ref<FormDraftColumn[] | undefined>
  formState: Ref<Record<string, any>>
  submitted: Ref<boolean>
  isEnabled: ComputedRef<boolean>
  /** Default + prefilled values per column title. Anything in formState matching this baseline is treated as "untouched" and never persisted. */
  baselineState: ComputedRef<Record<string, any>>
  validUserIds?: ComputedRef<Set<string>>
}

function isSameValue(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => isSameValue(v, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }
  return String(a) === String(b)
}

export function useSharedFormDraft(opts: UseSharedFormDraftOptions) {
  const { sharedViewUuid, columns, formState, submitted, isEnabled, baselineState, validUserIds } = opts

  const wasRestored = ref(false)
  const restoredAt = ref<number | null>(null)

  function isFieldDraftable(col: FormDraftColumn | undefined): boolean {
    if (!col || !col.id || !col.title) return false
    if (!col.show) return false
    if (col.read_only) return false
    if (col.permissions && col.permissions.isAllowedToEdit === false) return false
    if (isSystemColumn(col)) return false
    if (isVirtualCol(col)) return false
    if (!col.uidt || NON_DRAFTABLE_UITYPES.has(col.uidt)) return false
    return true
  }

  function validateValueForColumn(col: FormDraftColumn, savedField: FormDraftField): { ok: true; value: any } | { ok: false } {
    if (!col.uidt || col.uidt !== savedField.uidt) return { ok: false }
    const uidt: string = col.uidt

    const v = savedField.value
    if (v === undefined || v === null) return { ok: false }

    if (NUMERIC_UITYPES.has(uidt)) {
      const num = Number(v)
      if (Number.isNaN(num)) return { ok: false }
      return { ok: true, value: num }
    }

    if (DATE_UITYPES.has(uidt)) {
      if (!dayjs(v).isValid()) return { ok: false }
      return { ok: true, value: v }
    }

    if (col.uidt === UITypes.Checkbox) {
      return { ok: true, value: !!v }
    }

    if (col.uidt === UITypes.Rating) {
      const max = Number(parseProp(col.meta)?.max ?? 5)
      const num = Number(v)
      if (Number.isNaN(num) || num > max) return { ok: false }
      return { ok: true, value: num }
    }

    if (col.uidt === UITypes.SingleSelect) {
      const options = (col.colOptions as SelectOptionsType | undefined)?.options ?? []
      const titles = new Set(options.map((o) => o.title))
      if (!titles.has(String(v))) return { ok: false }
      return { ok: true, value: v }
    }

    if (col.uidt === UITypes.MultiSelect) {
      if (!Array.isArray(v) && typeof v !== 'string') return { ok: false }
      const arr = Array.isArray(v) ? v : String(v).split(',')
      const options = (col.colOptions as SelectOptionsType | undefined)?.options ?? []
      const titles = new Set(options.map((o) => o.title))
      const kept = arr.filter((t) => titles.has(String(t)))
      if (!kept.length) return { ok: false }
      return { ok: true, value: Array.isArray(v) ? kept : kept.join(',') }
    }

    if (col.uidt === UITypes.User) {
      const allowed = validUserIds?.value
      if (!allowed || !allowed.size) return { ok: false }
      const arr = Array.isArray(v) ? v : [v]
      const kept = arr.filter((id) => typeof id === 'string' && allowed.has(id))
      if (!kept.length) return { ok: false }
      return { ok: true, value: Array.isArray(v) ? kept : kept[0] }
    }

    if (col.uidt === UITypes.JSON || col.uidt === UITypes.Geometry) {
      if (typeof v === 'object') return { ok: true, value: v }
      try {
        JSON.parse(String(v))
        return { ok: true, value: v }
      } catch {
        return { ok: false }
      }
    }

    return { ok: true, value: v }
  }

  function buildColumnIndex(): Map<string, FormDraftColumn> {
    const map = new Map<string, FormDraftColumn>()
    for (const col of columns.value ?? []) {
      if (col?.id) map.set(col.id, col)
    }
    return map
  }

  function restore(): void {
    if (!isEnabled.value) return
    const uuid = sharedViewUuid.value
    if (!uuid) return

    const draft = formDraftStorageManager.get(uuid)
    if (!draft || !draft.fields) return

    const colsById = buildColumnIndex()
    let applied = 0

    for (const [columnId, savedField] of Object.entries(draft.fields)) {
      const col = colsById.get(columnId)
      if (!isFieldDraftable(col)) continue

      const result = validateValueForColumn(col!, savedField)
      if (!result.ok) continue

      formState.value[col!.title!] = result.value
      applied++
    }

    if (applied > 0) {
      wasRestored.value = true
      restoredAt.value = draft.savedAt
    }
  }

  function serializeCurrentDraft(): FormDraft | null {
    const fields: Record<string, FormDraftField> = {}
    let count = 0
    const baseline = baselineState.value ?? {}

    for (const col of columns.value ?? []) {
      if (!isFieldDraftable(col)) continue
      const v = formState.value[col.title!]
      if (v === undefined || v === null) continue
      if (typeof v === 'string' && v.length === 0) continue
      if (Array.isArray(v) && v.length === 0) continue

      // Skip values that match the default/prefilled baseline — they aren't user-typed content.
      if (isSameValue(v, baseline[col.title!])) continue

      fields[col.id!] = { uidt: col.uidt!, value: v }
      count++
    }

    if (!count) return null
    return { savedAt: Date.now(), fields }
  }

  const debouncedSave = useDebounceFn(() => {
    if (!isEnabled.value) return
    if (submitted.value) return
    const uuid = sharedViewUuid.value
    if (!uuid) return

    const draft = serializeCurrentDraft()
    if (!draft) {
      formDraftStorageManager.clear(uuid)
      return
    }
    formDraftStorageManager.set(uuid, draft)
  }, SAVE_DEBOUNCE_MS)

  function clearDraft(): void {
    const uuid = sharedViewUuid.value
    if (uuid) formDraftStorageManager.clear(uuid)
    wasRestored.value = false
    restoredAt.value = null
  }

  /**
   * Hide the "draft restored" banner without touching the restored data.
   * Useful when the user has acknowledged the restore and wants to keep the values.
   */
  function dismissBanner(): void {
    wasRestored.value = false
  }

  /**
   * Wipe the saved draft AND reset every draftable field in `formState` back to its
   * baseline (column default / URL prefill). Non-draftable fields are left alone.
   */
  function discard(): void {
    clearDraft()
    const baseline = baselineState.value ?? {}
    for (const col of columns.value ?? []) {
      if (!isFieldDraftable(col)) continue
      const title = col.title!
      if (title in baseline) {
        formState.value[title] = baseline[title]
      } else {
        delete formState.value[title]
      }
    }
  }

  watch(
    formState,
    () => {
      if (!isEnabled.value || submitted.value) return
      debouncedSave()
    },
    { deep: true },
  )

  watch(submitted, (next) => {
    if (next) clearDraft()
  })

  watch(isEnabled, (next) => {
    if (!next) clearDraft()
  })

  return {
    wasRestored: readonly(wasRestored),
    restoredAt: readonly(restoredAt),
    restore,
    discard,
    clearDraft,
    dismissBanner,
  }
}
