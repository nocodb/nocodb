import { NcUpgraderCtx } from '../NcUpgrader';
import Noco from '../../Noco';
import User from '../../../noco-models/User';
import Project from '../../../noco-models/Project';
import ProjectUser from '../../../noco-models/ProjectUser';
import Model from '../../../noco-models/Model';
import { ModelTypes, ViewTypes } from 'nocodb-sdk';
import Column from '../../../noco-models/Column';
import LinkToAnotherRecordColumn from '../../../noco-models/LinkToAnotherRecordColumn';
import UITypes from '../../../sqlUi/UITypes';
import NcHelp from '../../../utils/NcHelp';
import { substituteColumnAliasWithIdInFormula } from '../../meta/helpers/formulaHelpers';
import RollupColumn from '../../../noco-models/RollupColumn';
import View from '../../../noco-models/View';
import GridView from '../../../noco-models/GridView';
import KanbanView from '../../../noco-models/KanbanView';
import FormView from '../../../noco-models/FormView';
import GalleryView from '../../../noco-models/GalleryView';
import Sort from '../../../noco-models/Sort';
import Filter from '../../../noco-models/Filter';
import ModelRoleVisibility from '../../../noco-models/ModelRoleVisibility';
import { MetaTable } from '../../../utils/globals';
import Hook from '../../../noco-models/Hook';
import FormViewColumn from '../../../noco-models/FormViewColumn';
import GridViewColumn from '../../../noco-models/GridViewColumn';
import { getUniqueColumnAliasName } from '../../meta/helpers/getUniqueName';
import NcProjectBuilderEE from '../../NcProjectBuilderEE';
import Audit from '../../../noco-models/Audit';

export default async function(ctx: NcUpgraderCtx) {
  const ncMeta = ctx.ncMeta;

  const projects = await ctx.ncMeta.projectList();

  for (const project of projects) {
    // const projectConfig = JSON.parse(project.config);

    const projectBuilder = new NcProjectBuilderEE(
      { ncMeta: ctx.ncMeta } as any,
      { workingEnv: '_noco' } as any,
      project
    );

    await projectBuilder.init();
  }

  await migrateUsers(ncMeta);
  await migrateProjects(ncMeta);
  await migrateProjectUsers(ncMeta);
  const migrationCtx = await migrateProjectModels(ncMeta);

  await migrateUIAcl(migrationCtx, ncMeta);
  await migrateSharedViews(migrationCtx, ncMeta);
  await migrateSharedBase(ncMeta);
  await migratePlugins(ncMeta);
  await migrateWebhooks(migrationCtx, ncMeta);
  await migrateAutitLog(migrationCtx, ncMeta);
}

async function migrateUsers(ncMeta = Noco.ncMeta) {
  const users = await ncMeta.metaList(null, null, 'xc_users');
  const userList: User[] = [];

  for (const user of users) {
    userList.push(await User.insert(user, ncMeta));
  }
  return userList;
}

async function migrateProjects(ncMeta = Noco.ncMeta) {
  const projects = await ncMeta.projectList();
  const projectList: Project[] = [];

  for (const project of projects) {
    const projectConfig = JSON.parse(project.config);

    const projectBody = {
      id: project.id,
      prefix: projectConfig.prefix,
      is_meta: !!projectConfig.prefix,
      title: projectConfig?.title,
      bases: projectConfig?.envs?._noco?.db?.map(d => {
        const inflection = (d && d.meta && d.meta.inflection) || {};
        return {
          is_meta: !!projectConfig.prefix,
          type: d.client,
          config: d,
          created_at: project.created_at,
          updated_at: project.updated_at,
          inflection_column: inflection.cn,
          inflection_table: inflection.tn
        };
      }),
      created_at: project.created_at,
      updated_at: project.updated_at
    };

    projectList.push(await Project.createProject(projectBody, ncMeta));
  }
}

async function migrateProjectUsers(ncMeta = Noco.ncMeta) {
  const projectUsers = await ncMeta.metaList(null, null, 'nc_projects_users');

  for (const projectUser of projectUsers) {
    await ProjectUser.insert(
      {
        project_id: projectUser.project_id,
        fk_user_id: projectUser.user_id,
        roles: projectUser.roles,
        created_at: projectUser.created_at,
        updated_at: projectUser.updated_at
      },
      ncMeta
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
  id: number;
  project_id: string;
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
  created_at;
  updated_at;
}

type ObjModelColumnRefv1 = {
  [projectId: string]: {
    [tableName: string]: {
      [columnName: string]: Column;
    };
  };
};
type ObjModelColumnAliasRefv1 = {
  [projectId: string]: {
    [tableName: string]: {
      [columnAlias: string]: Column;
    };
  };
};

type ObjModelRefv1 = {
  [projectId: string]: {
    [tableName: string]: Model;
  };
};
type ObjViewRefv1 = {
  [projectId: string]: {
    [tableName: string]: {
      [viewName: string]: View;
    };
  };
};
type ObjViewQPRefv1 = {
  [projectId: string]: {
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
  'is not like': 'nlike'
};

async function migrateProjectModels(
  ncMeta = Noco.ncMeta
): Promise<MigrateCtxV1> {
  // @ts-ignore

  const metas: ModelMetav1[] = await ncMeta.metaList(null, null, 'nc_models');
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

      const project = await Project.getWithInfo(modelData.project_id, ncMeta);
      const baseId = project.bases[0].id;

      const meta = JSON.parse(modelData.meta);
      const model = await Model.insert(
        project.id,
        baseId,
        {
          order: modelData.order,
          table_name: modelData.title,
          title: modelData.alias,
          // todo: sanitize
          type: modelData.type === 'table' ? ModelTypes.TABLE : ModelTypes.VIEW,
          created_at: modelData.created_at,
          updated_at: modelData.updated_at,
          mm: !!modelData.mm
        },
        ncMeta
      );
      models.push(model);

      const projectModelRefs = (objModelRef[project.id] =
        objModelRef[project.id] || {});
      objModelRef[project.id][model.table_name] = model;

      objModelAliasRef[project.id] = objModelAliasRef[project.id] || {};
      objModelAliasRef[project.id][model.title] = model;

      const projectModelColumnRefs = (objModelColumnRef[project.id] =
        objModelColumnRef[project.id] || {});
      objModelColumnRef[project.id][model.table_name] =
        objModelColumnRef[project.id][model.table_name] || {};
      const projectModelColumnAliasRefs = (objModelColumnAliasRef[project.id] =
        objModelColumnAliasRef[project.id] || {});
      objModelColumnAliasRef[project.id][model.table_name] =
        objModelColumnAliasRef[project.id][model.table_name] || {};

      objViewRef[project.id] = objViewRef[project.id] || {};
      objViewRef[project.id][modelData.title] =
        objViewRef[project.id][modelData.title] || {};

      objViewQPRef[project.id] = objViewQPRef[project.id] || {};
      objViewQPRef[project.id][modelData.title] =
        objViewQPRef[project.id][modelData.title] || {};

      // migrate table columns
      for (const columnMeta of meta.columns) {
        let system = false;

        if (meta.belongsTo?.find(bt => bt.cn === columnMeta.cn)) {
          system = true;
          columnMeta.uidt = UITypes.ForeignKey;
        }

        const column = await Column.insert(
          {
            ...columnMeta,
            title: columnMeta._cn,
            column_name: columnMeta.cn,
            system,
            fk_model_id: model.id
          },
          ncMeta
        );

        projectModelColumnRefs[model.table_name][
          column.column_name
        ] = projectModelColumnAliasRefs[model.table_name][
          column.title
        ] = column;
      }

      // migrate table virtual columns
      for (const _columnMeta of meta.v) {
        if (_columnMeta.mm || _columnMeta.hm || _columnMeta.bt) {
          const columnMeta: LinkToAnotherRecordv1 = _columnMeta;
          virtualRelationColumnInsert.push(async () => {
            const rel = columnMeta.hm || columnMeta.bt || columnMeta.mm;

            const rel_column_id =
              projectModelColumnRefs?.[rel.tn]?.[rel.cn]?.id;

            const tnId = projectModelRefs?.[rel.tn]?.id;

            const ref_rel_column_id =
              projectModelColumnRefs?.[rel.rtn]?.[rel.rcn]?.id;

            const rtnId = projectModelRefs?.[rel.rtn]?.id;

            let fk_mm_model_id;
            let fk_mm_child_column_id;
            let fk_mm_parent_column_id;

            if (columnMeta.mm) {
              fk_mm_model_id = projectModelRefs[rel.vtn].id;
              fk_mm_child_column_id =
                projectModelColumnRefs[rel.vtn][rel.vcn].id;
              fk_mm_parent_column_id =
                projectModelColumnRefs[rel.vtn][rel.vrcn].id;
            }
            const column = await Column.insert<LinkToAnotherRecordColumn>(
              {
                project_id: project.id,
                db_alias: baseId,
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
                fk_related_model_id: columnMeta.hm ? tnId : rtnId
              },
              ncMeta
            );

            projectModelColumnAliasRefs[model.table_name][
              column.title
            ] = column;
          });
        } else {
          // other virtual columns insert
          virtualColumnInsert.push(async () => {
            //  migrate lookup column
            if (_columnMeta.lk) {
              const columnMeta: Lookupv1 = _columnMeta;

              const colBody: any = {
                _cn: columnMeta._cn
              };

              colBody.fk_lookup_column_id =
                projectModelColumnRefs[columnMeta.lk.ltn][columnMeta.lk.lcn].id;

              const columns = Object.values(
                projectModelColumnAliasRefs[model.table_name]
              );

              // extract related(virtual relation) column id
              for (const col of columns) {
                if (col.uidt === UITypes.LinkToAnotherRecord) {
                  const colOpt = await col.getColOptions<
                    LinkToAnotherRecordColumn
                  >(ncMeta);
                  if (
                    colOpt.type === columnMeta.lk.type &&
                    colOpt.fk_child_column_id ===
                      projectModelColumnRefs[columnMeta.lk.tn][columnMeta.lk.cn]
                        .id &&
                    colOpt.fk_parent_column_id ===
                      projectModelColumnRefs[columnMeta.lk.rtn][
                        columnMeta.lk.rcn
                      ].id &&
                    (colOpt.type !== 'mm' ||
                      colOpt.fk_mm_model_id ===
                        projectModelRefs[columnMeta.lk.vtn].id)
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
                  fk_model_id: model.id
                },
                ncMeta
              );
              projectModelColumnAliasRefs[model.table_name][
                column.title
              ] = column;
            } else if (_columnMeta.rl) {
              //  migrate rollup column
              const columnMeta: Rollupv1 = _columnMeta;

              const colBody: Partial<RollupColumn & Column> = {
                title: columnMeta._cn,
                rollup_function: columnMeta.rl.fn
              };

              colBody.fk_rollup_column_id =
                projectModelColumnRefs[columnMeta.rl.rltn][
                  columnMeta.rl.rlcn
                ].id;

              const columns = Object.values(
                projectModelColumnAliasRefs[model.table_name]
              );

              // extract related(virtual relation) column id
              for (const col of columns) {
                if (col.uidt === UITypes.LinkToAnotherRecord) {
                  const colOpt = await col.getColOptions<
                    LinkToAnotherRecordColumn
                  >(ncMeta);
                  if (
                    colOpt.type === columnMeta.rl.type &&
                    colOpt.fk_child_column_id ===
                      projectModelColumnRefs[columnMeta.rl.tn][columnMeta.rl.cn]
                        .id &&
                    colOpt.fk_parent_column_id ===
                      projectModelColumnRefs[columnMeta.rl.rtn][
                        columnMeta.rl.rcn
                      ].id &&
                    (colOpt.type !== 'mm' ||
                      colOpt.fk_mm_model_id ===
                        projectModelRefs[columnMeta.rl.vtn].id)
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
                  fk_model_id: model.id
                },
                ncMeta
              );
              projectModelColumnAliasRefs[model.table_name][
                column.title
              ] = column;
            } else if (_columnMeta.formula) {
              const columnMeta: Formulav1 = _columnMeta;
              //  migrate formula column
              const colBody: any = {
                _cn: columnMeta._cn
              };
              colBody.formula = await substituteColumnAliasWithIdInFormula(
                columnMeta.formula.value,
                await model.getColumns(ncMeta)
              );
              colBody.formula_raw = columnMeta.formula.value;
              const column = await Column.insert(
                {
                  uidt: UITypes.Formula,
                  ...colBody,
                  fk_model_id: model.id
                },
                ncMeta
              );

              projectModelColumnAliasRefs[model.table_name][
                column.title
              ] = column;
            }
          });
        }
      }

      // extract system hasmany relation
      const hmColumns = meta.hasMany?.filter(
        hm =>
          !meta.v.find(
            v =>
              v.hm &&
              v.hm.rtn === hm.rtn &&
              v.hm.rcn === hm.rcn &&
              v.hm.tn === hm.tn &&
              v.hm.cn === hm.cn
          )
      );

      for (const rel of hmColumns) {
        virtualRelationColumnInsert.push(async () => {
          const rel_column_id = projectModelColumnRefs?.[rel.tn]?.[rel.cn]?.id;

          const tnId = projectModelRefs?.[rel.tn]?.id;

          const ref_rel_column_id =
            projectModelColumnRefs?.[rel.rtn]?.[rel.rcn]?.id;

          // const rtnId = projectModelRefs?.[rel.rtn]?.id;

          const column = await Column.insert<LinkToAnotherRecordColumn>(
            {
              project_id: project.id,
              db_alias: baseId,
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
              system: true
            },
            ncMeta
          );

          projectModelColumnAliasRefs[model.table_name][column.title] = column;
        });
      }

      defaultViewsUpdate.push(async () => {
        // insert default view data here
        // @ts-ignore
        const defaultView = await View.list(model.id, ncMeta).then(
          views => views[0]
        );

        objViewRef[project.id][modelData.title][
          defaultView.title
        ] = defaultView;
        objViewQPRef[project.id][modelData.title][
          defaultView.title
        ] = queryParams;

        const viewColumns = await View.getColumns(defaultView.id, ncMeta);

        const aliasColArr = Object.entries(
          projectModelColumnAliasRefs[model.table_name]
        ).sort(([a], [b]) => {
          return (
            ((queryParams?.fieldsOrder || [])?.indexOf(a) + 1 || Infinity) -
            ((queryParams?.fieldsOrder || [])?.indexOf(b) + 1 || Infinity)
          );
        });
        let orderCount = 1;
        for (const [_cn, column] of aliasColArr) {
          await GridViewColumn.update(
            viewColumns.find(c => column.id === c.fk_column_id).id,
            {
              order: orderCount++,
              show: queryParams?.showFields
                ? queryParams?.showFields?.[_cn] || false
                : true,
              width: queryParams?.columnsWidth?.[_cn]
            },
            ncMeta
          );
        }
        await View.update(
          defaultView.id,
          {
            show_system_fields: queryParams.showSystemFields,
            order: modelData.view_order
          },
          ncMeta
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
      views,
      objModelRef,
      objModelColumnAliasRef,
      objModelColumnRef,
      objViewRef,
      objViewQPRef,
      objModelAliasRef
    },
    ncMeta
  );

  await migrateViewsParams(
    {
      views,
      objModelRef,
      objModelColumnAliasRef,
      objModelColumnRef,
      objViewRef,
      objViewQPRef,
      objModelAliasRef
    },
    ncMeta
  );

  return {
    views,
    objModelRef,
    objModelColumnAliasRef,
    objModelColumnRef,
    objViewRef,
    objViewQPRef,
    objModelAliasRef
  };
}

async function migrateProjectModelViews(
  {
    views,
    objModelRef,
    // objModelColumnRef,
    objModelColumnAliasRef,
    objViewRef,
    objViewQPRef
  }: MigrateCtxV1,
  ncMeta
) {
  for (const viewData of views) {
    const project = await Project.getWithInfo(viewData.project_id, ncMeta);
    // @ts-ignore
    const baseId = project.bases[0].id;

    // @ts-ignore
    let queryParams: QueryParamsv1 = {};
    if (viewData.query_params) {
      queryParams = JSON.parse(viewData.query_params);
    }

    objViewQPRef[project.id][viewData.parent_model_title][
      viewData.title
    ] = queryParams;

    const insertObj: Partial<View &
      GridView &
      KanbanView &
      FormView &
      GalleryView & {
        created_at;
        updated_at;
      }> = {
      title: viewData.title,
      show: true,
      order: viewData.view_order,
      fk_model_id: objModelRef[project.id][viewData.parent_model_title].id,
      project_id: project.id,
      base_id: baseId,
      created_at: viewData.created_at,
      updated_at: viewData.updated_at
    };

    if (viewData.show_as === 'grid') {
      insertObj.type = ViewTypes.GRID;
    } else if (viewData.show_as === 'gallery') {
      insertObj.type = ViewTypes.GALLERY;
      insertObj.fk_cover_image_col_id =
        objModelColumnAliasRef[project.id][viewData.parent_model_title][
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
        queryParams.extraViewParams?.formParams?.emailMe
      );
      insertObj.submit_another_form =
        queryParams.extraViewParams?.formParams?.submit.showAnotherSubmit;
      insertObj.show_blank_form =
        queryParams.extraViewParams?.formParams?.submit?.showBlankForm;
    } else throw new Error('not implemented');

    const view = await View.insert(insertObj, ncMeta);
    objViewRef[project.id][viewData.parent_model_title][view.title] = view;

    const viewColumns = await View.getColumns(view.id, ncMeta);

    const aliasColArr = Object.entries(
      objModelColumnAliasRef[project.id][viewData.parent_model_title]
    ).sort(([a], [b]) => {
      return (
        ((queryParams?.fieldsOrder || [])?.indexOf(a) + 1 || Infinity) -
        ((queryParams?.fieldsOrder || [])?.indexOf(b) + 1 || Infinity)
      );
    });

    let orderCount = 1;

    for (const [_cn, column] of aliasColArr) {
      const viewColumn = viewColumns.find(c => column.id === c.fk_column_id);
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
            help: columnParams?.help,
            label: columnParams?.label,
            required: columnParams?.required,
            description: columnParams?.description,
            order,
            show
          },
          ncMeta
        );
      } else if (viewData.show_as === 'grid') {
        await GridViewColumn.update(
          viewColumns.find(c => column.id === c.fk_column_id).id,
          {
            order,
            show,
            width: queryParams?.columnsWidth?.[_cn]
          },
          ncMeta
        );
      } else {
        await View.updateColumn(
          view.id,
          viewColumn.id,
          {
            order,
            show
          },
          ncMeta
        );
      }
    }
    await View.update(
      view.id,
      {
        show_system_fields: queryParams.showSystemFields,
        order: viewData.view_order
      },
      ncMeta
    );
  }
}

// migrate sort & filter
async function migrateViewsParams(
  {
    objModelColumnAliasRef,
    objViewRef,
    objViewQPRef,
    objModelColumnRef
  }: MigrateCtxV1,
  ncMeta
) {
  for (const projectId of Object.keys(objViewRef)) {
    for (const tn of Object.keys(objViewRef[projectId])) {
      for (const [viewTitle, view] of Object.entries(
        objViewRef[projectId][tn]
      )) {
        const queryParams = objViewQPRef[projectId][tn][viewTitle];

        if (
          queryParams?.viewStatus?.type &&
          queryParams?.viewStatus?.type !== view.lock_type
        ) {
          await View.update(
            view.id,
            {
              lock_type: queryParams?.viewStatus?.type
            },
            ncMeta
          );
          view.lock_type = queryParams?.viewStatus?.type;
        }
        // migrate view sort list
        for (const sort of queryParams.sortList || []) {
          await Sort.insert(
            {
              fk_column_id: sort.field
                ? (
                    objModelColumnAliasRef[projectId][tn][sort.field] ||
                    objModelColumnRef[projectId][tn][sort.field]
                  ).id
                : null,
              fk_view_id: view.id,
              direction: sort.order === '-' ? 'desc' : 'asc'
            },
            ncMeta
          );
        }

        // migrate view filter list
        for (const filter of queryParams.filters || []) {
          await Filter.insert(
            {
              fk_column_id: filter.field
                ? objModelColumnAliasRef[projectId][tn][filter.field].id
                : null,
              fk_view_id: view.id,
              comparison_op: filterV1toV2CompOpMap[filter.op],
              logical_op: filter.logicOp,
              value: filter.value
            },
            ncMeta
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
    project_id: string;
    created_at?;
    updated_at?;
  }> = await ncMeta.metaList(null, null, 'nc_disabled_models_for_role');

  for (const acl of uiAclList) {
    let fk_view_id;
    if (acl.type === 'vtable') {
      fk_view_id =
        ctx.objViewRef[acl.project_id][acl.parent_model_title][acl.title].id;
    } else {
      fk_view_id =
        ctx.objViewRef[acl.project_id][acl.title][
          ctx.objModelRef[acl.project_id][acl.title].title
        ].id || ctx.objViewRef[acl.project_id][acl.title][acl.title].id;
    }

    await ModelRoleVisibility.insert(
      {
        role: acl.role,
        fk_view_id,
        disabled: acl.disabled,
        created_at: acl.created_at,
        updated_at: acl.updated_at
      },
      ncMeta
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
    project_id: string;
  }> = await ncMeta.metaList(null, null, 'nc_shared_views');

  for (const sharedView of sharedViews) {
    let fk_view_id;
    if (sharedView.view_type !== 'table' && sharedView.view_type !== 'view') {
      fk_view_id =
        ctx.objViewRef[sharedView.project_id][sharedView.model_name][
          sharedView.view_name
        ].id;
    } else {
      fk_view_id =
        ctx.objViewRef[sharedView.project_id][sharedView.model_name][
          ctx.objModelRef[sharedView.project_id][sharedView.model_name].title
        ].id ||
        ctx.objViewRef[sharedView.project_id][sharedView.model_name][
          sharedView.model_name
        ].id;
    }

    await View.update(
      fk_view_id,
      {
        uuid: sharedView.view_id,
        password: sharedView.password
      },
      ncMeta
    );
  }
}

async function migrateSharedBase(ncMeta: any) {
  const sharedBases: Array<{
    roles: string;
    shared_base_id: string;
    enabled: boolean;
    project_id: string;
    password: string;
  }> = await ncMeta.metaList(null, null, 'nc_shared_bases');

  for (const sharedBase of sharedBases) {
    await Project.update(
      sharedBase.project_id,
      {
        uuid: sharedBase.shared_base_id,
        password: sharedBase.password,
        roles: sharedBase.roles
      },
      ncMeta
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
      created_at: plugin.created_at,
      updated_at: plugin.updated_at
    });
  }
}

async function migrateWebhooks(ctx: MigrateCtxV1, ncMeta: any) {
  const hooks: Array<{
    project_id: string;
    db_alias: string;
    title: string;
    description: string;
    env: string;
    tn: string;
    type: string;
    event: 'After' | 'Before';
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
    created_at?;
    updated_at?;
  }> = await ncMeta.metaList(null, null, 'nc_hooks');

  for (const hookMeta of hooks) {
    if (!hookMeta.project_id) {
      continue;
    }
    const hook = await Hook.insert(
      {
        fk_model_id: ctx.objModelRef[hookMeta.project_id][hookMeta.tn].id,
        project_id: hookMeta.project_id,
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
        created_at: hookMeta.created_at,
        updated_at: hookMeta.updated_at
      },
      ncMeta
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
                ctx.objModelColumnRef[hookMeta.project_id][hookMeta.tn][
                  filter.field
                ] ||
                ctx.objModelColumnAliasRef[hookMeta.project_id][hookMeta.tn][
                  filter.field
                ]
              ).id
            : null,
          fk_hook_id: hook.id,
          logical_op: filter.logicOp,
          comparison_op: filterV1toV2CompOpMap[filter.op],
          value: filter.value
        },
        ncMeta
      );
    }
  }
}

async function migrateAutitLog(ctx: MigrateCtxV1, ncMeta: any) {
  const audits: Array<{
    user: string;
    ip: string;
    project_id: string;
    db_alias: string;
    model_name: string;
    model_id: string;
    op_type: string;
    op_sub_type: string;
    status: string;
    description: string;
    details: string;
    created_at: any;
    updated_at: any;
  }> = await ncMeta.metaList(null, null, 'nc_audit');

  for (const audit of audits) {
    const insertObj: any = {
      user: audit.user,
      ip: audit.ip,
      project_id: audit.project_id,
      row_id: audit.model_id,
      op_type: audit.op_type,
      op_sub_type: audit.op_sub_type,
      status: audit.status,
      description: audit.description,
      details: audit.details,
      created_at: audit.created_at,
      updated_at: audit.updated_at
    };

    if (audit.model_name) {
      insertObj.fk_model_id = (
        ctx.objModelAliasRef?.[audit.project_id]?.[audit.model_name] ||
        ctx.objModelRef?.[audit.project_id]?.[audit.model_name]
      ).id;
    }

    await Audit.insert(insertObj, ncMeta);
  }
}
