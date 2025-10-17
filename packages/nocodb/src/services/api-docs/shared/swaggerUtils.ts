import { ViewTypes } from 'nocodb-sdk';
import type {
  Base,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  Model,
  Source,
  View,
} from '~/models';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export interface SwaggerView {
  view: View;
  columns: Array<GridViewColumn | GalleryViewColumn | FormViewColumn>;
}

export interface SwaggerGenerationContext {
  context: NcContext;
  base: Base;
  models: Model[];
  ncMeta?: any;
}

export interface SwaggerGenerationResult {
  sourcesMap: Map<string, Source>;
  tableNamesMap: Map<string, string>;
  swaggerViews: Map<string, SwaggerView[]>;
}

/**
 * Prepares common data structures for swagger generation
 * - Fetches sources once and creates a map for efficient lookup
 * - Pre-constructs table names with source prefixes and handles duplicates
 * - Prepares views data for each model
 */
export async function prepareSwaggerGenerationData({
  context,
  base,
  models,
  ncMeta = Noco.ncMeta,
}: SwaggerGenerationContext): Promise<SwaggerGenerationResult> {
  // Fetch sources once for the entire base to avoid repeated queries
  const sources = await base.getSources(false, ncMeta);
  const sourcesMap = new Map<string, Source>(
    sources.map((source) => [source.id, source]),
  );

  // Pre-construct table names for all models to avoid repeated construction and handle duplicates
  const tableNamesMap = new Map<string, string>();
  const usedTableNames = new Set<string>();

  for (const model of models) {
    const source = sourcesMap.get(model.source_id);
    const sourcePrefix = source?.isMeta()
      ? ''
      : `${source?.alias || 'Source'}_`;
    const tableName = `${sourcePrefix}${model.title}`;

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

  // Prepare views data for all models
  const swaggerViews = new Map<string, SwaggerView[]>();

  for (const model of models) {
    const views: SwaggerView[] = [];

    for (const view of (await model.getViews(context, false, ncMeta)) || []) {
      if (view.type !== ViewTypes.GRID) continue;
      views.push({
        view,
        columns: await view.getColumns(context, ncMeta),
      });
    }

    swaggerViews.set(model.id, views);
  }

  return {
    sourcesMap,
    tableNamesMap,
    swaggerViews,
  };
}

/**
 * Generic swagger generation function that can be used by all versions
 */
export async function generateSwagger<TSwaggerColumn, TSwaggerView>(
  generationContext: SwaggerGenerationContext,
  swaggerBase: any,
  getSwaggerColumnMetas: (
    context: NcContext,
    columns: any[],
    base: Base,
    ncMeta?: any,
  ) => Promise<TSwaggerColumn[]>,
  getPaths: (
    context: NcContext,
    params: {
      base?: Base;
      model: Model;
      columns: TSwaggerColumn[];
      views: TSwaggerView[];
      sourcesMap: Map<string, Source>;
      tableName: string;
    },
    ncMeta?: any,
  ) => Promise<any>,
  getSchemas: (
    context: NcContext,
    params: {
      base?: Base;
      model: Model;
      columns: TSwaggerColumn[];
      views: TSwaggerView[];
      sourcesMap: Map<string, Source>;
      tableName: string;
    },
    ncMeta?: any,
  ) => Promise<any>,
  transformViews?: (swaggerViews: SwaggerView[]) => TSwaggerView[],
) {
  const { context, base, models, ncMeta = Noco.ncMeta } = generationContext;

  // base swagger object
  const swaggerObj = {
    ...swaggerBase,
    paths: {},
    components: {
      ...swaggerBase.components,
      schemas: { ...swaggerBase.components.schemas },
    },
  };

  // Prepare common data structures
  const { sourcesMap, tableNamesMap, swaggerViews } =
    await prepareSwaggerGenerationData(generationContext);

  // iterate and populate swagger schema and path for models and views
  for (const model of models) {
    let paths = {};

    const columns = await getSwaggerColumnMetas(
      context,
      await model.getColumns(context, ncMeta),
      base,
      ncMeta,
    );

    const modelViews = swaggerViews.get(model.id) || [];
    const views = transformViews
      ? transformViews(modelViews)
      : (modelViews as any);

    // skip mm tables
    if (!model.mm) {
      paths = await getPaths(
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
    }

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
