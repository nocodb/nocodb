import { ViewTypes } from 'nocodb-sdk';
import swaggerBase from './swagger-base.json';
import getPaths from './getPaths';
import getSchemas from './getSchemas';
import getSwaggerColumnMetas from './getSwaggerColumnMetas';
import type {
  Base,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  Model,
  View,
} from '~/models';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getSwaggerJSONV2(
  context: NcContext,
  base: Base,
  models: Model[],
  ncMeta = Noco.ncMeta,
) {
  // base swagger object
  const swaggerObj = {
    ...swaggerBase,
    paths: {},
    components: {
      ...swaggerBase.components,
      schemas: { ...swaggerBase.components.schemas },
    },
  };

  // Fetch sources once for the entire base to avoid repeated queries
  const sources = await base.getSources(false, ncMeta);
  const sourcesMap = new Map(sources.map((source) => [source.id, source]));

  // Helper function to sanitize names for use in schema names
  function sanitizeSchemaName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  // Pre-construct table names for all models to avoid repeated construction and handle duplicates
  const tableNamesMap = new Map<string, string>();
  const usedTableNames = new Set<string>();

  for (const model of models) {
    const source = sourcesMap.get(model.source_id);
    const sourcePrefix = source?.isMeta()
      ? ''
      : `${sanitizeSchemaName(source?.alias || 'Source')}_`;
    const tableName = `${sourcePrefix}${sanitizeSchemaName(model.title)}`;

    // Handle duplicate table names by adding a number suffix
    let finalTableName = tableName;
    let counter = 1;
    while (usedTableNames.has(finalTableName)) {
      finalTableName = `${tableName}_${counter}`;
      counter++;
    }

    usedTableNames.add(finalTableName);
    tableNamesMap.set(model.id, finalTableName);
  }

  // iterate and populate swagger schema and path for models and views
  for (const model of models) {
    let paths = {};

    const columns = await getSwaggerColumnMetas(
      context,
      await model.getColumns(context, ncMeta),
      base,
      ncMeta,
    );

    const views: SwaggerView[] = [];

    for (const view of (await model.getViews(context, false, ncMeta)) || []) {
      if (view.type !== ViewTypes.GRID) continue;
      views.push({
        view,
        columns: await view.getColumns(context, ncMeta),
      });
    }

    // skip mm tables
    if (!model.mm)
      paths = await getPaths(
        context,
        {
          model,
          columns,
          views,
          sourcesMap,
          tableName: tableNamesMap.get(model.id),
        },
        ncMeta,
      );

    const schemas = await getSchemas(
      context,
      {
        base,
        model,
        columns,
        views,
        sourcesMap,
        tableName: tableNamesMap.get(model.id),
      },
      ncMeta,
    );

    Object.assign(swaggerObj.paths, paths);
    Object.assign(swaggerObj.components.schemas, schemas);
  }

  return swaggerObj;
}

export interface SwaggerView {
  view: View;
  columns: Array<GridViewColumn | GalleryViewColumn | FormViewColumn>;
}
