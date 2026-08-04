import type { TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { beforeAll, describe, expect, it } from 'vitest'

// `~/utils/dataUtils` transitively imports `columnUtils`, which references the
// Nuxt auto-imported `iconMap` global at module-eval time. Provide a stub before
// importing so the module can load under vitest.
;(globalThis as any).iconMap = new Proxy({}, { get: () => undefined })

let populateInsertObject: typeof import('~/utils/dataUtils')['populateInsertObject']

const getMeta = async () => null

beforeAll(async () => {
  ;({ populateInsertObject } = await import('~/utils/dataUtils'))
})

describe('populateInsertObject', () => {
  it('does not throw when meta is undefined (transient teardown race) — regression for #9461', async () => {
    // Sentry JAVASCRIPT-14X1: `meta.value` can be undefined when a deferred save
    // fires during navigation/teardown, previously crashing with
    // "Cannot read properties of undefined (reading 'columns')".
    const result = await populateInsertObject({
      meta: undefined as unknown as TableType,
      ltarState: {},
      getMeta,
      row: { Title: 'foo' },
    })

    expect(result.insertObj).toEqual({})
    expect(result.missingRequiredColumns.size).toBe(0)
  })

  it('does not throw when meta has no columns', async () => {
    const result = await populateInsertObject({
      meta: {} as TableType,
      ltarState: {},
      getMeta,
      row: { Title: 'foo' },
    })

    expect(result.insertObj).toEqual({})
    expect(result.missingRequiredColumns.size).toBe(0)
  })

  it('still builds the insert object for a normal table meta', async () => {
    const meta = {
      base_id: 'base1',
      columns: [
        { id: 'c1', title: 'Title', uidt: UITypes.SingleLineText },
        { id: 'c2', title: 'Notes', uidt: UITypes.LongText },
      ],
    } as TableType

    const result = await populateInsertObject({
      meta,
      ltarState: {},
      getMeta,
      row: { Title: 'foo', Notes: 'bar' },
    })

    expect(result.insertObj).toEqual({ Title: 'foo', Notes: 'bar' })
    expect(result.missingRequiredColumns.size).toBe(0)
  })
})
