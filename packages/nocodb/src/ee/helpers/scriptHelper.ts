import {
  ButtonActionsType,
  checkboxIconList,
  durationOptions,
  ModelTypes,
  ratingIconList,
  UITypes,
  viewTypeAlias,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

/**
 * Transform field metadata from DB format to API format
 */
function transformFieldMeta(field: any, colOptions: any): Record<string, any> {
  const options: Record<string, any> = {};
  let metaObj: Record<string, any> = {};

  try {
    metaObj = field.meta ? JSON.parse(field.meta) : {};
  } catch {
    metaObj = typeof field.meta === 'object' ? field.meta || {} : {};
  }

  switch (field.type) {
    case UITypes.LongText:
      options.rich_text = metaObj.richMode || false;
      options.ai = metaObj.ai || false;
      break;
    case UITypes.PhoneNumber:
    case UITypes.URL:
    case UITypes.Email:
      options.validation = metaObj.validate || false;
      break;
    case UITypes.Number:
      options.locale_string = metaObj.isLocaleString || false;
      break;
    case UITypes.Decimal:
    case UITypes.Rollup:
      options.precision = metaObj.precision || 1;
      options.locale_string = metaObj.isLocaleString || false;
      break;
    case UITypes.Currency:
      options.locale = metaObj.currency_locale || 'en-US';
      options.code = metaObj.currency_code || 'USD';
      break;
    case UITypes.Percent:
      options.show_as_progress = metaObj.is_progress || false;
      break;
    case UITypes.Duration:
      options.duration_format = durationOptions[metaObj?.duration || 0]?.title;
      break;
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedBy:
      options.date_format = metaObj.date_format || 'YYYY/MM/DD';
      options.time_format = metaObj.time_format || 'HH:mm:ss';
      options['12hr_format'] = metaObj.is12hrFormat || false;
      options.display_timezone = metaObj.isDisplayTimezone;
      options.timezone = metaObj.timezone;
      options.use_same_timezone_for_all =
        metaObj.useSameTimezoneForAll || false;
      break;
    case UITypes.Date:
      options.date_format = metaObj.date_format || 'YYYY/MM/DD';
      break;
    case UITypes.Time:
      options.time_format = metaObj.time_format || 'HH:mm';
      options['12hr_format'] = metaObj.is12hrFormat || false;
      break;
    case UITypes.Checkbox:
      if (metaObj.icon) {
        options.icon = checkboxIconList[metaObj.iconIdx ?? 0]?.label;
        options.color = metaObj.color || '#232323';
      }
      break;
    case UITypes.Rating:
      options.icon = ratingIconList[metaObj.iconIdx ?? 0]?.label;
      options.max_value = metaObj.max || 5;
      options.color = metaObj.color || '#232323';
      break;
    case UITypes.User:
      options.allow_multiple_users = metaObj.is_multi || false;
      options.notify_user_when_added = metaObj.notify || false;
      break;
    case UITypes.Links:
    case UITypes.LinkToAnotherRecord:
      options.singular = metaObj.singular;
      options.plural = metaObj.plural;
      break;
    case UITypes.Formula:
      if (metaObj.display_column_meta) {
        if (metaObj.display_type) {
          // Recursively transform the nested display type options
          const nestedOptions = transformFieldMeta(
            {
              type: metaObj.display_type,
              meta: metaObj.display_column_meta.meta,
            },
            {},
          );
          options.result = {
            type: metaObj.display_type,
            options: nestedOptions,
          };
        } else {
          options.result = null;
        }
      }
      break;
    case UITypes.Button:
      if (colOptions?.type === ButtonActionsType.Ai) {
        options.prompt = colOptions?.formula || '';
      }
      break;
  }

  return options;
}

export async function getBaseSchema(context: NcContext, ncMeta = Noco.ncMeta) {
  const key = `${CacheScope.BASE_SCHEMA}:${context.base_id}`;

  const baseSchema = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);
  if (baseSchema) {
    return baseSchema;
  }

  const knex = ncMeta.knex;
  const baseId = context.base_id;
  const workspaceId = context.workspace_id;

  // Sequential simple queries - each one is fast and uses indexes
  // This approach avoids complex query planning overhead

  // 1. Base info
  const baseInfo = await knex(MetaTable.PROJECT)
    .where('id', baseId)
    .select('title')
    .first();

  // 2. Models (tables)
  const models = await knex(MetaTable.MODELS)
    .where('base_id', baseId)
    .where('fk_workspace_id', workspaceId)
    .whereNot('type', ModelTypes.DASHBOARD)
    .where('mm', false)
    .select('id', 'title', 'description');

  // 3. All columns
  const columns = await knex(MetaTable.COLUMNS)
    .where('base_id', baseId)
    .where('fk_workspace_id', workspaceId)
    .select(
      'id',
      'fk_model_id',
      'title',
      'uidt as type',
      'pk as primary_key',
      'pv as primary_value',
      'cdf as default_value',
      'system as is_system_field',
      'description',
      'order',
      'meta',
    )
    .orderBy('order', 'asc');

  // 4. All views
  const views = await knex(MetaTable.VIEWS)
    .where('base_id', baseId)
    .where('fk_workspace_id', workspaceId)
    .select('id', 'fk_model_id', 'title', 'type', 'description');

  // 5. Collaborators
  const collaborators = await knex(MetaTable.PROJECT_USERS)
    .where(`${MetaTable.PROJECT_USERS}.base_id`, baseId)
    .where(`${MetaTable.PROJECT_USERS}.fk_workspace_id`, workspaceId)
    .join(
      MetaTable.USERS,
      `${MetaTable.PROJECT_USERS}.fk_user_id`,
      `${MetaTable.USERS}.id`,
    )
    .select(
      `${MetaTable.USERS}.id`,
      `${MetaTable.USERS}.email`,
      `${MetaTable.USERS}.display_name as name`,
    );

  // 6. All column options in a single UNION ALL query (9 queries -> 1)
  const columnOptionsRows = await knex.raw(
    `
    SELECT fk_column_id, 'select' as opt_type, 
           id, title, color, 
           NULL as relation_type, NULL as related_table_id, NULL as limit_record_selection_view_id,
           NULL as related_field_id, NULL as related_table_lookup_field_id, NULL as related_table_rollup_field_id, 
           NULL as rollup_function, NULL as formula, NULL as label, NULL as theme, NULL as icon, 
           NULL as button_hook_id, NULL as script_id, NULL as integration_id, NULL as model, NULL as type,
           NULL as barcode_value_field_id, NULL as barcode_format, NULL as qrcode_value_field_id, NULL as prompt
    FROM ${MetaTable.COL_SELECT_OPTIONS}
    WHERE base_id = ? AND fk_workspace_id = ?
    
    UNION ALL
    
    SELECT fk_column_id, 'relation' as opt_type,
           NULL, NULL, NULL,
           type as relation_type, fk_related_model_id as related_table_id, fk_target_view_id as limit_record_selection_view_id,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM ${MetaTable.COL_RELATIONS}
    WHERE base_id = ? AND fk_workspace_id = ?
    
    UNION ALL
    
    SELECT fk_column_id, 'lookup' as opt_type,
           NULL, NULL, NULL, NULL, NULL, NULL,
           fk_relation_column_id as related_field_id, fk_lookup_column_id as related_table_lookup_field_id, NULL,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM ${MetaTable.COL_LOOKUP}
    WHERE base_id = ? AND fk_workspace_id = ?
    
    UNION ALL
    
    SELECT fk_column_id, 'rollup' as opt_type,
           NULL, NULL, NULL, NULL, NULL, NULL,
           fk_relation_column_id as related_field_id, NULL, fk_rollup_column_id as related_table_rollup_field_id,
           rollup_function, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM ${MetaTable.COL_ROLLUP}
    WHERE base_id = ? AND fk_workspace_id = ?
    
    UNION ALL
    
    SELECT fk_column_id, 'formula' as opt_type,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
           formula_raw as formula, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM ${MetaTable.COL_FORMULA}
    WHERE base_id = ? AND fk_workspace_id = ?
    
    UNION ALL
    
    SELECT fk_column_id, 'button' as opt_type,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 
           formula_raw as formula, label, theme, icon,
           fk_webhook_id as button_hook_id, fk_script_id as script_id, fk_integration_id as integration_id, model, type,
           NULL, NULL, NULL, NULL
    FROM ${MetaTable.COL_BUTTON}
    WHERE base_id = ? AND fk_workspace_id = ?
    
    UNION ALL
    
    SELECT fk_column_id, 'barcode' as opt_type,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
           fk_barcode_value_column_id as barcode_value_field_id, barcode_format, NULL, NULL
    FROM ${MetaTable.COL_BARCODE}
    WHERE base_id = ? AND fk_workspace_id = ?
    
    UNION ALL
    
    SELECT fk_column_id, 'qrcode' as opt_type,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
           fk_qr_value_column_id as qrcode_value_field_id, NULL
    FROM ${MetaTable.COL_QRCODE}
    WHERE base_id = ? AND fk_workspace_id = ?
    
    UNION ALL
    
    SELECT fk_column_id, 'longtext' as opt_type,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
           fk_integration_id as integration_id, model, NULL, NULL, NULL, NULL,
           prompt_raw as prompt
    FROM ${MetaTable.COL_LONG_TEXT}
    WHERE base_id = ? AND fk_workspace_id = ?
    `,
    [
      baseId,
      workspaceId, // select
      baseId,
      workspaceId, // relation
      baseId,
      workspaceId, // lookup
      baseId,
      workspaceId, // rollup
      baseId,
      workspaceId, // formula
      baseId,
      workspaceId, // button
      baseId,
      workspaceId, // barcode
      baseId,
      workspaceId, // qrcode
      baseId,
      workspaceId, // longtext
    ],
  );

  // Build column options lookup map from unified results
  const columnOptionsMap = new Map<string, Record<string, any>>();

  for (const row of columnOptionsRows.rows) {
    const { fk_column_id, opt_type, ...rest } = row;
    const existing = columnOptionsMap.get(fk_column_id) || {};

    if (opt_type === 'select') {
      // Group select options into choices array
      const choices = existing.choices || [];
      choices.push({ id: rest.id, title: rest.title, color: rest.color });
      columnOptionsMap.set(fk_column_id, { ...existing, choices });
    } else {
      // For non-select types, merge all non-null fields
      const cleanedOptions: Record<string, any> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== null) {
          cleanedOptions[key] = value;
        }
      }
      columnOptionsMap.set(fk_column_id, { ...existing, ...cleanedOptions });
    }
  }

  // Build views lookup map (grouped by model_id)
  const viewsByModel = new Map<string, any[]>();
  for (const view of views) {
    const modelViews = viewsByModel.get(view.fk_model_id) || [];
    modelViews.push({
      id: view.id,
      name: view.title,
      type: viewTypeAlias[view.type] || view.type,
      description: view.description,
    });
    viewsByModel.set(view.fk_model_id, modelViews);
  }

  // Build columns lookup map (grouped by model_id)
  const columnsByModel = new Map<string, any[]>();
  for (const col of columns) {
    const colOptions = columnOptionsMap.get(col.id) || {};
    const metaOptions = transformFieldMeta(col, colOptions);

    const modelColumns = columnsByModel.get(col.fk_model_id) || [];
    modelColumns.push({
      id: col.id,
      name: col.title,
      type: col.type,
      primary_key: col.primary_key,
      primary_value: col.primary_value,
      default_value: col.default_value,
      is_system_field: col.is_system_field,
      description: col.description,
      order: col.order,
      options: { ...colOptions, ...metaOptions },
    });
    columnsByModel.set(col.fk_model_id, modelColumns);
  }

  // Assemble final result
  const result = {
    id: baseId,
    name: baseInfo?.title || '',
    tables: models.map((model: any) => ({
      id: model.id,
      name: model.title,
      description: model.description,
      views: viewsByModel.get(model.id) || [],
      fields: columnsByModel.get(model.id) || [],
    })),
    collaborators: collaborators.map((c: any) => ({
      id: c.id,
      email: c.email,
      name: c.name,
    })),
  };

  await NocoCache.set(context, key, result);
  await NocoCache.appendToList(
    'root',
    CacheScope.BASE_SCHEMA,
    ['ws', context.workspace_id],
    key,
  );

  return result;
}

export async function cleanBaseSchemaCacheForBase(baseId: string) {
  await NocoCache.del('root', `${CacheScope.BASE_SCHEMA}:${baseId}`);
}

export async function cleanBaseSchemaCacheForWorkspace(workspaceId: string) {
  const keys = await NocoCache.get(
    'root',
    `${CacheScope.BASE_SCHEMA}:ws:${workspaceId}`,
    CacheGetType.TYPE_ARRAY,
  );

  if (keys) {
    await NocoCache.del('root', [
      ...keys,
      `${CacheScope.BASE_SCHEMA}:ws:${workspaceId}`,
    ]);
  }
}
