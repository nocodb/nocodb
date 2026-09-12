import {
  getColumnResultType,
  getEffectiveLookupColumn,
  getLookupResultType,
  getUITypesForLookupResultType,
} from './get-lookup-result-type';
import UITypes from '~/lib/UITypes';
import { FormulaDataTypes } from '~/lib/formula/enums';
import {
  ColumnType,
  LinkToAnotherRecordType,
  LookupType,
  TableType,
} from '~/lib/Api';

describe('getUITypesForLookupResultType', () => {
  it('offers number formats for numeric result types', () => {
    for (const t of [
      UITypes.Number,
      UITypes.Decimal,
      UITypes.Currency,
      UITypes.Percent,
      UITypes.Rating,
    ]) {
      expect(getUITypesForLookupResultType(t)).toEqual([
        UITypes.Decimal,
        UITypes.Currency,
        UITypes.Percent,
      ]);
    }
  });

  it('does not offer formatting for Duration (stored as seconds/ms but shown as hh:mm:ss, so reformatting would misrepresent the value)', () => {
    expect(getUITypesForLookupResultType(UITypes.Duration)).toEqual([]);
  });

  it('offers only Date for a Date source (no time to format)', () => {
    expect(getUITypesForLookupResultType(UITypes.Date)).toEqual([UITypes.Date]);
  });

  it('offers only Time for a Time source (no date to format)', () => {
    expect(getUITypesForLookupResultType(UITypes.Time)).toEqual([UITypes.Time]);
  });

  it('offers all date formats for DateTime / Created / LastModified (carry both)', () => {
    for (const t of [
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ]) {
      expect(getUITypesForLookupResultType(t)).toEqual([
        UITypes.Date,
        UITypes.DateTime,
        UITypes.Time,
      ]);
    }
  });

  it('offers nothing for non number/date result types', () => {
    for (const t of [
      UITypes.SingleLineText,
      UITypes.Email,
      UITypes.Checkbox,
      UITypes.Attachment,
      null,
      undefined,
    ]) {
      expect(getUITypesForLookupResultType(t as any)).toEqual([]);
    }
  });
});

describe('getColumnResultType', () => {
  it('returns the uidt directly for a plain column', () => {
    expect(
      getColumnResultType({ uidt: UITypes.Number } as ColumnType)
    ).toBe(UITypes.Number);
    expect(
      getColumnResultType({ uidt: UITypes.Date } as ColumnType)
    ).toBe(UITypes.Date);
  });

  it('unwraps a Formula display_type', () => {
    expect(
      getColumnResultType({
        uidt: UITypes.Formula,
        meta: { display_type: UITypes.Currency },
      } as unknown as ColumnType)
    ).toBe(UITypes.Currency);
  });

  it('maps a Formula parsed_tree dataType when no display_type', () => {
    expect(
      getColumnResultType({
        uidt: UITypes.Formula,
        colOptions: { parsed_tree: { dataType: FormulaDataTypes.NUMERIC } },
      } as unknown as ColumnType)
    ).toBe(UITypes.Decimal);

    expect(
      getColumnResultType({
        uidt: UITypes.Formula,
        colOptions: { parsed_tree: { dataType: FormulaDataTypes.DATE } },
      } as unknown as ColumnType)
    ).toBe(UITypes.Date);

    expect(
      getColumnResultType({
        uidt: UITypes.Formula,
        colOptions: { parsed_tree: { dataType: FormulaDataTypes.STRING } },
      } as unknown as ColumnType)
    ).toBe(UITypes.SingleLineText);
  });

  it('treats a Rollup as numeric', () => {
    expect(
      getColumnResultType({
        uidt: UITypes.Rollup,
        colOptions: { rollup_function: 'sum' },
      } as unknown as ColumnType)
    ).toBe(UITypes.Decimal);
  });

  it('returns null for an unresolved column', () => {
    expect(getColumnResultType(undefined)).toBeNull();
    expect(getColumnResultType({} as ColumnType)).toBeNull();
  });
});

describe('getLookupResultType', () => {
  const buildParams = (child: ColumnType) => {
    const lookupColumn = {
      id: 'lk1',
      uidt: UITypes.Lookup,
      colOptions: {
        fk_relation_column_id: 'rel1',
        fk_lookup_column_id: child.id,
      } as LookupType,
    } as ColumnType;

    const relationColumn = {
      id: 'rel1',
      uidt: UITypes.LinkToAnotherRecord,
      colOptions: {
        fk_related_model_id: 'related',
      } as LinkToAnotherRecordType,
    } as ColumnType;

    const meta = {
      id: 'table1',
      base_id: 'base1',
      columns: [lookupColumn, relationColumn],
    } as TableType;

    const relatedMeta = {
      id: 'related',
      base_id: 'base1',
      columns: [child],
    } as TableType;

    return {
      col: lookupColumn,
      meta,
      metas: { 'base1:related': relatedMeta },
    };
  };

  it('resolves a plain number child', () => {
    expect(
      getLookupResultType(
        buildParams({ id: 'c', uidt: UITypes.Number } as ColumnType)
      )
    ).toBe(UITypes.Number);
  });

  it('resolves a plain text child (not formattable)', () => {
    expect(
      getLookupResultType(
        buildParams({ id: 'c', uidt: UITypes.SingleLineText } as ColumnType)
      )
    ).toBe(UITypes.SingleLineText);
  });

  it('resolves a Formula child via its display_type', () => {
    expect(
      getLookupResultType(
        buildParams({
          id: 'c',
          uidt: UITypes.Formula,
          meta: { display_type: UITypes.Currency },
        } as unknown as ColumnType)
      )
    ).toBe(UITypes.Currency);
  });

  it('resolves a Rollup child as numeric', () => {
    expect(
      getLookupResultType(
        buildParams({
          id: 'c',
          uidt: UITypes.Rollup,
          colOptions: { rollup_function: 'sum' },
        } as unknown as ColumnType)
      )
    ).toBe(UITypes.Decimal);
  });

  it('resolves a nested lookup chain to the leaf type', () => {
    // outer lookup -> inner lookup (on related table) -> Date column (on leaf table)
    const dateCol = { id: 'dc', uidt: UITypes.Date } as ColumnType;

    const innerLookup = {
      id: 'inner',
      uidt: UITypes.Lookup,
      colOptions: {
        fk_relation_column_id: 'rel2',
        fk_lookup_column_id: 'dc',
      } as LookupType,
    } as ColumnType;

    const rel2 = {
      id: 'rel2',
      uidt: UITypes.LinkToAnotherRecord,
      colOptions: { fk_related_model_id: 'leaf' } as LinkToAnotherRecordType,
    } as ColumnType;

    const outerLookup = {
      id: 'outer',
      uidt: UITypes.Lookup,
      colOptions: {
        fk_relation_column_id: 'rel1',
        fk_lookup_column_id: 'inner',
      } as LookupType,
    } as ColumnType;

    const rel1 = {
      id: 'rel1',
      uidt: UITypes.LinkToAnotherRecord,
      colOptions: { fk_related_model_id: 'related' } as LinkToAnotherRecordType,
    } as ColumnType;

    const meta = {
      id: 'table1',
      base_id: 'base1',
      columns: [outerLookup, rel1],
    } as TableType;

    const relatedMeta = {
      id: 'related',
      base_id: 'base1',
      columns: [innerLookup, rel2],
    } as TableType;

    const leafMeta = {
      id: 'leaf',
      base_id: 'base1',
      columns: [dateCol],
    } as TableType;

    expect(
      getLookupResultType({
        col: outerLookup,
        meta,
        metas: {
          'base1:related': relatedMeta,
          'base1:leaf': leafMeta,
        },
      })
    ).toBe(UITypes.Date);
  });
});

describe('getEffectiveLookupColumn (stale-override guard)', () => {
  const lookupMeta = (displayType: UITypes) => ({
    display_type: displayType,
    display_column_meta: { meta: { precision: 2 }, custom: {} },
  });

  it('returns the child unchanged when no display_type is set', () => {
    const child = { id: 'c', uidt: UITypes.Number } as ColumnType;
    expect(getEffectiveLookupColumn({}, child)).toBe(child);
    expect(getEffectiveLookupColumn(null, child)).toBe(child);
  });

  it('applies the override when still valid for the child result type', () => {
    const child = { id: 'c', uidt: UITypes.Number } as ColumnType;
    const eff = getEffectiveLookupColumn(lookupMeta(UITypes.Currency), child);
    expect(eff).not.toBe(child);
    expect(eff.uidt).toBe(UITypes.Currency);
  });

  it('IGNORES a stale override when the child type no longer supports it', () => {
    // saved Currency override, but the looked-up field is now text
    const child = { id: 'c', uidt: UITypes.SingleLineText } as ColumnType;
    expect(getEffectiveLookupColumn(lookupMeta(UITypes.Currency), child)).toBe(child);
  });

  it('ignores a stale date override on a now-number child', () => {
    const child = { id: 'c', uidt: UITypes.Number } as ColumnType;
    expect(getEffectiveLookupColumn(lookupMeta(UITypes.Date), child)).toBe(child);
  });

  it('applies a Date override to a Date child but not a DateTime-only override', () => {
    const child = { id: 'c', uidt: UITypes.Date } as ColumnType;
    expect(getEffectiveLookupColumn(lookupMeta(UITypes.Date), child).uidt).toBe(UITypes.Date);
    // Date child can't be formatted as Time (no time component)
    expect(getEffectiveLookupColumn(lookupMeta(UITypes.Time), child)).toBe(child);
  });

  it('is permissive for computed children (Formula/Rollup/Lookup) — leaf not resolvable here', () => {
    for (const uidt of [UITypes.Formula, UITypes.Rollup, UITypes.Lookup]) {
      const child = { id: 'c', uidt } as ColumnType;
      const eff = getEffectiveLookupColumn(lookupMeta(UITypes.Currency), child);
      expect(eff.uidt).toBe(UITypes.Currency);
    }
  });
});
