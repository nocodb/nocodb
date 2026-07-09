import { RelationTypes, UITypes } from 'nocodb-sdk'
import { FormFilters, buildFormConditionSourceColumns } from '~/lib/form'

// Main-table columns as they appear in `meta.columns`
const linkCol = {
  id: 'col_link',
  title: 'Creative',
  uidt: UITypes.LinkToAnotherRecord,
  colOptions: {
    type: RelationTypes.BELONGS_TO,
    fk_related_model_id: 'mdl_creative',
  },
}

const lookupCol = {
  id: 'col_lookup',
  title: 'Creative Type',
  uidt: UITypes.Lookup,
  colOptions: {
    fk_relation_column_id: 'col_link',
    fk_lookup_column_id: 'col_ctype',
  },
}

const dependentCol = {
  id: 'col_dep',
  title: 'Notes',
  uidt: UITypes.SingleLineText,
}

const metaColumns = [linkCol, lookupCol, dependentCol] as any[]

// Rendered form columns (the lookup is NOT a rendered form input)
function makeFormColumns({ linkVisible = true, linkShow = true } = {}) {
  return [
    {
      fk_column_id: 'col_link',
      title: 'Creative',
      uidt: UITypes.LinkToAnotherRecord,
      colOptions: linkCol.colOptions,
      order: 0,
      show: linkShow,
      visible: linkVisible,
      permissions: { isAllowedToEdit: true },
    },
    {
      fk_column_id: 'col_dep',
      title: 'Notes',
      uidt: UITypes.SingleLineText,
      order: 1,
      show: true,
      visible: true,
      permissions: { isAllowedToEdit: true },
    },
  ] as any[]
}

const getMeta = async (_baseId: string, modelId: string) => {
  if (modelId !== 'mdl_creative') return null
  return {
    id: 'mdl_creative',
    columns: [
      { id: 'col_ctype', title: 'Type', uidt: UITypes.SingleSelect },
      { id: 'col_cname', title: 'Name', uidt: UITypes.SingleLineText, pv: true },
    ],
  } as any
}

function buildFilters(formColumns: any[]) {
  return buildFormConditionSourceColumns(formColumns, metaColumns).reduce((acc, c) => {
    acc[c.fk_column_id] = c
    return acc
  }, {} as Record<string, any>)
}

function makeFormFilters({ formColumns, formState, condition }: { formColumns: any[]; formState: any; condition: any[] }) {
  return new FormFilters({
    nestedGroupedFilters: { col_dep: condition },
    formViewColumns: formColumns,
    formViewColumnsMapByFkColumnId: buildFilters(formColumns),
    formState,
    isSharedForm: true,
    getMeta,
    baseId: 'base_1',
  })
}

describe('buildFormConditionSourceColumns', () => {
  it('adds a Lookup as a condition source when its link field is in the form', () => {
    const result = buildFormConditionSourceColumns(makeFormColumns(), metaColumns)
    const lookup = result.find((c) => c.fk_column_id === 'col_lookup')

    expect(lookup).toBeTruthy()
    // inherits position / show from the link field it resolves through
    expect(lookup!.order).toBe(0)
    expect(lookup!.show).toBe(true)
    expect(lookup!.isFormConditionLookup).toBe(true)
    expect(lookup!.fk_relation_column_id).toBe('col_link')
  })

  it('omits the Lookup when its link field is not a form field', () => {
    const onlyDependent = makeFormColumns().filter((c) => c.fk_column_id !== 'col_link')
    const result = buildFormConditionSourceColumns(onlyDependent, metaColumns)

    expect(result.find((c) => c.fk_column_id === 'col_lookup')).toBeUndefined()
  })

  it('returns the input untouched when there are no meta columns', () => {
    const formColumns = makeFormColumns()
    expect(buildFormConditionSourceColumns(formColumns, undefined)).toBe(formColumns)
  })
})

describe('FormFilters — Lookup condition source', () => {
  it('shows the dependent field when the looked-up value matches', async () => {
    const formColumns = makeFormColumns()
    const ff = makeFormFilters({
      formColumns,
      formState: { Creative: { Type: 'Video', Name: 'Promo' } },
      condition: [{ fk_column_id: 'col_lookup', comparison_op: 'eq', value: 'Video', logical_op: 'and' }],
    })

    await ff.validateVisibility()

    expect(formColumns.find((c) => c.fk_column_id === 'col_dep')!.visible).toBe(true)
  })

  it('hides the dependent field when the looked-up value does not match', async () => {
    const formColumns = makeFormColumns()
    const ff = makeFormFilters({
      formColumns,
      formState: { Creative: { Type: 'Image', Name: 'Promo' } },
      condition: [{ fk_column_id: 'col_lookup', comparison_op: 'eq', value: 'Video', logical_op: 'and' }],
    })

    await ff.validateVisibility()

    expect(formColumns.find((c) => c.fk_column_id === 'col_dep')!.visible).toBe(false)
  })

  it('hides the dependent field when no linked record is selected yet', async () => {
    const formColumns = makeFormColumns()
    const ff = makeFormFilters({
      formColumns,
      formState: {},
      condition: [{ fk_column_id: 'col_lookup', comparison_op: 'eq', value: 'Video', logical_op: 'and' }],
    })

    await ff.validateVisibility()

    expect(formColumns.find((c) => c.fk_column_id === 'col_dep')!.visible).toBe(false)
  })

  it('cascades: hides the dependent field when the link field is itself hidden by a condition', async () => {
    // A gating checkbox drives the link field's own visibility; the dependent field
    // is driven by the lookup that resolves through that (now hidden) link field.
    const formColumns = [
      {
        fk_column_id: 'col_flag',
        title: 'Flag',
        uidt: UITypes.Checkbox,
        order: -1,
        show: true,
        visible: true,
        permissions: { isAllowedToEdit: true },
      },
      {
        fk_column_id: 'col_link',
        title: 'Creative',
        uidt: UITypes.LinkToAnotherRecord,
        colOptions: linkCol.colOptions,
        order: 0,
        show: true,
        visible: true,
        permissions: { isAllowedToEdit: true },
      },
      { fk_column_id: 'col_dep', title: 'Notes', uidt: UITypes.SingleLineText, order: 1, show: true, visible: true },
    ] as any[]

    const ff = new FormFilters({
      nestedGroupedFilters: {
        col_link: [{ fk_column_id: 'col_flag', comparison_op: 'checked', logical_op: 'and' }],
        col_dep: [{ fk_column_id: 'col_lookup', comparison_op: 'eq', value: 'Video', logical_op: 'and' }],
      },
      formViewColumns: formColumns,
      formViewColumnsMapByFkColumnId: buildFilters(formColumns),
      formState: { Flag: false, Creative: { Type: 'Video', Name: 'Promo' } },
      isSharedForm: true,
      getMeta,
      baseId: 'base_1',
    })

    await ff.validateVisibility()

    expect(formColumns.find((c) => c.fk_column_id === 'col_link')!.visible).toBe(false)
    expect(formColumns.find((c) => c.fk_column_id === 'col_dep')!.visible).toBe(false)
  })

  it('resolves multi-record relations to joined looked-up values', async () => {
    const formColumns = makeFormColumns()
    const ff = makeFormFilters({
      formColumns,
      formState: { Creative: [{ Type: 'Video' }, { Type: 'Image' }] },
      condition: [{ fk_column_id: 'col_lookup', comparison_op: 'like', value: 'Image', logical_op: 'and' }],
    })

    await ff.validateVisibility()

    expect(formColumns.find((c) => c.fk_column_id === 'col_dep')!.visible).toBe(true)
  })
})
