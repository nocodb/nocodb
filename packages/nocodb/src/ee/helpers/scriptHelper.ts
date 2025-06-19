import { UITypes, viewTypeAlias } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { transformFieldConfig } from '~/utils/transformProperties';
import NocoCache from '~/cache/NocoCache';

const colOptionsHandlers = {
  [UITypes.Barcode]: {
    condition: UITypes.Barcode,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(
            `to_json(jsonb_build_object(
              'barcode_value_field_id', fk_barcode_value_column_id,
              'barcode_format', barcode_format
            ))`,
          ),
        )
        .from(MetaTable.COL_BARCODE)
        .where('fk_column_id', columnId),
  },
  [UITypes.QrCode]: {
    condition: UITypes.QrCode,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(
            `to_json(jsonb_build_object(
              'qrcode_value_field_id', fk_qr_value_column_id
            ))`,
          ),
        )
        .from(MetaTable.COL_QRCODE)
        .where('fk_column_id', columnId),
  },
  [UITypes.Links]: {
    condition: UITypes.Links,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(`
          to_json(jsonb_build_object(
            'relation_type', type,
            'related_table_id', fk_related_model_id,
            'limit_record_selection_view_id', fk_target_view_id
          ))
        `),
        )
        .from(MetaTable.COL_RELATIONS)
        .where('fk_column_id', columnId)
        .limit(1),
  },
  [UITypes.LinkToAnotherRecord]: {
    condition: UITypes.LinkToAnotherRecord,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(`
          to_json(jsonb_build_object(
            'relation_type', type,
            'related_table_id', fk_related_model_id,
            'limit_record_selection_view_id', fk_target_view_id
          ))
        `),
        )
        .from(MetaTable.COL_RELATIONS)
        .where('fk_column_id', columnId)
        .limit(1),
  },
  [UITypes.Lookup]: {
    condition: UITypes.Lookup,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(`
          to_json(jsonb_build_object(
            'related_field_id', fk_relation_column_id,
            'related_table_lookup_field_id', fk_lookup_column_id
          ))
        `),
        )
        .from(MetaTable.COL_LOOKUP)
        .where('fk_column_id', columnId)
        .limit(1),
  },
  [UITypes.Rollup]: {
    condition: UITypes.Rollup,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(`
          to_json(jsonb_build_object(
            'related_field_id', fk_relation_column_id,
            'related_table_rollup_field_id', fk_rollup_column_id,
            'rollup_function', rollup_function
          ))
        `),
        )
        .from(MetaTable.COL_ROLLUP)
        .where('fk_column_id', columnId)
        .limit(1),
  },
  [UITypes.Formula]: {
    condition: UITypes.Formula,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(`
          to_json(jsonb_build_object(
            'formula', formula_raw
          ))
        `),
        )
        .from(MetaTable.COL_FORMULA)
        .where('fk_column_id', columnId)
        .limit(1),
  },
  [UITypes.SingleSelect]: {
    condition: UITypes.SingleSelect,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(
            `to_json(jsonb_build_object(
              'choices', json_agg(jsonb_build_object('title', title, 'color', color, 'id', id))
            ))`,
          ),
        )
        .from(MetaTable.COL_SELECT_OPTIONS)
        .where('fk_column_id', columnId),
  },
  [UITypes.MultiSelect]: {
    condition: UITypes.MultiSelect,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(
            `to_json(jsonb_build_object(
              'choices', json_agg(jsonb_build_object(
                  'title', title, 
                  'color', color, 
                  'id', id
                ))
            ))`,
          ),
        )
        .from(MetaTable.COL_SELECT_OPTIONS)
        .where('fk_column_id', columnId),
  },
  [UITypes.Button]: {
    condition: UITypes.Button,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(
            `to_json(jsonb_build_object(
              'label', label,
              'theme', theme,
              'color', color,
              'icon', icon,
              'formula', formula_raw,
              'button_hook_id', fk_webhook_id,
              'script_id', fk_script_id,
              'integration_id', fk_integration_id,
              'model', model,
              'type', type
            ))`,
          ),
        )
        .from(MetaTable.COL_BUTTON)
        .where('fk_column_id', columnId),
  },
  [UITypes.LongText]: {
    condition: UITypes.LongText,
    handler: (knex, columnId) =>
      knex
        .select(
          knex.raw(
            `to_json(jsonb_build_object(
              'prompt', prompt_raw,
              'integration_id', fk_integration_id,
              'model', model
            ))`,
          ),
        )
        .from(MetaTable.COL_LONG_TEXT)
        .where('fk_column_id', columnId),
  },
};

const generateColOptionsCase = (knex = Noco.ncMeta.knex) => {
  const cases = Object.entries(colOptionsHandlers)
    .map(([_key, handler]) => {
      const subQuery = handler.handler(knex, knex.raw('c.id')).toQuery();
      return `WHEN c.uidt = '${handler.condition}' THEN (${subQuery})`;
    })
    .join('\n');

  return knex.raw(`
      CASE 
        ${cases}
        ELSE NULL 
      END
    `);
};

export async function getBaseSchema(
  baseId: string,
  workspaceId: string,
  ncMeta = Noco.ncMeta,
) {
  const key = `${CacheScope.BASE_SCHEMA}:${baseId}`;

  const baseSchema = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

  if (baseSchema) {
    return baseSchema;
  }

  const finalQuery = ncMeta.knex
    .with('base_tables', (qb) => {
      qb.select(
        'm.id',
        'm.title',
        'm.description',
        ncMeta.knex.raw(`
          (
            SELECT COALESCE(
              json_agg(
                jsonb_build_object(
                  'id', v.id,
                  'name', v.title,
                  'type', v.type,
                  'description', v.description
                )
              ),
              '[]'::json
            )
            FROM ${MetaTable.VIEWS} v
            WHERE v.fk_model_id = m.id
          ) as views
        `),
        ncMeta.knex.raw(`
          (
            SELECT COALESCE(
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
                  'options', ${generateColOptionsCase(ncMeta.knex).toQuery()},
                  'description', c.description,
                  'order', c.order
                )
                ORDER BY c.order NULLS LAST
              ),
              '[]'::json
            )
            FROM ${MetaTable.COLUMNS} c
            WHERE c.fk_model_id = m.id AND c.deleted IS NULL
          ) as fields
        `),
      )
        .from(`${MetaTable.MODELS} as m`)
        .where('m.base_id', baseId)
        .where('m.mm', '=', false)
        .whereNull('m.deleted');
    })
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
        .where('bu.base_id', baseId);
    })
    .select(
      ncMeta.knex.raw(
        `
        jsonb_build_object(
          'id', ?::text,
          'name', (SELECT title FROM ${MetaTable.PROJECT} WHERE id = ?::text),
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
        [baseId, baseId],
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
    ['ws', workspaceId],
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
