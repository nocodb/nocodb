import { UITypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';

type RemovedColumnChangeType = 'TABLE_COLUMN_REMOVE' | 'VIEW_COLUMN_REMOVE';

export type ImpactColumn = {
  id?: string;
  title?: string;
  uidt?: UITypes;
  fk_model_id?: string;
};

export type FormulaDependencyResolver = (
  context: NcContext,
  params: {
    column: ImpactColumn;
    columns: ImpactColumn[];
  },
) => Promise<ImpactColumn[]>;

type RemovedColumnChange = {
  type?: RemovedColumnChangeType | string;
  column?: ImpactColumn | null;
};

type MetaDiffWithDetectedChanges = {
  detectedChanges?: RemovedColumnChange[] | null;
};

export type RemovedColumnImpact = {
  dependencyType: 'formula' | 'button';
  removedColumnId: string;
  resource: {
    id: string;
    title: string;
    uidt: UITypes;
  };
};

const removedColumnChangeTypes = new Set<string>([
  'TABLE_COLUMN_REMOVE',
  'VIEW_COLUMN_REMOVE',
]);

const isFormulaOrButtonColumn = (column?: ImpactColumn | null) =>
  column?.uidt === UITypes.Formula || column?.uidt === UITypes.Button;

const hasRequiredColumnIdentity = (
  column?: ImpactColumn | null,
): column is ImpactColumn & { id: string; title: string; uidt: UITypes } =>
  !!column?.id && !!column?.title && !!column?.uidt;

export async function collectRemovedColumnImpact(
  context: NcContext,
  {
    metaDiffs,
    columnsByModelId,
    resolveFormulaDependencies,
  }: {
    metaDiffs?: MetaDiffWithDetectedChanges[] | null;
    columnsByModelId?: { get(modelId: string): ImpactColumn[] | undefined } | null;
    resolveFormulaDependencies: FormulaDependencyResolver;
  },
): Promise<RemovedColumnImpact[]> {
  const impact: RemovedColumnImpact[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(metaDiffs) || !columnsByModelId) return impact;

  for (const metaDiff of metaDiffs) {
    const detectedChanges = Array.isArray(metaDiff?.detectedChanges)
      ? metaDiff.detectedChanges
      : [];

    for (const change of detectedChanges) {
      if (!removedColumnChangeTypes.has(change?.type ?? '')) continue;

      const removedColumn = change.column;
      if (!removedColumn?.id || !removedColumn.fk_model_id) continue;

      const columns = columnsByModelId.get(removedColumn.fk_model_id);
      if (!Array.isArray(columns)) continue;

      const dependentColumns = await resolveFormulaDependencies(context, {
        column: removedColumn,
        columns,
      });

      for (const dependentColumn of dependentColumns) {
        if (
          !hasRequiredColumnIdentity(dependentColumn) ||
          !isFormulaOrButtonColumn(dependentColumn)
        ) {
          continue;
        }

        const dedupeKey = `${removedColumn.id}:${dependentColumn.id}`;
        if (seen.has(dedupeKey)) continue;

        seen.add(dedupeKey);
        impact.push({
          dependencyType:
            dependentColumn.uidt === UITypes.Button ? 'button' : 'formula',
          removedColumnId: removedColumn.id,
          resource: {
            id: dependentColumn.id,
            title: dependentColumn.title,
            uidt: dependentColumn.uidt,
          },
        });
      }
    }
  }

  return impact;
}
