import { UITypes, viewTypeAlias } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { transformFieldConfig } from '~/utils/transformProperties';
import NocoCache from '~/cache/NocoCache';
import { processConcurrently } from '~/utils';
import { Base, Model } from '~/models';

const colOptionsHandlers = {
  [UITypes.Barcode]: {
    table: MetaTable.COL_BARCODE,
    fields: {
      barcode_value_field_id: 'fk_barcode_value_column_id',
      barcode_format: 'barcode_format',
    },
    aggregate: false,
  },
  [UITypes.QrCode]: {
    table: MetaTable.COL_QRCODE,
    fields: {
      qrcode_value_field_id: 'fk_qr_value_column_id',
    },
    aggregate: false,
  },
  [UITypes.Links]: {
    table: MetaTable.COL_RELATIONS,
    fields: {
      relation_type: 'type',
      related_table_id: 'fk_related_model_id',
      limit_record_selection_view_id: 'fk_target_view_id',
    },
    aggregate: false,
  },
  [UITypes.LinkToAnotherRecord]: {
    table: MetaTable.COL_RELATIONS,
    fields: {
      relation_type: 'type',
      related_table_id: 'fk_related_model_id',
      limit_record_selection_view_id: 'fk_target_view_id',
    },
    aggregate: false,
  },
  [UITypes.Lookup]: {
    table: MetaTable.COL_LOOKUP,
    fields: {
      related_field_id: 'fk_relation_column_id',
      related_table_lookup_field_id: 'fk_lookup_column_id',
    },
    aggregate: false,
  },
  [UITypes.Rollup]: {
    table: MetaTable.COL_ROLLUP,
    fields: {
      related_field_id: 'fk_relation_column_id',
      related_table_rollup_field_id: 'fk_rollup_column_id',
      rollup_function: 'rollup_function',
    },
    aggregate: false,
  },
  [UITypes.Formula]: {
    table: MetaTable.COL_FORMULA,
    fields: {
      formula: 'formula_raw',
    },
    aggregate: false,
  },
  [UITypes.SingleSelect]: {
    table: MetaTable.COL_SELECT_OPTIONS,
    fields: {
      choices: 'SELECT_OPTIONS_AGGREGATE', // Special marker for aggregation
    },
    aggregate: true,
  },
  [UITypes.MultiSelect]: {
    table: MetaTable.COL_SELECT_OPTIONS,
    fields: {
      choices: 'SELECT_OPTIONS_AGGREGATE',
    },
    aggregate: true,
  },
  [UITypes.Button]: {
    table: MetaTable.COL_BUTTON,
    fields: {
      label: 'label',
      theme: 'theme',
      color: 'color',
      icon: 'icon',
      formula: 'formula_raw',
      button_hook_id: 'fk_webhook_id',
      script_id: 'fk_script_id',
      integration_id: 'fk_integration_id',
      model: 'model',
      type: 'type',
    },
    aggregate: false,
  },
  [UITypes.LongText]: {
    table: MetaTable.COL_LONG_TEXT,
    fields: {
      prompt: 'prompt_raw',
      integration_id: 'fk_integration_id',
      model: 'model',
    },
    aggregate: false,
  },
};

async function getBaseModels(context: NcContext, ncMeta = Noco.ncMeta) {
  return (
    await Model.list(context, { base_id: context.base_id }, ncMeta)
  ).filter((m) => !m.mm);
}

async function getModelViews(modelIds: string[], ncMeta = Noco.ncMeta) {
  if (modelIds.length === 0) return {};

  const views = await ncMeta.knex
    .select('fk_model_id', 'id', 'title', 'type', 'description')
    .from(MetaTable.VIEWS)
    .whereIn('fk_model_id', modelIds);

  const viewsByModel = {};
  views.forEach((view) => {
    if (!viewsByModel[view.fk_model_id]) {
      viewsByModel[view.fk_model_id] = [];
    }
    viewsByModel[view.fk_model_id].push({
      id: view.id,
      name: view.title,
      type: viewTypeAlias[view.type] || view.type,
      description: view.description,
    });
  });

  return viewsByModel;
}

async function getModelColumns(modelIds: string[], ncMeta = Noco.ncMeta) {
  if (modelIds.length === 0) return {};

  return await ncMeta.knex
    .select(
      'fk_model_id',
      'id',
      'title',
      'uidt',
      'pk',
      'pv',
      'cdf',
      'meta',
      'system',
      'description',
      'order',
    )
    .from(MetaTable.COLUMNS)
    .whereIn('fk_model_id', modelIds)
    .orderBy(['fk_model_id', 'order']);
}

async function getColumnOptions(columnIds: string[], ncMeta = Noco.ncMeta) {
  if (columnIds.length === 0) return {};

  const optionsMap = {};

  const optionEntries = Object.entries(colOptionsHandlers);

  const optionResults = await processConcurrently(
    optionEntries,
    async ([uiType, config]) => {
      if (config.aggregate) {
        const selectOptions = await ncMeta.knex
          .select('fk_column_id', 'title', 'color', 'id')
          .from(config.table)
          .whereIn('fk_column_id', columnIds);

        return { uiType, config, options: selectOptions, aggregate: true };
      } else {
        const fieldSelects = ['fk_column_id', ...Object.values(config.fields)];
        const options = await ncMeta.knex
          .select(fieldSelects)
          .from(config.table)
          .whereIn('fk_column_id', columnIds);

        return { uiType, config, options, aggregate: false };
      }
    },
    5,
  );

  optionResults.forEach(({ config, options, aggregate }) => {
    if (aggregate) {
      options.forEach((option) => {
        if (!optionsMap[option.fk_column_id]) {
          optionsMap[option.fk_column_id] = { choices: [] };
        }
        optionsMap[option.fk_column_id].choices.push({
          title: option.title,
          color: option.color,
          id: option.id,
        });
      });
    } else {
      options.forEach((option) => {
        if (!optionsMap[option.fk_column_id]) {
          optionsMap[option.fk_column_id] = {};
        }

        Object.entries(config.fields).forEach(([key, field]) => {
          optionsMap[option.fk_column_id][key] = option[field];
        });
      });
    }
  });

  return optionsMap;
}

async function getBaseCollaborators(context: NcContext, ncMeta = Noco.ncMeta) {
  return await ncMeta.knex
    .select('u.id', 'u.email', 'u.display_name as name')
    .from(`${MetaTable.PROJECT_USERS} as bu`)
    .join(`${MetaTable.USERS} as u`, 'bu.fk_user_id', 'u.id')
    .where('bu.base_id', context.base_id);
}

export async function getBaseSchema(context: NcContext, ncMeta = Noco.ncMeta) {
  return {};
  // TODO: Optimize the Query
  const key = `${CacheScope.BASE_SCHEMA}:${context.base_id}`;

  const baseSchema = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
  if (baseSchema) {
    return baseSchema;
  }

  const [baseInfo, models] = await Promise.all([
    Base.get(context, context.base_id),
    getBaseModels(context, ncMeta),
  ]);

  const modelIds = models.map((model) => model.id);

  const [viewsByModel, columns, collaborators] = await Promise.all([
    getModelViews(modelIds, ncMeta),
    getModelColumns(modelIds, ncMeta),
    getBaseCollaborators(context, ncMeta),
  ]);

  const columnIds = columns.map((col) => col.id);
  const columnOptions = await getColumnOptions(columnIds, ncMeta);

  const columnsByModel = {};
  columns.forEach((column) => {
    if (!columnsByModel[column.fk_model_id]) {
      columnsByModel[column.fk_model_id] = [];
    }

    const transformedColumn = {
      id: column.id,
      name: column.title,
      type: column.uidt,
      primary_key: column.pk,
      primary_value: column.pv,
      default_value: column.cdf,
      meta: column.meta,
      is_system_field: column.system,
      options: columnOptions[column.id] || null,
      description: column.description,
      order: column.order,
    };

    columnsByModel[column.fk_model_id].push(
      transformFieldConfig(transformedColumn),
    );
  });

  const result = {
    id: context.base_id,
    name: baseInfo.title,
    tables: models.map((model) => ({
      id: model.id,
      name: model.title,
      description: model.description,
      views: viewsByModel[model.id] || [],
      fields: columnsByModel[model.id] || [],
    })),
    collaborators: collaborators.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
    })),
  };

  await NocoCache.set(key, result);
  await NocoCache.appendToList(
    CacheScope.BASE_SCHEMA,
    ['ws', context.workspace_id],
    key,
  );

  return result;
}

export async function cleanBaseSchemaCacheForBase(baseId: string) {
  await NocoCache.del(`${CacheScope.BASE_SCHEMA}:${baseId}`);
}

export async function cleanBaseSchemaCacheForWorkspace(workspaceId: string) {
  const keys = await NocoCache.get(
    `${CacheScope.BASE_SCHEMA}:ws:${workspaceId}`,
    CacheGetType.TYPE_ARRAY,
  );

  if (keys) {
    await NocoCache.del([
      ...keys,
      `${CacheScope.BASE_SCHEMA}:ws:${workspaceId}`,
    ]);
  }
}
