import { Request, Response } from 'express';
import Project from '../../models/Project';
import { BaseListType, ModelTypes, ProjectListType, UITypes } from 'nocodb-sdk';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { syncBaseMigration } from '../helpers/syncMigration';
import { IGNORE_TABLES } from '../../utils/common/BaseApiBuilder';
import Column from '../../models/Column';
import Model from '../../models/Model';
import NcHelp from '../../utils/NcHelp';
import Base from '../../models/Base';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import getTableNameAlias, { getColumnNameAlias } from '../helpers/getTableName';
import LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';
import { NcError } from '../helpers/catchError';
import getColumnUiType from '../helpers/getColumnUiType';
import mapDefaultPrimaryValue from '../helpers/mapDefaultPrimaryValue';
import { extractAndGenerateManyToManyRelations } from './metaDiffApis';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function baseGet(
  req: Request<any, any, any>,
  res: Response<Base>
) {
  const base = await Base.get(req.params.baseId);

  delete base.config;

  res.json(base);
}

export async function baseUpdate(
  _req: Request<any, any, any>,
  _res: Response<ProjectListType>
) {
  NcError.badRequest('Base update not yet supported');
}

export async function baseList(
  req: Request<any, any, any>,
  res: Response<BaseListType>,
  next
) {
  try {
    const bases = await Base.list({ projectId: req.params.projectId });

    res // todo: pagination
      .json({
          bases: new PagedResponseImpl(bases, {
            count: bases.length,
            limit: bases.length,
          })
        }
      );
  } catch (e) {
    console.log(e);
    next(e);
  }
}

export async function baseDelete(
  req: Request<any, any, any>,
  res: Response<any>
) {
  const base = await Base.get(req.params.baseId);
  const result = await base.delete();
  Tele.emit('evt', { evt_type: 'base:deleted' });
  res.json(result);
}

async function baseCreate(req: Request<any, any>, res) {
  // type | base | projectId
  const baseBody = req.body;
  const project = await Project.getWithInfo(req.params.projectId);
  const base = await Base.createBase({
    ...baseBody,
    type: baseBody.config?.client,
    projectId: project.id,
  });

  await syncBaseMigration(project, base);

  const info = await populateMeta(base, project);
  
  Tele.emit('evt_api_created', info);

  delete base.config;

  Tele.emit('evt', {
    evt_type: 'base:created'
  });

  res.json(base);
}

async function populateMeta(base: Base, project: Project): Promise<any> {
  const info = {
    type: 'rest',
    apiCount: 0,
    tablesCount: 0,
    relationsCount: 0,
    viewsCount: 0,
    client: base?.getConnectionConfig()?.client,
    timeTaken: 0,
  };

  const t = process.hrtime();
  const sqlClient = NcConnectionMgrv2.getSqlClient(base);
  let order = 1;
  const models2: { [tableName: string]: Model } = {};

  const virtualColumnsInsert = [];

  /* Get all relations */
  const relations = (await sqlClient.relationListAll())?.data?.list;

  info.relationsCount = relations.length;

  let tables = (await sqlClient.tableList())?.data?.list
    ?.filter(({ tn }) => !IGNORE_TABLES.includes(tn))
    ?.map((t) => {
      t.order = ++order;
      t.title = getTableNameAlias(t.tn, project.prefix, base);
      t.table_name = t.tn;
      return t;
    });


  /* filter based on prefix */
  if (base.is_meta && project?.prefix) {
    tables = tables.filter((t) => {
      return t?.tn?.startsWith(project?.prefix);
    });
  }
  

  info.tablesCount = tables.length;

  tables.forEach((t) => {
    t.title = getTableNameAlias(t.tn, project.prefix, base);
  });

  relations.forEach((r) => {
    r.title = getTableNameAlias(r.tn, project.prefix, base);
    r.rtitle = getTableNameAlias(r.rtn, project.prefix, base);
  });

  // await this.syncRelations();

  const tableMetasInsert = tables.map((table) => {
    return async () => {
      /* filter relation where this table is present */
      const tableRelations = relations.filter(
        (r) => r.tn === table.tn || r.rtn === table.tn
      );

      const columns: Array<
        Omit<Column, 'column_name' | 'title'> & {
          cn: string;
          system?: boolean;
        }
      > = (await sqlClient.columnList({ tn: table.tn }))?.data?.list;

      const hasMany =
        table.type === 'view'
          ? []
          : tableRelations.filter((r) => r.rtn === table.tn);
      const belongsTo =
        table.type === 'view'
          ? []
          : tableRelations.filter((r) => r.tn === table.tn);

      mapDefaultPrimaryValue(columns);

      // add vitual columns
      const virtualColumns = [
        ...hasMany.map((hm) => {
          return {
            uidt: UITypes.LinkToAnotherRecord,
            type: 'hm',
            hm,
            title: `${hm.title} List`,
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

      // await Model.insert(project.id, base.id, meta);

      /* create nc_models and its rows if it doesn't exists  */
      models2[table.table_name] = await Model.insert(project.id, base.id, {
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
          uidt: column.uidt || getColumnUiType(base, column),
          fk_model_id: models2[table.tn].id,
          ...column,
          title: getColumnNameAlias(column.cn, base),
          column_name: column.cn,
          order: colOrder++,
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
            (c) => c.column_name === rel.cn
          )?.id;

          const tnId = models2?.[rel.tn]?.id;

          const ref_rel_column_id = (
            await models2?.[rel.rtn]?.getColumns()
          )?.find((c) => c.column_name === rel.rcn)?.id;

          const rtnId = models2?.[rel.rtn]?.id;

          try {
            await Column.insert<LinkToAnotherRecordColumn>({
              project_id: project.id,
              db_alias: base.id,
              fk_model_id: models2[table.tn].id,
              cn: column.cn,
              title: column.title,
              uidt: column.uidt,
              type: column.hm ? 'hm' : column.mm ? 'mm' : 'bt',
              // column_id,
              fk_child_column_id: rel_column_id,
              fk_parent_column_id: ref_rel_column_id,
              fk_index_name: rel.fkn,
              ur: rel.ur,
              dr: rel.dr,
              order: colOrder++,
              fk_related_model_id: column.hm ? tnId : rtnId,
              system: column.system,
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
  await NcHelp.executeOperations(tableMetasInsert, base.type);
  await NcHelp.executeOperations(virtualColumnsInsert, base.type);
  await extractAndGenerateManyToManyRelations(Object.values(models2));

  let views: Array<{ order: number; table_name: string; title: string }> = (
    await sqlClient.viewList()
  )?.data?.list
    // ?.filter(({ tn }) => !IGNORE_TABLES.includes(tn))
    ?.map((v) => {
      v.order = ++order;
      v.table_name = v.view_name;
      v.title = getTableNameAlias(v.view_name, project.prefix, base);
      return v;
    });

  /* filter based on prefix */
  if (base.is_meta && project?.prefix) {
    views = tables.filter((t) => {
      return t?.tn?.startsWith(project?.prefix);
    });
  }

  info.viewsCount = views.length;

  const viewMetasInsert = views.map((table) => {
    return async () => {
      const columns = (await sqlClient.columnList({ tn: table.table_name }))
        ?.data?.list;

      /* create nc_models and its rows if it doesn't exists  */
      models2[table.table_name] = await Model.insert(project.id, base.id, {
        table_name: table.table_name,
        title: getTableNameAlias(table.table_name, project.prefix, base),
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
          title: getColumnNameAlias(column.cn, base),
          order: colOrder++,
          uidt: getColumnUiType(base, column),
        });
      }
    };
  });

  await NcHelp.executeOperations(viewMetasInsert, base.type);

  const t1 = process.hrtime(t);
  const t2 = t1[0] + t1[1] / 1000000000;

  (info as any).timeTaken = t2.toFixed(1);

  return info;
}

export default (router) => {
  router.get(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    ncMetaAclMw(baseGet, 'baseGet')
  );
  router.patch(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    ncMetaAclMw(baseUpdate, 'baseUpdate')
  );
  router.delete(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    ncMetaAclMw(baseDelete, 'baseDelete')
  );
  router.post(
    '/api/v1/db/meta/projects/:projectId/bases',
    metaApiMetrics,
    ncMetaAclMw(baseCreate, 'baseCreate')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId/bases',
    metaApiMetrics,
    ncMetaAclMw(baseList, 'baseList')
  );
};
