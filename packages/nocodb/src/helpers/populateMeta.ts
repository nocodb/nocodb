import { ModelTypes, UITypes, ViewTypes } from 'nocodb-sdk';
import { isVirtualCol, RelationTypes } from 'nocodb-sdk';
import { pluralize, singularize } from 'inflection';
import { isLinksOrLTAR } from 'nocodb-sdk';
import { getUniqueColumnAliasName } from './getUniqueName';
import type { RollupColumn } from '~/models';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type Source from '~/models/Source';
import type Base from '~/models/Base';
import type PGClient from '~/db/sql-client/lib/pg/PgClient';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import getColumnUiType from '~/helpers/getColumnUiType';
import getTableNameAlias, { getColumnNameAlias } from '~/helpers/getTableName';
import View from '~/models/View';
import NcHelp from '~/utils/NcHelp';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Model from '~/models/Model';
import Column from '~/models/Column';
import { GridViewColumn } from '~/models';

export const IGNORE_TABLES = [
  'nc_models',
  'nc_roles',
  'nc_routes',
  'nc_loaders',
  'nc_resolvers',
  'nc_hooks',
  'nc_store',
  '_evolutions',
  'nc_evolutions',
  'xc_users',
  'nc_rpc',
  'nc_acl',
  'nc_cron',
  'nc_disabled_models_for_role',
  'nc_audit',
  'xc_knex_migrations',
  'xc_knex_migrations_lock',
  'nc_plugins',
  'nc_migrations',
  'nc_api_tokens',
  'nc_projects',
  'nc_projects_users',
  'nc_relations',
  'nc_shared_views',
];

async function isMMRelationExist(
  model: Model,
  assocModel: Model,
  belongsToCol: Column<LinkToAnotherRecordColumn>,
) {
  let isExist = false;
  const colChildOpt =
    await belongsToCol.getColOptions<LinkToAnotherRecordColumn>();
  for (const col of await model.getColumns()) {
    if (col.uidt === UITypes.LinkToAnotherRecord) {
      const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>();
      if (
        colOpt &&
        colOpt.type === RelationTypes.MANY_TO_MANY &&
        colOpt.fk_mm_model_id === assocModel.id &&
        colOpt.fk_child_column_id === colChildOpt.fk_parent_column_id &&
        colOpt.fk_mm_child_column_id === colChildOpt.fk_child_column_id
      ) {
        isExist = true;
        break;
      }
    }
  }
  return isExist;
}

// @ts-ignore
export async function extractAndGenerateManyToManyRelations(
  modelsArr: Array<Model>,
) {
  for (const assocModel of modelsArr) {
    await assocModel.getColumns();
    // check if table is a Bridge table(or Associative Table) by checking
    // number of foreign keys and columns

    const normalColumns = assocModel.columns.filter((c) => !isVirtualCol(c));
    const belongsToCols: Column<LinkToAnotherRecordColumn>[] = [];
    for (const col of assocModel.columns) {
      if (col.uidt == UITypes.LinkToAnotherRecord) {
        const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>();
        if (colOpt?.type === RelationTypes.BELONGS_TO) belongsToCols.push(col);
      }
    }

    // todo: impl better method to identify m2m relation
    if (
      belongsToCols?.length === 2 &&
      normalColumns.length < 5 &&
      assocModel.primaryKeys.length === 2
    ) {
      const modelA = await belongsToCols[0].colOptions.getRelatedTable();
      const modelB = await belongsToCols[1].colOptions.getRelatedTable();

      await modelA.getColumns();
      await modelB.getColumns();

      // check tableA already have the relation or not
      const isRelationAvailInA = await isMMRelationExist(
        modelA,
        assocModel,
        belongsToCols[0],
      );
      const isRelationAvailInB = await isMMRelationExist(
        modelB,
        assocModel,
        belongsToCols[1],
      );

      if (!isRelationAvailInA) {
        await Column.insert<LinkToAnotherRecordColumn>({
          title: getUniqueColumnAliasName(
            modelA.columns,
            pluralize(modelB.title),
          ),
          fk_model_id: modelA.id,
          fk_related_model_id: modelB.id,
          fk_mm_model_id: assocModel.id,
          fk_child_column_id: belongsToCols[0].colOptions.fk_parent_column_id,
          fk_parent_column_id: belongsToCols[1].colOptions.fk_parent_column_id,
          fk_mm_child_column_id: belongsToCols[0].colOptions.fk_child_column_id,
          fk_mm_parent_column_id:
            belongsToCols[1].colOptions.fk_child_column_id,
          type: RelationTypes.MANY_TO_MANY,
          uidt: UITypes.Links,
          meta: {
            plural: pluralize(modelB.title),
            singular: singularize(modelB.title),
          },
        });
      }
      if (!isRelationAvailInB) {
        await Column.insert<LinkToAnotherRecordColumn>({
          title: getUniqueColumnAliasName(
            modelB.columns,
            pluralize(modelA.title),
          ),
          fk_model_id: modelB.id,
          fk_related_model_id: modelA.id,
          fk_mm_model_id: assocModel.id,
          fk_child_column_id: belongsToCols[1].colOptions.fk_parent_column_id,
          fk_parent_column_id: belongsToCols[0].colOptions.fk_parent_column_id,
          fk_mm_child_column_id: belongsToCols[1].colOptions.fk_child_column_id,
          fk_mm_parent_column_id:
            belongsToCols[0].colOptions.fk_child_column_id,
          type: RelationTypes.MANY_TO_MANY,
          uidt: UITypes.Links,
          meta: {
            plural: pluralize(modelA.title),
            singular: singularize(modelA.title),
          },
        });
      }

      await Model.markAsMmTable(assocModel.id, true);

      // mark has many relation associated with mm as system field in both table
      for (const btCol of [belongsToCols[0], belongsToCols[1]]) {
        const colOpt = await btCol.colOptions;
        const model = await colOpt.getRelatedTable();

        for (const col of await model.getColumns()) {
          if (!isLinksOrLTAR(col.uidt)) continue;

          const colOpt1 = await col.getColOptions<LinkToAnotherRecordColumn>();
          if (!colOpt1 || colOpt1.type !== RelationTypes.HAS_MANY) continue;

          if (
            colOpt1.fk_child_column_id !== colOpt.fk_child_column_id ||
            colOpt1.fk_parent_column_id !== colOpt.fk_parent_column_id
          )
            continue;

          await Column.markAsSystemField(col.id);
          break;
        }
      }
    } else {
      if (assocModel.mm) await Model.markAsMmTable(assocModel.id, false);
    }
  }
}

export async function populateMeta(
  source: Source,
  base: Base,
  logger?: (message: string) => void,
): Promise<any> {
  const info = {
    type: 'rest',
    apiCount: 0,
    tablesCount: 0,
    relationsCount: 0,
    viewsCount: 0,
    client: (await source?.getConnectionConfig())?.client,
    timeTaken: 0,
  };

  const t = process.hrtime();
  const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
  let order = 1;
  const models2: { [tableName: string]: Model } = {};

  const virtualColumnsInsert = [];

  /* Get all relations */
  const relations = (
    await sqlClient.relationListAll({ schema: source.getConfig()?.schema })
  )?.data?.list;

  info.relationsCount = relations.length;

  let tables = (
    await sqlClient.tableList({ schema: source.getConfig()?.schema })
  )?.data?.list
    ?.filter(({ tn }) => !IGNORE_TABLES.includes(tn))
    ?.map((t) => {
      t.order = ++order;
      t.title = getTableNameAlias(t.tn, base.prefix, source);
      t.table_name = t.tn;
      return t;
    });

  /* filter based on prefix */
  if (source.is_meta && base?.prefix) {
    tables = tables.filter((t) => {
      return t?.tn?.startsWith(base?.prefix);
    });
  }

  info.tablesCount = tables.length;

  tables.forEach((t) => {
    t.title = getTableNameAlias(t.tn, base.prefix, source);
  });

  relations.forEach((r) => {
    r.title = getTableNameAlias(r.tn, base.prefix, source);
    r.rtitle = getTableNameAlias(r.rtn, base.prefix, source);
  });

  let colMeta = null;

  if (source.type === 'pg') {
    colMeta = {
      format: (await (sqlClient as PGClient).getDefaultByteaOutputFormat())
        .data,
    };
  }

  // await this.syncRelations();

  const tableMetasInsert = tables.map((table) => {
    logger?.(`Populating meta for table '${table.title}'`);
    return async () => {
      /* filter relation where this table is present */
      const tableRelations = relations.filter(
        (r) => r.tn === table.tn || r.rtn === table.tn,
      );

      const columns: Array<
        Omit<Column, 'column_name' | 'title'> & {
          cn: string;
          system?: boolean;
        }
      > = (
        await sqlClient.columnList({
          tn: table.tn,
          schema: source.getConfig()?.schema,
        })
      )?.data?.list;

      const hasMany =
        table.type === 'view'
          ? []
          : tableRelations.filter((r) => r.rtn === table.tn);
      const belongsTo =
        table.type === 'view'
          ? []
          : tableRelations.filter((r) => r.tn === table.tn);

      mapDefaultDisplayValue(columns);

      // add vitual columns
      const virtualColumns = [
        ...hasMany.map((hm) => {
          return {
            uidt: UITypes.Links,
            type: 'hm',
            hm,
            title: pluralize(hm.title),
            meta: {
              plural: pluralize(hm.title),
              singular: singularize(hm.title),
            },
          };
        }),
        ...belongsTo.map((bt) => {
          // find and mark foreign key column
          const fkColumn = columns.find((c) => c.cn === bt.cn);
          if (fkColumn) {
            fkColumn.uidt = UITypes.ForeignKey;
            fkColumn.system = true;
          }

          return {
            uidt: UITypes.LinkToAnotherRecord,
            type: 'bt',
            bt,
            title: `${bt.rtitle}`,
          };
        }),
      ];

      // await Model.insert(base.id, base.id, meta);

      /* create nc_models and its rows if it doesn't exists  */
      models2[table.table_name] = await Model.insert(base.id, source.id, {
        table_name: table.tn || table.table_name,
        title: table.title,
        type: table.type || 'table',
        order: table.order,
      });

      // table crud apis
      info.apiCount += 5;

      let colOrder = 1;

      for (const column of columns) {
        await Column.insert({
          uidt: column.uidt || getColumnUiType(source, column),
          fk_model_id: models2[table.tn].id,
          ...column,
          title: getColumnNameAlias(column.cn, source),
          column_name: column.cn,
          order: colOrder++,
          // if postgres and bytea then add format to meta
          ...(colMeta && column.dt === 'bytea' ? { meta: colMeta } : {}),
        });
      }
      virtualColumnsInsert.push(async () => {
        const columnNames = {};
        for (const column of virtualColumns) {
          // generate unique name if there is any duplicate column name
          let c = 0;
          while (`${column.title}${c || ''}` in columnNames) {
            c++;
          }
          column.title = `${column.title}${c || ''}`;
          columnNames[column.title] = true;

          const rel = column.hm || column.bt;

          const rel_column_id = (await models2?.[rel.tn]?.getColumns())?.find(
            (c) => c.column_name === rel.cn,
          )?.id;

          const tnId = models2?.[rel.tn]?.id;

          const ref_rel_column_id = (
            await models2?.[rel.rtn]?.getColumns()
          )?.find((c) => c.column_name === rel.rcn)?.id;

          const rtnId = models2?.[rel.rtn]?.id;

          try {
            await Column.insert<LinkToAnotherRecordColumn>({
              base_id: base.id,
              db_alias: source.id,
              fk_model_id: models2[table.tn].id,
              cn: column.cn,
              title: column.title,
              uidt: column.uidt,
              type: column.hm ? 'hm' : column.mm ? 'mm' : 'bt',
              // column_id,
              fk_child_column_id: rel_column_id,
              fk_parent_column_id: ref_rel_column_id,
              fk_index_name: rel.cstn,
              ur: rel.ur,
              dr: rel.dr,
              order: colOrder++,
              fk_related_model_id: column.hm ? tnId : rtnId,
              system: column.system,
              meta: column.meta,
            });

            // nested relations data apis
            info.apiCount += 5;
          } catch (e) {
            console.log(e);
          }
        }
      });
    };
  });

  /* handle xc_tables update in parallel */
  await NcHelp.executeOperations(tableMetasInsert, source.type);
  await NcHelp.executeOperations(virtualColumnsInsert, source.type);
  await extractAndGenerateManyToManyRelations(Object.values(models2));

  let views: Array<{ order: number; table_name: string; title: string }> = (
    await sqlClient.viewList({
      schema: source.getConfig()?.schema,
    })
  )?.data?.list
    // ?.filter(({ tn }) => !IGNORE_TABLES.includes(tn))
    ?.map((v) => {
      v.order = ++order;
      v.table_name = v.view_name;
      v.title = getTableNameAlias(v.view_name, base.prefix, source);
      return v;
    });

  /* filter based on prefix */
  if (source.is_meta && base?.prefix) {
    views = tables.filter((t) => {
      return t?.tn?.startsWith(base?.prefix);
    });
  }

  info.viewsCount = views.length;

  const viewMetasInsert = views.map((table) => {
    logger?.(`Populating meta for view '${table.title}'`);
    return async () => {
      const columns = (
        await sqlClient.columnList({
          tn: table.table_name,
          schema: source.getConfig()?.schema,
        })
      )?.data?.list;

      mapDefaultDisplayValue(columns);

      /* create nc_models and its rows if it doesn't exists  */
      models2[table.table_name] = await Model.insert(base.id, source.id, {
        table_name: table.table_name,
        title: getTableNameAlias(table.table_name, base.prefix, source),
        // todo: sanitize
        type: ModelTypes.VIEW,
        order: table.order,
      });

      let colOrder = 1;

      // view apis
      info.apiCount += 2;

      for (const column of columns) {
        await Column.insert({
          fk_model_id: models2[table.table_name].id,
          ...column,
          title: getColumnNameAlias(column.cn, source),
          order: colOrder++,
          uidt: getColumnUiType(source, column),
        });
      }
    };
  });

  await NcHelp.executeOperations(viewMetasInsert, source.type);

  // fix pv column for created grid views
  const models = await Model.list({ base_id: base.id, source_id: source.id });

  for (const model of models) {
    const views = await model.getViews();
    for (const view of views) {
      if (view.type === ViewTypes.GRID) {
        await View.fixPVColumnForView(view.id);
      }
    }
  }

  const t1 = process.hrtime(t);
  const t2 = t1[0] + t1[1] / 1000000000;

  (info as any).timeTaken = t2.toFixed(1);

  logger?.(`Populating meta completed in ${t2.toFixed(1)}s`);

  return info;
}

export async function populateRollupColumnAndHideLTAR(
  source: Source,
  base: Base,
) {
  for (const model of await Model.list({
    base_id: base.id,
    source_id: source.id,
  })) {
    const columns = await model.getColumns();
    const hmAndMmLTARColumns = columns.filter(
      (c) =>
        c.uidt === UITypes.LinkToAnotherRecord &&
        c.colOptions.type !== RelationTypes.BELONGS_TO &&
        !c.system,
    );

    const views = await model.getViews();

    for (const column of hmAndMmLTARColumns) {
      const relatedModel = await column
        .getColOptions<LinkToAnotherRecordColumn>()
        .then((colOpt) => colOpt.getRelatedTable());
      await relatedModel.getColumns();
      const pkId =
        relatedModel.primaryKey?.id || (await relatedModel.getColumns())[0]?.id;

      await Column.insert<RollupColumn>({
        uidt: UITypes.Links,
        title: getUniqueColumnAliasName(
          await model.getColumns(),
          `${relatedModel.title}`,
        ),
        fk_rollup_column_id: pkId,
        fk_model_id: model.id,
        rollup_function: 'count',
        fk_relation_column_id: column.id,
        meta: {
          singular: singularize(relatedModel.title),
          plural: pluralize(relatedModel.title),
        },
      });

      const viewCol = await GridViewColumn.list(views[0].id).then((cols) =>
        cols.find((c) => c.fk_column_id === column.id),
      );
      await GridViewColumn.update(viewCol.id, { show: false });
    }
  }
}
