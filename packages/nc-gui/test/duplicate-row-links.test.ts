import type { ColumnType } from 'nocodb-sdk'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import { beforeAll, describe, expect, it } from 'vitest'

// `~/utils/dataUtils` transitively imports `columnUtils`, which references the
// Nuxt auto-imported `iconMap` global at module-eval time. Provide a stub before
// importing so the module can load under vitest.
;(globalThis as any).iconMap = new Proxy({}, { get: () => undefined })

let getDuplicateRowData: typeof import('~/utils/dataUtils')['getDuplicateRowData']
let getSkippedDuplicateLinks: typeof import('~/utils/dataUtils')['getSkippedDuplicateLinks']
let isSingleParentLinkColumn: typeof import('~/utils/dataUtils')['isSingleParentLinkColumn']

const link = (title: string, type: RelationTypes, uidt: UITypes = UITypes.LinkToAnotherRecord): ColumnType =>
  ({ id: title, title, uidt, colOptions: { type } } as unknown as ColumnType)

beforeAll(async () => {
  ;({ getDuplicateRowData, getSkippedDuplicateLinks, isSingleParentLinkColumn } = await import('~/utils/dataUtils'))
})

describe('isSingleParentLinkColumn', () => {
  it('is true for links whose related record allows a single parent (hm / oo / om)', () => {
    expect(isSingleParentLinkColumn(link('HM', RelationTypes.HAS_MANY))).toBe(true)
    expect(isSingleParentLinkColumn(link('OO', RelationTypes.ONE_TO_ONE))).toBe(true)
    expect(isSingleParentLinkColumn(link('OM', RelationTypes.ONE_TO_MANY))).toBe(true)
  })

  it('is false for shareable relations (bt / mo / mm)', () => {
    expect(isSingleParentLinkColumn(link('BT', RelationTypes.BELONGS_TO))).toBe(false)
    expect(isSingleParentLinkColumn(link('MO', RelationTypes.MANY_TO_ONE))).toBe(false)
    expect(isSingleParentLinkColumn(link('MM', RelationTypes.MANY_TO_MANY, UITypes.Links))).toBe(false)
  })

  it('is false for non-link columns', () => {
    expect(isSingleParentLinkColumn({ id: 't', title: 'Title', uidt: UITypes.SingleLineText } as ColumnType)).toBe(false)
  })
})

describe('getDuplicateRowData', () => {
  const columns: ColumnType[] = [
    { id: 'c1', title: 'Title', uidt: UITypes.SingleLineText } as ColumnType,
    link('Children', RelationTypes.HAS_MANY),
    link('Partner', RelationTypes.ONE_TO_ONE),
    link('Project', RelationTypes.BELONGS_TO),
    link('Tags', RelationTypes.MANY_TO_MANY, UITypes.Links),
  ]

  const row = {
    ncRecordId: 'rec1',
    ncRecordHash: 'hash1',
    Title: 'Budget card',
    Children: [{ Id: 1 }, { Id: 2 }],
    Partner: { Id: 9 },
    Project: { Id: 5 },
    Tags: [{ Id: 7 }],
  }

  it('drops single-parent links but keeps shareable ones and plain fields', () => {
    const cloned = getDuplicateRowData(row, columns)

    // identity markers stripped
    expect(cloned.ncRecordId).toBeUndefined()
    expect(cloned.ncRecordHash).toBeUndefined()

    // single-parent links dropped (would detach the original)
    expect(cloned.Children).toBeUndefined()
    expect(cloned.Partner).toBeUndefined()

    // shareable links + plain fields kept
    expect(cloned.Title).toBe('Budget card')
    expect(cloned.Project).toEqual({ Id: 5 })
    expect(cloned.Tags).toEqual([{ Id: 7 }])
  })

  it('keeps single-parent links when the user opts to move them to the copy', () => {
    const cloned = getDuplicateRowData(row, columns, { keepSingleParentLinks: true })

    expect(cloned.Children).toEqual([{ Id: 1 }, { Id: 2 }])
    expect(cloned.Partner).toEqual({ Id: 9 })

    // identity markers are still stripped regardless of the link choice
    expect(cloned.ncRecordId).toBeUndefined()
    expect(cloned.ncRecordHash).toBeUndefined()
  })
})

describe('getSkippedDuplicateLinks', () => {
  const columns: ColumnType[] = [
    { id: 'c1', title: 'Title', uidt: UITypes.SingleLineText } as ColumnType,
    link('Children', RelationTypes.HAS_MANY),
    link('Partner', RelationTypes.ONE_TO_ONE),
    link('Project', RelationTypes.BELONGS_TO),
  ]

  it('only reports single-parent links that actually hold a value', () => {
    const skipped = getSkippedDuplicateLinks({ Title: 'x', Children: [{ Id: 1 }], Partner: null, Project: { Id: 2 } }, columns)
    expect(skipped.map((c) => c.title)).toEqual(['Children'])
  })

  it('returns nothing when no single-parent link is populated', () => {
    expect(getSkippedDuplicateLinks({ Title: 'x', Children: [], Partner: null }, columns)).toEqual([])
  })

  // `Links` columns carry the child count, not the records — a count of 0 means
  // nothing is linked and must not trigger the prompt.
  it('treats a zero link count as empty', () => {
    expect(getSkippedDuplicateLinks({ Children: 0 }, columns)).toEqual([])
    expect(getSkippedDuplicateLinks({ Children: 3 }, columns).map((c) => c.title)).toEqual(['Children'])
  })

  // Shape taken verbatim from a real self-referencing table: a v2 one-to-one
  // creates a user-facing column plus a `system: true` reverse twin, and each mm
  // link leaves hidden `_nc_m2m_*` junction columns behind. Only the column the
  // user can actually see in their grid may be named in the modal.
  it('ignores system columns — hidden junction and reverse-side links', () => {
    const sys = (col: ColumnType): ColumnType => ({ ...col, system: true } as ColumnType)

    const selfRefColumns: ColumnType[] = [
      { id: 'c1', title: 'Title', uidt: UITypes.SingleLineText } as ColumnType,
      link('Features', RelationTypes.MANY_TO_MANY),
      sys(link('Features1', RelationTypes.MANY_TO_MANY)),
      link('Features 1', RelationTypes.ONE_TO_ONE),
      sys(link('Feature', RelationTypes.ONE_TO_ONE)),
      sys(link('_nc_m2m_Features_Features', RelationTypes.HAS_MANY)),
      sys(link('_nc_m2m_Features_Features1s', RelationTypes.HAS_MANY)),
    ]

    const row = {
      'Title': 'a',
      'Features': [],
      'Features1': [],
      'Features 1': { Id: 1, Title: 'a' },
      'Feature': { Id: 1, Title: 'a' },
      // the junction columns carry a value too when the row comes from cache
      '_nc_m2m_Features_Features': [{ Id: 1 }],
      '_nc_m2m_Features_Features1s': [{ Id: 1 }],
    }

    expect(getSkippedDuplicateLinks(row, selfRefColumns).map((c) => c.title)).toEqual(['Features 1'])
  })
})
