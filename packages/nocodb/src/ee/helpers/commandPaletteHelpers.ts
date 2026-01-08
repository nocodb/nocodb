import {
  AutomationTypes,
  ModelTypes,
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { DBQueryClient } from 'src/dbQueryClient';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export interface CommandPaletteResult {
  wsAndBases: {
    workspace_id: string;
    workspace_title: string;
    workspace_meta: string;
    base_id: string;
    base_title: string;
    base_meta: string;
    base_role: string;
    base_order: string;
  }[];
  items: {
    kind: string;
    fk_workspace_id: string;
    base_id: string;
    item_id: string;
    item_title: string;
    item_type: string;
    item_meta: string;
    item_order: number;
    item_sync: boolean | null;
    item_parent_id: string;
    result_order: string;
    visibility_role: string;
    visibility_disabled: string;
  }[];
}
export async function getCommandPaletteForUserWorkspace(
  userId: string,
  workspaceId: string,
  ncMeta = Noco.ncMeta,
): Promise<CommandPaletteResult> {
  const key = `${CacheScope.CMD_PALETTE}:${userId}:${workspaceId}`;

  let cmdData = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);

  if (!cmdData) {
    const dbQueryClient = DBQueryClient.get(ncMeta.knex.clientType());
    const rootQb = ncMeta
      .knexConnection(`${MetaTable.WORKSPACE} as ws`)
      .select(
        'ws.id as workspace_id',
        'ws.title as workspace_title',
        'ws.meta as workspace_meta',
        'b.id as base_id',
        'b.title as base_title',
        'b.meta as base_meta',
        ncMeta.knexConnection.raw(`CASE
          WHEN "bu"."roles" is not null THEN "bu"."roles"
          ${Object.values(WorkspaceUserRoles)
            .map(
              (value) =>
                `WHEN "wu"."roles" = '${value}' THEN '${WorkspaceRolesToProjectRoles[value]}'`,
            )
            .join(' ')}
          ELSE '${ProjectRoles.NO_ACCESS}'
          END as base_role`),
        'b.order as base_order',
      )
      .innerJoin(
        `${MetaTable.WORKSPACE_USER} as wu`,
        `wu.fk_workspace_id`,
        `ws.id`,
      )
      .innerJoin(`${MetaTable.PROJECT} as b`, `b.fk_workspace_id`, `ws.id`)
      .leftJoin(`${MetaTable.PROJECT_USERS} as bu`, function () {
        this.on(`bu.base_id`, `=`, `b.id`).andOn(
          `bu.fk_user_id`,
          `=`,
          `wu.fk_user_id`,
        );
      })
      .where('ws.id', workspaceId)
      .andWhere('wu.fk_user_id', userId)
      .andWhere(function () {
        this.where('ws.deleted', false).orWhereNull('ws.deleted');
      })
      .andWhere(function () {
        this.where('b.deleted', false).orWhereNull('b.deleted');
        this.andWhere('b.is_snapshot', false).orWhereNull('b.is_snapshot');
      })
      .orderBy([
        { column: 'ws.title', order: 'asc' },
        { column: 'b.order', order: 'asc' },
      ]);

    // Query 1: Get workspace and bases
    const workspaceAndBases = (await rootQb).filter(
      (wbs) => wbs.base_role !== ProjectRoles.NO_ACCESS,
    );

    const baseTables = dbQueryClient.temporaryTableRaw({
      knex: ncMeta.knex,
      data: workspaceAndBases,
      alias: '_base_tbl',
      fields: ['workspace_id', 'base_id', 'base_order', 'base_role'],
    });

    const itemOrder = (itemField: string[]) => {
      const itemFieldWithSeparator = [];
      let isFirst = true;
      for (const item of itemField) {
        if (!isFirst) {
          itemFieldWithSeparator.push("'_'");
        }
        itemFieldWithSeparator.push(item);
        isFirst = false;
      }
      return dbQueryClient.concat([
        '_base_tbl.base_order',
        "'_'",
        ...itemFieldWithSeparator,
      ]);
    };

    const itemQuery = ncMeta.knexConnection.raw(
      `
          -- Tables
          SELECT
            'model' as kind,
            t.base_id,
            t.fk_workspace_id,
            t.id as item_id,
            t.title as item_title,
            t.type as item_type,
            t.meta as item_meta,
            t.order as item_order,
            t.synced as item_sync,
            NULL as item_parent_id,
            ${itemOrder(['t.order'])} as result_order,
            NULL as visibility_role,
            NULL as visibility_disabled
          FROM ${MetaTable.MODELS} as t
            INNER JOIN ${baseTables}
              ON t.base_id = _base_tbl.base_id
              AND t.fk_workspace_id = _base_tbl.workspace_id
          WHERE (t.mm = false OR t.mm IS NULL)
            AND t.type NOT IN (:type_dashboard)
            AND (t.deleted = false OR t.deleted IS NULL)
          
          UNION ALL

          -- Views
          SELECT 
            'view' as kind,
            t.base_id,
            t.fk_workspace_id,
            v.id as item_id,
            v.title as item_title,
            ${dbQueryClient.simpleCast('v.type', 'TEXT')} as item_type,
            v.meta as item_meta,
            v.order as item_order,
            NULL as item_sync,
            v.fk_model_id as item_parent_id,
            ${itemOrder(['t.order', 'v.order'])} as result_order,
            dm.role as visibility_role,
            dm.disabled as visibility_disabled
          FROM ${MetaTable.MODELS} as t
            INNER JOIN ${baseTables}
              ON t.base_id = _base_tbl.base_id
              AND t.fk_workspace_id = _base_tbl.workspace_id
            INNER JOIN ${MetaTable.VIEWS} as v 
              ON v.fk_model_id = t.id
              AND v.base_id = t.base_id
              AND v.fk_workspace_id = t.fk_workspace_id
            LEFT JOIN ${
              MetaTable.MODEL_ROLE_VISIBILITY
            } as dm ON dm.fk_view_id = v.id
          WHERE (t.mm = false OR t.mm IS NULL)
            AND t.type NOT IN (:type_dashboard)
            AND (t.deleted = false OR t.deleted IS NULL)
            AND (dm.disabled = false OR dm.disabled IS NULL)
          
          UNION ALL
          
          -- Scripts
          SELECT 
            'script' as kind,
            s.base_id,
            s.fk_workspace_id,
            s.id as item_id,
            s.title as item_title,
            NULL as item_type,
            s.meta as item_meta,
            s.order as item_order,
            NULL as item_sync,
            NULL as item_parent_id,
            ${itemOrder(['s.order'])} as result_order,
            NULL as visibility_role,
            NULL as visibility_disabled
          FROM ${MetaTable.AUTOMATIONS} as s
            INNER JOIN ${baseTables}
              ON s.base_id = _base_tbl.base_id
              AND s.fk_workspace_id = _base_tbl.workspace_id
          WHERE s.type = :type_script
            and _base_tbl.base_role IN ('${ProjectRoles.EDITOR}', '${
        ProjectRoles.CREATOR
      }', '${ProjectRoles.OWNER}')
          
          UNION ALL
          
          -- Dashboards
          SELECT 
            'dashboard' as kind,
            d.base_id,
            d.fk_workspace_id,
            d.id as item_id,
            d.title as item_title,
            d.type as item_type,
            d.meta as item_meta,
            d.order as item_order,
            NULL as item_sync,
            NULL as item_parent_id,
            ${itemOrder(['d.order'])} as result_order,
            NULL as visibility_role,
            NULL as visibility_disabled
          FROM ${MetaTable.MODELS} as d
            INNER JOIN ${baseTables}
              ON d.base_id = _base_tbl.base_id
              AND d.fk_workspace_id = _base_tbl.workspace_id
          WHERE d.type = :type_dashboard
          
          UNION ALL
          
          -- Workflows
          SELECT 
            'workflow' as kind,
            w.base_id,
            w.fk_workspace_id,
            w.id as item_id,
            w.title as item_title,
            NULL as item_type,
            w.meta as item_meta,
            w.order as item_order,
            NULL as item_sync,
            NULL as item_parent_id,
            ${itemOrder(['w.order'])} as result_order,
            NULL as visibility_role,
            NULL as visibility_disabled
          FROM ${MetaTable.AUTOMATIONS} as w
            INNER JOIN ${baseTables}
              ON w.base_id = _base_tbl.base_id
              AND w.fk_workspace_id = _base_tbl.workspace_id
          WHERE w.type = :type_workflow
        `,
      {
        type_dashboard: ModelTypes.DASHBOARD,
        type_workflow: AutomationTypes.WORKFLOW,
        type_script: AutomationTypes.SCRIPT,
      },
    );
    // Query 2: Get all items using UNION ALL
    // we can improve further with object types but this should sufficient for now
    const items = workspaceAndBases.length
      ? await ncMeta.knexConnection.fromRaw(`(${itemQuery}) as t`).select('*')
      : [];
    console.log(items);
    cmdData = {
      wsAndBases: workspaceAndBases,
      items,
    };
    await NocoCache.set('root', key, cmdData);
    // append to lists for later cleanup
    await NocoCache.set('root', `${CacheScope.CMD_PALETTE}:ws:${workspaceId}`, [
      key,
    ]);
    await NocoCache.set('root', `${CacheScope.CMD_PALETTE}:user:${userId}`, [
      key,
    ]);
  }

  // order by kind, result_order
  return {
    wsAndBases: cmdData?.wsAndBases,
    items: cmdData?.items?.sort((a, b) =>
      `${a.kind}_${a.result_order}`.localeCompare(
        `${b.kind}_${b.result_order}`,
      ),
    ),
  };
}

export async function cleanCommandPaletteCache(workspaceId: string) {
  const keys = await NocoCache.get(
    'root',
    `${CacheScope.CMD_PALETTE}:ws:${workspaceId}`,
    CacheGetType.TYPE_ARRAY,
  );

  if (keys) {
    await NocoCache.del('root', [
      ...keys,
      `${CacheScope.CMD_PALETTE}:${workspaceId}`,
    ]);
  }
}

export async function cleanCommandPaletteCacheForUser(userId: string) {
  const keys = await NocoCache.get(
    'root',
    `${CacheScope.CMD_PALETTE}:user:${userId}`,
    CacheGetType.TYPE_ARRAY,
  );

  if (keys) {
    await NocoCache.del('root', [
      ...keys,
      `${CacheScope.CMD_PALETTE}:${userId}`,
    ]);
  }
}
