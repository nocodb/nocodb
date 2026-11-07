import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { stripTypeScriptTypes } from 'node:module'
import { computed, effectScope, nextTick, ref, watch } from 'vue'

const file = process.argv[2] ?? new URL('../components/virtual-cell/components/LinkedItems.vue', import.meta.url)
const source = readFileSync(file, 'utf8')
// Run the component's watcher setup with a controlled list loader so response
// ordering is deterministic, without bootstrapping Nuxt or copying the watchers.
assert.ok(source.includes('const REORDER_MAX =') && source.includes('const onReorderEnd ='))
assert.ok(source.includes('watch(\n  [vModel, isForm]') && source.includes('const unlinkRow ='))
const reorderCode = source.slice(source.indexOf('const REORDER_MAX ='), source.indexOf('const onReorderEnd ='))
const openCode = source.slice(source.indexOf('watch(\n  [vModel, isForm]'), source.indexOf('const unlinkRow ='))

const tick = async () => {
  for (let i = 0; i < 5; i++) await nextTick()
}
function fixture({ cached = true, canReorder = true, total = 31, queuedLinks = 0 } = {}) {
  const scope = effectScope()
  const records = Array.from({ length: total }, (_, i) => ({ Id: i + 1 }))
  const store = {
    canReorder: ref(canReorder),
    readOnly: ref(false),
    isPublic: ref(false),
    isForm: ref(false),
    isNew: ref(false),
    childrenListPagination: { query: '' },
    childrenListCount: ref(cached ? total + queuedLinks : 0),
    childrenList: ref(cached ? { list: records, pageInfo: { totalRows: total } } : undefined),
    vModel: ref(true),
    refreshCurrentRow() {},
    resetChildrenListOffsetCount() {},
  }
  const requests = []
  store.loadChildrenList = (reset, state, limit = 10) =>
    new Promise((resolve) => {
      requests.push({
        limit,
        finish() {
          store.childrenList.value = { list: records.slice(0, limit), pageInfo: { totalRows: total } }
          // Expanded form: the count also includes queued (unsaved) links (resolveDeferredLtarCount).
          store.childrenListCount.value = total + queuedLinks
          resolve(store.childrenList.value)
        },
      })
    })
  const names = Object.keys(store)
  // eslint-disable-next-line no-new-func -- runs the component's real watcher source
  const setup = new Function(
    'ref',
    'computed',
    'watch',
    ...names,
    `${stripTypeScriptTypes(`${reorderCode}\n${openCode}`)}\nreturn {reorderEnabled, reorderRows}`,
  )
  const output = scope.run(() => setup(ref, computed, watch, ...names.map((n) => store[n])))
  return { ...output, store, requests, stop: () => scope.stop() }
}

async function drain(f) {
  for (let iteration = 0; iteration < 10 && f.requests.length; iteration++) {
    const batch = f.requests.splice(0)
    batch.forEach((r) => r.finish())
    await tick()
  }
  assert.equal(f.requests.length, 0, 'must not loop loading the full list')
}

test('reopening a cached reorderable list retains every linked record', async () => {
  const f = fixture()
  try {
    assert.equal(f.reorderRows.value.length, 31)
    await drain(f)
    assert.equal(f.reorderRows.value.length, 31, 'reopen must not truncate linked records to the first 10')
  } finally {
    f.stop()
  }
})
test('a later default-size reload must not truncate a full reorderable list', async () => {
  const f = fixture({ cached: false })
  try {
    await drain(f)
    assert.equal(f.reorderRows.value.length, 31)
    f.store.loadChildrenList(true)
    await drain(f)
    assert.equal(f.reorderRows.value.length, 31, 'reload must refill the draggable list')
  } finally {
    f.stop()
  }
})
test('a queued (unsaved) link keeps the count above the loadable rows without looping', async () => {
  // Expanded form of an existing row: childrenListCount = persisted + queued
  // links, so no reload can ever satisfy `list.length >= childrenListCount`.
  const f = fixture({ cached: false, queuedLinks: 1 })
  try {
    await drain(f)
    assert.equal(f.store.childrenListCount.value, 32)
    assert.equal(f.reorderRows.value.length, 31)
    f.store.loadChildrenList(true)
    await drain(f)
    assert.equal(f.reorderRows.value.length, 31, 'reload must refill once and stop')
  } finally {
    f.stop()
  }
})
test('ordinary non-reorderable lists keep their standard page size', async () => {
  const f = fixture({ cached: false, canReorder: false })
  try {
    assert.deepEqual(
      f.requests.map((r) => r.limit),
      [10],
    )
    await drain(f)
    assert.equal(f.reorderEnabled.value, false)
    assert.equal(f.store.childrenList.value.list.length, 10)
  } finally {
    f.stop()
  }
})
test('lists above the reorder threshold retain virtual paging', async () => {
  const f = fixture({ total: 51 })
  try {
    assert.equal(f.reorderEnabled.value, false)
    assert.deepEqual(
      f.requests.map((r) => r.limit),
      [10],
    )
    await drain(f)
  } finally {
    f.stop()
  }
})

for (const first of ['full', 'partial']) {
  test(`overlapping reloads converge when ${first} response finishes first`, async () => {
    const f = fixture()
    try {
      f.store.loadChildrenList(true, undefined, 50)
      const partial = f.requests.find((r) => r.limit === 10)
      const full = f.requests.find((r) => r.limit === 50)
      f.requests.splice(0)
      ;(first === 'full' ? full : partial).finish()
      await tick()
      ;(first === 'full' ? partial : full).finish()
      await tick()
      await drain(f)
      assert.equal(f.reorderRows.value.length, 31)
      assert.deepEqual(
        f.reorderRows.value.map((r) => r.Id),
        Array.from({ length: 31 }, (_, i) => i + 1),
      )
    } finally {
      f.stop()
    }
  })
}
