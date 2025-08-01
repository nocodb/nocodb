import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  ClientType,
  isAIPromptCol,
  isLinksOrLTAR,
  isVirtualCol,
  ModelTypes,
  RelationTypes,
  SqlUiFactory,
  UITypes,
} from 'nocodb-sdk';
import { pluralize, singularize } from 'inflection';
import type { UserType } from 'nocodb-sdk';
import type { LinksColumn, LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
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
    context: NcContext,
    sqlClient,
    base: Base,
    source: Source,
  ): Promise<Array<MetaDiff>> {
    // if meta base then return empty array
    if (source.isMeta()) {
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
    const oldMetas = await source.getModels(context);
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

      await oldMeta.getColumns(context);

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

        if (
          oldCol.dt !== column.dt ||
          // if mysql and data type is set or enum then compare dtxp as well
          (['mysql', 'mysql2'].includes(source.type) &&
            ['set', 'enum'].includes(column.dt) &&
            column.dtxp !== oldCol.dtxp)
        ) {
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
          (<UITypes[]>[
            UITypes.LinkToAnotherRecord,
            UITypes.Links,
            UITypes.Rollup,
            UITypes.Lookup,
            UITypes.Formula,
            UITypes.QrCode,
            UITypes.Barcode,
            UITypes.Button,
          ]).includes(column.uidt) ||
          isAIPromptCol(column) ||
          // skip alias columns of CreatedTime, LastModifiedTime, CreatedBy, LastModifiedBy
          ((<UITypes[]>[
            UITypes.CreatedTime,
            UITypes.LastModifiedTime,
            UITypes.LastModifiedBy,
            UITypes.CreatedBy,
          ]).includes(column.uidt) &&
            !column.system)
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
      const colOpt = await relationCol.getColOptions<LinkToAnotherRecordColumn>(
        context,
      );
      const parentCol = await colOpt.getParentColumn(context);
      const childCol = await colOpt.getChildColumn(context);
      const parentModel = await parentCol.getModel(context);
      const childModel = await childCol.getModel(context);

      // many to many relation
      if (colOpt.type === RelationTypes.MANY_TO_MANY) {
        const m2mModel = await colOpt.getMMModel(context);

        const relatedTable = tableList.find(
          (t) => t.tn === parentModel.table_name,
        );
        const m2mTable = tableList.find((t) => t.tn === m2mModel.table_name);

        if (!relatedTable) {
          changes
            .find((t) => t.table_name === childModel.table_name)
            .detectedChanges.push({
              type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
              msg: `Many to many removed(${parentModel.table_name} removed)`,
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

        const m2mChildCol = await colOpt.getMMChildColumn(context);
        const m2mParentCol = await colOpt.getMMParentColumn(context);

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
              (colOpt.type === RelationTypes.BELONGS_TO ||
              (colOpt.type === RelationTypes.ONE_TO_ONE && relationCol.meta?.bt)
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
      if (
        !relation?.found?.[RelationTypes.BELONGS_TO] &&
        !relation?.found?.[RelationTypes.ONE_TO_ONE]
      ) {
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
      if (
        !relation?.found?.[RelationTypes.HAS_MANY] &&
        !relation?.found?.[RelationTypes.ONE_TO_ONE]
      ) {
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

      await oldMeta.getColumns(context);

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

        if (
          oldCol.dt !== column.dt ||
          // if mysql and data type is set or enum then compare dtxp as well
          (['mysql', 'mysql2'].includes(source.type) &&
            ['set', 'enum'].includes(column.dt) &&
            column.dtxp !== oldCol.dtxp)
        ) {
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

  async metaDiff(context: NcContext, param: { baseId: string }) {
    const base = await Base.getWithInfo(context, param.baseId);
    let changes = [];
    for (const source of base.sources) {
      try {
        // skip meta base
        if (source.isMeta()) continue;

        // @ts-ignore
        const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
        changes = changes.concat(
          await this.getMetaDiff(context, sqlClient, base, source),
        );
      } catch (e) {
        console.log(e);
      }
    }

    return changes;
  }

  async baseMetaDiff(
    context: NcContext,
    param: { baseId: string; sourceId: string; user: UserType },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);
    const source = await Source.get(context, param.sourceId);

    let changes = [];

    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    changes = await this.getMetaDiff(context, sqlClient, base, source);

    return changes;
  }

  async syncBaseMeta(
    context: NcContext,
    {
      base,
      source,
      throwOnFail = false,
      logger,
      user,
    }: {
      base: Base;
      source: Source;
      throwOnFail?: boolean;
      logger?: (message: string) => void;
      user: UserType;
    },
  ) {
    if (source.isMeta()) {
      if (throwOnFail) NcError.badRequest('Cannot sync meta source');
      return;
    }

    const virtualColumnInsert: Array<() => Promise<void>> = [];

    logger?.(`Getting meta diff for ${source.alias}`);

    // @ts-ignore
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    const sqlUi = SqlUiFactory.create({ client: source.type ?? ClientType.PG });
    const changes = await this.getMetaDiff(context, sqlClient, base, source);

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

      if (detectedChanges.length === 0) {
        logger?.(`No changes detected for ${table_name}`);
        continue;
      }

      logger?.(`Applying changes for ${table_name}`);

      for (const change of detectedChanges) {
        logger?.(`Applying change: ${change.msg}`);
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

              const model = await Model.insert(context, base.id, source.id, {
                table_name: table_name,
                title: getTableNameAlias(
                  table_name,
                  source.is_meta ? base.prefix : '',
                  source,
                ),
                type: ModelTypes.TABLE,
                user_id: user.id,
              });

              for (const column of columns) {
                await Column.insert(context, {
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

              const model = await Model.insert(context, base.id, source.id, {
                table_name: table_name,
                title: getTableNameAlias(table_name, base.prefix, source),
                type: ModelTypes.VIEW,
                user_id: user.id,
              });

              for (const column of columns) {
                await Column.insert(context, {
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
              await change.model.delete(context);
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
              await Column.insert(context, {
                fk_model_id: change.id,
                ...column,
              });
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

              // check if new type is compatible with old uidt
              const allowedDatatypes = sqlUi.getDataTypeListForUiType(column);

              // if UIDT not compatible with new type then change uidt
              if (!allowedDatatypes?.includes(column.dt)) {
                column.uidt = metaFact.getUIDataType(column);
              }

              column.title = change.column.title;
              await Column.update(context, change.column.id, column);
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
              await Column.update(context, change.column.id, {
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
            await change.column.delete(context);
            break;
          case MetaDiffType.TABLE_RELATION_REMOVE:
          case MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE:
            await change.column.delete(context);
            break;
          case MetaDiffType.TABLE_RELATION_ADD:
            {
              virtualColumnInsert.push(async () => {
                const parentModel = await Model.getByIdOrName(context, {
                  base_id: source.base_id,
                  source_id: source.id,
                  table_name: change.rtn,
                });
                const childModel = await Model.getByIdOrName(context, {
                  base_id: source.base_id,
                  source_id: source.id,
                  table_name: change.tn,
                });

                // Skip relation creation if either the parent or child table is missing.
                // This can happen if the database user has access limited to specific tables,
                // making it unable to create the relation. In such cases, we simply skip.
                if (!parentModel || !childModel) {
                  logger?.(
                    `Skipping relation creation for ${change.tn} and ${change.rtn} because one of the tables is missing or the database user lacks access.`,
                  );
                  return;
                }

                const parentCol = await parentModel
                  .getColumns(context)
                  .then((cols) =>
                    cols.find((c) => c.column_name === change.rcn),
                  );
                const childCol = await childModel
                  .getColumns(context)
                  .then((cols) =>
                    cols.find((c) => c.column_name === change.cn),
                  );

                await Column.update(context, childCol.id, {
                  ...childCol,
                  uidt: UITypes.ForeignKey,
                  system: true,
                });

                if (change.relationType === RelationTypes.BELONGS_TO) {
                  const title = getUniqueColumnAliasName(
                    childModel.columns,
                    `${parentModel.title || parentModel.table_name}`,
                  );
                  await Column.insert<LinkToAnotherRecordColumn>(context, {
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
                  await Column.insert<LinkToAnotherRecordColumn>(context, {
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
      logger?.(`Changes applied for ${table_name}`);
    }

    logger?.(`Processing virtual column changes`);

    await NcHelp.executeOperations(virtualColumnInsert, source.type);

    logger?.(`Virtual column changes applied`);

    logger?.(`Processing many to many relation changes`);

    // populate m2m relations
    await this.extractAndGenerateManyToManyRelations(
      context,
      await source.getModels(context),
    );

    logger?.(`Many to many relation changes applied`);
  }

  async metaDiffSync(
    context: NcContext,
    param: { baseId: string; logger?: (message: string) => void; req: any },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);
    for (const source of base.sources) {
      await this.syncBaseMeta(context, {
        base,
        source,
        logger: param.logger,
        user: param.req.user,
      });
    }

    this.appHooksService.emit(AppEvents.META_DIFF_SYNC, {
      base,
      req: param.req,
      context,
    });

    return true;
  }

  async baseMetaDiffSync(
    context: NcContext,
    param: {
      baseId: string;
      sourceId: string;
      logger?: (message: string) => void;
      req: any;
    },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);
    const source = await Source.get(context, param.sourceId);

    await this.syncBaseMeta(context, {
      base,
      source,
      throwOnFail: true,
      logger: param.logger,
      user: param.req.user,
    });

    this.appHooksService.emit(AppEvents.META_DIFF_SYNC, {
      base,
      source,
      req: param.req,
      context,
    });

    return true;
  }

  async isMMRelationExist(
    context: NcContext,
    model: Model,
    assocModel: Model,
    belongsToCol: Column<LinkToAnotherRecordColumn>,
  ) {
    let isExist = false;
    const colChildOpt =
      await belongsToCol.getColOptions<LinkToAnotherRecordColumn>(context);
    for (const col of await model.getColumns(context)) {
      if (isLinksOrLTAR(col.uidt)) {
        const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
          context,
        );
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
  async extractAndGenerateManyToManyRelations(
    context: NcContext,
    modelsArr: Array<Model>,
  ) {
    for (const assocModel of modelsArr) {
      await assocModel.getColumns(context);
      // check if table is a Bridge table(or Associative Table) by checking
      // number of foreign keys and columns

      const normalColumns = assocModel.columns.filter((c) => !isVirtualCol(c));
      const belongsToCols: Column<LinkToAnotherRecordColumn>[] = [];
      for (const col of assocModel.columns) {
        if (col.uidt == UITypes.LinkToAnotherRecord) {
          const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
            context,
          );
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
        const modelA = await belongsToCols[0].colOptions.getRelatedTable(
          context,
        );
        const modelB = await belongsToCols[1].colOptions.getRelatedTable(
          context,
        );

        await modelA.getColumns(context);
        await modelB.getColumns(context);

        // check tableA already have the relation or not
        const isRelationAvailInA = await this.isMMRelationExist(
          context,
          modelA,
          assocModel,
          belongsToCols[0],
        );
        const isRelationAvailInB = await this.isMMRelationExist(
          context,
          modelB,
          assocModel,
          belongsToCols[1],
        );

        if (!isRelationAvailInA) {
          await Column.insert<LinksColumn>(context, {
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
          await Column.insert<LinksColumn>(context, {
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

        await Model.markAsMmTable(context, assocModel.id, true);

        // mark has many relation associated with mm as system field in both table
        for (const btCol of [belongsToCols[0], belongsToCols[1]]) {
          const colOpt = await btCol.colOptions;
          const model = await colOpt.getRelatedTable(context);

          for (const col of await model.getColumns(context)) {
            if (!isLinksOrLTAR(col.uidt)) continue;

            const colOpt1 = await col.getColOptions<LinkToAnotherRecordColumn>(
              context,
            );
            if (!colOpt1 || colOpt1.type !== RelationTypes.HAS_MANY) continue;

            if (
              colOpt1.fk_child_column_id !== colOpt.fk_child_column_id ||
              colOpt1.fk_parent_column_id !== colOpt.fk_parent_column_id
            )
              continue;

            await Column.markAsSystemField(context, col.id);
            break;
          }
        }
      } else {
        if (assocModel.mm)
          await Model.markAsMmTable(context, assocModel.id, false);
      }
    }
  }
}
