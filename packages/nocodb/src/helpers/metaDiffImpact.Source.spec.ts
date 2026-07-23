import { ModelTypes, UITypes } from 'nocodb-sdk';
import {
  attachRemovedColumnImpacts,
  collectRemovedColumnImpact,
} from '~/helpers/metaDiffImpact';
import type {
  FormulaDependencyResolver,
  ImpactColumn,
  RemovedColumnImpact,
} from '~/helpers/metaDiffImpact';
import type { NcContext } from '~/interface/config';

type TestColumn = ImpactColumn & {
  id: string;
  title: string;
  column_name: string;
  uidt: UITypes;
  fk_model_id: string;
};

type RemovedColumnMetaDiff = {
  table_name: string;
  source_id: string;
  type: ModelTypes;
  detectedChanges: Array<{
    type: 'TABLE_COLUMN_REMOVE' | 'VIEW_COLUMN_REMOVE' | 'TABLE_COLUMN_ADD';
    cn: string;
    column?: TestColumn;
    msg?: string;
    id?: string;
  }>;
};

const context = { workspace_id: 'ws_test', base_id: 'base_test' } as NcContext;
const modelId = 'md_orders';

const makeColumn = (overrides: Partial<TestColumn> = {}): TestColumn => ({
  id: 'cl_removed',
  title: 'Column4',
  column_name: 'removed',
  uidt: UITypes.SingleLineText,
  fk_model_id: modelId,
  ...overrides,
});

const makeRemovedColumnDiff = (
  removedColumn: TestColumn,
): RemovedColumnMetaDiff => ({
  table_name: 'orders',
  source_id: 'ds_external',
  type: ModelTypes.TABLE,
  detectedChanges: [
    {
      type: 'TABLE_COLUMN_REMOVE',
      cn: removedColumn.column_name,
      column: removedColumn,
      msg: `Column ${removedColumn.title} removed`,
    },
  ],
});

const makeResolver = (dependencies: ImpactColumn[]) =>
  jest
    .fn<Promise<ImpactColumn[]>, Parameters<FormulaDependencyResolver>>()
    .mockResolvedValue(dependencies);

const collectImpact = (
  metaDiffs: RemovedColumnMetaDiff[],
  columns: TestColumn[],
  resolveFormulaDependencies: FormulaDependencyResolver,
) =>
  collectRemovedColumnImpact(context, {
    metaDiffs,
    columnsByModelId: new Map([[modelId, columns]]),
    resolveFormulaDependencies,
  });

describe('Meta Diff removed-column impact discovery', () => {
  it('maps resolver results, preserves order, and removes duplicate dependencies', async () => {
    const removedColumn = makeColumn();
    const firstFormula = makeColumn({
      id: 'cl_formula',
      title: 'Total Label',
      uidt: UITypes.Formula,
    });
    const buttonColumn = makeColumn({
      id: 'cl_button',
      title: 'Open Invoice',
      uidt: UITypes.Button,
    });
    const unrelatedColumn = makeColumn({
      id: 'cl_unrelated',
      title: 'Column1',
      column_name: 'unrelated',
    });
    const unrelatedFormulaColumn = makeColumn({
      id: 'cl_unrelated_formula',
      title: 'Unrelated Formula',
      uidt: UITypes.Formula,
    });
    const secondFormula = makeColumn({
      id: 'cl_formula_a',
      title: 'A Formula',
      uidt: UITypes.Formula,
    });
    const columns = [
      removedColumn,
      firstFormula,
      buttonColumn,
      unrelatedColumn,
      unrelatedFormulaColumn,
      secondFormula,
    ];
    const resolveFormulaDependencies = makeResolver([
      firstFormula,
      buttonColumn,
      firstFormula,
      secondFormula,
    ]);

    const impact = await collectImpact(
      [makeRemovedColumnDiff(removedColumn)],
      columns,
      resolveFormulaDependencies,
    );

    expect(resolveFormulaDependencies).toHaveBeenCalledTimes(1);
    expect(resolveFormulaDependencies).toHaveBeenCalledWith(context, {
      column: removedColumn,
      columns,
    });
    expect(impact.map((item) => item.resource.id)).toEqual([
      firstFormula.id,
      buttonColumn.id,
      secondFormula.id,
    ]);
    expect(impact.map((item) => item.dependencyType)).toEqual([
      'formula',
      'button',
      'formula',
    ]);
    expect(impact.map((item) => item.resource.id)).not.toContain(
      unrelatedFormulaColumn.id,
    );
    expect(
      impact.filter((item) => item.resource.id === firstFormula.id),
    ).toHaveLength(1);
  });

  it('returns an empty collection when the resolver finds no references', async () => {
    const removedColumn = makeColumn();
    const columns = [removedColumn];
    const resolveFormulaDependencies = makeResolver([]);

    await expect(
      collectImpact(
        [makeRemovedColumnDiff(removedColumn)],
        columns,
        resolveFormulaDependencies,
      ),
    ).resolves.toEqual([]);
    expect(resolveFormulaDependencies).toHaveBeenCalledTimes(1);
    expect(resolveFormulaDependencies).toHaveBeenCalledWith(context, {
      column: removedColumn,
      columns,
    });
  });

  it('does not mutate columns, metadata maps, or the input diff object', async () => {
    const removedColumn = makeColumn();
    const formulaColumn = makeColumn({
      id: 'cl_formula',
      title: 'Total Label',
      uidt: UITypes.Formula,
    });
    const metaDiffs = [makeRemovedColumnDiff(removedColumn)];
    const columns = [removedColumn, formulaColumn];
    const columnsByModelId = new Map([[modelId, columns]]);
    const resolveFormulaDependencies = makeResolver([formulaColumn]);
    const columnsBefore = JSON.stringify(columns);
    const diffBefore = JSON.stringify(metaDiffs);

    await collectRemovedColumnImpact(context, {
      metaDiffs,
      columnsByModelId,
      resolveFormulaDependencies,
    });

    expect(JSON.stringify(columns)).toBe(columnsBefore);
    expect(JSON.stringify(metaDiffs)).toBe(diffBefore);
    expect(columnsByModelId.get(modelId)).toBe(columns);
  });
});

describe('Meta Diff removed-column impact enrichment', () => {
  it('attaches matching impacts to removed columns without changing unrelated changes', () => {
    const firstRemovedColumn = makeColumn();
    const secondRemovedColumn = makeColumn({
      id: 'cl_removed_other',
      title: 'Other Removed',
      column_name: 'removed_other',
    });
    const formulaImpact: RemovedColumnImpact = {
      dependencyType: 'formula',
      removedColumnId: firstRemovedColumn.id,
      resource: {
        id: 'cl_formula',
        title: 'Total Label',
        uidt: UITypes.Formula,
      },
    };
    const buttonImpact: RemovedColumnImpact = {
      dependencyType: 'button',
      removedColumnId: secondRemovedColumn.id,
      resource: {
        id: 'cl_button',
        title: 'Open Invoice',
        uidt: UITypes.Button,
      },
    };
    const unrelatedChange = {
      type: 'TABLE_COLUMN_ADD' as const,
      cn: 'new_column',
      id: modelId,
      msg: 'New column(new_column)',
    };
    const metaDiffs: RemovedColumnMetaDiff[] = [
      {
        table_name: 'orders',
        source_id: 'ds_external',
        type: ModelTypes.TABLE,
        detectedChanges: [
          {
            type: 'TABLE_COLUMN_REMOVE',
            cn: firstRemovedColumn.column_name,
            column: firstRemovedColumn,
          },
          unrelatedChange,
          {
            type: 'VIEW_COLUMN_REMOVE',
            cn: secondRemovedColumn.column_name,
            column: secondRemovedColumn,
          },
        ],
      },
    ];

    const enriched = attachRemovedColumnImpacts(metaDiffs, [
      formulaImpact,
      buttonImpact,
    ]);

    expect(enriched).not.toBe(metaDiffs);
    expect(enriched[0]).not.toBe(metaDiffs[0]);
    expect(enriched[0].detectedChanges).not.toBe(metaDiffs[0].detectedChanges);
    expect(enriched[0].detectedChanges?.[0]).toEqual({
      ...metaDiffs[0].detectedChanges[0],
      impacts: [formulaImpact],
    });
    expect(enriched[0].detectedChanges?.[1]).toEqual(unrelatedChange);
    expect(enriched[0].detectedChanges?.[1]).not.toHaveProperty('impacts');
    expect(enriched[0].detectedChanges?.[2]).toEqual({
      ...metaDiffs[0].detectedChanges[2],
      impacts: [buttonImpact],
    });
  });

  it('attaches an empty impact collection and does not mutate inputs', () => {
    const removedColumn = makeColumn();
    const metaDiffs = [makeRemovedColumnDiff(removedColumn)];
    const impacts: RemovedColumnImpact[] = [];
    const diffBefore = JSON.stringify(metaDiffs);
    const impactsBefore = JSON.stringify(impacts);

    const enriched = attachRemovedColumnImpacts(metaDiffs, impacts);

    expect(enriched[0].detectedChanges?.[0]).toEqual({
      ...metaDiffs[0].detectedChanges[0],
      impacts: [],
    });
    expect(JSON.stringify(metaDiffs)).toBe(diffBefore);
    expect(JSON.stringify(impacts)).toBe(impactsBefore);
    expect(metaDiffs[0].detectedChanges[0]).not.toHaveProperty('impacts');
  });
});
