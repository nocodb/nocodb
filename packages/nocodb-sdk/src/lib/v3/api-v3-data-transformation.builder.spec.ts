import UITypes from '../UITypes';
import {
  columnBuilder,
  columnV3ToV2Builder,
} from './api-v3-data-transformation.builder';
import type { FieldV3Type } from '../Api';

const buildMeta = (field: Partial<FieldV3Type>) =>
  columnV3ToV2Builder().build(field as FieldV3Type).meta as Record<string, any>;

describe('columnV3ToV2Builder display_column_meta', () => {
  it('nests flat Formula display options and maps v3 keys to v2', () => {
    const meta = buildMeta({
      title: 'F',
      type: UITypes.Formula,
      options: {
        formula: '{A}',
        display_type: UITypes.Percent,
        display_column_meta: { show_as_progress: true, precision: 2 },
      } as any,
    });

    expect(meta.display_column_meta).toEqual({
      meta: { is_progress: true, precision: 2 },
      custom: {},
    });
  });

  it('applies display-type transforms to flat Lookup options', () => {
    const meta = buildMeta({
      title: 'L',
      type: UITypes.Lookup,
      options: {
        display_type: UITypes.Decimal,
        display_column_meta: { locale_string: true, custom: { x: 1 } },
      } as any,
    });

    expect(meta.display_column_meta).toEqual({
      meta: { separator: 'comma_period' },
      custom: { x: 1 },
    });
  });

  it('leaves already nested display options untouched', () => {
    const nested = { meta: { is_progress: true }, custom: {} };
    const meta = buildMeta({
      title: 'F',
      type: UITypes.Formula,
      options: {
        formula: '{A}',
        display_type: UITypes.Percent,
        display_column_meta: nested,
      } as any,
    });

    expect(meta.display_column_meta).toEqual(nested);
  });
});

describe('enable_conditions', () => {
  it('is written as the enableConditions meta key the backend reads', () => {
    const meta = buildMeta({
      title: 'L',
      type: UITypes.Lookup,
      options: { enable_conditions: true } as any,
    });

    expect(meta.enableConditions).toBe(true);
    expect(meta).not.toHaveProperty('enable_conditions');
  });

  it('is read from enableConditions, not a stale enable_conditions key', () => {
    const field = columnBuilder().build({
      id: 'c1',
      title: 'Links',
      uidt: UITypes.Links,
      meta: {
        enableConditions: true,
        enable_conditions: false,
        useRecursiveEvaluation: true,
        use_recursive_evaluation: false,
      },
    } as any) as any;

    expect(field.options.enable_conditions).toBe(true);
    expect(field.options.use_recursive_evaluation).toBe(true);
  });
});

describe('cross-base link options', () => {
  const link = (fk_related_base_id: string | null) =>
    columnBuilder().build({
      id: 'c1',
      title: 'L',
      uidt: UITypes.LinkToAnotherRecord,
      base_id: 'p1',
      colOptions: {
        base_id: 'p1',
        type: 'mm',
        fk_related_model_id: 'm2',
        fk_related_base_id,
      },
    } as any) as any;

  it('reads related_base_id only on a cross-base link', () => {
    expect(link('p2').options).toEqual({
      relation_type: 'mm',
      related_table_id: 'm2',
      related_base_id: 'p2',
    });
    expect(link(null).options).not.toHaveProperty('related_base_id');
    // a copied same-base link can store its own base id
    expect(link('p1').options).not.toHaveProperty('related_base_id');
  });

  it('maps related_base_id to ref_base_id on create', () => {
    const v2 = columnV3ToV2Builder().build({
      title: 'L',
      type: UITypes.LinkToAnotherRecord,
      options: {
        relation_type: 'mm',
        related_table_id: 'm2',
        related_base_id: 'p2',
      },
    } as FieldV3Type) as any;
    expect(v2.childId).toBe('m2');
    expect(v2.ref_base_id).toBe('p2');
  });
});

describe('lookup_limit', () => {
  const readOptions = (meta: Record<string, unknown>) =>
    (
      columnBuilder().build({
        id: 'c1',
        title: 'L',
        uidt: UITypes.Lookup,
        meta,
      } as any) as any
    ).options ?? {};

  it('writes a plain number as the stored first-N shape', () => {
    const meta = buildMeta({
      title: 'L',
      type: UITypes.Lookup,
      options: { lookup_limit: 3 } as any,
    });

    expect(meta.lookup_limit).toEqual({ type: 'first', value: 3 });
    expect(meta).not.toHaveProperty('lookup_limit_type');
  });

  it('writes an explicit last type', () => {
    const meta = buildMeta({
      title: 'L',
      type: UITypes.Lookup,
      options: { lookup_limit: 2, lookup_limit_type: 'last' } as any,
    });

    expect(meta.lookup_limit).toEqual({ type: 'last', value: 2 });
  });

  it('drops a null or zero limit', () => {
    for (const lookup_limit of [null, 0]) {
      const meta = buildMeta({
        title: 'L',
        type: UITypes.Lookup,
        options: { lookup_limit, lookup_limit_type: 'last' } as any,
      });
      expect(meta).not.toHaveProperty('lookup_limit');
      expect(meta).not.toHaveProperty('lookup_limit_type');
    }
  });

  it('reads the stored shape back as a number and its type', () => {
    expect(
      readOptions({ lookup_limit: { type: 'last', value: 2 } })
    ).toMatchObject({ lookup_limit: 2, lookup_limit_type: 'last' });
  });

  it('does not report a legacy plain number, which is never applied', () => {
    const options = readOptions({ lookup_limit: 5 });
    expect(options).not.toHaveProperty('lookup_limit');
    expect(options).not.toHaveProperty('lookup_limit_type');
  });

  it('round-trips read → write without reshaping', () => {
    const stored = { type: 'last', value: 4 };
    const meta = buildMeta({
      title: 'L',
      type: UITypes.Lookup,
      options: readOptions({ lookup_limit: stored }),
    });
    expect(meta.lookup_limit).toEqual(stored);
  });
});
