import type { FilterType, RecordColumnMeta } from 'nocodb-sdk'
import { NcApiVersion, extractFilterFromXwhere } from 'nocodb-sdk'
import type { FieldBadge, ToolUseBlock } from './thinkingTypes'

// ─── Where-clause parsing ────────────────────────────────────────────

function buildColMap(where: string): Record<string, { id: string; title: string; uidt: string }> {
  const map: Record<string, { id: string; title: string; uidt: string }> = {}
  const regex = /\(([^,(]+),/g
  let m
  while ((m = regex.exec(where)) !== null) {
    const alias = m[1]
    if (alias && !map[alias]) {
      map[alias] = { id: alias, title: alias, uidt: 'SingleLineText' }
    }
  }
  return map
}

export function parseWhere(where: string, metadataColumns?: RecordColumnMeta[]): FilterType[] {
  try {
    let colMap: Record<string, { id: string; title: string; uidt: string }>
    if (metadataColumns?.length) {
      colMap = {}
      for (const col of metadataColumns) {
        if (col.title) colMap[col.title] = { id: col.title, title: col.title, uidt: col.uidt as string }
      }
    } else {
      colMap = buildColMap(where)
    }
    const { filters } = extractFilterFromXwhere(
      { api_version: NcApiVersion.V1, timezone: 'UTC' },
      where,
      colMap as any,
      false,
      [],
    )
    return filters || []
  } catch {
    return []
  }
}

export function collectFieldBadges(filters: FilterType[], metadataColumns?: RecordColumnMeta[]): FieldBadge[] {
  const badges: FieldBadge[] = []
  const uidtMap = new Map(metadataColumns?.filter((c) => c.title).map((c) => [c.title!, c.uidt as string]) || [])

  function walk(list: FilterType[]) {
    for (const f of list) {
      if (f.is_group && f.children) walk(f.children)
      else if (f.fk_column_id && !badges.some((b) => b.name === f.fk_column_id)) {
        badges.push({ name: f.fk_column_id, uidt: uidtMap.get(f.fk_column_id) })
      }
    }
  }

  walk(filters)
  return badges
}

/** Collect field badges from `where` clauses across multiple blocks. */
export function collectFieldBadgesFromBlocks(blocks: ToolUseBlock[]): FieldBadge[] {
  const badges: FieldBadge[] = []
  let metadataColumns: RecordColumnMeta[] | undefined

  for (const block of blocks) {
    if ((block.metadata as any)?.model?.columns?.length) {
      metadataColumns = (block.metadata as any).model.columns as RecordColumnMeta[]
      break
    }
  }

  for (const block of blocks) {
    const where = (block.input as any)?.where
    if (where && typeof where === 'string') {
      for (const badge of collectFieldBadges(parseWhere(where, metadataColumns), metadataColumns)) {
        if (!badges.some((b) => b.name === badge.name)) badges.push(badge)
      }
    }
  }

  return badges
}

// ─── Natural language filter rendering ───────────────────────────────

export const OP_LABELS: Record<string, string> = {
  eq: 'is',
  neq: 'is not',
  like: 'contains',
  nlike: 'does not contain',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  in: 'is any of',
  blank: 'is blank',
  notblank: 'is not blank',
  null: 'is empty',
  notnull: 'is not empty',
  checked: 'is checked',
  notchecked: 'is not checked',
  btw: 'is between',
  isWithin: 'is within',
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function bold(s: string): string {
  return `<b>${esc(s)}</b>`
}

function renderClause(filter: FilterType): string {
  const field = bold(filter.fk_column_id || '')
  const op = filter.comparison_op || ''
  const opLabel = OP_LABELS[op] || op

  if (filter.value != null && filter.value !== '') {
    let rawVal = Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value)
    if (op === 'like' || op === 'nlike') rawVal = rawVal.replace(/^%|%$/g, '')
    return `${field} ${esc(opLabel)} "${esc(rawVal)}"`
  }
  return `${field} ${esc(opLabel)}`
}

function joinGroup(parts: string[], op: string, depth: number): string {
  if (parts.length === 1) return parts[0]
  switch (op) {
    case 'or':
      return parts.length === 2
        ? `either ${parts[0]} or ${parts[1]}`
        : `either ${parts.slice(0, -1).join(', ')}, or ${parts[parts.length - 1]}`
    case 'not':
      return `neither ${parts.slice(0, -1).join(', nor ')}, nor ${parts[parts.length - 1]}`
    default:
      return depth > 0 && parts.length === 2
        ? `both ${parts[0]} and ${parts[1]}`
        : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  }
}

function negate(clause: string): string {
  return clause
    .replace(' is not ', ' §IS§ ')
    .replace(' does not ', ' §DOESNOT§ ')
    .replace(' is ', ' is not ')
    .replace(' contains ', ' does not contain ')
    .replace(' has a value', ' has no value')
    .replace(' §IS§ ', ' is ')
    .replace(' §DOESNOT§ ', ' does ')
}

function filterToNl(filter: FilterType, depth = 0): string {
  if (filter.is_group && filter.children?.length) {
    const parts = filter.children.map((f) => filterToNl(f, depth + 1)).filter(Boolean)
    if (parts.length === 0) return ''
    if (parts.length === 1) return filter.logical_op === 'not' ? negate(parts[0]) : parts[0]
    const groupOp = filter.children.slice(1).find((c) => c.logical_op)?.logical_op || 'and'
    return joinGroup(parts, groupOp, depth)
  }
  if (!filter.fk_column_id) return ''
  return renderClause(filter)
}

export function renderFilterTree(filters: FilterType[]): string {
  if (filters.length === 0) return ''
  const parts = filters.map((f) => filterToNl(f)).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  const dominantOp = filters.slice(1).find((f) => f.logical_op)?.logical_op || 'and'
  return joinGroup(parts, dominantOp, 0)
}
