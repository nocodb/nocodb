import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  isLinksOrLTAR,
  isVirtualCol,
  ModelTypes,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { pluralize, singularize } from 'inflection';
import type { LinksColumn, LinkToAnotherRecordColumn } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import ModelXcMetaFactory from '~/db/sql-mgr/code/models/xc/ModelXcMetaFactory';
import getColumnUiType from '~/helpers/getColumnUiType';
import getTableNameAlias, { getColumnNameAlias } from '~/helpers/getTableName';
import { getUniqueColumnAliasName } from '~/helpers/getUniqueName';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import { NcError } from '~/helpers/catchError';
import NcHelp from '~/utils/NcHelp';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Base, Column, Model, Source } from '~/models';

// todo:move enum and types
export enum MetaDiffType {
  TABLE_NEW = 'TABLE_NEW',
  TABLE_REMOVE = 'TABLE_REMOVE',
  TABLE_COLUMN_ADD = 'TABLE_COLUMN_ADD',
  TABLE_COLUMN_TYPE_CHANGE = 'TABLE_COLUMN_TYPE_CHANGE',
  TABLE_COLUMN_PROPS_CHANGED = 'TABLE_COLUMN_PROPS_CHANGED',
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
  source_id: string;
  type: ModelTypes;
  meta?: any;
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
      cstn?: string;
    }
  | {
      type: MetaDiffType.TABLE_COLUMN_PROPS_CHANGED;
      tn?: string;
      model?: Model;
      id?: string;
      cn: string;
      column: Column;
      colId?: string;
    }
);

@Injectable()
export class MetaDiffsService {
  constructor(private appHooksService: AppHooksService) {}

  async getMetaDiff(
    sqlClient,
    base: Base,
    source: Source,
  ): Promise<Array<MetaDiff>> {
    // if meta base then return empty array
    if (source.is_meta) {
      return [];
    }

    const changes: Array<MetaDiff> = [];
    const virtualRelationColumns: Column<LinkToAnotherRecordColumn>[] = [];

    // @ts-ignore
    const tableList: Array<{ tn: string }> = (
      await sqlClient.tableList({ schema: source.getConfig()?.schema })
    )?.data?.list?.filter((t) => {
      if (base?.prefix && source.is_meta) {
        return t.tn?.startsWith(base?.prefix);
      }
      return true;
    });

    const colListRef = {};
    const oldMetas = await source.getModels();
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
      cstn?: string;
    }> = (
      await sqlClient.relationListAll({ schema: source.getConfig()?.schema })
    )?.data?.list;

    for (const table of tableList) {
      if (table.tn === 'nc_evolutions') continue;

      const oldMetaIdx = oldTableMetas.findIndex(
        (m) => m.table_name === table.tn,
      );

      // new table
      if (oldMetaIdx === -1) {
        changes.push({
          table_name: table.tn,
          source_id: source.id,
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
        meta: oldMeta.meta,
        table_name: table.tn,
        source_id: source.id,
        type: ModelTypes.TABLE,
        detectedChanges: [],
      };
      changes.push(tableProp);

      // check for column change
      colListRef[table.tn] = (
        await sqlClient.columnList({
          tn: table.tn,
          schema: source.getConfig()?.schema,
        })
      )?.data?.list;

      await oldMeta.getColumns();

      for (const column of colListRef[table.tn]) {
        const oldColIdx = oldMeta.columns.findIndex(
          (c) => c.column_name === column.cn,
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
        if (
          !!oldCol.pk !== !!column.pk ||
          !!oldCol.rqd !== !!column.rqd ||
          !!oldCol.un !== !!column.un ||
          !!oldCol.ai !== !!column.ai ||
          !!oldCol.unique !== !!column.unique
        ) {
          tableProp.detectedChanges.push({
            type: MetaDiffType.TABLE_COLUMN_PROPS_CHANGED,
            msg: `Column properties changed (${column.cn})`,
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
            UITypes.Links,
            UITypes.Rollup,
            UITypes.Lookup,
            UITypes.Formula,
            UITypes.QrCode,
            UITypes.Barcode,
          ].includes(column.uidt)
        ) {
          if (isLinksOrLTAR(column.uidt)) {
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
        meta: model.meta,
        source_id: source.id,
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
      const colOpt =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>();
      const parentCol = await colOpt.getParentColumn();
      const childCol = await colOpt.getChildColumn();
      const parentModel = await parentCol.getModel();
      const childModel = await childCol.getModel();

      // many to many relation
      if (colOpt.type === RelationTypes.MANY_TO_MANY) {
        const m2mModel = await colOpt.getMMModel();

        const relatedTable = tableList.find(
          (t) => t.tn === parentModel.table_name,
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
          (
            await sqlClient.columnList({
              tn: childModel.table_name,
              schema: source.getConfig()?.schema,
            })
          )?.data?.list);

        const pColumns = (colListRef[parentModel.table_name] =
          colListRef[parentModel.table_name] ||
          (
            await sqlClient.columnList({
              tn: parentModel.table_name,
              schema: source.getConfig()?.schema,
            })
          )?.data?.list);

        const vColumns = (colListRef[m2mTable.tn] =
          colListRef[m2mTable.tn] ||
          (
            await sqlClient.columnList({
              tn: m2mTable.tn,
              schema: source.getConfig()?.schema,
            })
          )?.data?.list);

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
          r.rtn === parentModel.table_name,
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
                : parentModel.table_name),
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
            cstn: relation.cstn,
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
    }> = (
      await sqlClient.viewList({ schema: source.getConfig()?.schema })
    )?.data?.list
      ?.map((v) => {
        v.type = 'view';
        v.tn = v.view_name;
        return v;
      })
      .filter((t) => {
        if (base?.prefix && source.is_meta) {
          return t.tn?.startsWith(base?.prefix);
        }
        return true;
      }); // @ts-ignore

    for (const view of viewList) {
      const oldMetaIdx = oldViewMetas.findIndex(
        (m) => m.table_name === view.tn,
      );

      // new table
      if (oldMetaIdx === -1) {
        changes.push({
          table_name: view.tn,
          source_id: source.id,
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
        meta: oldMeta.meta,
        table_name: view.tn,
        source_id: source.id,
        type: ModelTypes.VIEW,
        detectedChanges: [],
      };
      changes.push(tableProp);

      // check for column change
      colListRef[view.tn] = (
        await sqlClient.columnList({
          tn: view.tn,
          schema: source.getConfig()?.schema,
        })
      )?.data?.list;

      await oldMeta.getColumns();

      for (const column of colListRef[view.tn]) {
        const oldColIdx = oldMeta.columns.findIndex(
          (c) => c.column_name === column.cn,
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
            UITypes.Links,
            UITypes.QrCode,
            UITypes.Barcode,
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
        meta: model.meta,
        source_id: source.id,
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

  async metaDiff(param: { baseId: string }) {
    const base = await Base.getWithInfo(param.baseId);
    let changes = [];
    for (const source of base.sources) {
      try {
        // skip meta base
        if (source.is_meta) continue;

        // @ts-ignore
        const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
        changes = changes.concat(
          await this.getMetaDiff(sqlClient, base, source),
        );
      } catch (e) {
        console.log(e);
      }
    }

    return changes;
  }

  async baseMetaDiff(param: { baseId: string; sourceId: string }) {
    const base = await Base.getWithInfo(param.baseId);
    const source = await Source.get(param.sourceId);

    let changes = [];

    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    changes = await this.getMetaDiff(sqlClient, base, source);

    return changes;
  }

  async syncBaseMeta(base: Base, source: Source, throwOnFail = false) {
    if (source.is_meta) {
      if (throwOnFail) NcError.badRequest('Cannot sync meta source');
      return;
    }

    const virtualColumnInsert: Array<() => Promise<void>> = [];

    // @ts-ignore
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    const changes = await this.getMetaDiff(sqlClient, base, source);

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
                await sqlClient.columnList({
                  tn: table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

              mapDefaultDisplayValue(columns);

              const model = await Model.insert(base.id, source.id, {
                table_name: table_name,
                title: getTableNameAlias(
                  table_name,
                  source.is_meta ? base.prefix : '',
                  source,
                ),
                type: ModelTypes.TABLE,
              });

              for (const column of columns) {
                await Column.insert({
                  uidt: getColumnUiType(source, column),
                  fk_model_id: model.id,
                  ...column,
                  title: getColumnNameAlias(column.column_name, source),
                });
              }
            }
            break;
          case MetaDiffType.VIEW_NEW:
            {
              const columns = (
                await sqlClient.columnList({
                  tn: table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

              mapDefaultDisplayValue(columns);

              const model = await Model.insert(base.id, source.id, {
                table_name: table_name,
                title: getTableNameAlias(table_name, base.prefix, source),
                type: ModelTypes.VIEW,
              });

              for (const column of columns) {
                await Column.insert({
                  uidt: getColumnUiType(source, column),
                  fk_model_id: model.id,
                  ...column,
                  title: getColumnNameAlias(column.column_name, source),
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
                await sqlClient.columnList({
                  tn: table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));
              const column = columns.find((c) => c.cn === change.cn);
              column.uidt = getColumnUiType(source, column);
              //todo: inflection
              column.title = getColumnNameAlias(column.cn, source);
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
                await sqlClient.columnList({
                  tn: table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));
              const column = columns.find((c) => c.cn === change.cn);
              const metaFact = ModelXcMetaFactory.create(
                { client: source.type },
                {},
              );
              column.uidt = metaFact.getUIDataType(column);
              column.title = change.column.title;
              await Column.update(change.column.id, column);
            }
            break;
          case MetaDiffType.TABLE_COLUMN_PROPS_CHANGED:
            {
              const columns = (
                await sqlClient.columnList({ tn: table_name })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));
              const colMeta = columns.find((c) => c.cn === change.cn);
              if (!colMeta) break;
              const { pk, ai, rqd, un, unique } = colMeta;
              await Column.update(change.column.id, {
                pk,
                ai,
                rqd,
                un,
                unique,
              });
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
                  base_id: source.base_id,
                  source_id: source.id,
                  table_name: change.rtn,
                });
                const childModel = await Model.getByIdOrName({
                  base_id: source.base_id,
                  source_id: source.id,
                  table_name: change.tn,
                });
                const parentCol = await parentModel
                  .getColumns()
                  .then((cols) =>
                    cols.find((c) => c.column_name === change.rcn),
                  );
                const childCol = await childModel
                  .getColumns()
                  .then((cols) =>
                    cols.find((c) => c.column_name === change.cn),
                  );

                await Column.update(childCol.id, {
                  ...childCol,
                  uidt: UITypes.ForeignKey,
                  system: true,
                });

                if (change.relationType === RelationTypes.BELONGS_TO) {
                  const title = getUniqueColumnAliasName(
                    childModel.columns,
                    `${parentModel.title || parentModel.table_name}`,
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
                    fk_index_name: change.cstn,
                  });
                } else if (change.relationType === RelationTypes.HAS_MANY) {
                  const title = getUniqueColumnAliasName(
                    childModel.columns,
                    pluralize(childModel.title || childModel.table_name),
                  );
                  await Column.insert<LinkToAnotherRecordColumn>({
                    uidt: UITypes.Links,
                    title,
                    fk_model_id: parentModel.id,
                    fk_related_model_id: childModel.id,
                    type: RelationTypes.HAS_MANY,
                    fk_parent_column_id: parentCol.id,
                    fk_child_column_id: childCol.id,
                    virtual: false,
                    fk_index_name: change.cstn,
                    meta: {
                      plural: pluralize(childModel.title),
                      singular: singularize(childModel.title),
                    },
                  });
                }
              });
            }
            break;
        }
      }
    }

    await NcHelp.executeOperations(virtualColumnInsert, source.type);

    // populate m2m relations
    await this.extractAndGenerateManyToManyRelations(await source.getModels());
  }

  async metaDiffSync(param: { baseId: string; req: any }) {
    const base = await Base.getWithInfo(param.baseId);
    for (const source of base.sources) {
      await this.syncBaseMeta(base, source);
    }

    this.appHooksService.emit(AppEvents.META_DIFF_SYNC, {
      base,
      req: param.req,
    });

    return true;
  }

  async baseMetaDiffSync(param: {
    baseId: string;
    sourceId: string;
    req: any;
  }) {
    const base = await Base.getWithInfo(param.baseId);
    const source = await Source.get(param.sourceId);

    await this.syncBaseMeta(base, source, true);

    this.appHooksService.emit(AppEvents.META_DIFF_SYNC, {
      base,
      source,
      req: param.req,
    });

    return true;
  }

  async isMMRelationExist(
    model: Model,
    assocModel: Model,
    belongsToCol: Column<LinkToAnotherRecordColumn>,
  ) {
    let isExist = false;
    const colChildOpt =
      await belongsToCol.getColOptions<LinkToAnotherRecordColumn>();
    for (const col of await model.getColumns()) {
      if (isLinksOrLTAR(col.uidt)) {
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
  async extractAndGenerateManyToManyRelations(modelsArr: Array<Model>) {
    for (const assocModel of modelsArr) {
      await assocModel.getColumns();
      // check if table is a Bridge table(or Associative Table) by checking
      // number of foreign keys and columns

      const normalColumns = assocModel.columns.filter((c) => !isVirtualCol(c));
      const belongsToCols: Column<LinkToAnotherRecordColumn>[] = [];
      for (const col of assocModel.columns) {
        if (col.uidt == UITypes.LinkToAnotherRecord) {
          const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>();
          if (colOpt?.type === RelationTypes.BELONGS_TO)
            belongsToCols.push(col);
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
        const isRelationAvailInA = await this.isMMRelationExist(
          modelA,
          assocModel,
          belongsToCols[0],
        );
        const isRelationAvailInB = await this.isMMRelationExist(
          modelB,
          assocModel,
          belongsToCols[1],
        );

        if (!isRelationAvailInA) {
          await Column.insert<LinksColumn>({
            title: getUniqueColumnAliasName(
              modelA.columns,
              pluralize(modelB.title),
            ),
            fk_model_id: modelA.id,
            fk_related_model_id: modelB.id,
            fk_mm_model_id: assocModel.id,
            fk_child_column_id: belongsToCols[0].colOptions.fk_parent_column_id,
            fk_parent_column_id:
              belongsToCols[1].colOptions.fk_parent_column_id,
            fk_mm_child_column_id:
              belongsToCols[0].colOptions.fk_child_column_id,
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
          await Column.insert<LinksColumn>({
            title: getUniqueColumnAliasName(
              modelB.columns,
              pluralize(modelA.title),
            ),
            fk_model_id: modelB.id,
            fk_related_model_id: modelA.id,
            fk_mm_model_id: assocModel.id,
            fk_child_column_id: belongsToCols[1].colOptions.fk_parent_column_id,
            fk_parent_column_id:
              belongsToCols[0].colOptions.fk_parent_column_id,
            fk_mm_child_column_id:
              belongsToCols[1].colOptions.fk_child_column_id,
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

            const colOpt1 =
              await col.getColOptions<LinkToAnotherRecordColumn>();
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
}
