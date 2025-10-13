import { getModelPaths, getViewPaths } from './templates/paths';
import type { Base, Model, Source } from '~/models';
import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from './getSwaggerJSON';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

// Helper function to sanitize names for use in schema names
function sanitizeSchemaName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

export default async function getPaths(
  context: NcContext,
  {
    base,
    model,
    columns,
    views,
    tableName,
  }: {
    base: Base;
    model: Model;
    columns: SwaggerColumn[];
    views: SwaggerView[];
    sourcesMap: Map<string, Source>;
    tableName: string;
  },
  _ncMeta = Noco.ncMeta,
) {
  const swaggerPaths = await getModelPaths(context, {
    tableName,
    type: model.type,
    orgs: 'v1',
    columns,
    baseName: base.id,
  });

  for (const { view, columns: viewColumns } of views) {
    const swaggerColumns = columns.filter(
      (c) => viewColumns.find((vc) => vc.fk_column_id === c.column.id)?.show,
    );
    Object.assign(
      swaggerPaths,
      await getViewPaths(context, {
        tableName,
        viewName: sanitizeSchemaName(view.title),
        type: model.type,
        orgs: 'v1',
        columns: swaggerColumns,
        baseName: base.id,
      }),
    );
  }

  return swaggerPaths;
}
