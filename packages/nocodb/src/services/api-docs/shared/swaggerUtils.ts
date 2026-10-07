import { ViewTypes } from 'nocodb-sdk';
import type { SourcesMap } from '~/services/api-docs/types';
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
import { swaggerGetSourcePrefix } from '~/helpers/dbHelpers';
import { swaggerSanitizeSchemaName } from '~/helpers/stringHelpers';

export interface SwaggerView {
  view: View;
  columns: Array<GridViewColumn | GalleryViewColumn | FormViewColumn>;
}

export interface SwaggerGenerationContext {
  context: NcContext;
  base: Base;
  sourcesMap: SourcesMap;
  models: Model[];
  ncMeta?: any;
  // View types offered per table; defaults to grid only.
  viewTypes?: ViewTypes[];
}

export interface SwaggerGenerationOptions {
  // Junction tables have no paths; skip their schemas too unless another
  // schema references them.
  skipMmSchemas?: boolean;
}

export interface SwaggerGenerationResult {
  sourcesMap: Map<string, Source>;
  tableNamesMap: Map<string, string>;
  schemaNamesMap: Map<string, string>;
  swaggerViews: Map<string, SwaggerView[]>;
}

/**
 * Prepares common data structures for swagger generation
 * - Fetches sources once and creates a map for efficient lookup
 * - Pre-constructs table names with source prefixes and handles duplicates
 * - Prepares views data for each model
 */
export async function prepareSwaggerGenerationData({
  models,
  sourcesMap,
  ncMeta = Noco.ncMeta,
  viewTypes = [ViewTypes.GRID],
}: SwaggerGenerationContext): Promise<SwaggerGenerationResult> {
  // Pre-construct table names for all models to avoid repeated construction and handle duplicates
  const tableNamesMap = new Map<string, string>();
  const usedTableNames = new Set<string>();
  // Component names and operationIds are sanitized to ASCII and lowercased in
  // operationIds, so uniqueness is checked on that form, not the title.
  const schemaNamesMap = new Map<string, string>();
  const usedSchemaNames = new Set<string>();

  for (const model of models) {
    const source = sourcesMap.get(model.source_id);
    const sourcePrefix = swaggerGetSourcePrefix(source);
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

    let schemaName = swaggerSanitizeSchemaName(finalTableName);
    // A title with no ASCII letters or digits sanitizes to underscores only.
    if (!/[A-Za-z0-9]/.test(schemaName)) {
      schemaName = `${schemaName}${model.id}`;
    }
    let finalSchemaName = schemaName;
    counter = 1;
    while (usedSchemaNames.has(finalSchemaName.toLowerCase())) {
      finalSchemaName = `${schemaName}_${counter}`;
      counter++;
    }
    usedSchemaNames.add(finalSchemaName.toLowerCase());
    schemaNamesMap.set(model.id, finalSchemaName);
  }

  // Prepare views data for all models
  const swaggerViews = new Map<string, SwaggerView[]>();

  for (const model of models) {
    const views: SwaggerView[] = [];

    for (const view of (await model.getViews(false, ncMeta)) || []) {
      if (!viewTypes.includes(view.type)) continue;
      views.push({
        view,
        columns: await view.getColumns(ncMeta),
      });
    }

    swaggerViews.set(model.id, views);
  }

  return {
    sourcesMap,
    tableNamesMap,
    schemaNamesMap,
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
    param: {
      columns: any[];
      model: Model;
      base: Base;
      sourcesMap: SourcesMap;
    },
    ncMeta?: any,
  ) => Promise<TSwaggerColumn[]>,
  getPaths: (
    context: NcContext,
    params: {
      base: Base;
      model: Model;
      columns: TSwaggerColumn[];
      views: TSwaggerView[];
      sourcesMap: Map<string, Source>;
      tableName: string;
      schemaName: string;
    },
    ncMeta?: any,
  ) => Promise<any>,
  getSchemas: (
    context: NcContext,
    params: {
      base: Base;
      model: Model;
      columns: TSwaggerColumn[];
      views: TSwaggerView[];
      sourcesMap: Map<string, Source>;
      tableName: string;
      schemaName: string;
    },
    ncMeta?: any,
  ) => Promise<any>,
  transformViews?: (swaggerViews: SwaggerView[]) => TSwaggerView[],
  options: SwaggerGenerationOptions = {},
) {
  const {
    context,
    base,
    models,
    sourcesMap,
    ncMeta = Noco.ncMeta,
  } = generationContext;

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
  const { tableNamesMap, schemaNamesMap, swaggerViews } =
    await prepareSwaggerGenerationData(generationContext);

  // iterate and populate swagger schema and path for models and views
  for (const model of models) {
    if (model.mm && options.skipMmSchemas) continue;

    let paths = {};

    const columns = await getSwaggerColumnMetas(
      context,
      {
        columns: await model.getColumns(ncMeta),
        model,
        sourcesMap,
        base,
      },
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
          schemaName: schemaNamesMap.get(model.id),
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
        schemaName: schemaNamesMap.get(model.id),
      },
      ncMeta,
    );

    Object.assign(swaggerObj.paths, paths);
    Object.assign(swaggerObj.components.schemas, schemas);
  }

  return swaggerObj;
}
