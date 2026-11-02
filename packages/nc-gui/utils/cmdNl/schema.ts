import type { ColumnType, SelectOptionsType, TableType } from 'nocodb-sdk'
import { UITypes, getAvailableAggregations, isSystemColumn } from 'nocodb-sdk'
import type { CmdCreateColumn, CmdCreateKind, CmdStatColumn, CmdStatKind } from '../commandPaletteDataOps'
import type { CmdNlKind } from './ir'

export interface CmdNlMember {
  id: string
  name: string
  email?: string
}

export interface CmdNlField {
  id: string
  title: string
  uidt?: string
  kind: CmdNlKind
  options?: string[]
  /** User fields: who a name or email can mean. */
  members?: CmdNlMember[]
  /** Footer aggregation ids this field offers. */
  aggregations: string[]
  /** Display (primary) field. */
  pv?: boolean
  required?: boolean
  /** Rating maximum. */
  max?: number
  /** Not editable (computed, system, read-only). */
  readonly?: boolean
  /** A hidden system audit field (created/modified time or by); a user field of the same name wins. */
  system?: boolean
}

export interface CmdNlSchema {
  table: { id?: string; title: string }
  fields: CmdNlField[]
  /** The signed-in user's id, so "me" can be resolved where an id is needed. */
  me?: string
}

const READONLY_UIDTS = new Set<string>([
  UITypes.Formula,
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.Links,
  UITypes.LinkToAnotherRecord,
  UITypes.Button,
  UITypes.Barcode,
  UITypes.QrCode,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  UITypes.AutoNumber,
  UITypes.ID,
])

export function cmdNlKind(uidt?: string): CmdNlKind {
  switch (uidt) {
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Rating:
    case UITypes.Year:
    case UITypes.AutoNumber:
      return 'number'
    case UITypes.Date:
      return 'date'
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      return 'datetime'
    case UITypes.Checkbox:
      return 'checkbox'
    case UITypes.SingleSelect:
      return 'select'
    case UITypes.MultiSelect:
      return 'multiselect'
    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy:
      return 'user'
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.PhoneNumber:
      return 'text'
    default:
      return 'other'
  }
}

/** Hidden audit columns every table has ("CreatedAt", "nc_created_by"…), under the names people use. */
export const CMD_NL_SYSTEM_TITLES: Record<string, string> = {
  [UITypes.CreatedTime]: 'Created time',
  [UITypes.LastModifiedTime]: 'Last modified time',
  [UITypes.CreatedBy]: 'Created by',
  [UITypes.LastModifiedBy]: 'Last modified by',
}

/** The schema the parser reads, from a table's columns; members are resolved by the caller (base users). */
export function buildCmdNlSchema(
  table: TableType,
  opts: { members?: (column: ColumnType) => CmdNlMember[]; me?: string } = {},
): CmdNlSchema {
  const columns = (table.columns ?? []).filter((column) => column.id && column.title)
  // One system field per audit kind, and only when the user hasn't made a field of that kind.
  const userKinds = new Set(columns.filter((c) => !isSystemColumn(c)).map((c) => c.uidt))
  const fields = columns
    .filter((column) => (isSystemColumn(column) ? !!CMD_NL_SYSTEM_TITLES[column.uidt!] && !userKinds.has(column.uidt) : true))
    .filter((column, i, all) => !isSystemColumn(column) || all.findIndex((c) => c.uidt === column.uidt) === i)
    .map((column): CmdNlField => {
      const kind = cmdNlKind(column.uidt)
      const meta = typeof column.meta === 'object' && column.meta ? (column.meta as { max?: number }) : {}
      const system = isSystemColumn(column)
      return {
        id: column.id!,
        title: system ? CMD_NL_SYSTEM_TITLES[column.uidt!]! : column.title!,
        ...(system ? { system: true } : {}),
        uidt: column.uidt,
        kind,
        options:
          kind === 'select' || kind === 'multiselect'
            ? ((column.colOptions as SelectOptionsType | undefined)?.options ?? []).map((o) => o.title!).filter(Boolean)
            : undefined,
        members: kind === 'user' ? opts.members?.(column) ?? [] : undefined,
        aggregations: getAvailableAggregations(column.uidt!),
        pv: !!column.pv,
        required: !!column.rqd && column.cdf == null,
        max: column.uidt === UITypes.Rating ? meta.max : undefined,
        readonly: !!column.readonly || READONLY_UIDTS.has(column.uidt!),
      }
    })
  return { table: { id: table.id, title: table.title ?? '' }, fields, me: opts.me }
}

export function cmdNlField(schema: CmdNlSchema, id: string) {
  return schema.fields.find((field) => field.id === id)
}

/** Exact or case-insensitive title lookup (adapters receive titles from the legacy parsers). */
export function cmdNlFieldByTitle(schema: CmdNlSchema, title: string) {
  const lower = title.trim().toLowerCase()
  return (
    schema.fields.find((field) => field.title === title) ?? schema.fields.find((field) => field.title.toLowerCase() === lower)
  )
}

const STAT_KIND: Partial<Record<CmdNlKind, CmdStatKind>> = {
  number: 'number',
  date: 'date',
  datetime: 'date',
  checkbox: 'checkbox',
  select: 'select',
  multiselect: 'select',
  user: 'user',
  text: 'text',
}

/** The legacy stats parser's column shape. */
export function toCmdStatColumns(schema: CmdNlSchema): CmdStatColumn[] {
  return schema.fields.flatMap((field) => {
    const kind = STAT_KIND[field.kind]
    return kind
      ? [
          {
            id: field.id,
            title: field.title,
            kind,
            aggregations: field.aggregations,
            options: field.options,
            members: field.members,
          },
        ]
      : []
  })
}

const CREATE_KIND: Record<CmdNlKind, CmdCreateKind> = {
  number: 'number',
  date: 'date',
  datetime: 'datetime',
  checkbox: 'checkbox',
  select: 'select',
  multiselect: 'multiselect',
  user: 'user',
  text: 'text',
  other: 'other',
}

/** The legacy quick-create parser's column shape (editable fields only). */
export function toCmdCreateColumns(schema: CmdNlSchema): CmdCreateColumn[] {
  return schema.fields
    .filter((field) => !field.readonly)
    .map((field) => ({
      title: field.title,
      kind: CREATE_KIND[field.kind],
      pv: field.pv,
      required: field.required,
      options: field.options,
      max: field.max,
    }))
}
