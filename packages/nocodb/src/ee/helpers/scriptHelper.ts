import { UITypes, viewTypeAlias } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { transformFieldConfig } from '~/utils/transformProperties';
import NocoCache from '~/cache/NocoCache';

const colOptionsHandlers = {
  [UITypes.Barcode]: {
    condition: UITypes.Barcode,
    table: MetaTable.COL_BARCODE,
    fields: {
      barcode_value_field_id: 'fk_barcode_value_column_id',
      barcode_format: 'barcode_format',
    },
    aggregate: false,
  },
  [UITypes.QrCode]: {
    condition: UITypes.QrCode,
    table: MetaTable.COL_QRCODE,
    fields: {
      qrcode_value_field_id: 'fk_qr_value_column_id',
    },
    aggregate: false,
  },
  [UITypes.Links]: {
    condition: UITypes.Links,
    table: MetaTable.COL_RELATIONS,
    fields: {
      relation_type: 'type',
      related_table_id: 'fk_related_model_id',
      limit_record_selection_view_id: 'fk_target_view_id',
    },
    aggregate: false,
  },
  [UITypes.LinkToAnotherRecord]: {
    condition: UITypes.LinkToAnotherRecord,
    table: MetaTable.COL_RELATIONS,
    fields: {
      relation_type: 'type',
      related_table_id: 'fk_related_model_id',
      limit_record_selection_view_id: 'fk_target_view_id',
    },
    aggregate: false,
  },
  [UITypes.Lookup]: {
    condition: UITypes.Lookup,
    table: MetaTable.COL_LOOKUP,
    fields: {
      related_field_id: 'fk_relation_column_id',
      related_table_lookup_field_id: 'fk_lookup_column_id',
    },
    aggregate: false,
  },
  [UITypes.Rollup]: {
    condition: UITypes.Rollup,
    table: MetaTable.COL_ROLLUP,
    fields: {
      related_field_id: 'fk_relation_column_id',
      related_table_rollup_field_id: 'fk_rollup_column_id',
      rollup_function: 'rollup_function',
    },
    aggregate: false,
  },
  [UITypes.Formula]: {
    condition: UITypes.Formula,
    table: MetaTable.COL_FORMULA,
    fields: {
      formula: 'formula_raw',
    },
    aggregate: false,
  },
  [UITypes.SingleSelect]: {
    condition: UITypes.SingleSelect,
    table: MetaTable.COL_SELECT_OPTIONS,
    fields: {
      choices:
        "json_agg(jsonb_build_object('title', title, 'color', color, 'id', id))",
    },
    aggregate: true,
  },
  [UITypes.MultiSelect]: {
    condition: UITypes.MultiSelect,
    table: MetaTable.COL_SELECT_OPTIONS,
    fields: {
      choices:
        "json_agg(jsonb_build_object('title', title, 'color', color, 'id', id))",
    },
    aggregate: true,
  },
  [UITypes.Button]: {
    condition: UITypes.Button,
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
    condition: UITypes.LongText,
    table: MetaTable.COL_LONG_TEXT,
    fields: {
      prompt: 'prompt_raw',
      integration_id: 'fk_integration_id',
      model: 'model',
    },
    aggregate: false,
  },
};

const generateColumnOptionsCTEs = (knex) => {
  const ctes = {};

  Object.entries(colOptionsHandlers).forEach(([uiType, config]) => {
    const cteName = `col_options_${uiType
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')}`;

    if (config?.aggregate) {
      ctes[cteName] = (qb) => {
        const fieldMappings = Object.entries(config.fields)
          .map(([key, value]) => {
            return `'${key}', ${value}`;
          })
          .join(', ');

        qb.select(
          'fk_column_id',
          knex.raw(`to_json(jsonb_build_object(${fieldMappings})) as options`),
        )
          .from(config.table)
          .groupBy('fk_column_id');
      };
    } else {
      ctes[cteName] = (qb) => {
        const fieldMappings = Object.entries(config.fields)
          .map(([key, value]) => {
            return `'${key}', ${value}`;
          })
          .join(', ');

        qb.select(
          'fk_column_id',
          knex.raw(`to_json(jsonb_build_object(${fieldMappings})) as options`),
        ).from(config.table);
      };
    }
  });

  return ctes;
};

const generateOptionsJoins = (knex, qb) => {
  Object.entries(colOptionsHandlers).forEach(([uiType, config]) => {
    const cteName = `col_options_${uiType
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')}`;
    const alias = `opt_${uiType.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    qb.leftJoin(`${cteName} as ${alias}`, function () {
      this.on(`${alias}.fk_column_id`, '=', 'c.id').andOn(
        knex.raw('c.uidt'),
        '=',
        knex.raw(`'${config.condition}'`),
      );
    });
  });

  return qb;
};

const generateOptionsCoalesce = () => {
  const optionAliases = Object.keys(colOptionsHandlers).map(
    (uiType) =>
      `opt_${uiType.toLowerCase().replace(/[^a-z0-9]/g, '_')}.options`,
  );

  return `COALESCE(${optionAliases.join(', ')})`;
};

export async function getBaseSchema(context: NcContext, ncMeta = Noco.ncMeta) {
  const key = `${CacheScope.BASE_SCHEMA}:${context.base_id}`;

  const baseSchema = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

  if (baseSchema) {
    return baseSchema;
  }

  // Generate CTEs for column options
  const optionsCTEs = generateColumnOptionsCTEs(ncMeta.knex);

  let queryBuilder = ncMeta.knex;

  Object.entries(optionsCTEs).forEach(([cteName, cteBuilder]) => {
    queryBuilder = queryBuilder.with(cteName, cteBuilder);
  });

  const finalQuery = queryBuilder
    // Base models CTE
    .with('base_models', (qb) => {
      qb.select('id', 'title', 'description')
        .from(`${MetaTable.MODELS}`)
        .where('base_id', context.base_id)
        .where('mm', false)
        .whereNull('deleted');
    })

    // Views aggregation CTE
    .with('model_views', (qb) => {
      qb.select(
        'fk_model_id',
        ncMeta.knex.raw(`
          json_agg(
            jsonb_build_object(
              'id', id,
              'name', title,
              'type', type,
              'description', description
            )
          ) as views_json
        `),
      )
        .from(MetaTable.VIEWS)
        .whereIn('fk_model_id', function () {
          this.select('id').from('base_models');
        })
        .groupBy('fk_model_id');
    })

    // Columns with options CTE
    .with('model_columns', (qb) => {
      let columnsQuery = qb
        .select(
          'c.fk_model_id',
          ncMeta.knex.raw(`
          json_agg(
            jsonb_build_object(
              'id', c.id,
              'name', c.title,
              'type', c.uidt,
              'primary_key', c.pk,
              'primary_value', c.pv,
              'default_value', c.cdf,
              'meta', c.meta,
              'is_system_field', c.system,
              'options', ${generateOptionsCoalesce()},
              'description', c.description,
              'order', c."order"
            )
            ORDER BY c."order" NULLS LAST
          ) as columns_json
        `),
        )
        .from(`${MetaTable.COLUMNS} as c`)
        .whereIn('c.fk_model_id', function () {
          this.select('id').from('base_models');
        })
        .whereNull('c.deleted');

      // Add all the LEFT JOINs for column options
      columnsQuery = generateOptionsJoins(ncMeta.knex, columnsQuery);

      columnsQuery.groupBy('c.fk_model_id');
    })

    // Base tables CTE - combining models with their views and columns
    .with('base_tables', (qb) => {
      qb.select(
        'bm.id',
        'bm.title',
        'bm.description',
        ncMeta.knex.raw("COALESCE(mv.views_json, '[]'::json) as views"),
        ncMeta.knex.raw("COALESCE(mc.columns_json, '[]'::json) as fields"),
      )
        .from('base_models as bm')
        .leftJoin('model_views as mv', 'bm.id', 'mv.fk_model_id')
        .leftJoin('model_columns as mc', 'bm.id', 'mc.fk_model_id');
    })

    // Base users CTE
    .with('base_users', (qb) => {
      qb.select(
        ncMeta.knex.raw(`
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', u.id,
                'email', u.email,
                'name', u.display_name
              )
            ),
            '[]'::json
          ) as base_collaborators
        `),
      )
        .from(`${MetaTable.PROJECT_USERS} as bu`)
        .join(`${MetaTable.USERS} as u`, 'bu.fk_user_id', 'u.id')
        .where('bu.base_id', context.base_id);
    })
    .select(
      ncMeta.knex.raw(
        `
        jsonb_build_object(
          'id', (?)::text,
          'name', (SELECT title FROM ${MetaTable.PROJECT} WHERE id = ?)::text,
          'tables', COALESCE(
            (SELECT json_agg(
              jsonb_build_object(
                'id', bt.id,
                'description', bt.description,
                'name', bt.title,
                'views', bt.views,
                'fields', bt.fields
              )
            ) FROM base_tables bt),
            '[]'::json
          ),
          'collaborators', (SELECT base_collaborators FROM base_users)
        ) as result
      `,
        [context.base_id, context.base_id],
      ),
    )
    .first();

  const result = (await finalQuery)?.result;

  result.tables = result.tables.map((table) => {
    table.fields = table.fields.map((field) => {
      return transformFieldConfig(field);
    });

    table.views = table.views.map((view) => {
      view.type = viewTypeAlias[view.type];
      return view;
    });

    return table;
  });

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
