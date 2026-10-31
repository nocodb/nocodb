import dayjs from 'dayjs'
import {
  PermissionEntity,
  PermissionKey,
  RelationTypes,
  UITypes,
  isAIPromptCol,
  isBtLikeV2Junction,
  isLinkV2,
  isLinksOrLTAR,
  isSystemColumn,
  isValidPhoneNumber,
  isValidURL,
  validateEmail,
} from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, SelectOptionType, TableType } from 'nocodb-sdk'
import { timeFormatsObj } from '~/components/cell/DateTime/utils'
import { getSelectedUsers, getOptions as getUserOptions } from '~/components/cell/User/utils'
import type { CmdCommand, CmdEdit } from '~/lib/types'
import {
  applyCmdCheckboxEdit,
  applyCmdDateEdit,
  applyCmdListEdit,
  applyCmdNumberEdit,
  applyCmdSelectEdit,
  applyCmdTextEdit,
  applyCmdTimeEdit,
  cmdFieldWordMatches,
  cmdFillAccepts,
  cmdFillValues,
  cmdShiftSeconds,
  matchCmdName,
  parseCmdFill,
  parseCmdRelativeEdits,
} from '~/utils/commandPaletteRelativeEdit'
import type { CmdFill, CmdFillType, CmdRelativeEdit } from '~/utils/commandPaletteRelativeEdit'
import { applyLtarCellOp } from '~/utils/ltarDeferredOps'

interface SetFieldTarget {
  meta?: TableType
  /** Editable candidates in view order; `hidden` ones are listed only when searching. */
  columns: Array<{ column: ColumnType; hidden?: boolean }>
  /** The column's current value on every targeted record. */
  values: (column: ColumnType) => unknown[]
  /** Applies `next` to every targeted record, in visual order (`index`); throws to show the error inline. */
  save: (column: ColumnType, next: (prev: unknown, index?: number) => unknown) => Promise<unknown>
  section: string
  /** Records targeted; above one the titles say "for N records". */
  count?: number
  feedback?: string
  /** The single targeted record's row (mutated in place); enables Link/Unlink for link fields. */
  row?: Record<string, any>
  /** Runs after a link or unlink, e.g. to repaint the canvas. */
  afterSave?: () => void
}

type RelativeEditTarget = SetFieldTarget & {
  activeColumnId?: string
  /** Offers fills ("fill down", "number rows"): a cell range fills its column(s), checked rows the fitting fields. */
  fill?: 'range' | 'rows'
  /** Records named in the confirm dialog's change list ("Acme: Lead → Won"); asking first even for one record. */
  rowLabels?: string[]
}

/** Changes listed in a confirm dialog before "… +N more". */
const CONFIRM_LIST_MAX = 3

interface LinkListState {
  loading: boolean
  /** The request failed; the submenu says so instead of looking empty. */
  error?: boolean
  list: Record<string, any>[]
  loadedAt: number
}

/** Related tables whose meta was already requested, so a table the user can't read isn't re-fetched per read. */
const requestedRelatedMetas = new Set<string>()

/** First page the link picker would show; the palette filters it as you type. */
const LINK_LIST_LIMIT = 50

const LINK_LIST_TTL_MS = 15_000

const SETTABLE_UIDTS: string[] = [
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.Checkbox,
  UITypes.User,
  UITypes.Rating,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
]

const NUMERIC_UIDTS: string[] = [UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Rating]

/** At most this many fields get a row when the query names none and no field is active. */
const RELATIVE_EDIT_MAX_FIELDS = 4

type CanEdit = ReturnType<typeof usePermissions>['isAllowed']

/** Types only relative edits change ("+1h" on a duration); Set field has no picker for them. */
const RELATIVE_ONLY_UIDTS: string[] = [UITypes.Duration, UITypes.Time, UITypes.Year]

const TEXT_UIDTS: string[] = [UITypes.SingleLineText, UITypes.LongText]

function isSettableColumn(column: ColumnType, isAllowed: CanEdit, extraUidts: string[] = []) {
  const settable = SETTABLE_UIDTS.includes(column.uidt!) || extraUidts.includes(column.uidt!)
  if (!settable || column.pk || column.ai || column.readonly || isSystemColumn(column)) {
    return false
  }
  // Rich text and AI prompts have their own editors.
  if (column.uidt === UITypes.LongText && (parseProp(column.meta).richMode || isAIPromptCol(column))) return false
  return !column.id || isAllowed(PermissionEntity.FIELD, column.id, PermissionKey.RECORD_FIELD_EDIT)
}

/** "Set <Field>…" commands, Linear style, for one record or a selection; the caller gates the surface. */
export function useSetFieldCommands() {
  const { t } = useI18n()

  const { isAllowed } = usePermissions()

  const { user } = useGlobal()

  const { basesUser } = storeToRefs(useBases())

  const { $api } = useNuxtApp()

  const { getMeta, getMetaByKey } = useMetas()

  // Interface pages link through page-scoped ops with element-level record limits; not offered there.
  const interfaceDataApi = inject(InterfacePageDataInj, undefined)

  /** Linkable / linked records per `kind:column:row`, loaded when a submenu first asks. */
  const linkLists = reactive(new Map<string, LinkListState>())

  function isLinkable(column: ColumnType) {
    if (!isLinksOrLTAR(column) || column.readonly || isSystemColumn(column)) return false
    return !column.id || isAllowed(PermissionEntity.FIELD, column.id, PermissionKey.RECORD_FIELD_EDIT)
  }

  function isSingleTarget(column: ColumnType) {
    const type = (column.colOptions as LinkToAnotherRecordType)?.type
    return (
      type === RelationTypes.BELONGS_TO ||
      type === RelationTypes.ONE_TO_ONE ||
      type === RelationTypes.MANY_TO_ONE ||
      isBtLikeV2Junction(column)
    )
  }

  function relatedMetaOf(column: ColumnType) {
    const colOptions = column.colOptions as LinkToAnotherRecordType
    return getMetaByKey(colOptions?.fk_related_base_id || column.base_id, colOptions?.fk_related_model_id)
  }

  function loadLinkList(key: string, kind: 'linkable' | 'linked', meta: TableType, column: ColumnType, rowId: string) {
    const existing = linkLists.get(key)
    if (existing && (existing.loading || Date.now() - existing.loadedAt < LINK_LIST_TTL_MS)) return

    linkLists.set(key, { loading: true, list: existing?.list ?? [], loadedAt: 0 })
    const type = (column.colOptions as LinkToAnotherRecordType).type as RelationTypes
    const query = { limit: LINK_LIST_LIMIT, offset: 0 }

    const isSingleV1 = kind === 'linked' && isSingleTarget(column) && !isLinkV2(column)

    // Same endpoints as the link picker's "link" and "linked records" lists; a single-target v1 link
    // has no list endpoint, so its record is read from the row (needed when the view didn't load the field).
    const request = isSingleV1
      ? $api.dbTableRow
          .read(NOCO, meta.base_id!, meta.id!, encodeURIComponent(rowId), { getHiddenColumn: true })
          .then((record: Record<string, any>) => record?.[column.title!] ?? null)
      : kind === 'linkable'
      ? $api.dbTableRow.nestedChildrenExcludedList(
          NOCO,
          meta.base_id!,
          meta.id!,
          encodeURIComponent(rowId),
          type,
          column.id!,
          query,
        )
      : $api.dbTableRow.nestedList(NOCO, meta.base_id!, meta.id!, encodeURIComponent(rowId), type, column.id!, query)

    request
      .then((result: unknown) => {
        // Single-target relations return the related row itself (or nothing) instead of a page.
        const page = result as { list?: Record<string, any>[] } | Record<string, any> | null
        const list = !page ? [] : Array.isArray(page.list) ? page.list : Object.keys(page).length ? [page] : []
        linkLists.set(key, { loading: false, list, loadedAt: Date.now() })
      })
      .catch(() => linkLists.set(key, { loading: false, error: true, list: [], loadedAt: Date.now() }))
  }

  const isSettable = (column: ColumnType) => isSettableColumn(column, isAllowed)

  return function setFieldCommands(target: SetFieldTarget): CmdCommand[] {
    const count = target.count ?? 1
    const isMany = count > 1
    const userId = user.value?.id

    function title(column: ColumnType) {
      return isMany
        ? t('labels.commandPalette.setFieldForRecords', { field: column.title, count }, count)
        : t('labels.commandPalette.setFieldTitle', { field: column.title })
    }

    // One value for every target, or undefined when they differ.
    function common(column: ColumnType) {
      const values = target.values(column)
      const first = values[0]
      return values.every((value) => String(value ?? '') === String(first ?? '')) ? first : undefined
    }

    function textEdit(column: ColumnType): CmdEdit {
      const meta = parseProp(column.meta)
      const value = common(column)
      return {
        value: value === null || value === undefined ? '' : String(value),
        multiline: column.uidt === UITypes.LongText,
        placeholder: column.title,
        validate: (input) => {
          if (!input) return
          switch (column.uidt) {
            case UITypes.Number:
              return Number.isInteger(Number(input)) ? undefined : t('labels.commandPalette.invalidNumber')
            case UITypes.Decimal:
            case UITypes.Currency:
            case UITypes.Percent:
              return Number.isFinite(Number(input)) ? undefined : t('labels.commandPalette.invalidNumber')
            // Like the cells, these validate only when the field asks for it.
            case UITypes.Email:
              return meta.validate && !validateEmail(input) ? t('msg.error.invalidEmail') : undefined
            case UITypes.URL:
              return meta.validate && !isValidURL(input) ? t('msg.error.invalidURL') : undefined
            case UITypes.PhoneNumber:
              return meta.validate && !isValidPhoneNumber(input) ? t('msg.invalidPhoneNumber') : undefined
          }
        },
        submit: (input) => {
          const isNumeric = [UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent].includes(column.uidt as UITypes)
          return target.save(column, () => (input === '' ? null : isNumeric ? Number(input) : input))
        },
      }
    }

    function selectChildren(column: ColumnType): CmdCommand[] {
      const options = ((column.colOptions as { options?: SelectOptionType[] })?.options ?? []).filter((o) => o.title)
      const values = target.values(column)

      if (column.uidt === UITypes.SingleSelect) {
        return [
          ...options.map((option) => ({
            id: `set-field:${column.id}:${option.id ?? option.title}`,
            title: option.title!,
            icon: { type: 'color' as const, color: option.color },
            checked: values.every((value) => value === option.title),
            run: () => target.save(column, () => option.title),
          })),
          {
            id: `set-field:${column.id}:clear`,
            title: t('general.clear'),
            icon: { type: 'icon', name: 'ncX' },
            run: () => target.save(column, () => null),
          },
        ]
      }

      const toList = (value: unknown) =>
        typeof value === 'string' && value ? value.split(',') : Array.isArray(value) ? value.map(String) : []

      // Toggle: add to every record unless all of them already have it.
      return options.map((option) => {
        const hasAll = values.length > 0 && values.every((value) => toList(value).includes(option.title!))
        return {
          id: `set-field:${column.id}:${option.id ?? option.title}`,
          title: option.title!,
          icon: { type: 'color' as const, color: option.color },
          checked: hasAll,
          run: () =>
            target.save(column, (prev) => {
              const list = toList(prev).filter((title) => title !== option.title)
              const next = hasAll ? list : [...list, option.title!]
              return next.length ? next.join(',') : null
            }),
        }
      })
    }

    function userChildren(column: ColumnType): CmdCommand[] {
      const baseUsers = target.meta?.base_id ? basesUser.value.get(target.meta.base_id) ?? [] : []
      const options = getUserOptions(column, false, false, baseUsers).filter((option) => !option.deleted)
      const optionsMap = Object.fromEntries(
        options.flatMap((option) => [
          [option.id!, option],
          [option.email!, option],
        ]),
      )
      const ids = (value: unknown) =>
        getSelectedUsers(optionsMap, value as Parameters<typeof getSelectedUsers>[1]).map((selected) => selected.value)
      const values = target.values(column)
      const isMulti = !!parseProp(column.meta).is_multi

      const toggle = (id: string) => {
        const hasAll = values.length > 0 && values.every((value) => ids(value).includes(id))
        return {
          checked: hasAll,
          run: () =>
            target.save(column, (prev) => {
              if (!isMulti) return hasAll ? null : id
              const list = ids(prev).filter((existing) => existing !== id)
              const next = hasAll ? list : [...list, id]
              return next.length ? next.join(',') : null
            }),
        }
      }

      const me = options.find((option) => option.id === userId)
      return [
        ...(me
          ? [
              {
                id: `set-field:${column.id}:me`,
                title: t('labels.commandPalette.assignToMe'),
                icon: { type: 'icon', name: 'ncUser' },
                ...toggle(me.id!),
              } satisfies CmdCommand,
            ]
          : []),
        ...options.map((option) => ({
          id: `set-field:${column.id}:${option.id}`,
          title: option.display_name || option.email!,
          hint: option.display_name ? option.email : undefined,
          keywords: [option.email!],
          ...toggle(option.id!),
        })),
      ]
    }

    function dateChildren(column: ColumnType): CmdCommand[] {
      const meta = parseProp(column.meta)
      const isDateTime = column.uidt === UITypes.DateTime
      const dateFormat: string = meta.date_format ?? 'YYYY-MM-DD'
      const timeFormat: string = meta.time_format ?? 'HH:mm'
      const typedTimeFormat: string = meta.is12hrFormat ? timeFormatsObj[timeFormat] ?? timeFormat : timeFormat
      // Date-times are read and "now" taken in the column's timezone, as the cell editor does.
      const { dayjsTz } = withTimezone(isDateTime ? meta.timezone : undefined)
      // Stored as the cells store them.
      const toValue = (date: dayjs.Dayjs) => (isDateTime ? date.utc().format('YYYY-MM-DD HH:mm:ssZ') : date.format('YYYY-MM-DD'))
      const parse = (input: string) => {
        const value = input.trim()
        const formats = isDateTime ? [`${dateFormat} ${typedTimeFormat}`, dateFormat] : [dateFormat]
        const format = formats.find((f) => dayjs(value, f, true).isValid())
        if (!isDateTime) return format ? dayjs(value, format, true) : dayjs(value)
        return format ? dayjsTz(value, format) : dayjsTz(value)
      }

      return [
        isDateTime
          ? {
              id: `set-field:${column.id}:now`,
              title: t('general.now'),
              run: () => target.save(column, () => toValue(dayjsTz())),
            }
          : {
              id: `set-field:${column.id}:today`,
              title: t('labels.today'),
              run: () => target.save(column, () => toValue(dayjs())),
            },
        {
          id: `set-field:${column.id}:tomorrow`,
          title: t('labels.commandPalette.tomorrow'),
          run: () => target.save(column, () => toValue((isDateTime ? dayjsTz() : dayjs()).add(1, 'day'))),
        },
        {
          id: `set-field:${column.id}:enter`,
          title: t('labels.commandPalette.enterDate'),
          icon: { type: 'icon', name: 'ncEdit' },
          edit: {
            value: '',
            placeholder: isDateTime ? `${dateFormat} ${timeFormat}` : dateFormat,
            validate: (input) => (input && !parse(input).isValid() ? t('msg.invalidDate') : undefined),
            submit: (input) => target.save(column, () => (input ? toValue(parse(input)) : null)),
          },
        },
        {
          id: `set-field:${column.id}:clear`,
          title: t('general.clear'),
          icon: { type: 'icon', name: 'ncX' },
          run: () => target.save(column, () => null),
        },
      ]
    }

    function linkCommands(column: ColumnType, hidden?: boolean): CmdCommand[] {
      const row = target.row
      const meta = target.meta
      const relatedMeta = relatedMetaOf(column)
      const rowId = row && meta?.columns ? extractPkFromRow(row, meta.columns as ColumnType[]) : undefined
      if (!row || !meta?.id || !rowId) return []

      // The related table's meta is needed for display values; an inaccessible table never loads.
      if (!relatedMeta) {
        const colOptions = column.colOptions as LinkToAnotherRecordType
        const relatedKey = `${colOptions.fk_related_base_id || column.base_id}:${colOptions.fk_related_model_id}`
        if (!requestedRelatedMetas.has(relatedKey)) {
          requestedRelatedMetas.add(relatedKey)
          getMeta(colOptions.fk_related_base_id || column.base_id!, colOptions.fk_related_model_id!).catch(() => {})
        }
        return []
      }

      const relatedColumns = (relatedMeta.columns ?? []) as ColumnType[]
      const displayColumn = relatedColumns.find((c) => c.pv)
      const relatedId = (related: Record<string, any>) => extractPkFromRow(related, relatedColumns)
      const label = (related: Record<string, any>) =>
        String((displayColumn && related[displayColumn.title!]) ?? relatedId(related) ?? '')
      const type = (column.colOptions as LinkToAnotherRecordType).type
      const isSingle = isSingleTarget(column)
      const shape = isSingle ? 'single' : column.uidt === UITypes.Links ? 'count' : 'records'

      async function apply(op: 'link' | 'unlink', related: Record<string, any>) {
        const snapshot = row![column.title!]
        const call = op === 'link' ? $api.dbTableRow.nestedAdd : $api.dbTableRow.nestedRemove
        await call(
          NOCO,
          meta!.base_id!,
          meta!.id!,
          encodeURIComponent(rowId!),
          type as RelationTypes,
          column.id!,
          encodeURIComponent(String(relatedId(related))),
        )
        // Same optimistic cell write as the link picker, so the cell updates without a reload.
        row![column.title!] = applyLtarCellOp({
          op,
          shape,
          current: row![column.title!],
          snapshot,
          relatedRow: related,
          getRelatedRowId: relatedId,
        })
        linkLists.delete(`linkable:${column.id}:${rowId}`)
        linkLists.delete(`linked:${column.id}:${rowId}`)
        target.afterSave?.()
      }

      function listChildren(kind: 'linkable' | 'linked', op: 'link' | 'unlink'): CmdCommand[] {
        const key = `${kind}:${column.id}:${rowId}`
        let list: Record<string, any>[]
        const current = row![column.title!]
        // A loaded single-target v1 cell holds the linked record itself, as the picker reads it.
        if (kind === 'linked' && isSingle && !isLinkV2(column) && current !== undefined) {
          list = current && typeof current === 'object' ? [current] : []
        } else {
          loadLinkList(key, kind, meta!, column, rowId!)
          const state = linkLists.get(key)
          if (state?.loading && !state.list.length) {
            return [{ id: `${key}:loading`, title: t('general.loading'), disabled: true, loading: true }]
          }
          if (state?.error) {
            return [
              {
                id: `${key}:error`,
                title: t('labels.commandPalette.linkLoadFailed'),
                icon: { type: 'icon', name: 'ncAlertCircle' },
                disabled: true,
                error: true,
              },
            ]
          }
          list = state?.list ?? []
        }
        return list.map((related) => ({
          id: `${key}:${relatedId(related)}`,
          title: label(related),
          icon: { type: 'table', icon: parseProp(relatedMeta!.meta).icon },
          keywords: [String(relatedId(related))],
          feedback: target.feedback,
          run: () => apply(op, related),
        }))
      }

      const base = {
        priority: CMD_PRIORITY.normal,
        section: target.section,
        icon: { type: 'field' as const, column },
        searchOnly: hidden,
      }
      // Undefined when the view didn't load the field; then Unlink is offered and its list says what's linked.
      const value = row[column.title!]
      const hasLinks = value === undefined || (Array.isArray(value) ? value.length > 0 : !!value)

      return [
        {
          ...base,
          id: `link-field:${column.id}`,
          title: t('labels.commandPalette.linkField', { field: column.title }),
          keywords: ['link', 'add', 'connect', relatedMeta.title ?? ''],
          lazyChildren: true,
          children: () => listChildren('linkable', 'link'),
        },
        ...(hasLinks
          ? [
              {
                ...base,
                id: `unlink-field:${column.id}`,
                title: t('labels.commandPalette.unlinkField', { field: column.title }),
                keywords: ['unlink', 'remove', 'disconnect', relatedMeta.title ?? ''],
                lazyChildren: true,
                children: () => listChildren('linked', 'unlink'),
              } satisfies CmdCommand,
            ]
          : []),
      ]
    }

    // Links need one saved record and the plain data API.
    const canLink = !isMany && !!target.row && !interfaceDataApi

    return target.columns
      .filter(({ column }) => isSettable(column) || (canLink && isLinkable(column)))
      .flatMap(({ column, hidden }): CmdCommand[] => {
        if (isLinksOrLTAR(column)) return linkCommands(column, hidden)
        return [setCommand(column, hidden)]
      })

    function setCommand(column: ColumnType, hidden?: boolean): CmdCommand {
      const base = {
        id: `set-field:${column.id}`,
        priority: CMD_PRIORITY.normal,
        section: target.section,
        icon: { type: 'field' as const, column },
        keywords: ['set', 'change', 'update', 'edit'],
        searchOnly: hidden,
        feedback: target.feedback,
      }

      switch (column.uidt) {
        case UITypes.Checkbox: {
          const allChecked = target.values(column).every((value) => !!value && value !== '0' && value !== 'false')
          const key = allChecked ? 'unmarkField' : 'markField'
          return {
            ...base,
            title: isMany
              ? t(`labels.commandPalette.${key}ForRecords`, { field: column.title, count }, count)
              : t(`labels.commandPalette.${key}`, { field: column.title }),
            checked: allChecked,
            run: () => target.save(column, () => !allChecked),
          }
        }
        case UITypes.SingleSelect:
        case UITypes.MultiSelect:
          return { ...base, title: title(column), searchChildren: true, children: () => selectChildren(column) }
        case UITypes.User:
          return { ...base, title: title(column), searchChildren: true, children: () => userChildren(column) }
        case UITypes.Rating: {
          const max = Number(parseProp(column.meta).max ?? 5)
          return {
            ...base,
            title: title(column),
            searchChildren: true,
            children: () =>
              Array.from({ length: max + 1 }, (_, n) => ({
                id: `set-field:${column.id}:${n}`,
                title: n ? '★'.repeat(n) : t('general.clear'),
                keywords: [String(n)],
                checked: n > 0 && target.values(column).every((value) => Number(value) === n),
                run: () => target.save(column, () => n || null),
              })),
          }
        }
        case UITypes.Date:
        case UITypes.DateTime:
          return { ...base, title: title(column), searchChildren: true, children: () => dateChildren(column) }
        default:
          return { ...base, title: title(column), edit: textEdit(column) }
      }
    }
  }
}

/**
 * "add 1m", "+10%", "add a week", "uppercase name", "add urgent to tags": rows built from the query
 * for the surface's fields, previewing old → new. Above one record, applying asks first.
 */
export function useRelativeEditCommands() {
  const { t } = useI18n()

  const { isAllowed } = usePermissions()

  const { showWarningModal } = useNcConfirmModal()

  const { user } = useGlobal()

  const { basesUser } = storeToRefs(useBases())

  const { isMysql } = useBase()

  const { schemaFor, parse: parseNl } = useCmdNl()

  const dash = '—'

  const truncate = (text: string) => (text.length > 28 ? `${text.slice(0, 27)}…` : text)

  const selectTitles = (column: ColumnType) =>
    ((column.colOptions as { options?: SelectOptionType[] })?.options ?? [])
      .filter((option) => option.title)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((option) => option.title!)

  function members(column: ColumnType, meta?: TableType) {
    const baseUsers = meta?.base_id ? basesUser.value.get(meta.base_id) ?? [] : []
    return getUserOptions(column, false, false, baseUsers).filter((option) => !option.deleted)
  }

  function userIds(column: ColumnType, meta: TableType | undefined, value: unknown) {
    const options = members(column, meta)
    const optionsMap = Object.fromEntries(
      options.flatMap((option) => [
        [option.id!, option],
        [option.email!, option],
      ]),
    )
    return getSelectedUsers(optionsMap, value as Parameters<typeof getSelectedUsers>[1]).map(
      (selected) => selected.value as string,
    )
  }

  /** The member a typed name means ("me", a name or an email), or undefined. */
  function resolveUser(column: ColumnType, meta: TableType | undefined, who: string) {
    const options = members(column, meta)
    if (/^(me|myself)$/i.test(who)) return options.find((option) => option.id === user.value?.id)
    const byName = matchCmdName(
      who,
      options.map((option) => option.display_name || option.email || ''),
    )
    const byEmail = byName
      ? undefined
      : matchCmdName(
          who,
          options.map((option) => option.email ?? ''),
        )
    return options.find((option) => (option.display_name || option.email) === byName || option.email === byEmail)
  }

  function parseTime(value: unknown) {
    if (value === null || value === undefined || value === '') return
    let time = dayjs(value as string)
    if (!time.isValid()) time = dayjs(value as string, 'HH:mm:ss')
    if (!time.isValid()) time = dayjs(`1999-01-01 ${value}`)
    return time.isValid() ? time : undefined
  }

  function display(column: ColumnType, value: unknown, meta?: TableType) {
    if (value === null || value === undefined || value === '') return dash
    const columnMeta = parseProp(column.meta)
    switch (column.uidt) {
      case UITypes.Duration:
        return String(convertMS2Duration(value, columnMeta.duration ?? 0))
      case UITypes.Time:
        return parseTime(value)?.format(columnMeta.is12hrFormat ? 'hh:mm A' : 'HH:mm') ?? dash
      case UITypes.Year:
        return String(value)
      case UITypes.Checkbox:
        return value === true || value === 1 || value === '1' || value === 'true' ? '☑' : '☐'
      case UITypes.SingleSelect:
      case UITypes.SingleLineText:
      case UITypes.LongText:
      case UITypes.Email:
      case UITypes.URL:
      case UITypes.PhoneNumber:
        return truncate(String(value))
      case UITypes.MultiSelect:
        return truncate((Array.isArray(value) ? value.map(String) : String(value).split(',')).join(', '))
      case UITypes.User: {
        const byId = Object.fromEntries(members(column, meta).map((option) => [option.id, option.display_name || option.email]))
        return truncate(
          userIds(column, meta, value)
            .map((id) => byId[id] ?? id)
            .join(', ') || dash,
        )
      }
    }
    switch (column.uidt) {
      case UITypes.Currency:
        return getCurrencyValue(value as number, column)
      case UITypes.Percent:
        return `${Number(value).toLocaleString()}%`
      case UITypes.Decimal:
        return Number(value).toLocaleString(undefined, {
          minimumFractionDigits: columnMeta.precision ?? 0,
          maximumFractionDigits: columnMeta.precision ?? 8,
        })
      case UITypes.Date:
        return dayjs(value as string).format(columnMeta.date_format ?? 'YYYY-MM-DD')
      case UITypes.DateTime: {
        const date = dayjs(value as string)
        const local = columnMeta.timezone && isEeUI ? date.tz(columnMeta.timezone) : date
        return local.format(`${columnMeta.date_format ?? 'YYYY-MM-DD'} ${columnMeta.time_format ?? 'HH:mm'}`)
      }
      default:
        return Number(value).toLocaleString()
    }
  }

  /** Whether `edit` can apply to `column` at all (option and user edits also need a match). */
  function accepts(edit: CmdRelativeEdit, column: ColumnType, meta?: TableType) {
    const uidt = column.uidt as string
    switch (edit.kind) {
      case 'number':
        if (edit.op === 'add' && edit.unit === 'stars') return uidt === UITypes.Rating
        // A bare amount on a duration has no unit ("+30": seconds? minutes?); scaling does.
        if (uidt === UITypes.Duration) return edit.op !== 'add'
        if (uidt === UITypes.Year) return edit.op === 'add' && !edit.unit
        return NUMERIC_UIDTS.includes(uidt)
      case 'date': {
        const isTimeUnit = edit.op === 'shift' && (edit.unit === 'hour' || edit.unit === 'minute')
        if (uidt === UITypes.Date) return !isTimeUnit
        if (uidt === UITypes.DateTime) return true
        if (uidt === UITypes.Duration) return cmdShiftSeconds(edit) !== undefined
        if (uidt === UITypes.Time) return isTimeUnit
        if (uidt === UITypes.Year) return edit.op === 'shift' && edit.unit === 'year'
        return false
      }
      case 'text':
        if (edit.op === 'https') return uidt === UITypes.URL
        if (edit.op === 'trim') return [...TEXT_UIDTS, UITypes.Email, UITypes.URL, UITypes.PhoneNumber].includes(uidt as UITypes)
        return TEXT_UIDTS.includes(uidt)
      case 'checkbox':
        return uidt === UITypes.Checkbox
      case 'select':
        return uidt === UITypes.SingleSelect
      case 'option':
        return uidt === UITypes.MultiSelect && (edit.op === 'clear' || !!matchCmdName(edit.option, selectTitles(column)))
      case 'user':
        return uidt === UITypes.User && !!resolveUser(column, meta, edit.who)
    }
  }

  /** `undefined` leaves the value as it is; `NaN` marks a result the field can't hold. */
  function nextValue(edit: CmdRelativeEdit, column: ColumnType, prev: unknown, meta?: TableType): unknown {
    const columnMeta = parseProp(column.meta)
    const isEmpty = prev === null || prev === undefined || prev === ''

    switch (edit.kind) {
      case 'number': {
        // An empty year isn't year 0.
        if (column.uidt === UITypes.Year && isEmpty) return
        const next = applyCmdNumberEdit(edit, prev)
        if (next === undefined || Number.isNaN(next)) return next
        if (column.uidt === UITypes.Number || column.uidt === UITypes.Year) return Math.round(next)
        if (column.uidt === UITypes.Rating) {
          const max = Number(columnMeta.max ?? 5)
          return Math.min(max, Math.max(0, Math.round(next)))
        }
        if (column.uidt === UITypes.Decimal && columnMeta.precision !== undefined) {
          return Number(next.toFixed(Number(columnMeta.precision)))
        }
        return next
      }
      case 'text':
        return applyCmdTextEdit(edit, prev)
      case 'checkbox':
        return applyCmdCheckboxEdit(edit, prev)
      case 'select':
        return applyCmdSelectEdit(edit, prev, selectTitles(column))
      case 'option': {
        const option = edit.op === 'clear' ? undefined : matchCmdName(edit.option, selectTitles(column))
        if (edit.op === 'clear') return isEmpty ? undefined : null
        return applyCmdListEdit(edit.op, prev, option)
      }
      case 'user': {
        const member = resolveUser(column, meta, edit.who)
        if (!member) return
        const current = userIds(column, meta, prev)
        if (!parseProp(column.meta).is_multi) {
          if (edit.op === 'add') return member.id
          return current.includes(member.id!) ? null : undefined
        }
        return applyCmdListEdit(edit.op, current.join(','), member.id)
      }
    }

    // Date edits, by the field they land on.
    if (column.uidt === UITypes.Duration) {
      const seconds = cmdShiftSeconds(edit)
      return seconds === undefined ? undefined : Math.max(0, (isEmpty ? 0 : Number(prev)) + seconds)
    }
    if (isEmpty) return
    if (column.uidt === UITypes.Year) return Number(prev) + (edit.op === 'shift' ? edit.amount : 0)
    if (column.uidt === UITypes.Time) {
      const format = isMysql(column.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'
      return applyCmdTimeEdit(edit, parseTime(prev))?.format(format)
    }
    if (column.uidt === UITypes.Date) return applyCmdDateEdit(edit, dayjs(prev as string))?.format('YYYY-MM-DD')
    // Date-times shift in the column's timezone and are stored as the cells store them.
    const date = dayjs(prev as string)
    const local = columnMeta.timezone && isEeUI ? date.tz(columnMeta.timezone) : date
    return applyCmdDateEdit(edit, local)?.utc().format('YYYY-MM-DD HH:mm:ssZ')
  }

  function title(edit: CmdRelativeEdit, column: ColumnType, meta?: TableType) {
    const field = column.title
    const prefix = 'labels.commandPalette.relative'
    if (edit.kind === 'date') {
      if (edit.op === 'shift') {
        const amount = Math.abs(edit.amount)
        const span = t(`${prefix}.units.${edit.unit}`, { count: amount.toLocaleString() }, amount)
        return t(edit.amount < 0 ? `${prefix}.subtract` : `${prefix}.add`, { amount: span, field })
      }
      if (edit.op === 'weekday') {
        const key = edit.which === 'next' ? 'nextWeekday' : edit.which === 'this' ? 'thisWeekday' : 'lastWeekday'
        return t(`${prefix}.${key}`, { field, weekday: dayjs().day(edit.weekday).format('dddd') })
      }
      const unit = t(`${prefix}.periods.${edit.unit}`)
      const period =
        edit.offset > 0
          ? t(`${prefix}.periodNext`, { period: unit })
          : edit.offset < 0
          ? t(`${prefix}.periodLast`, { period: unit })
          : unit
      return t(`${prefix}.${edit.op === 'end-of' ? 'endOf' : 'startOf'}`, { field, period })
    }
    if (edit.kind === 'text') {
      switch (edit.op) {
        case 'append':
        case 'prepend':
        case 'remove':
          return t(`${prefix}.text.${edit.op}`, { text: truncate(edit.text), field })
        case 'replace':
          return t(`${prefix}.text.replace`, { from: truncate(edit.from), to: truncate(edit.to), field })
        default:
          return t(`${prefix}.text.${edit.op}`, { field })
      }
    }
    if (edit.kind === 'checkbox') return t(`${prefix}.checkbox.${edit.op}`, { field })
    if (edit.kind === 'select') return t(`${prefix}.select.${edit.op}`, { field })
    if (edit.kind === 'option') {
      if (edit.op === 'clear') return t(`${prefix}.option.clear`, { field })
      return t(`${prefix}.option.${edit.op}`, { option: matchCmdName(edit.option, selectTitles(column)) ?? edit.option, field })
    }
    if (edit.kind === 'user') {
      const member = resolveUser(column, meta, edit.who)
      return t(`${prefix}.user.${edit.op}`, { user: member?.display_name || member?.email || edit.who, field })
    }
    switch (edit.op) {
      case 'add': {
        const amount = Math.abs(edit.amount)
        if (edit.unit) {
          const key = `${prefix}.${edit.unit}.${edit.amount < 0 ? 'subtract' : 'add'}`
          return t(key, { count: amount.toLocaleString(), field }, amount)
        }
        return t(edit.amount < 0 ? `${prefix}.subtract` : `${prefix}.add`, { amount: amount.toLocaleString(), field })
      }
      case 'round-nearest':
        return t(`${prefix}.roundNearest`, { amount: edit.amount.toLocaleString(), field })
      case 'at-least':
        return t(`${prefix}.atLeast`, { amount: edit.amount.toLocaleString(), field })
      case 'at-most':
        return t(`${prefix}.atMost`, { amount: edit.amount.toLocaleString(), field })
      case 'abs':
      case 'floor':
      case 'ceil':
        return t(`${prefix}.${edit.op}`, { field })
      case 'percent':
        return t(edit.amount < 0 ? `${prefix}.decreasePercent` : `${prefix}.increasePercent`, {
          amount: Math.abs(edit.amount).toLocaleString(),
          field,
        })
      case 'multiply':
        return t(`${prefix}.multiply`, { amount: edit.amount.toLocaleString(), field })
      case 'divide':
        return t(`${prefix}.divide`, { amount: edit.amount.toLocaleString(), field })
      case 'round':
        return edit.amount ? t(`${prefix}.roundTo`, { amount: edit.amount, field }) : t(`${prefix}.round`, { field })
      case 'negate':
        return t(`${prefix}.negate`, { field })
    }
  }

  /** Columns an edit targets: the named field, else the active one, else the first few visible. */
  function targetColumns(edit: CmdRelativeEdit, target: RelativeEditTarget) {
    const candidates = target.columns.filter(
      ({ column }) => isSettableColumn(column, isAllowed, RELATIVE_ONLY_UIDTS) && accepts(edit, column, target.meta),
    )
    if (edit.field) {
      const words = edit.field.split(' ')
      return candidates
        .map(({ column }) => column)
        .filter((column) => {
          const titleWords = (column.title ?? '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
          return words.every((word) => titleWords.some((titleWord) => cmdFieldWordMatches(word, titleWord)))
        })
    }
    const active = candidates.find(({ column }) => column.id === target.activeColumnId)
    if (active) return [active.column]
    const visible = candidates.filter(({ hidden }) => !hidden).map(({ column }) => column)
    // A single field that takes the edit ("assign ann" with one User field) counts as known.
    return (visible.length ? visible : candidates.map(({ column }) => column)).slice(0, RELATIVE_EDIT_MAX_FIELDS)
  }

  /** The field is known when the query names it, it's the selected cell's, or it's the only one that fits. */
  function isKnownField(edit: CmdRelativeEdit, column: ColumnType, columns: ColumnType[], activeColumnId?: string) {
    return !!edit.field || column.id === activeColumnId || columns.length === 1
  }

  function fillType(column: ColumnType): CmdFillType {
    const uidt = column.uidt as string
    if (NUMERIC_UIDTS.includes(uidt) || uidt === UITypes.Year) return 'number'
    if (uidt === UITypes.Date || uidt === UITypes.DateTime) return 'date'
    if (TEXT_UIDTS.includes(uidt)) return 'text'
    if (uidt === UITypes.SingleSelect) return 'select'
    return 'other'
  }

  /** Fits a filled number or date to the column as its cells store it; other values pass through. */
  function fitFillValue(column: ColumnType, value: unknown, prev: unknown) {
    if (value === undefined) return
    const columnMeta = parseProp(column.meta)
    if (typeof value === 'number') {
      if (column.uidt === UITypes.Number || column.uidt === UITypes.Year) return Math.round(value)
      if (column.uidt === UITypes.Rating) return Math.min(Number(columnMeta.max ?? 5), Math.max(0, Math.round(value)))
      if (column.uidt === UITypes.Decimal && columnMeta.precision !== undefined) {
        return Number(value.toFixed(Number(columnMeta.precision)))
      }
      return value
    }
    if (column.uidt === UITypes.DateTime && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      // A filled day keeps the cell's time of day (else midnight), in the column's timezone.
      const timezone = columnMeta.timezone && isEeUI ? (columnMeta.timezone as string) : undefined
      const prevDate = prev === null || prev === undefined || prev === '' ? undefined : dayjs(prev as string)
      const prevLocal = prevDate?.isValid() ? (timezone ? prevDate.tz(timezone) : prevDate) : undefined
      const day = timezone ? dayjs.tz(value, timezone) : dayjs(value)
      const local = prevLocal ? day.hour(prevLocal.hour()).minute(prevLocal.minute()).second(prevLocal.second()) : day
      return local.utc().format('YYYY-MM-DD HH:mm:ssZ')
    }
    return value
  }

  /** "fill down", "number rows", "fill weekly from today": a range fills its column(s), checked rows the fitting fields. */
  function fillCommands(target: RelativeEditTarget, fill: CmdFill): CmdCommand[] {
    const prefix = 'labels.commandPalette.fill'
    const candidates = target.columns.filter(({ column }) => isSettableColumn(column, isAllowed, RELATIVE_ONLY_UIDTS))
    const accepting = candidates.filter(({ column }) => cmdFillAccepts(fill, fillType(column), selectTitles(column)))

    let columns: ColumnType[]
    if (target.fill === 'range') {
      // A range over several columns only fills each of them down.
      columns = candidates.length > 1 && fill.kind !== 'down' ? [] : accepting.map(({ column }) => column)
    } else {
      const active = accepting.find(({ column }) => column.id === target.activeColumnId)
      columns = active
        ? [active.column]
        : accepting
            .filter(({ hidden }) => !hidden)
            .map(({ column }) => column)
            .slice(0, RELATIVE_EDIT_MAX_FIELDS)
    }

    return columns.map((column): CmdCommand => {
      const field = column.title
      const prevs = target.values(column)
      const values = cmdFillValues(fill, prevs, fillType(column), { options: selectTitles(column) }).map((value, i) =>
        fitFillValue(column, value, prevs[i]),
      )
      const changed = values.flatMap((value, i) => (value === undefined ? [] : [i]))
      const cells = changed.length
      const firstValue = cells ? display(column, values[changed[0]!], target.meta) : dash
      const lastValue = cells ? display(column, values[changed[cells - 1]!], target.meta) : dash
      const rowTitle =
        fill.kind === 'down'
          ? t(`${prefix}.down`, { field })
          : fill.kind === 'constant'
          ? t(`${prefix}.with`, { field, value: firstValue })
          : t(`${prefix}.title`, { field })
      const preview = !cells
        ? dash
        : fill.kind === 'down' || fill.kind === 'constant'
        ? t(`${prefix}.previewSame`, { value: firstValue, count: cells }, cells)
        : t(`${prefix}.preview`, { from: firstValue, to: lastValue, count: cells }, cells)
      // "fill 1..3" over six cells stops at 3; the rest stay as they are.
      const beyondEnd = (fill.kind === 'number' || fill.kind === 'text') && fill.end !== undefined ? values.length - cells : 0

      const apply = () =>
        target.save(column, (prev, index) => {
          const value = values[index ?? 0]
          return value === undefined ? prev : value
        })

      return {
        id: `fill:${column.id}`,
        title: rowTitle,
        section: target.section,
        icon: { type: 'field', column },
        priority: CMD_PRIORITY.primary,
        lead: true,
        value: preview,
        hint: !cells ? t(`${prefix}.nothing`) : beyondEnd ? t(`${prefix}.beyondEnd`, { count: beyondEnd }, beyondEnd) : undefined,
        disabled: !cells,
        feedback: cells > 1 ? undefined : target.feedback ?? t('labels.commandPalette.saved'),
        run:
          cells > 1
            ? () =>
                showWarningModal({
                  title: t('labels.commandPalette.relative.confirmTitle', { count: cells }, cells),
                  content: `${rowTitle} · ${preview}`,
                  showCancelBtn: true,
                  okText: t('general.update'),
                  okCallback: async () => {
                    await apply()
                  },
                })
            : apply,
      }
    })
  }

  /** "Acme: Lead → Won, Globex: Lead → Won, … +5 more" for the records whose value actually changes. */
  function changeList(column: ColumnType, labels: string[], values: unknown[], nexts: unknown[], meta?: TableType) {
    const changes = nexts.flatMap((next, i) => {
      if (next === undefined) return []
      const before = display(column, values[i], meta)
      const after = display(column, next, meta)
      return before === after ? [] : [`${labels[i] ?? i + 1}: ${before} → ${after}`]
    })
    const more = changes.length - CONFIRM_LIST_MAX
    return [
      ...changes.slice(0, CONFIRM_LIST_MAX),
      ...(more > 0 ? [t('labels.commandPalette.where.more', { count: more }, more)] : []),
    ].join(', ')
  }

  /** What the query asks of this surface (no where clause), from the NL parser's readings, best first. */
  function readSurfaceQuery(query: string, meta?: TableType): { edits: CmdRelativeEdit[]; fill?: CmdFill } {
    const schema = schemaFor(meta)
    if (!schema) return { edits: parseCmdRelativeEdits(query), fill: parseCmdFill(query) }
    const readings = parseNl(query, schema)
    // "add 1 week to due where stage is lead" is the view's where-edit, not this record's.
    if (readings[0]?.scope === 'where') return { edits: [] }
    const edits: CmdRelativeEdit[] = []
    let fill: CmdFill | undefined
    for (const ir of readings) {
      if (ir.scope === 'where' || (ir.intent !== 'edit' && ir.intent !== 'fill')) continue
      for (const edit of ir.edits ?? []) {
        // The resolved field's own title words, matched back to the column by targetColumns.
        const field = edit.field
          ? schema.fields
              .find((f) => f.id === edit.field!.id)
              ?.title.toLowerCase()
              .replace(/[^\p{L}\p{N}\s]/gu, ' ')
              .trim()
              .replace(/\s+/g, ' ')
          : undefined
        if (edit.op.kind === 'relative') edits.push(field ? { ...edit.op.edit, field } : edit.op.edit)
        else if (edit.op.kind === 'fill') fill ??= edit.op.fill
      }
    }
    return { edits, fill }
  }

  function relativeEditCommands(target: RelativeEditTarget, query: string): CmdCommand[] {
    const read = readSurfaceQuery(query, target.meta)
    if (target.fill && read.fill) return fillCommands(target, read.fill)

    const seen = new Set<string>()
    const count = target.count ?? 1

    return read.edits.flatMap((edit) =>
      targetColumns(edit, target)
        .filter((column) => !seen.has(column.id!) && seen.add(column.id!))
        .map((column, _, columns): CmdCommand => {
          const values = target.values(column)
          const nexts = values.map((prev) => nextValue(edit, column, prev, target.meta))
          const invalid = nexts.some((next) => typeof next === 'number' && Number.isNaN(next))
          const skipped = nexts.filter((next) => next === undefined).length
          const firstIndex = nexts.findIndex((next) => next !== undefined)
          const rowTitle = title(edit, column, target.meta)
          const preview =
            firstIndex < 0
              ? dash
              : `${display(column, values[firstIndex], target.meta)} → ${display(column, nexts[firstIndex], target.meta)}`

          const apply = () =>
            target.save(column, (prev) => {
              const next = nextValue(edit, column, prev, target.meta)
              return next === undefined ? prev : next
            })

          return {
            id: `relative-edit:${column.id}`,
            title: rowTitle,
            section: target.section,
            icon: { type: 'field', column },
            priority: CMD_PRIORITY.primary,
            // An option/member match ("add urgent") may also be a command's name; it leads once its field is known.
            lead: (edit.kind !== 'option' && edit.kind !== 'user') || isKnownField(edit, column, columns, target.activeColumnId),
            value: count > 1 ? t('labels.commandPalette.relative.bulkPreview', { count, preview }, count) : preview,
            hint: invalid
              ? t('labels.commandPalette.relative.invalid')
              : skipped && count > 1
              ? t('labels.commandPalette.relative.emptySkipped', { count: skipped }, skipped)
              : undefined,
            error: invalid,
            disabled: invalid || firstIndex < 0,
            feedback: count > 1 || target.rowLabels ? undefined : target.feedback ?? t('labels.commandPalette.saved'),
            run:
              count > 1 || target.rowLabels
                ? () =>
                    showWarningModal({
                      title: t('labels.commandPalette.relative.confirmTitle', { count }, count),
                      content: target.rowLabels
                        ? `${rowTitle} · ${changeList(column, target.rowLabels, values, nexts, target.meta) || dash}`
                        : `${rowTitle} · ${preview}`,
                      showCancelBtn: true,
                      okText: t('general.update'),
                      okCallback: async () => {
                        await apply()
                      },
                    })
                : apply,
          }
        }),
    )
  }

  // Shared with "… where …" edits, which build absolute "set" rows next to these.
  return Object.assign(relativeEditCommands, {
    display,
    changeList,
    accepts,
    nextValue,
    title,
    isSettable: (column: ColumnType) => isSettableColumn(column, isAllowed, RELATIVE_ONLY_UIDTS),
  })
}
