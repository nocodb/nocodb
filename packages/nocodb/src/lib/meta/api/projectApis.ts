import { Request, Response } from 'express';
import { OrgUserRoles, ProjectType } from 'nocodb-sdk';
import Project from '../../models/Project';
import { ModelTypes, ProjectListType, UITypes } from 'nocodb-sdk';
import DOMPurify from 'isomorphic-dompurify';
import { packageVersion } from '../../utils/packageVersion';
import { Tele } from 'nc-help';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import syncMigration from '../helpers/syncMigration';
import { IGNORE_TABLES } from '../../utils/common/BaseApiBuilder';
import Column from '../../models/Column';
import Model from '../../models/Model';
import NcHelp from '../../utils/NcHelp';
import Base from '../../models/Base';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import getTableNameAlias, { getColumnNameAlias } from '../helpers/getTableName';
import LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import ProjectUser from '../../models/ProjectUser';
import { customAlphabet } from 'nanoid';
import Noco from '../../Noco';
import isDocker from 'is-docker';
import { NcError } from '../helpers/catchError';
import getColumnUiType from '../helpers/getColumnUiType';
import mapDefaultPrimaryValue from '../helpers/mapDefaultPrimaryValue';
import { extractAndGenerateManyToManyRelations } from './metaDiffApis';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { extractPropsAndSanitize } from '../helpers/extractProps';
import NcConfigFactory from '../../utils/NcConfigFactory';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

// // Project CRUD

export async function projectGet(
  req: Request<any, any, any>,
  res: Response<Project>
) {
  const project = await Project.getWithInfo(req.params.projectId);

  // delete datasource connection details
  project.bases?.forEach((b) => {
    ['config'].forEach((k) => delete b[k]);
  });

  res.json(project);
}

export async function projectUpdate(
  req: Request<any, any, any>,
  res: Response<ProjectListType>
) {
  const project = await Project.getWithInfo(req.params.projectId);

  const data: Partial<Project> = extractPropsAndSanitize(req?.body, [
    'title',
    'meta',
    'color',
  ]);

  if (
    data?.title &&
    project.title !== data.title &&
    (await Project.getByTitle(data.title))
  ) {
    NcError.badRequest('Project title already in use');
  }

  const result = await Project.update(req.params.projectId, data);
  Tele.emit('evt', { evt_type: 'project:update' });
  res.json(result);
}

export async function projectList(
  req: Request<any> & { user: { id: string; roles: string } },
  res: Response<ProjectListType>,
  next
) {
  try {
    const projects = req.user?.roles?.includes(OrgUserRoles.SUPER_ADMIN)
      ? await Project.list(req.query)
      : await ProjectUser.getProjectsList(req.user.id, req.query);

    res // todo: pagination
      .json(
        new PagedResponseImpl(projects as ProjectType[], {
          count: projects.length,
          limit: projects.length,
        })
      );
  } catch (e) {
    console.log(e);
    next(e);
  }
}

export async function projectDelete(
  req: Request<any>,
  res: Response<ProjectListType>
) {
  const result = await Project.softDelete(req.params.projectId);
  Tele.emit('evt', { evt_type: 'project:deleted' });
  res.json(result);
}

//
//

async function projectCreate(req: Request<any, any>, res) {
  const projectBody = req.body;
  if (!projectBody.external) {
    const ranId = nanoid();
    projectBody.prefix = `nc_${ranId}__`;
    projectBody.is_meta = true;
    if (process.env.NC_MINIMAL_DBS) {
      // if env variable NC_MINIMAL_DBS is set, then create a SQLite file/connection for each project
      // each file will be named as nc_<random_id>.db
      const fs = require('fs');
      const toolDir = NcConfigFactory.getToolDir();
      const nanoidv2 = customAlphabet(
        '1234567890abcdefghijklmnopqrstuvwxyz',
        14
      );
      if (!fs.existsSync(`${toolDir}/nc_minimal_dbs`)) {
        fs.mkdirSync(`${toolDir}/nc_minimal_dbs`);
      }
      const dbId = nanoidv2();
      const projectTitle = DOMPurify.sanitize(projectBody.title);
      projectBody.prefix = '';
      projectBody.bases = [
        {
          type: 'sqlite3',
          config: {
            client: 'sqlite3',
            connection: {
              client: 'sqlite3',
              database: projectTitle,
              connection: {
                filename: `${toolDir}/nc_minimal_dbs/${projectTitle}_${dbId}.db`,
              },
              useNullAsDefault: true,
            },
          },
          inflection_column: 'camelize',
          inflection_table: 'camelize',
        },
      ];
    } else {
      const db = Noco.getConfig().meta?.db;
      projectBody.bases = [
        {
          type: db?.client,
          config: null,
          is_meta: true,
          inflection_column: 'camelize',
          inflection_table: 'camelize',
        },
      ];
    }
  } else {
    if (process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED) {
      NcError.badRequest('Connecting to external db is disabled');
    }
    projectBody.is_meta = false;
  }

  if (projectBody?.title.length > 50) {
    NcError.badRequest('Project title exceeds 50 characters');
  }

  if (await Project.getByTitle(projectBody?.title)) {
    NcError.badRequest('Project title already in use');
  }

  projectBody.title = DOMPurify.sanitize(projectBody.title);
  projectBody.slug = projectBody.title;

  const project = await Project.createProject(projectBody);
  await ProjectUser.insert({
    fk_user_id: (req as any).user.id,
    project_id: project.id,
    roles: 'owner',
  });

  await syncMigration(project);

  // populate metadata if existing table
  for (const base of await project.getBases()) {
    const info = await populateMeta(base, project);

    Tele.emit('evt_api_created', info);
    delete base.config;
  }

  Tele.emit('evt', {
    evt_type: 'project:created',
    xcdb: !projectBody.external,
  });

  Tele.emit('evt', { evt_type: 'project:rest' });

  res.json(project);
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
  if (project?.prefix) {
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
  if (project?.prefix) {
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

export async function projectInfoGet(req, res) {
  const project = await Project.getWithInfo(req.params.projectId);
  res.json({
    Node: process.version,
    Arch: process.arch,
    Platform: process.platform,
    Docker: isDocker(),
    Database: project.bases?.[0]?.type,
    ProjectOnRootDB: !!project?.is_meta,
    RootDB: Noco.getConfig()?.meta?.db?.client,
    PackageVersion: packageVersion,
  });
}

export async function projectCost(req, res) {
  let cost = 0;
  const project = await Project.getWithInfo(req.params.projectId);
  const sqlClient = NcConnectionMgrv2.getSqlClient(project.bases[0]);
  const userCount = await ProjectUser.getUsersCount(req.query);
  const recordCount = (await sqlClient.totalRecords())?.data.TotalRecords;

  if (recordCount > 100000) {
    // 36,000 or $79/user/month
    cost = Math.max(36000, 948 * userCount);
  } else if (recordCount > 50000) {
    // $36,000 or $50/user/month
    cost = Math.max(36000, 600 * userCount);
  } else if (recordCount > 10000) {
    // $240/user/yr
    cost = Math.min(240 * userCount, 36000);
  } else if (recordCount > 1000) {
    // $120/user/yr
    cost = Math.min(120 * userCount, 36000);
  }

  Tele.event({
    event: 'a:project:cost',
    data: {
      cost,
    },
  });

  res.json({ cost });
}

export default (router) => {
  router.get(
    '/api/v1/db/meta/projects/:projectId/info',
    metaApiMetrics,
    ncMetaAclMw(projectInfoGet, 'projectInfoGet')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    ncMetaAclMw(projectGet, 'projectGet')
  );
  router.patch(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    ncMetaAclMw(projectUpdate, 'projectUpdate')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId/cost',
    metaApiMetrics,
    ncMetaAclMw(projectCost, 'projectCost')
  );
  router.delete(
    '/api/v1/db/meta/projects/:projectId',
    metaApiMetrics,
    ncMetaAclMw(projectDelete, 'projectDelete')
  );
  router.post(
    '/api/v1/db/meta/projects',
    metaApiMetrics,
    ncMetaAclMw(projectCreate, 'projectCreate')
  );
  router.get(
    '/api/v1/db/meta/projects',
    metaApiMetrics,
    ncMetaAclMw(projectList, 'projectList')
  );
};
