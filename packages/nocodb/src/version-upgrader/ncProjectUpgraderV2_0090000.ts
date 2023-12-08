import {
  ModelTypes,
  substituteColumnAliasWithIdInFormula,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import NcProjectBuilderEE from './v1-legacy/NcProjectBuilder';
import type GalleryView from '~/models/GalleryView';
import type FormView from '~/models/FormView';
import type { UserType, ViewType } from 'nocodb-sdk';
import type KanbanView from '~/models/KanbanView';
import type GridView from '~/models/GridView';
import type RollupColumn from '~/models/RollupColumn';
import type { ROLLUP_FUNCTIONS } from '~/models/RollupColumn';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type { NcUpgraderCtx } from './NcUpgrader';
import { getUniqueColumnAliasName } from '~/helpers/getUniqueName';
import Noco from '~/Noco';
import Model from '~/models/Model';
import BaseUser from '~/models/BaseUser';
import Base from '~/models/Base';
import User from '~/models/User';
import Column from '~/models/Column';
import NcHelp from '~/utils/NcHelp';
import View from '~/models/View';
import Sort from '~/models/Sort';
import Filter from '~/models/Filter';
import ModelRoleVisibility from '~/models/ModelRoleVisibility';
import { MetaTable } from '~/utils/globals';
import Hook from '~/models/Hook';
import FormViewColumn from '~/models/FormViewColumn';
import GridViewColumn from '~/models/GridViewColumn';
import Audit from '~/models/Audit';

export default async function (ctx: NcUpgraderCtx) {
  const ncMeta = ctx.ncMeta;

  const bases = await ctx.ncMeta.baseList();

  for (const base of bases) {
    // const baseConfig = JSON.parse(base.config);

    const baseBuilder = new NcProjectBuilderEE(
      { ncMeta: ctx.ncMeta } as any,
      { workingEnv: '_noco' } as any,
      base,
    );

    await baseBuilder.init();
  }

  const usersObj = await migrateUsers(ncMeta);
  const projectsObj = await migrateProjects(ncMeta);
  await migrateProjectUsers(projectsObj, usersObj, ncMeta);
  const migrationCtx = await migrateProjectModels(ncMeta);

  await migrateUIAcl(migrationCtx, ncMeta);
  await migrateSharedViews(migrationCtx, ncMeta);
  await migrateSharedBase(ncMeta);
  await migratePlugins(ncMeta);
  await migrateWebhooks(migrationCtx, ncMeta);
  await migrateAutitLog(migrationCtx, projectsObj, ncMeta);
}

async function migrateUsers(ncMeta = Noco.ncMeta) {
  const users = await ncMeta.metaList(null, null, 'xc_users');
  const userObj: { [id: string]: User | UserType } = {};

  for (const user of users) {
    const user1 = await User.insert(user, ncMeta);
    userObj[user1.id] = user1;
  }
  return userObj;
}

async function migrateProjects(
  ncMeta = Noco.ncMeta,
): Promise<{ [baseId: string]: Base }> {
  const bases = await ncMeta.baseList();
  const projectsObj: { [baseId: string]: Base } = {};

  for (const base of bases) {
    const baseConfig = JSON.parse(base.config);

    const baseBody = {
      id: base.id,
      prefix: baseConfig.prefix,
      is_meta: !!baseConfig.prefix,
      title: baseConfig?.title,
      sources: baseConfig?.envs?._noco?.db?.map((d) => {
        const inflection = (d && d.meta && d.meta.inflection) || {};
        return {
          is_meta: !!baseConfig.prefix,
          type: d.client,
          config: d,
          inflection_column: inflection.cn,
          inflection_table: inflection.tn,
        };
      }),
    };
    const p = await Base.createProject(baseBody, ncMeta);
    projectsObj[p.id] = p;
  }
  return projectsObj;
}

async function migrateProjectUsers(
  projectsObj: { [p: string]: Base },
  usersObj: { [p: string]: User | UserType },
  ncMeta = Noco.ncMeta,
) {
  const baseUsers = await ncMeta.metaList(null, null, 'nc_projects_users');

  for (const baseUser of baseUsers) {
    // skip if base is missing
    if (!(baseUser.base_id in projectsObj)) continue;

    // skip if user is missing
    if (!(baseUser.user_id in usersObj)) continue;

    await BaseUser.insert(
      {
        base_id: baseUser.base_id,
        fk_user_id: baseUser.user_id,
        roles: baseUser.roles,
      },
      ncMeta,
    );
  }
}

export interface ShowFieldsv1 {
  [columnAlias: string]: boolean;
}

export interface ViewStatusv1 {
  type: string;
}

export interface ColumnsWidthv1 {
  [columnAlias: string]: string;
}

export interface ExtraViewParamsv1 {
  formParams?: {
    name: string;
    description: string;
    submit: {
      submitRedirectUrl?: string;
      message: string;
      showBlankForm: boolean;
      showAnotherSubmit: boolean;
    };
    emailMe: {
      [email: string]: boolean;
    };
    fields: {
      [columnAlias: string]: {
        help: string;
        required: boolean;
        label?: string;
        description?: string;
      };
    };
  };
}

export interface QueryParamsv1 {
  filters: Array<{
    field: string;
    op: string;
    value: string | boolean | number;
    logicOp: 'and' | 'or';
  }>;
  sortList: Array<{
    field: string;
    order: '' | '-';
  }>;
  showFields: ShowFieldsv1;
  fieldsOrder: string[];
  viewStatus: ViewStatusv1;
  columnsWidth: ColumnsWidthv1;
  extraViewParams: ExtraViewParamsv1;
  showSystemFields: boolean;
  coverImageField: string;
}

interface Rollupv1 {
  _cn: string;
  rl: {
    type: string;
    tn: string;
    cn: string;
    vtn: string;
    vrcn: string;
    rcn: string;
    rtn: string;
    vcn: string;
    _rtn: string;
    rltn: string;
    _rltn: string;
    rlcn: string;
    _rlcn: string;
    fn: string;
  };
}

interface Formulav1 {
  _cn: string;
  formula: {
    value: string;
    tree: any;
    error: string[] | string;
  };
}

interface Lookupv1 {
  _cn: string;
  lk: {
    type: string;
    tn: string;
    cn: string;
    vtn: string;
    vrcn: string;
    rcn: string;
    rtn: string;
    vcn: string;
    _rtn: string;
    ltn: string;
    _ltn: string;
    lcn: string;
    _lcn: string;
  };
}

interface LinkToAnotherRecordv1 {
  _cn: string;
  hm?: any;
  bt?: any;
  mm?: any;
}

interface ModelMetav1 {
  id: number | string;
  base_id: string;
  db_alias: string;
  title: string;
  alias: string;
  type: 'table' | 'vtable' | 'view';
  meta: string;
  schema: string;
  schema_previous: string;
  services: string;
  messages: string;
  enabled: boolean;
  parent_model_title: string;
  show_as: 'grid' | 'gallery' | 'form';
  query_params: string;
  list_idx: number;
  tags: string;
  pinned: boolean;
  mm: boolean;
  m_to_m_meta: string;
  order: number;
  view_order: number;
}

type ObjModelColumnRefv1 = {
  [baseId: string]: {
    [tableName: string]: {
      [columnName: string]: Column;
    };
  };
};
type ObjModelColumnAliasRefv1 = {
  [baseId: string]: {
    [tableName: string]: {
      [columnAlias: string]: Column;
    };
  };
};

type ObjModelRefv1 = {
  [baseId: string]: {
    [tableName: string]: Model;
  };
};
type ObjViewRefv1 = {
  [baseId: string]: {
    [tableName: string]: {
      [viewName: string]: View;
    };
  };
};
type ObjViewQPRefv1 = {
  [baseId: string]: {
    [tableName: string]: {
      [viewName: string]: QueryParamsv1;
    };
  };
};

interface MigrateCtxV1 {
  views: ModelMetav1[];
  objModelRef: ObjModelRefv1;
  objModelAliasRef: ObjModelRefv1;
  objModelColumnRef: ObjModelColumnRefv1;
  objModelColumnAliasRef: ObjModelColumnAliasRefv1;
  objViewRef: ObjViewRefv1;
  objViewQPRef: ObjViewQPRefv1;
  metas: ModelMetav1[];
}

// @ts-ignore
const filterV1toV2CompOpMap = {
  'is like': 'like',
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
  'is equal': 'eq',
  'is not null': 'notnull',
  'is null': 'null',
  'is not equal': 'neq',
  'is not like': 'nlike',
};

interface Relationv1 {
  base_id?: string;
  db_alias?: string;
  tn?: string;
  rtn?: string;
  _tn?: string;
  _rtn?: string;
  cn?: string;
  rcn?: string;
  _cn?: string;
  _rcn?: string;
  referenced_db_alias?: string;
  type?: string;
  db_type?: string;
  ur?: string;
  dr?: string;
}

async function migrateProjectModels(
  ncMeta = Noco.ncMeta,
): Promise<MigrateCtxV1> {
  // @ts-ignore

  const metas: ModelMetav1[] = await ncMeta.metaList(null, null, 'nc_models');
  // @ts-ignore
  const relations: Relationv1[] = await ncMeta.metaList(
    null,
    null,
    'nc_relations',
  );
  const models: Model[] = [];

  // variable for keeping all
  const objModelRef: ObjModelRefv1 = {};
  const objModelAliasRef: ObjModelRefv1 = {};
  const objModelColumnRef: ObjModelColumnRefv1 = {};
  const objModelColumnAliasRef: ObjModelColumnAliasRefv1 = {};
  const objViewRef: ObjViewRefv1 = {};
  const objViewQPRef: ObjViewQPRefv1 = {};

  const virtualRelationColumnInsert: Array<() => Promise<any>> = [];
  const virtualColumnInsert: Array<() => Promise<any>> = [];
  const defaultViewsUpdate: Array<() => Promise<any>> = [];
  const views: ModelMetav1[] = [];

  for (const modelData of metas) {
    // @ts-ignore
    let queryParams: QueryParamsv1 = {};
    if (modelData.query_params) {
      queryParams = JSON.parse(modelData.query_params);
    }

    if (modelData.type === 'table' || modelData.type === 'view') {
      // parse meta

      const base = await Base.getWithInfo(modelData.base_id, ncMeta);

      // skip if associated base is not found
      if (!base) {
        continue;
      }

      const sourceId = base.sources[0].id;

      const meta = JSON.parse(modelData.meta);
      const model = await Model.insert(
        base.id,
        sourceId,
        {
          order: modelData.order,
          table_name: modelData.title,
          title: modelData.alias,
          // todo: sanitize
          type: modelData.type === 'table' ? ModelTypes.TABLE : ModelTypes.VIEW,
          mm: !!modelData.mm,
        },
        ncMeta,
      );
      models.push(model);

      const baseModelRefs = (objModelRef[base.id] = objModelRef[base.id] || {});
      objModelRef[base.id][model.table_name] = model;

      objModelAliasRef[base.id] = objModelAliasRef[base.id] || {};
      objModelAliasRef[base.id][model.title] = model;

      const baseModelColumnRefs = (objModelColumnRef[base.id] =
        objModelColumnRef[base.id] || {});
      objModelColumnRef[base.id][model.table_name] =
        objModelColumnRef[base.id][model.table_name] || {};
      const baseModelColumnAliasRefs = (objModelColumnAliasRef[base.id] =
        objModelColumnAliasRef[base.id] || {});
      objModelColumnAliasRef[base.id][model.table_name] =
        objModelColumnAliasRef[base.id][model.table_name] || {};

      objViewRef[base.id] = objViewRef[base.id] || {};
      objViewRef[base.id][modelData.title] =
        objViewRef[base.id][modelData.title] || {};

      objViewQPRef[base.id] = objViewQPRef[base.id] || {};
      objViewQPRef[base.id][modelData.title] =
        objViewQPRef[base.id][modelData.title] || {};

      // migrate table columns
      for (const columnMeta of meta.columns) {
        let system = false;

        if (meta.belongsTo?.find((bt) => bt.cn === columnMeta.cn)) {
          system = true;
          columnMeta.uidt = UITypes.ForeignKey;
        }

        if (columnMeta.uidt === UITypes.Rating) {
          columnMeta.uidt = UITypes.Number;
        }

        const column = await Column.insert(
          {
            ...columnMeta,
            title: columnMeta._cn,
            column_name: columnMeta.cn,
            system,
            fk_model_id: model.id,
          },
          ncMeta,
        );

        baseModelColumnRefs[model.table_name][column.column_name] =
          baseModelColumnAliasRefs[model.table_name][column.title] = column;
      }

      // migrate table virtual columns
      for (const _columnMeta of meta.v) {
        if (_columnMeta.mm || _columnMeta.hm || _columnMeta.bt) {
          const columnMeta: LinkToAnotherRecordv1 = _columnMeta;
          virtualRelationColumnInsert.push(async () => {
            const rel = columnMeta.hm || columnMeta.bt || columnMeta.mm;

            const rel_column_id = baseModelColumnRefs?.[rel.tn]?.[rel.cn]?.id;

            const tnId = baseModelRefs?.[rel.tn]?.id;

            const ref_rel_column_id =
              baseModelColumnRefs?.[rel.rtn]?.[rel.rcn]?.id;

            const rtnId = baseModelRefs?.[rel.rtn]?.id;

            let fk_mm_model_id;
            let fk_mm_child_column_id;
            let fk_mm_parent_column_id;

            if (columnMeta.mm) {
              fk_mm_model_id = baseModelRefs[rel.vtn].id;
              fk_mm_child_column_id = baseModelColumnRefs[rel.vtn][rel.vcn].id;
              fk_mm_parent_column_id =
                baseModelColumnRefs[rel.vtn][rel.vrcn].id;
            }

            let virtual = false;
            if (columnMeta.mm) {
              const relation = relations.find(
                (r) =>
                  r.rtn === columnMeta.mm.tn &&
                  r.rcn === columnMeta.mm.cn &&
                  r.tn === columnMeta.mm.vtn &&
                  r.cn === columnMeta.mm.vcn,
              );
              virtual = relation?.type === 'virtual';
            } else if (columnMeta.hm) {
              virtual =
                relations.find(
                  (r) =>
                    r.rtn === columnMeta.hm.rtn &&
                    r.tn === columnMeta.hm.tn &&
                    r.rcn === columnMeta.hm.rcn &&
                    r.cn === columnMeta.hm.cn,
                )?.type === 'virtual';
            } else if (columnMeta.bt) {
              virtual =
                relations.find(
                  (r) =>
                    r.rtn === columnMeta.bt.rtn &&
                    r.tn === columnMeta.bt.tn &&
                    r.rcn === columnMeta.bt.rcn &&
                    r.cn === columnMeta.bt.cn,
                )?.type === 'virtual';
            }

            const column = await Column.insert<LinkToAnotherRecordColumn>(
              {
                base_id: base.id,
                db_alias: sourceId,
                fk_model_id: model.id,
                // cn: columnMeta.cn,
                _cn: columnMeta._cn,
                uidt: UITypes.LinkToAnotherRecord,
                type: columnMeta.hm ? 'hm' : columnMeta.mm ? 'mm' : 'bt',
                fk_child_column_id: rel_column_id,
                fk_parent_column_id: ref_rel_column_id,
                fk_index_name: rel.fkn,
                ur: rel.ur,
                dr: rel.dr,
                fk_mm_model_id,
                fk_mm_child_column_id,
                fk_mm_parent_column_id,
                fk_related_model_id: columnMeta.hm ? tnId : rtnId,
                virtual,
              },
              ncMeta,
            );

            baseModelColumnAliasRefs[model.table_name][column.title] = column;
          });
        } else {
          // other virtual columns insert
          virtualColumnInsert.push(async () => {
            //  migrate lookup column
            if (_columnMeta.lk) {
              const columnMeta: Lookupv1 = _columnMeta;

              const colBody: any = {
                _cn: columnMeta._cn,
              };

              colBody.fk_lookup_column_id =
                baseModelColumnRefs[columnMeta.lk.ltn][columnMeta.lk.lcn].id;

              const columns = Object.values(
                baseModelColumnAliasRefs[model.table_name],
              );

              // extract related(virtual relation) column id
              for (const col of columns) {
                if (col.uidt === UITypes.LinkToAnotherRecord) {
                  const colOpt =
                    await col.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
                  if (
                    colOpt.type === columnMeta.lk.type &&
                    colOpt.fk_child_column_id ===
                      baseModelColumnRefs[columnMeta.lk.tn][columnMeta.lk.cn]
                        .id &&
                    colOpt.fk_parent_column_id ===
                      baseModelColumnRefs[columnMeta.lk.rtn][columnMeta.lk.rcn]
                        .id &&
                    (colOpt.type !== 'mm' ||
                      colOpt.fk_mm_model_id ===
                        baseModelRefs[columnMeta.lk.vtn].id)
                  ) {
                    colBody.fk_relation_column_id = col.id;
                    break;
                  }
                }
              }

              if (!colBody.fk_relation_column_id) {
                throw new Error('relation not found');
              }

              const column = await Column.insert(
                {
                  uidt: UITypes.Lookup,
                  ...colBody,
                  fk_model_id: model.id,
                },
                ncMeta,
              );
              baseModelColumnAliasRefs[model.table_name][column.title] = column;
            } else if (_columnMeta.rl) {
              //  migrate rollup column
              const columnMeta: Rollupv1 = _columnMeta;

              const colBody: Partial<RollupColumn & Column> = {
                title: columnMeta._cn,
                rollup_function: columnMeta.rl
                  .fn as (typeof ROLLUP_FUNCTIONS)[number],
              };

              colBody.fk_rollup_column_id =
                baseModelColumnRefs[columnMeta.rl.rltn][columnMeta.rl.rlcn].id;

              const columns = Object.values(
                baseModelColumnAliasRefs[model.table_name],
              );

              // extract related(virtual relation) column id
              for (const col of columns) {
                if (col.uidt === UITypes.LinkToAnotherRecord) {
                  const colOpt =
                    await col.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
                  if (
                    colOpt.type === columnMeta.rl.type &&
                    colOpt.fk_child_column_id ===
                      baseModelColumnRefs[columnMeta.rl.tn][columnMeta.rl.cn]
                        .id &&
                    colOpt.fk_parent_column_id ===
                      baseModelColumnRefs[columnMeta.rl.rtn][columnMeta.rl.rcn]
                        .id &&
                    (colOpt.type !== 'mm' ||
                      colOpt.fk_mm_model_id ===
                        baseModelRefs[columnMeta.rl.vtn].id)
                  ) {
                    colBody.fk_relation_column_id = col.id;
                    break;
                  }
                }
              }

              if (!colBody.fk_relation_column_id) {
                throw new Error('relation not found');
              }
              const column = await Column.insert(
                {
                  uidt: UITypes.Rollup,
                  ...colBody,
                  fk_model_id: model.id,
                },
                ncMeta,
              );
              baseModelColumnAliasRefs[model.table_name][column.title] = column;
            } else if (_columnMeta.formula) {
              const columnMeta: Formulav1 = _columnMeta;
              //  migrate formula column
              const colBody: any = {
                _cn: columnMeta._cn,
              };
              if (columnMeta?.formula?.error?.length) {
                colBody.error = Array.isArray(columnMeta.formula.error)
                  ? columnMeta.formula.error.join(',')
                  : columnMeta.formula.error;
              } else {
                try {
                  colBody.formula = await substituteColumnAliasWithIdInFormula(
                    columnMeta.formula.value,
                    await model.getColumns(ncMeta),
                  );
                } catch {
                  colBody.error = 'Invalid formula';
                }
              }
              colBody.formula_raw = columnMeta.formula.value;
              const column = await Column.insert(
                {
                  uidt: UITypes.Formula,
                  ...colBody,
                  fk_model_id: model.id,
                },
                ncMeta,
              );

              baseModelColumnAliasRefs[model.table_name][column.title] = column;
            }
          });
        }
      }

      // extract system hasmany relation
      const hmColumns = meta.hasMany?.filter(
        (hm) =>
          !meta.v.find(
            (v) =>
              v.hm &&
              v.hm.rtn === hm.rtn &&
              v.hm.rcn === hm.rcn &&
              v.hm.tn === hm.tn &&
              v.hm.cn === hm.cn,
          ),
      );

      for (const rel of hmColumns) {
        virtualRelationColumnInsert.push(async () => {
          const rel_column_id = baseModelColumnRefs?.[rel.tn]?.[rel.cn]?.id;

          const tnId = baseModelRefs?.[rel.tn]?.id;

          const ref_rel_column_id =
            baseModelColumnRefs?.[rel.rtn]?.[rel.rcn]?.id;

          // const rtnId = baseModelRefs?.[rel.rtn]?.id;

          const virtual =
            relations.find(
              (r) =>
                r.rtn === rel.rtn &&
                r.tn === rel.tn &&
                r.rcn === rel.rcn &&
                r.cn === rel.cn,
            )?.type === 'virtual';

          const column = await Column.insert<LinkToAnotherRecordColumn>(
            {
              base_id: base.id,
              db_alias: sourceId,
              fk_model_id: model.id,
              // todo: populate unique name
              _cn: getUniqueColumnAliasName([], `${rel.tn}List`),
              uidt: UITypes.LinkToAnotherRecord,
              type: 'hm',
              fk_child_column_id: rel_column_id,
              fk_parent_column_id: ref_rel_column_id,
              fk_index_name: rel.fkn,
              ur: rel.ur,
              dr: rel.dr,
              fk_related_model_id: tnId,
              system: true,
              virtual,
            },
            ncMeta,
          );

          baseModelColumnAliasRefs[model.table_name][column.title] = column;
        });
      }

      defaultViewsUpdate.push(async () => {
        // insert default view data here
        // @ts-ignore
        const defaultView = await View.list(model.id, ncMeta).then(
          (views) => views[0],
        );

        objViewRef[base.id][modelData.title][defaultView.title] = defaultView;
        objViewQPRef[base.id][modelData.title][defaultView.title] = queryParams;

        const viewColumns = await View.getColumns(defaultView.id, ncMeta);

        const aliasColArr = Object.entries(
          baseModelColumnAliasRefs[model.table_name],
        ).sort(([a], [b]) => {
          return (
            ((queryParams?.fieldsOrder || [])?.indexOf(a) + 1 || Infinity) -
            ((queryParams?.fieldsOrder || [])?.indexOf(b) + 1 || Infinity)
          );
        });
        let orderCount = 1;
        for (const [_cn, column] of aliasColArr) {
          const viewColumn = viewColumns.find(
            (c) => column.id === c.fk_column_id,
          );
          if (!viewColumn) continue;
          await GridViewColumn.update(
            viewColumn.id,
            {
              order: orderCount++,
              show: queryParams?.showFields
                ? queryParams?.showFields?.[_cn] || false
                : true,
              width: queryParams?.columnsWidth?.[_cn],
            },
            ncMeta,
          );
        }
        await View.update(
          defaultView.id,
          {
            show_system_fields: queryParams.showSystemFields,
            order: modelData.view_order,
          },
          ncMeta,
        );
      });
    } else {
      views.push(modelData);
    }
  }

  const type = Noco.getConfig()?.meta?.db?.client;

  await NcHelp.executeOperations(virtualRelationColumnInsert, type);
  await NcHelp.executeOperations(virtualColumnInsert, type);
  await NcHelp.executeOperations(defaultViewsUpdate, type);

  await migrateProjectModelViews(
    {
      metas,
      views,
      objModelRef,
      objModelColumnAliasRef,
      objModelColumnRef,
      objViewRef,
      objViewQPRef,
      objModelAliasRef,
    },
    ncMeta,
  );

  await migrateViewsParams(
    {
      metas,
      views,
      objModelRef,
      objModelColumnAliasRef,
      objModelColumnRef,
      objViewRef,
      objViewQPRef,
      objModelAliasRef,
    },
    ncMeta,
  );

  return {
    metas,
    views,
    objModelRef,
    objModelColumnAliasRef,
    objModelColumnRef,
    objViewRef,
    objViewQPRef,
    objModelAliasRef,
  };
}

async function migrateProjectModelViews(
  {
    views,
    objModelRef,
    // objModelColumnRef,
    objModelColumnAliasRef,
    objViewRef,
    objViewQPRef,
  }: MigrateCtxV1,
  ncMeta,
) {
  for (const viewData of views) {
    const base = await Base.getWithInfo(viewData.base_id, ncMeta);
    // @ts-ignore
    const sourceId = base.sources[0].id;

    // @ts-ignore
    let queryParams: QueryParamsv1 = {};
    if (viewData.query_params) {
      queryParams = JSON.parse(viewData.query_params);
    }

    objViewQPRef[base.id][viewData.parent_model_title][viewData.title] =
      queryParams;

    const insertObj: Partial<
      View & GridView & KanbanView & FormView & GalleryView
    > = {
      title: viewData.title,
      show: true,
      order: viewData.view_order,
      fk_model_id: objModelRef[base.id][viewData.parent_model_title].id,
      base_id: base.id,
      source_id: sourceId,
    };

    if (viewData.show_as === 'grid') {
      insertObj.type = ViewTypes.GRID;
    } else if (viewData.show_as === 'gallery') {
      insertObj.type = ViewTypes.GALLERY;
      insertObj.fk_cover_image_col_id =
        objModelColumnAliasRef[base.id][viewData.parent_model_title][
          queryParams.coverImageField
        ]?.id;
    } else if (viewData.show_as === 'form') {
      insertObj.type = ViewTypes.FORM;
      insertObj.heading = queryParams.extraViewParams?.formParams?.name;
      insertObj.subheading =
        queryParams.extraViewParams?.formParams?.description;
      insertObj.success_msg =
        queryParams.extraViewParams?.formParams?.submit?.message;
      insertObj.redirect_url =
        queryParams.extraViewParams?.formParams?.submit?.submitRedirectUrl;
      insertObj.email = JSON.stringify(
        queryParams.extraViewParams?.formParams?.emailMe,
      );
      insertObj.submit_another_form =
        queryParams.extraViewParams?.formParams?.submit.showAnotherSubmit;
      insertObj.show_blank_form =
        queryParams.extraViewParams?.formParams?.submit?.showBlankForm;
    } else throw new Error('not implemented');

    const view = await View.insert(insertObj, ncMeta);
    objViewRef[base.id][viewData.parent_model_title][view.title] = view;

    const viewColumns = await View.getColumns(view.id, ncMeta);

    const aliasColArr = Object.entries(
      objModelColumnAliasRef[base.id][viewData.parent_model_title],
    ).sort(([a], [b]) => {
      return (
        ((queryParams?.fieldsOrder || [])?.indexOf(a) + 1 || Infinity) -
        ((queryParams?.fieldsOrder || [])?.indexOf(b) + 1 || Infinity)
      );
    });

    let orderCount = 1;

    for (const [_cn, column] of aliasColArr) {
      const viewColumn = viewColumns.find((c) => column.id === c.fk_column_id);
      const order = orderCount++;
      const show = queryParams?.showFields
        ? queryParams?.showFields?.[_cn] || false
        : true;
      if (viewData.show_as === 'form') {
        const columnParams =
          queryParams?.extraViewParams?.formParams?.fields?.[_cn];
        await FormViewColumn.update(
          viewColumn.id,
          {
            help: columnParams?.help?.slice(0, 254),
            label: columnParams?.label,
            required: columnParams?.required,
            description: columnParams?.description,
            order,
            show,
          },
          ncMeta,
        );
      } else if (viewData.show_as === 'grid') {
        const viewColumn = viewColumns.find(
          (c) => column.id === c.fk_column_id,
        );
        if (!viewColumn) continue;
        await GridViewColumn.update(
          viewColumn.id,
          {
            order,
            show,
            width: queryParams?.columnsWidth?.[_cn],
          },
          ncMeta,
        );
      } else {
        await View.updateColumn(
          view.id,
          viewColumn.id,
          {
            order,
            show,
          },
          ncMeta,
        );
      }
    }
    await View.update(
      view.id,
      {
        show_system_fields: queryParams.showSystemFields,
        order: viewData.view_order,
      },
      ncMeta,
    );
  }
}

// migrate sort & filter
async function migrateViewsParams(
  {
    objModelColumnAliasRef,
    objViewRef,
    objViewQPRef,
    objModelColumnRef,
  }: MigrateCtxV1,
  ncMeta,
) {
  for (const baseId of Object.keys(objViewRef)) {
    for (const tn of Object.keys(objViewRef[baseId])) {
      for (const [viewTitle, view] of Object.entries(objViewRef[baseId][tn])) {
        const queryParams = objViewQPRef[baseId][tn][viewTitle];

        if (
          queryParams?.viewStatus?.type &&
          queryParams?.viewStatus?.type !== view.lock_type
        ) {
          await View.update(
            view.id,
            {
              lock_type: queryParams?.viewStatus?.type,
            },
            ncMeta,
          );
          view.lock_type = queryParams?.viewStatus
            ?.type as ViewType['lock_type'];
        }
        // migrate view sort list
        for (const sort of queryParams.sortList || []) {
          await Sort.insert(
            {
              fk_column_id: sort.field
                ? (
                    objModelColumnAliasRef[baseId]?.[tn]?.[sort.field] ||
                    objModelColumnRef[baseId]?.[tn]?.[sort.field]
                  )?.id || null
                : null,
              fk_view_id: view.id,
              direction: sort.order === '-' ? 'desc' : 'asc',
            },
            ncMeta,
          );
        }

        // migrate view filter list
        for (const filter of queryParams.filters || []) {
          await Filter.insert(
            {
              fk_column_id: filter.field
                ? (
                    objModelColumnAliasRef?.[baseId]?.[tn]?.[filter.field] ||
                    objModelColumnRef?.[baseId]?.[tn]?.[filter.field]
                  )?.id || null
                : null,
              fk_view_id: view.id,
              comparison_op: filterV1toV2CompOpMap[filter.op],
              logical_op: filter.logicOp,
              value: filter.value,
            },
            ncMeta,
          );
        }
      }
    }
  }
}

async function migrateUIAcl(ctx: MigrateCtxV1, ncMeta: any) {
  const uiAclList: Array<{
    role: string;
    title: string;
    type: 'vtable' | 'table' | 'view';
    disabled: boolean;
    tn: string;
    parent_model_title: string;
    base_id: string;
  }> = await ncMeta.metaList(null, null, 'nc_disabled_models_for_role');

  for (const acl of uiAclList) {
    // if missing model name skip the view acl migration
    if (!acl?.title) continue;

    let fk_view_id;
    if (acl.type === 'vtable') {
      // if missing parent model name skip the view acl migration
      if (!acl.parent_model_title) continue;
      fk_view_id =
        ctx.objViewRef[acl.base_id]?.[
          (
            ctx.objModelRef?.[acl.base_id]?.[acl.parent_model_title] ||
            ctx.objModelAliasRef?.[acl.base_id]?.[acl.parent_model_title]
          )?.table_name
        ]?.[acl.title]?.id;
    } else {
      fk_view_id =
        ctx.objViewRef?.[acl.base_id]?.[acl.title]?.[
          ctx.objModelRef?.[acl.base_id]?.[acl.title]?.title
        ].id || ctx.objViewRef[acl.base_id]?.[acl.title]?.[acl.title]?.id;
    }

    // if view id missing skip ui acl view migration
    if (!fk_view_id) continue;

    await ModelRoleVisibility.insert(
      {
        role: acl.role,
        fk_view_id,
        disabled: acl.disabled,
      },
      ncMeta,
    );
  }
}

async function migrateSharedViews(ctx: MigrateCtxV1, ncMeta: any) {
  const sharedViews: Array<{
    model_name: string;
    view_type: 'vtable' | 'table' | 'view';
    view_id: string;
    password: string;
    view_name: string;
    base_id: string;
  }> = await ncMeta.metaList(null, null, 'nc_shared_views');

  for (const sharedView of sharedViews) {
    let fk_view_id;

    // if missing view name or model name skip the shared view migration
    if (!sharedView.view_name || !sharedView.model_name) continue;

    if (sharedView.view_type !== 'table' && sharedView.view_type !== 'view') {
      fk_view_id =
        ctx.objViewRef[sharedView.base_id]?.[
          (
            ctx.objModelRef?.[sharedView.base_id]?.[sharedView.model_name] ||
            ctx.objModelAliasRef?.[sharedView.base_id]?.[sharedView.model_name]
          )?.title
        ]?.[sharedView.view_name]?.id;
    } else {
      fk_view_id =
        ctx.objViewRef[sharedView.base_id]?.[sharedView.model_name]?.[
          ctx.objModelRef[sharedView.base_id]?.[sharedView.model_name]?.title
        ]?.id ||
        ctx.objViewRef[sharedView.base_id]?.[sharedView.model_name]?.[
          sharedView.model_name
        ]?.id;
    }

    // if view id missing skip shared view migration
    if (!fk_view_id) continue;

    await View.update(
      fk_view_id,
      {
        uuid: sharedView.view_id,
        password: sharedView.password,
      },
      ncMeta,
    );
  }
}

async function migrateSharedBase(ncMeta: any) {
  const sharedBases: Array<{
    roles: string;
    shared_base_id: string;
    enabled: boolean;
    base_id: string;
    password: string;
  }> = await ncMeta.metaList(null, null, 'nc_shared_bases');

  for (const sharedBase of sharedBases) {
    await Base.update(
      sharedBase.base_id,
      {
        uuid: sharedBase.shared_base_id,
        password: sharedBase.password,
        roles: sharedBase.roles,
      },
      ncMeta,
    );
  }
}

async function migratePlugins(ncMeta: any) {
  const plugins: Array<any> = await ncMeta.metaList(null, null, 'nc_plugins');

  for (const plugin of plugins) {
    await ncMeta.metaInsert2(null, null, MetaTable.PLUGIN, {
      title: plugin.title,
      description: plugin.description,
      active: plugin.active,
      version: plugin.version,
      docs: plugin.docs,
      status: plugin.status,
      status_details: plugin.status_details,
      logo: plugin.logo,
      tags: plugin.tags,
      category: plugin.category,
      input: plugin.input,
      input_schema: plugin.input_schema,
      creator: plugin.creator,
      creator_website: plugin.creator_website,
      price: plugin.price,
    });
  }
}

async function migrateWebhooks(ctx: MigrateCtxV1, ncMeta: any) {
  const hooks: Array<{
    base_id: string;
    db_alias: string;
    title: string;
    description: string;
    env: string;
    tn: string;
    type: string;
    event: 'after' | 'before';
    operation: 'delete' | 'update' | 'insert';
    async: boolean;
    payload: string;
    url: string;
    headers: string;
    condition: string;
    notification: string;
    retries: number;
    retry_interval: number;
    timeout: number;
    active: boolean;
  }> = await ncMeta.metaList(null, null, 'nc_hooks');

  for (const hookMeta of hooks) {
    if (
      !hookMeta.base_id ||
      !ctx.objModelRef[hookMeta?.base_id]?.[hookMeta?.tn]
    ) {
      continue;
    }
    const hook = await Hook.insert(
      {
        fk_model_id: ctx.objModelRef[hookMeta.base_id][hookMeta.tn].id,
        base_id: hookMeta.base_id,
        title: hookMeta.title,
        description: hookMeta.description,
        env: hookMeta.env,
        type: hookMeta.type,
        event: hookMeta.event,
        operation: hookMeta.operation,
        async: hookMeta.async,
        payload: hookMeta.payload,
        url: hookMeta.url,
        headers: hookMeta.headers,
        condition: !!hookMeta.condition,
        notification: hookMeta.notification,
        retries: hookMeta.retries,
        retry_interval: hookMeta.retry_interval,
        timeout: hookMeta.timeout,
        active: hookMeta.active,
      },
      ncMeta,
    );
    let filters = [];
    try {
      filters = JSON.parse(hookMeta.condition);
    } catch {}
    // migrate view filter list
    for (const filter of filters || []) {
      await Filter.insert(
        {
          fk_column_id: filter.field
            ? (
                ctx.objModelColumnRef[hookMeta.base_id][hookMeta.tn][
                  filter.field
                ] ||
                ctx.objModelColumnAliasRef[hookMeta.base_id][hookMeta.tn][
                  filter.field
                ]
              ).id
            : null,
          fk_hook_id: hook.id,
          logical_op: filter.logicOp,
          comparison_op: filterV1toV2CompOpMap[filter.op],
          value: filter.value,
        },
        ncMeta,
      );
    }
  }
}

async function migrateAutitLog(
  ctx: MigrateCtxV1,
  projectsObj: { [baseId: string]: Base },
  ncMeta: any,
) {
  const audits: Array<{
    user: string;
    ip: string;
    base_id: string;
    db_alias: string;
    model_name: string;
    model_id: string;
    op_type: string;
    op_sub_type: string;
    status: string;
    description: string;
    details: string;
  }> = await ncMeta.metaList(null, null, 'nc_audit');

  for (const audit of audits) {
    // skip deleted bases audit
    if (!(audit.base_id in projectsObj)) continue;

    const insertObj: any = {
      user: audit.user,
      ip: audit.ip,
      base_id: audit.base_id,
      row_id: audit.model_id,
      op_type: audit.op_type,
      op_sub_type: audit.op_sub_type,
      status: audit.status,
      description: audit.description,
      details: audit.details,
    };

    if (audit.model_name) {
      const model =
        ctx.objModelAliasRef?.[audit.base_id]?.[audit.model_name] ||
        ctx.objModelRef?.[audit.base_id]?.[audit.model_name] ||
        // extract model by using model_id property from audit
        ctx.objModelRef?.[audit.base_id]?.[
          ctx.metas?.find((m) => m.id == audit.model_id)?.title
        ] ||
        ctx.objModelAliasRef?.[audit.base_id]?.[
          ctx.metas?.find((m) => m.id == audit.model_id)?.alias
        ];

      // if model is not found skip audit insertion
      if (!model) continue;

      insertObj.fk_model_id = model.id;
    }

    await Audit.insert(insertObj, ncMeta);
  }
}
