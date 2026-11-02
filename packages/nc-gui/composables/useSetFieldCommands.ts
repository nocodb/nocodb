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
import { applyLtarCellOp } from '~/utils/ltarDeferredOps'

interface SetFieldTarget {
  meta?: TableType
  /** Editable candidates in view order; `hidden` ones are listed only when searching. */
  columns: Array<{ column: ColumnType; hidden?: boolean }>
  /** The column's current value on every targeted record. */
  values: (column: ColumnType) => unknown[]
  /** Applies `next` to every targeted record; throws to show the error inline. */
  save: (column: ColumnType, next: (prev: unknown) => unknown) => Promise<unknown>
  section: string
  /** Records targeted; above one the titles say "for N records". */
  count?: number
  feedback?: string
  /** The single targeted record's row (mutated in place); enables Link/Unlink for link fields. */
  row?: Record<string, any>
  /** Runs after a link or unlink, e.g. to repaint the canvas. */
  afterSave?: () => void
}

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

  function isSettable(column: ColumnType) {
    if (!SETTABLE_UIDTS.includes(column.uidt!) || column.pk || column.ai || column.readonly || isSystemColumn(column)) {
      return false
    }
    // Rich text and AI prompts have their own editors.
    if (column.uidt === UITypes.LongText && (parseProp(column.meta).richMode || isAIPromptCol(column))) return false
    return !column.id || isAllowed(PermissionEntity.FIELD, column.id, PermissionKey.RECORD_FIELD_EDIT)
  }

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
