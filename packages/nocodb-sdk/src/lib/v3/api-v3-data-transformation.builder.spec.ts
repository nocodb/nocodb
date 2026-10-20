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
