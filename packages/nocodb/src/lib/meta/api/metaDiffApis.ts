// // Project CRUD

import { Tele } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import Model from '../../models/Model';
import Project from '../../models/Project';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import { isVirtualCol, ModelTypes, RelationTypes, UITypes } from 'nocodb-sdk';
import { Router } from 'express';
import Base from '../../models/Base';
import ModelXcMetaFactory from '../../db/sql-mgr/code/models/xc/ModelXcMetaFactory';
import Column from '../../models/Column';
import LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';
import { getUniqueColumnAliasName } from '../helpers/getUniqueName';
import NcHelp from '../../utils/NcHelp';
import getTableNameAlias, { getColumnNameAlias } from '../helpers/getTableName';
import mapDefaultPrimaryValue from '../helpers/mapDefaultPrimaryValue';
import getColumnUiType from '../helpers/getColumnUiType';
import { metaApiMetrics } from '../helpers/apiMetrics';

export enum MetaDiffType {
  TABLE_NEW = 'TABLE_NEW',
  TABLE_REMOVE = 'TABLE_REMOVE',
  TABLE_COLUMN_ADD = 'TABLE_COLUMN_ADD',
  TABLE_COLUMN_TYPE_CHANGE = 'TABLE_COLUMN_TYPE_CHANGE',
  TABLE_COLUMN_REMOVE = 'TABLE_COLUMN_REMOVE',
  VIEW_NEW = 'VIEW_NEW',
  VIEW_REMOVE = 'VIEW_REMOVE',
  VIEW_COLUMN_ADD = 'VIEW_COLUMN_ADD',
  VIEW_COLUMN_TYPE_CHANGE = 'VIEW_COLUMN_TYPE_CHANGE',
  VIEW_COLUMN_REMOVE = 'VIEW_COLUMN_REMOVE',
  TABLE_RELATION_ADD = 'TABLE_RELATION_ADD',
  TABLE_RELATION_REMOVE = 'TABLE_RELATION_REMOVE',
  TABLE_VIRTUAL_M2M_REMOVE = 'TABLE_VIRTUAL_M2M_REMOVE',
}

const applyChangesPriorityOrder = [
  MetaDiffType.VIEW_COLUMN_REMOVE,
  MetaDiffType.TABLE_RELATION_REMOVE,
];

type MetaDiff = {
  title?: string;
  table_name: string;
  type: ModelTypes;
  detectedChanges: Array<MetaDiffChange>;
};

type MetaDiffChange = {
  msg?: string;
  // type: MetaDiffType;
} & (
  | {
      type: MetaDiffType.TABLE_NEW | MetaDiffType.VIEW_NEW;
      tn?: string;
    }
  | {
      type: MetaDiffType.TABLE_REMOVE | MetaDiffType.VIEW_REMOVE;
      tn?: string;
      model?: Model;
      id?: string;
    }
  | {
      type: MetaDiffType.TABLE_COLUMN_ADD | MetaDiffType.VIEW_COLUMN_ADD;
      tn?: string;
      model?: Model;
      id?: string;
      cn: string;
    }
  | {
      type:
        | MetaDiffType.TABLE_COLUMN_TYPE_CHANGE
        | MetaDiffType.VIEW_COLUMN_TYPE_CHANGE
        | MetaDiffType.TABLE_COLUMN_REMOVE
        | MetaDiffType.VIEW_COLUMN_REMOVE;
      tn?: string;
      model?: Model;
      id?: string;
      cn: string;
      column: Column;
      colId?: string;
    }
  | {
      type: MetaDiffType.TABLE_RELATION_REMOVE;
      tn?: string;
      rtn?: string;
      cn?: string;
      rcn?: string;
      colId: string;
      column: Column;
    }
  | {
      type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE;
      tn?: string;
      rtn?: string;
      cn?: string;
      rcn?: string;
      colId: string;
      column: Column;
    }
  | {
      type: MetaDiffType.TABLE_RELATION_ADD;
      tn?: string;
      rtn?: string;
      cn?: string;
      rcn?: string;
      relationType: RelationTypes;
    }
);

async function getMetaDiff(
  sqlClient,
  project: Project,
  base: Base
): Promise<Array<MetaDiff>> {
  const changes: Array<MetaDiff> = [];
  const virtualRelationColumns: Column<LinkToAnotherRecordColumn>[] = [];

  // @ts-ignore
  const tableList: Array<{ tn: string }> = (
    await sqlClient.tableList()
  )?.data?.list?.filter((t) => {
    if (project?.prefix) {
      return t.tn?.startsWith(project?.prefix);
    }
    return true;
  });

  const colListRef = {};
  const oldMetas = await base.getModels();
  // @ts-ignore
  const oldTableMetas: Model[] = [];
  const oldViewMetas: Model[] = [];

  for (const model of oldMetas) {
    if (model.type === ModelTypes.TABLE) oldTableMetas.push(model);
    else if (model.type === ModelTypes.VIEW) oldViewMetas.push(model);
  }

  // @ts-ignore
  const relationList: Array<{
    tn: string;
    rtn: string;
    cn: string;
    rcn: string;
    found?: any;
  }> = (await sqlClient.relationListAll())?.data?.list;

  for (const table of tableList) {
    if (table.tn === 'nc_evolutions') continue;

    const oldMetaIdx = oldTableMetas.findIndex(
      (m) => m.table_name === table.tn
    );

    // new table
    if (oldMetaIdx === -1) {
      changes.push({
        table_name: table.tn,
        type: ModelTypes.TABLE,
        detectedChanges: [
          {
            type: MetaDiffType.TABLE_NEW,
            msg: `New table`,
          },
        ],
      });
      continue;
    }

    const oldMeta = oldTableMetas[oldMetaIdx];

    oldTableMetas.splice(oldMetaIdx, 1);

    const tableProp: MetaDiff = {
      title: oldMeta.title,
      table_name: table.tn,
      type: ModelTypes.TABLE,
      detectedChanges: [],
    };
    changes.push(tableProp);

    // check for column change
    colListRef[table.tn] = (
      await sqlClient.columnList({ tn: table.tn })
    )?.data?.list;

    await oldMeta.getColumns();

    for (const column of colListRef[table.tn]) {
      const oldColIdx = oldMeta.columns.findIndex(
        (c) => c.column_name === column.cn
      );

      // new table
      if (oldColIdx === -1) {
        tableProp.detectedChanges.push({
          type: MetaDiffType.TABLE_COLUMN_ADD,
          msg: `New column(${column.cn})`,
          cn: column.cn,
          id: oldMeta.id,
        });
        continue;
      }

      const [oldCol] = oldMeta.columns.splice(oldColIdx, 1);

      if (oldCol.dt !== column.dt) {
        tableProp.detectedChanges.push({
          type: MetaDiffType.TABLE_COLUMN_TYPE_CHANGE,
          msg: `Column type changed(${column.cn})`,
          cn: oldCol.column_name,
          id: oldMeta.id,
          column: oldCol,
        });
      }
    }
    for (const column of oldMeta.columns) {
      if (
        [
          UITypes.LinkToAnotherRecord,
          UITypes.Rollup,
          UITypes.Lookup,
          UITypes.Formula,
        ].includes(column.uidt)
      ) {
        if (column.uidt === UITypes.LinkToAnotherRecord) {
          virtualRelationColumns.push(column);
        }

        continue;
      }

      tableProp.detectedChanges.push({
        type: MetaDiffType.TABLE_COLUMN_REMOVE,
        msg: `Column removed(${column.column_name})`,
        cn: column.column_name,
        id: oldMeta.id,
        column: column,
        colId: column.id,
      });
    }
  }

  for (const model of oldTableMetas) {
    changes.push({
      table_name: model.table_name,
      type: ModelTypes.TABLE,
      detectedChanges: [
        {
          type: MetaDiffType.TABLE_REMOVE,
          msg: `Table removed`,
          tn: model.table_name,
          id: model.id,
          model,
        },
      ],
    });
  }

  for (const relationCol of virtualRelationColumns) {
    const colOpt = await relationCol.getColOptions<LinkToAnotherRecordColumn>();
    const parentCol = await colOpt.getParentColumn();
    const childCol = await colOpt.getChildColumn();
    const parentModel = await parentCol.getModel();
    const childModel = await childCol.getModel();

    // many to many relation
    if (colOpt.type === RelationTypes.MANY_TO_MANY) {
      const m2mModel = await colOpt.getMMModel();

      const relatedTable = tableList.find(
        (t) => t.tn === parentModel.table_name
      );
      const m2mTable = tableList.find((t) => t.tn === m2mModel.table_name);

      if (!relatedTable) {
        changes
          .find((t) => t.table_name === childModel.table_name)
          .detectedChanges.push({
            type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
            msg: `Many to many removed(${relatedTable.tn} removed)`,
            colId: relationCol.id,
            column: relationCol,
          });
        continue;
      }
      if (!m2mTable) {
        changes
          .find((t) => t.table_name === childModel.table_name)
          .detectedChanges.push({
            type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
            msg: `Many to many removed(${m2mModel.table_name} removed)`,
            colId: relationCol.id,
            column: relationCol,
          });
        continue;
      }

      // verify columns

      const cColumns = (colListRef[childModel.table_name] =
        colListRef[childModel.table_name] ||
        (await sqlClient.columnList({ tn: childModel.table_name }))?.data
          ?.list);

      const pColumns = (colListRef[parentModel.table_name] =
        colListRef[parentModel.table_name] ||
        (await sqlClient.columnList({ tn: parentModel.table_name }))?.data
          ?.list);

      const vColumns = (colListRef[m2mTable.tn] =
        colListRef[m2mTable.tn] ||
        (await sqlClient.columnList({ tn: m2mTable.tn }))?.data?.list);

      const m2mChildCol = await colOpt.getMMChildColumn();
      const m2mParentCol = await colOpt.getMMParentColumn();

      if (
        pColumns.every((c) => c.cn !== parentCol.column_name) ||
        cColumns.every((c) => c.cn !== childCol.column_name) ||
        vColumns.every((c) => c.cn !== m2mChildCol.column_name) ||
        vColumns.every((c) => c.cn !== m2mParentCol.column_name)
      ) {
        changes
          .find((t) => t.table_name === childModel.table_name)
          .detectedChanges.push({
            type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
            msg: `Many to many removed(One of the relation column removed)`,
            colId: relationCol.id,
            column: relationCol,
          });
      }

      continue;
    }

    if (relationCol.colOptions.virtual) continue;

    const dbRelation = relationList.find(
      (r) =>
        r.cn === childCol.column_name &&
        r.tn === childModel.table_name &&
        r.rcn === parentCol.column_name &&
        r.rtn === parentModel.table_name
    );

    if (dbRelation) {
      dbRelation.found = dbRelation.found || {};

      if (dbRelation.found[colOpt.type]) {
        // todo: handle duplicate
      } else {
        dbRelation.found[colOpt.type] = true;
      }
    } else {
      changes
        .find(
          (t) =>
            t.table_name ===
            (colOpt.type === RelationTypes.BELONGS_TO
              ? childModel.table_name
              : parentModel.table_name)
        )
        .detectedChanges.push({
          type: MetaDiffType.TABLE_RELATION_REMOVE,
          tn: childModel.table_name,
          rtn: parentModel.table_name,
          cn: childCol.column_name,
          rcn: parentCol.column_name,
          msg: `Relation removed`,
          colId: relationCol.id,
          column: relationCol,
        });
    }
  }

  for (const relation of relationList) {
    if (!relation?.found?.[RelationTypes.BELONGS_TO]) {
      changes
        .find((t) => t.table_name === relation.tn)
        ?.detectedChanges.push({
          type: MetaDiffType.TABLE_RELATION_ADD,
          tn: relation.tn,
          rtn: relation.rtn,
          cn: relation.cn,
          rcn: relation.rcn,
          msg: `New relation added`,
          relationType: RelationTypes.BELONGS_TO,
        });
    }
    if (!relation?.found?.[RelationTypes.HAS_MANY]) {
      changes
        .find((t) => t.table_name === relation.rtn)
        ?.detectedChanges.push({
          type: MetaDiffType.TABLE_RELATION_ADD,
          tn: relation.tn,
          rtn: relation.rtn,
          cn: relation.cn,
          rcn: relation.rcn,
          msg: `New relation added`,
          relationType: RelationTypes.HAS_MANY,
        });
    }
  }

  // views
  // @ts-ignore
  const viewList: Array<{
    view_name: string;
    tn: string;
    type: 'view';
  }> = (await sqlClient.viewList())?.data?.list
    ?.map((v) => {
      v.type = 'view';
      v.tn = v.view_name;
      return v;
    })
    .filter((t) => {
      if (project?.prefix) {
        return t.tn?.startsWith(project?.prefix);
      }
      return true;
    }); // @ts-ignore

  for (const view of viewList) {
    const oldMetaIdx = oldViewMetas.findIndex((m) => m.table_name === view.tn);

    // new table
    if (oldMetaIdx === -1) {
      changes.push({
        table_name: view.tn,
        type: ModelTypes.VIEW,
        detectedChanges: [
          {
            type: MetaDiffType.VIEW_NEW,
            msg: `New view`,
          },
        ],
      });
      continue;
    }

    const oldMeta = oldViewMetas[oldMetaIdx];

    oldViewMetas.splice(oldMetaIdx, 1);

    const tableProp: MetaDiff = {
      title: oldMeta.title,
      table_name: view.tn,
      type: ModelTypes.VIEW,
      detectedChanges: [],
    };
    changes.push(tableProp);

    // check for column change
    colListRef[view.tn] = (
      await sqlClient.columnList({ tn: view.tn })
    )?.data?.list;

    await oldMeta.getColumns();

    for (const column of colListRef[view.tn]) {
      const oldColIdx = oldMeta.columns.findIndex(
        (c) => c.column_name === column.cn
      );

      // new table
      if (oldColIdx === -1) {
        tableProp.detectedChanges.push({
          type: MetaDiffType.VIEW_COLUMN_ADD,
          msg: `New column(${column.cn})`,
          cn: column.cn,
          id: oldMeta.id,
        });
        continue;
      }

      const [oldCol] = oldMeta.columns.splice(oldColIdx, 1);

      if (oldCol.dt !== column.dt) {
        tableProp.detectedChanges.push({
          type: MetaDiffType.TABLE_COLUMN_TYPE_CHANGE,
          msg: `Column type changed(${column.cn})`,
          cn: oldCol.column_name,
          id: oldMeta.id,
          column: oldCol,
        });
      }
    }
    for (const column of oldMeta.columns) {
      if (
        [
          UITypes.LinkToAnotherRecord,
          UITypes.Rollup,
          UITypes.Lookup,
          UITypes.Formula,
        ].includes(column.uidt)
      ) {
        continue;
      }

      tableProp.detectedChanges.push({
        type: MetaDiffType.VIEW_COLUMN_REMOVE,
        msg: `Column removed(${column.column_name})`,
        cn: column.column_name,
        id: oldMeta.id,
        column: column,
        colId: column.id,
      });
    }
  }

  for (const model of oldViewMetas) {
    changes.push({
      table_name: model.table_name,
      type: ModelTypes.TABLE,
      detectedChanges: [
        {
          type: MetaDiffType.VIEW_REMOVE,
          msg: `Table removed`,
          tn: model.table_name,
          id: model.id,
          model,
        },
      ],
    });
  }

  return changes;
}

export async function metaDiff(req, res) {
  const project = await Project.getWithInfo(req.params.projectId);
  const base = project.bases[0];

  // @ts-ignore
  const sqlClient = NcConnectionMgrv2.getSqlClient(base);
  const changes = await getMetaDiff(sqlClient, project, base);

  res.json(changes);
}

export async function metaDiffSync(req, res) {
  const project = await Project.getWithInfo(req.params.projectId);
  const base = project.bases[0];
  const virtualColumnInsert: Array<() => Promise<void>> = [];

  // @ts-ignore
  const sqlClient = NcConnectionMgrv2.getSqlClient(base);
  const changes = await getMetaDiff(sqlClient, project, base);

  /* Get all relations */
  // const relations = (await sqlClient.relationListAll())?.data?.list;

  for (const { table_name, detectedChanges } of changes) {
    // reorder changes to apply relation remove changes
    // before column remove to avoid foreign key constraint error
    detectedChanges.sort((a, b) => {
      return (
        applyChangesPriorityOrder.indexOf(b.type) -
        applyChangesPriorityOrder.indexOf(a.type)
      );
    });

    for (const change of detectedChanges) {
      switch (change.type) {
        case MetaDiffType.TABLE_NEW:
          {
            const columns = (
              await sqlClient.columnList({ tn: table_name })
            )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

            mapDefaultPrimaryValue(columns);

            const model = await Model.insert(project.id, base.id, {
              table_name: table_name,
              title: getTableNameAlias(table_name, project.prefix, base),
              type: ModelTypes.TABLE,
            });

            for (const column of columns) {
              await Column.insert({
                uidt: getColumnUiType(base, column),
                fk_model_id: model.id,
                ...column,
                title: getColumnNameAlias(column.column_name, base),
              });
            }
          }
          break;
        case MetaDiffType.VIEW_NEW:
          {
            const columns = (
              await sqlClient.columnList({ tn: table_name })
            )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

            mapDefaultPrimaryValue(columns);

            const model = await Model.insert(project.id, base.id, {
              table_name: table_name,
              title: getTableNameAlias(table_name, project.prefix, base),
              type: ModelTypes.VIEW,
            });

            for (const column of columns) {
              await Column.insert({
                uidt: getColumnUiType(base, column),
                fk_model_id: model.id,
                ...column,
                title: getColumnNameAlias(column.column_name, base),
              });
            }
          }
          break;
        case MetaDiffType.TABLE_REMOVE:
        case MetaDiffType.VIEW_REMOVE:
          {
            await change.model.delete();
          }
          break;
        case MetaDiffType.TABLE_COLUMN_ADD:
        case MetaDiffType.VIEW_COLUMN_ADD:
          {
            const columns = (
              await sqlClient.columnList({ tn: table_name })
            )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));
            const column = columns.find((c) => c.cn === change.cn);
            column.uidt = getColumnUiType(base, column);
            //todo: inflection
            column.title = getColumnNameAlias(column.cn, base);
            await Column.insert({ fk_model_id: change.id, ...column });
          }
          // update old
          // populateParams.tableNames.push({ tn });
          // populateParams.oldMetas[tn] = oldMetas.find(m => m.tn === tn);

          break;
        case MetaDiffType.TABLE_COLUMN_TYPE_CHANGE:
        case MetaDiffType.VIEW_COLUMN_TYPE_CHANGE:
          {
            const columns = (
              await sqlClient.columnList({ tn: table_name })
            )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));
            const column = columns.find((c) => c.cn === change.cn);
            const metaFact = ModelXcMetaFactory.create(
              { client: base.type },
              {}
            );
            column.uidt = metaFact.getUIDataType(column);
            column.title = change.column.title;
            await Column.update(change.column.id, column);
          }
          break;
        case MetaDiffType.TABLE_COLUMN_REMOVE:
        case MetaDiffType.VIEW_COLUMN_REMOVE:
          await change.column.delete();
          break;
        case MetaDiffType.TABLE_RELATION_REMOVE:
        case MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE:
          await change.column.delete();
          break;
        case MetaDiffType.TABLE_RELATION_ADD:
          {
            virtualColumnInsert.push(async () => {
              const parentModel = await Model.getByIdOrName({
                project_id: base.project_id,
                base_id: base.id,
                table_name: change.rtn,
              });
              const childModel = await Model.getByIdOrName({
                project_id: base.project_id,
                base_id: base.id,
                table_name: change.tn,
              });
              const parentCol = await parentModel
                .getColumns()
                .then((cols) => cols.find((c) => c.column_name === change.rcn));
              const childCol = await childModel
                .getColumns()
                .then((cols) => cols.find((c) => c.column_name === change.cn));

              await Column.update(childCol.id, {
                ...childCol,
                uidt: UITypes.ForeignKey,
                system: true,
              });

              if (change.relationType === RelationTypes.BELONGS_TO) {
                const title = getUniqueColumnAliasName(
                  childModel.columns,
                  `${parentModel.title || parentModel.table_name}`
                );
                await Column.insert<LinkToAnotherRecordColumn>({
                  uidt: UITypes.LinkToAnotherRecord,
                  title,
                  fk_model_id: childModel.id,
                  fk_related_model_id: parentModel.id,
                  type: RelationTypes.BELONGS_TO,
                  fk_parent_column_id: parentCol.id,
                  fk_child_column_id: childCol.id,
                  virtual: false,
                });
              } else if (change.relationType === RelationTypes.HAS_MANY) {
                const title = getUniqueColumnAliasName(
                  childModel.columns,
                  `${childModel.title || childModel.table_name} List`
                );
                await Column.insert<LinkToAnotherRecordColumn>({
                  uidt: UITypes.LinkToAnotherRecord,
                  title,
                  fk_model_id: parentModel.id,
                  fk_related_model_id: childModel.id,
                  type: RelationTypes.HAS_MANY,
                  fk_parent_column_id: parentCol.id,
                  fk_child_column_id: childCol.id,
                  virtual: false,
                });
              }
            });
          }
          break;
      }
    }
  }

  await NcHelp.executeOperations(virtualColumnInsert, base.type);

  // populate m2m relations
  await extractAndGenerateManyToManyRelations(await base.getModels());

  Tele.emit('evt', { evt_type: 'metaDiff:synced' });

  res.json({ msg: 'success' });
}

async function isMMRelationExist(
  model: Model,
  assocModel: Model,
  belongsToCol: Column<LinkToAnotherRecordColumn>
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
  modelsArr: Array<Model>
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
    if (belongsToCols?.length === 2 && normalColumns.length < 5) {
      const modelA = await belongsToCols[0].colOptions.getRelatedTable();
      const modelB = await belongsToCols[1].colOptions.getRelatedTable();

      await modelA.getColumns();
      await modelB.getColumns();

      // check tableA already have the relation or not
      const isRelationAvailInA = await isMMRelationExist(
        modelA,
        assocModel,
        belongsToCols[0]
      );
      const isRelationAvailInB = await isMMRelationExist(
        modelB,
        assocModel,
        belongsToCols[1]
      );

      if (!isRelationAvailInA) {
        await Column.insert<LinkToAnotherRecordColumn>({
          title: getUniqueColumnAliasName(
            modelA.columns,
            `${modelB.title} List`
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
          uidt: UITypes.LinkToAnotherRecord,
        });
      }
      if (!isRelationAvailInB) {
        await Column.insert<LinkToAnotherRecordColumn>({
          title: getUniqueColumnAliasName(
            modelB.columns,
            `${modelA.title} List`
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
          uidt: UITypes.LinkToAnotherRecord,
        });
      }

      await Model.markAsMmTable(assocModel.id, true);

      // mark has many relation associated with mm as system field in both table
      for (const btCol of [belongsToCols[0], belongsToCols[1]]) {
        const colOpt = await btCol.colOptions;
        const model = await colOpt.getRelatedTable();

        for (const col of await model.getColumns()) {
          if (col.uidt !== UITypes.LinkToAnotherRecord) continue;

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

const router = Router();
router.get(
  '/api/v1/db/meta/projects/:projectId/meta-diff',
  metaApiMetrics,
  ncMetaAclMw(metaDiff, 'metaDiff')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/meta-diff',
  metaApiMetrics,
  ncMetaAclMw(metaDiffSync, 'metaDiffSync')
);
export default router;
