import { extractFilterFromXwhere, NcApiVersion } from 'nocodb-sdk';
import groupBy from 'lodash/groupBy';
import type { Logger } from '@nestjs/common';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { LinkToAnotherRecordColumn } from '~/models';
import { _wherePk, applyPaginate } from '~/helpers/dbHelpers';
import { Filter, Model, View } from '~/models';
import sortV2 from '~/db/sortV2';
import conditionV2 from '~/db/conditionV2';
import getAst from '~/helpers/getAst';

const GROUP_COL = '__nc_group_id';

export const relationDataFetcher = (param: {
  baseModel: IBaseModelSqlV2;
  logger: Logger;
}) => {
  const { baseModel } = param;
  return {
    async multipleHmList(
      {
        colId,
        ids: _ids,
        apiVersion,
        nested = false,
      }: {
        colId: string;
        ids: any[];
        apiVersion?: NcApiVersion;
        nested?: boolean;
      },
      args: { limit?; offset?; fieldsSet?: Set<string> } = {},
    ) {
      try {
        // skip duplicate id
        const ids = [...new Set(_ids)];

        const { where, sort, ...rest } = baseModel._getListArgs(args as any);
        // todo: get only required fields
        const relColumn = (
          await baseModel.model.getColumns(baseModel.context)
        ).find((c) => c.id === colId);

        const relationColOpts = (await relColumn.getColOptions(
          baseModel.context,
        )) as LinkToAnotherRecordColumn;
        const chilCol = await relationColOpts.getChildColumn(baseModel.context);
        const childTable = await chilCol.getModel(baseModel.context);
        const parentCol = await relationColOpts.getParentColumn(
          baseModel.context,
        );
        const parentTable = await parentCol.getModel(baseModel.context);
        const childModel = await Model.getBaseModelSQL(baseModel.context, {
          model: childTable,
          dbDriver: baseModel.dbDriver,
        });
        await parentTable.getColumns(baseModel.context);

        const childTn = baseModel.getTnPath(childTable);
        const parentTn = baseModel.getTnPath(parentTable);

        const qb = baseModel.dbDriver(childTn);
        await childModel.selectObject({
          qb,
          extractPkAndPv: true,
          fieldsSet: args.fieldsSet,
        });
        const view = relationColOpts.fk_target_view_id
          ? await View.get(baseModel.context, relationColOpts.fk_target_view_id)
          : await View.getDefaultView(baseModel.context, childModel.model.id);
        await baseModel.applySortAndFilter({
          table: childTable,
          where,
          qb,
          sort,
          view,
          skipViewFilter: true,
        });
        const childQb = baseModel.dbDriver.queryBuilder().from(
          baseModel.dbDriver
            .unionAll(
              ids.map((p) => {
                const query = qb
                  .clone()
                  .select(baseModel.dbDriver.raw('? as ??', [p, GROUP_COL]))
                  .whereIn(
                    chilCol.column_name,
                    baseModel
                      .dbDriver(parentTn)
                      .select(parentCol.column_name)
                      // .where(parentTable.primaryKey.cn, p)
                      .where(_wherePk(parentTable.primaryKeys, p)),
                  );
                // todo: sanitize

                // get one extra record to check if there are more records in case of v3 api and nested
                query.limit(
                  (+rest?.limit || 25) +
                    (apiVersion === NcApiVersion.V3 && nested ? 1 : 0),
                );
                query.offset(+rest?.offset || 0);

                return baseModel.isSqlite
                  ? baseModel.dbDriver.select().from(query)
                  : query;
              }),
              !baseModel.isSqlite,
            )
            .as('list'),
        );

        const children = await baseModel.execAndParse(
          childQb,
          await childTable.getColumns(baseModel.context),
        );
        const proto = await (
          await Model.getBaseModelSQL(baseModel.context, {
            id: childTable.id,
            dbDriver: baseModel.dbDriver,
          })
        ).getProto();

        return groupBy(
          children.map((c) => {
            c.__proto__ = proto;
            return c;
          }),
          GROUP_COL,
        );
      } catch (e) {
        param.logger.error(e);
      }
    },

    async mmList(
      {
        colId,
        parentId,
        apiVersion,
        nested = false,
      }: {
        colId: string;
        parentId: any;
        apiVersion?: NcApiVersion;
        nested?: boolean;
      },
      args: { limit?; offset?; fieldsSet?: Set<string> } = {},
      selectAllRecords = false,
    ) {
      const { where, sort, ...rest } = baseModel._getListArgs(args as any, {
        apiVersion,
        nested: true,
      });
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      // const tn = baseModel.model.tn;
      // const cn = (await relColOptions.getChildColumn()).title;
      const mmTable = await relColOptions.getMMModel(baseModel.context);
      const vtn = baseModel.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(baseModel.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(baseModel.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const parentTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      await parentTable.getColumns(baseModel.context);
      const childModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: childTable,
      });

      const childTn = baseModel.getTnPath(childTable);
      const parentTn = baseModel.getTnPath(parentTable);

      const rtn = childTn;
      const rtnId = childTable.id;

      const qb = baseModel
        .dbDriver(rtn)
        .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
        .whereIn(
          `${vtn}.${vcn}`,
          baseModel
            .dbDriver(parentTn)
            .select(cn)
            // .where(parentTable.primaryKey.cn, id)
            .where(_wherePk(parentTable.primaryKeys, parentId)),
        );

      await childModel.selectObject({
        qb,
        fieldsSet: args.fieldsSet,
      });

      await childTable.getViews(baseModel.context);
      const viewId =
        relColumn.colOptions?.fk_target_view_id ?? childTable.views?.[0]?.id;
      let view: View | null = null;
      if (viewId) view = await View.get(baseModel.context, viewId);
      await baseModel.applySortAndFilter({
        table: childTable,
        where,
        view,
        qb,
        sort,
        skipViewFilter: true,
      });

      if (!sort || sort === '') {
        const view = relColOptions.fk_target_view_id
          ? await View.get(baseModel.context, relColOptions.fk_target_view_id)
          : await View.getDefaultView(baseModel.context, childTable.id);
        const childSorts = await view.getSorts(baseModel.context);
        await sortV2(childModel, childSorts, qb);
      }

      // todo: sanitize
      if (!selectAllRecords) {
        // get one extra record to check if there are more records in case of v3 api and nested
        qb.limit(
          (+rest?.limit || 25) +
            (apiVersion === NcApiVersion.V3 && nested ? 1 : 0),
        );
      }
      qb.offset(selectAllRecords ? 0 : +rest?.offset || 0);

      const children = await baseModel.execAndParse(
        qb,
        await childTable.getColumns(baseModel.context),
      );
      const proto = await (
        await Model.getBaseModelSQL(baseModel.context, {
          id: rtnId,
          dbDriver: baseModel.dbDriver,
        })
      ).getProto();

      return children.map((c) => {
        c.__proto__ = proto;
        return c;
      });
    },

    async multipleHmListCount({ colId, ids }) {
      try {
        // const { cn } = baseModel.hasManyRelations.find(({ tn }) => tn === child) || {};
        const relColumn = (
          await baseModel.model.getColumns(baseModel.context)
        ).find((c) => c.id === colId);
        const chilCol = await (
          (await relColumn.getColOptions(
            baseModel.context,
          )) as LinkToAnotherRecordColumn
        ).getChildColumn(baseModel.context);
        const childTable = await chilCol.getModel(baseModel.context);
        const parentCol = await (
          (await relColumn.getColOptions(
            baseModel.context,
          )) as LinkToAnotherRecordColumn
        ).getParentColumn(baseModel.context);
        const parentTable = await parentCol.getModel(baseModel.context);
        await parentTable.getColumns(baseModel.context);

        const childTn = baseModel.getTnPath(childTable);
        const parentTn = baseModel.getTnPath(parentTable);

        const children = await baseModel.execAndParse(
          baseModel.dbDriver.unionAll(
            ids.map((p) => {
              const query = baseModel
                .dbDriver(childTn)
                .count(`${chilCol?.column_name} as count`)
                .whereIn(
                  chilCol.column_name,
                  baseModel
                    .dbDriver(parentTn)
                    .select(parentCol.column_name)
                    // .where(parentTable.primaryKey.cn, p)
                    .where(_wherePk(parentTable.primaryKeys, p)),
                )
                .first();

              return baseModel.isSqlite
                ? baseModel.dbDriver.select().from(query)
                : query;
            }),
            !baseModel.isSqlite,
          ),
          null,
          { raw: true },
        );

        return children.map(({ count }) => count);
      } catch (e) {
        throw e;
      }
    },

    async hmList(
      {
        colId,
        id,
        apiVersion,
      }: {
        colId: string;
        id: any;
        apiVersion?: NcApiVersion;
        nested?: boolean;
      },
      args: { limit?; offset?; fieldSet?: Set<string> } = {},
    ) {
      try {
        const { where, sort, ...rest } = baseModel._getListArgs(args as any, {
          apiVersion,
          nested: true,
        });
        // todo: get only required fields

        const relColumn = (
          await baseModel.model.getColumns(baseModel.context)
        ).find((c) => c.id === colId);
        const relationColOpts = (await relColumn.getColOptions(
          baseModel.context,
        )) as LinkToAnotherRecordColumn;
        const chilCol = await relationColOpts.getChildColumn(baseModel.context);
        const childTable = await chilCol.getModel(baseModel.context);
        const parentCol = await relationColOpts.getParentColumn(
          baseModel.context,
        );
        const parentTable = await parentCol.getModel(baseModel.context);
        const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
          model: childTable,
          dbDriver: baseModel.dbDriver,
        });
        await parentTable.getColumns(baseModel.context);

        const childTn = childBaseModel.getTnPath(childTable);
        const parentTn = baseModel.getTnPath(parentTable);

        const qb = baseModel.dbDriver(childTn);

        await childTable.getViews(baseModel.context);
        const viewId =
          relColumn.colOptions?.fk_target_view_id ?? childTable.views?.[0]?.id;
        let view: View | null = null;
        if (viewId) view = await View.get(baseModel.context, viewId);

        qb.whereIn(
          chilCol.column_name,
          baseModel
            .dbDriver(parentTn)
            .select(parentCol.column_name)
            // .where(parentTable.primaryKey.cn, p)
            .where(_wherePk(parentTable.primaryKeys, id)),
        );
        // todo: sanitize
        qb.limit(+rest?.limit || 25);
        qb.offset(+rest?.offset || 0);

        await childBaseModel.selectObject({
          qb,
          fieldsSet: args.fieldSet,
        });

        await baseModel.applySortAndFilter({
          table: childTable,
          where,
          qb,
          sort,
          view,
          skipViewFilter: true,
        });

        const children = await baseModel.execAndParse(
          qb,
          await childTable.getColumns(baseModel.context),
        );

        const proto = await (
          await Model.getBaseModelSQL(baseModel.context, {
            id: childTable.id,
            dbDriver: baseModel.dbDriver,
          })
        ).getProto();

        return children.map((c) => {
          c.__proto__ = proto;
          return c;
        });
      } catch (e) {
        throw e;
      }
    },

    async hmListCount({ colId, id }, args) {
      try {
        // const { cn } = baseModel.hasManyRelations.find(({ tn }) => tn === child) || {};
        const { where } = baseModel._getListArgs(args as any);
        const relColumn = (
          await baseModel.model.getColumns(baseModel.context)
        ).find((c) => c.id === colId);
        const chilCol = await (
          (await relColumn.getColOptions(
            baseModel.context,
          )) as LinkToAnotherRecordColumn
        ).getChildColumn(baseModel.context);
        const childTable = await chilCol.getModel(baseModel.context);
        const parentCol = await (
          (await relColumn.getColOptions(
            baseModel.context,
          )) as LinkToAnotherRecordColumn
        ).getParentColumn(baseModel.context);
        const parentTable = await parentCol.getModel(baseModel.context);
        await parentTable.getColumns(baseModel.context);

        const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
          dbDriver: baseModel.dbDriver,
          model: childTable,
        });
        const childTn = childBaseModel.getTnPath(childTable);
        const parentTn = baseModel.getTnPath(parentTable);

        const query = baseModel
          .dbDriver(childTn)
          .count(`${chilCol?.column_name} as count`)
          .whereIn(
            chilCol.column_name,
            baseModel
              .dbDriver(parentTn)
              .select(parentCol.column_name)
              .where(_wherePk(parentTable.primaryKeys, id)),
          );
        const aliasColObjMap = await childTable.getAliasColObjMap(
          baseModel.context,
        );
        const { filters: filterObj } = extractFilterFromXwhere(
          baseModel.context,
          where,
          aliasColObjMap,
        );

        await conditionV2(
          // cast as any before further refactor
          baseModel as any,
          [
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and',
            }),
          ],
          query,
        );

        return (
          await baseModel.execAndParse(query, null, { raw: true, first: true })
        )?.count;
      } catch (e) {
        throw e;
      }
    },

    async multipleMmList(
      {
        colId,
        parentIds: _parentIds,
        apiVersion,
        nested = false,
      }: {
        colId: string;
        parentIds: any[];
        apiVersion?: NcApiVersion;
        nested?: boolean;
      },
      args: { limit?; offset?; fieldsSet?: Set<string> } = {},
    ) {
      // skip duplicate id
      const parentIds = [...new Set(_parentIds)];
      const { where, sort, ...rest } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      // const tn = baseModel.model.tn;
      // const cn = (await relColOptions.getChildColumn(baseModel.context)).title;
      const mmTable = await relColOptions.getMMModel(baseModel.context);

      // if mm table is not present then return
      if (!mmTable) {
        return;
      }

      const vtn = baseModel.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(baseModel.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(baseModel.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const parentTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      await parentTable.getColumns(baseModel.context);
      const childModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: childTable,
      });

      const childTn = baseModel.getTnPath(childTable);
      const parentTn = baseModel.getTnPath(parentTable);

      const rtn = childTn;
      const rtnId = childTable.id;

      const qb = baseModel
        .dbDriver(rtn)
        .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`);

      await childModel.selectObject({ qb, fieldsSet: args.fieldsSet });

      const view = relColOptions.fk_target_view_id
        ? await View.get(baseModel.context, relColOptions.fk_target_view_id)
        : await View.getDefaultView(baseModel.context, childTable.id);
      await baseModel.applySortAndFilter({
        table: childTable,
        where,
        qb,
        sort,
        view,
        skipViewFilter: true,
      });

      const finalQb = baseModel.dbDriver.unionAll(
        parentIds.map((id) => {
          const query = qb
            .clone()
            .whereIn(
              `${vtn}.${vcn}`,
              baseModel
                .dbDriver(parentTn)
                .select(cn)
                // .where(parentTable.primaryKey.cn, id)
                .where(_wherePk(parentTable.primaryKeys, id)),
            )
            .select(baseModel.dbDriver.raw('? as ??', [id, GROUP_COL]));
          // get one extra record to check if there are more records in case of v3 api and nested
          query.limit(
            (+rest?.limit || 25) +
              (apiVersion === NcApiVersion.V3 && nested ? 1 : 0),
          );
          query.offset(+rest?.offset || 0);
          return baseModel.isSqlite
            ? baseModel.dbDriver.select().from(query)
            : query;
        }),
        !baseModel.isSqlite,
      );

      const children = await baseModel.execAndParse(
        finalQb,
        await childTable.getColumns(baseModel.context),
      );

      const proto = await (
        await Model.getBaseModelSQL(baseModel.context, {
          id: rtnId,
          dbDriver: baseModel.dbDriver,
        })
      ).getProto();
      const gs = groupBy(
        children.map((c) => {
          c.__proto__ = proto;
          return c;
        }),
        GROUP_COL,
      );
      return _parentIds.map((id) => gs[id] || []);
    },

    async multipleMmListCount({ colId, parentIds }) {
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const mmTable = await relColOptions.getMMModel(baseModel.context);
      const vtn = baseModel.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(baseModel.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(baseModel.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const parentTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      await parentTable.getColumns(baseModel.context);

      const childTn = baseModel.getTnPath(childTable);
      const parentTn = baseModel.getTnPath(parentTable);

      const rtn = childTn;

      const qb = baseModel
        .dbDriver(rtn)
        .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
        // .select({
        //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
        // })
        .count(`${vtn}.${vcn}`, { as: 'count' });

      // await childModel.selectObject({ qb });
      const children = await baseModel.execAndParse(
        baseModel.dbDriver.unionAll(
          parentIds.map((id) => {
            const query = qb
              .clone()
              .whereIn(
                `${vtn}.${vcn}`,
                baseModel
                  .dbDriver(parentTn)
                  .select(cn)
                  // .where(parentTable.primaryKey.cn, id)
                  .where(_wherePk(parentTable.primaryKeys, id)),
              )
              .select(baseModel.dbDriver.raw('? as ??', [id, GROUP_COL]));
            // baseModel._paginateAndSort(query, { sort, limit, offset }, null, true);
            return baseModel.isSqlite
              ? baseModel.dbDriver.select().from(query)
              : query;
          }),
          !baseModel.isSqlite,
        ),
        null,
        { raw: true },
      );

      const gs = groupBy(children, GROUP_COL);
      return parentIds.map((id) => gs?.[id]?.[0] || []);
    },

    async mmListCount({ colId, parentId }, args) {
      const { where } = baseModel._getListArgs(args as any);

      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const mmTable = await relColOptions.getMMModel(baseModel.context);

      const assocBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        model: mmTable,
        dbDriver: baseModel.dbDriver,
      });

      const vtn = assocBaseModel.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(baseModel.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(baseModel.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);

      const parentTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      await parentTable.getColumns(baseModel.context);

      const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: childTable,
      });

      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = baseModel.getTnPath(parentTable);

      const rtn = childTn;

      const qb = baseModel
        .dbDriver(rtn)
        .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
        // .select({
        //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
        // })
        .count(`${vtn}.${vcn}`, { as: 'count' })
        .whereIn(
          `${vtn}.${vcn}`,
          baseModel
            .dbDriver(parentTn)
            .select(cn)
            // .where(parentTable.primaryKey.cn, id)
            .where(_wherePk(parentTable.primaryKeys, parentId)),
        );
      const aliasColObjMap = await childTable.getAliasColObjMap(
        baseModel.context,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      await conditionV2(
        // cast as any before further refactor
        baseModel as any,
        [
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );
      return (
        await baseModel.execAndParse(qb, null, { raw: true, first: true })
      )?.count;
    },

    async getMmChildrenExcludedListCount(
      { colId, pid = null },
      args,
    ): Promise<any> {
      const { where } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const mmTable = await relColOptions.getMMModel(baseModel.context);
      const assocBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        id: mmTable.id,
        dbDriver: baseModel.dbDriver,
      });

      const vtn = assocBaseModel.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(baseModel.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(baseModel.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);

      const childView = await relColOptions.getChildView(baseModel.context);
      let listArgs: any = {};
      if (childView) {
        const { dependencyFields } = await getAst(baseModel.context, {
          model: childTable,
          query: {},
          view: childView,
          throwErrorIfInvalidParams: false,
        });

        listArgs = dependencyFields;
        try {
          listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
        } catch (e) {}
        try {
          listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
        } catch (e) {}
      }

      const parentTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      await parentTable.getColumns(baseModel.context);

      const parentBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        id: parentTable.id,
        dbDriver: baseModel.dbDriver,
      });
      const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        id: childTable.id,
        dbDriver: baseModel.dbDriver,
      });
      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = parentBaseModel.getTnPath(parentTable);

      const rtn = childTn;
      const qb = baseModel
        .dbDriver(rtn)
        .count(`*`, { as: 'count' })
        .where((qb) => {
          qb.whereNotIn(
            rcn,
            baseModel
              .dbDriver(rtn)
              .select(`${rtn}.${rcn}`)
              .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
              .whereIn(
                `${vtn}.${vcn}`,
                baseModel
                  .dbDriver(parentTn)
                  .select(cn)
                  // .where(parentTable.primaryKey.cn, pid)
                  .where(_wherePk(parentTable.primaryKeys, pid)),
              ),
          ).orWhereNull(rcn);
        });

      const aliasColObjMap = await childTable.getAliasColObjMap(
        baseModel.context,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      await baseModel.getCustomConditionsAndApply({
        column: relColumn,
        view: childView,
        filters: filterObj,
        args,
        qb,
        rowId: pid,
      });

      return (
        await baseModel.execAndParse(
          qb,
          await childTable.getColumns(baseModel.context),
          {
            raw: true,
            first: true,
          },
        )
      )?.count;
    },

    async getMmChildrenExcludedList({ colId, pid = null }, args): Promise<any> {
      const { where, sort, ...rest } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const mmTable = await relColOptions.getMMModel(baseModel.context);
      const assocBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        id: mmTable.id,
        dbDriver: baseModel.dbDriver,
      });

      const vtn = assocBaseModel.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(baseModel.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(baseModel.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;

      const childTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const parentTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      await parentTable.getColumns(baseModel.context);
      const parentBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        id: parentTable.id,
        dbDriver: baseModel.dbDriver,
      });
      const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        id: childTable.id,
      });
      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = parentBaseModel.getTnPath(parentTable);

      const childView = await relColOptions.getChildView(
        baseModel.context,
        childTable,
      );
      let listArgs: any = {};
      if (childView) {
        const { dependencyFields } = await getAst(baseModel.context, {
          model: childTable,
          query: {},
          view: childView,
          throwErrorIfInvalidParams: false,
        });
        listArgs = dependencyFields;
      }

      const rtn = childTn;

      const qb = baseModel.dbDriver(rtn).where((qb) =>
        qb
          .whereNotIn(
            rcn,
            baseModel
              .dbDriver(rtn)
              .select(`${rtn}.${rcn}`)
              .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
              .whereIn(
                `${vtn}.${vcn}`,
                baseModel
                  .dbDriver(parentTn)
                  .select(cn)
                  // .where(parentTable.primaryKey.cn, pid)
                  .where(_wherePk(parentTable.primaryKeys, pid)),
              ),
          )
          .orWhereNull(rcn),
      );

      if (+rest?.shuffle) {
        await this.shuffle({ qb });
      }

      await childBaseModel.selectObject({
        qb,
        fieldsSet: listArgs?.fieldsSet,
        viewId: childView?.id,
      });

      const aliasColObjMap = await childTable.getAliasColObjMap(
        baseModel.context,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      await baseModel.getCustomConditionsAndApply({
        column: relColumn,
        view: relColOptions.fk_target_view_id ? childView : null,
        filters: filterObj,
        args,
        qb,
        rowId: pid,
      });

      await baseModel.applySortAndFilter({
        table: childTable,
        view: childView,
        qb,
        sort,
        where,
        // condition is applied in getCustomConditionsAndApply and we don't want to apply it again
        onlySort: true,
      });

      applyPaginate(qb, rest);

      const proto = await childBaseModel.getProto();
      const data = await baseModel.execAndParse(
        qb,
        await childTable.getColumns(baseModel.context),
      );
      return data.map((c) => {
        c.__proto__ = proto;
        return c;
      });
    },

    async getHmChildrenExcludedList({ colId, pid = null }, args): Promise<any> {
      const { where, sort, ...rest } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      const parentTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: childTable,
      });
      const parentBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: parentTable,
      });
      await parentTable.getColumns(baseModel.context);

      const childView = await relColOptions.getChildView(
        baseModel.context,
        childTable,
      );

      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = parentBaseModel.getTnPath(parentTable);

      const tn = childTn;
      const rtn = parentTn;

      const qb = baseModel.dbDriver(tn).where((qb) => {
        qb.whereNotIn(
          cn,
          baseModel
            .dbDriver(rtn)
            .select(rcn)
            // .where(parentTable.primaryKey.cn, pid)
            .where(_wherePk(parentTable.primaryKeys, pid)),
        ).orWhereNull(cn);
      });

      if (+rest?.shuffle) {
        await this.shuffle({ qb });
      }

      await childBaseModel.selectObject({ qb });

      const aliasColObjMap = await childTable.getAliasColObjMap(
        baseModel.context,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );
      await baseModel.getCustomConditionsAndApply({
        column: relColumn,
        view: relColOptions.fk_target_view_id ? childView : null,
        filters: filterObj,
        args,
        qb,
        rowId: pid,
      });
      await baseModel.applySortAndFilter({
        table: childTable,
        view: childView,
        qb,
        sort,
        where,
        // condition is applied in getCustomConditionsAndApply and we don't want to apply it again
        onlySort: true,
      });

      applyPaginate(qb, rest);

      const proto = await childBaseModel.getProto();
      const data = await baseModel.execAndParse(
        qb,
        await childTable.getColumns(baseModel.context),
      );
      return data.map((c) => {
        c.__proto__ = proto;
        return c;
      });
    },

    async getHmChildrenExcludedListCount(
      { colId, pid = null },
      args,
    ): Promise<any> {
      const { where } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);

      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      const parentTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);

      const childView = await relColOptions.getChildView(baseModel.context);

      const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: childTable,
      });

      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = baseModel.getTnPath(parentTable);

      const tn = childTn;
      const rtn = parentTn;
      await parentTable.getColumns(baseModel.context);

      const qb = baseModel
        .dbDriver(tn)
        .count(`*`, { as: 'count' })
        .where((qb) => {
          qb.whereNotIn(
            cn,
            baseModel
              .dbDriver(rtn)
              .select(rcn)
              // .where(parentTable.primaryKey.cn, pid)
              .where(_wherePk(parentTable.primaryKeys, pid)),
          ).orWhereNull(cn);
        });

      const aliasColObjMap = await childTable.getAliasColObjMap(
        baseModel.context,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      await baseModel.getCustomConditionsAndApply({
        column: relColumn,
        view: childView,
        filters: filterObj,
        args,
        qb,
        rowId: pid,
      });

      return (
        await baseModel.execAndParse(qb, null, { raw: true, first: true })
      )?.count;
    },

    async getExcludedOneToOneChildrenList(
      { colId, cid = null },
      args,
    ): Promise<any> {
      const { where, sort, ...rest } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const parentTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      const parentModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: parentTable,
      });
      const childModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: childTable,
      });

      // one-to-one relation is combination of both hm and bt to identify table which have
      // foreign key column(similar to bt) we are adding a boolean flag `bt` under meta
      const isBt = relColumn.meta?.bt;

      const targetView = await relColOptions.getChildView(
        baseModel.context,
        isBt ? parentTable : childTable,
      );
      let listArgs: any = {};
      if (targetView) {
        const { dependencyFields } = await getAst(baseModel.context, {
          model: isBt ? parentTable : childTable,
          query: {},
          view: targetView,
          throwErrorIfInvalidParams: false,
        });
        listArgs = dependencyFields;
      }

      const rtn = baseModel.getTnPath(parentTable);
      const tn = baseModel.getTnPath(childTable);
      await childTable.getColumns(baseModel.context);

      const qb = baseModel.dbDriver(isBt ? rtn : tn).where((qb) => {
        qb.whereNotIn(
          isBt ? rcn : cn,
          baseModel
            .dbDriver(isBt ? tn : rtn)
            .select(isBt ? cn : rcn)
            .where(_wherePk((isBt ? childTable : parentTable).primaryKeys, cid))
            .whereNotNull(isBt ? cn : rcn),
        ).orWhereNull(isBt ? rcn : cn);
      });

      if (+rest?.shuffle) {
        await this.shuffle({ qb });
      }

      // pre-load columns for later user
      await parentTable.getColumns(baseModel.context);
      await childTable.getColumns(baseModel.context);

      await (isBt ? parentModel : childModel).selectObject({
        qb,
        fieldsSet: listArgs.fieldsSet,
        viewId: targetView?.id,
      });

      // extract col-alias map based on the correct relation table
      const aliasColObjMap = await (relColumn.meta?.bt
        ? parentTable
        : childTable
      ).getAliasColObjMap(baseModel.context);
      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      await baseModel.getCustomConditionsAndApply({
        column: relColumn,
        view: relColOptions.fk_target_view_id ? targetView : null,
        filters: filterObj,
        args,
        qb,
        rowId: cid,
      });

      await baseModel.applySortAndFilter({
        table: isBt ? parentTable : childTable,
        view: targetView,
        qb,
        sort,
        where,
        // condition is applied in getCustomConditionsAndApply and we don't want to apply it again
        onlySort: true,
      });

      applyPaginate(qb, rest);

      const proto = await (isBt ? parentModel : childModel).getProto();
      const data = await baseModel.execAndParse(
        qb,
        await (isBt ? parentTable : childTable).getColumns(baseModel.context),
      );

      return data.map((c) => {
        c.__proto__ = proto;
        return c;
      });
    },

    async getBtChildrenExcludedListCount(
      { colId, cid = null },
      args,
    ): Promise<any> {
      const { where } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const parentTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);

      const parentBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: parentTable,
      });

      const childTn = baseModel.getTnPath(childTable);
      const parentTn = parentBaseModel.getTnPath(parentTable);

      const rtn = parentTn;
      const tn = childTn;
      await childTable.getColumns(baseModel.context);

      const qb = baseModel
        .dbDriver(rtn)
        .where((qb) => {
          qb.whereNotIn(
            rcn,
            baseModel
              .dbDriver(tn)
              .select(cn)
              // .where(childTable.primaryKey.cn, cid)
              .where(_wherePk(childTable.primaryKeys, cid))
              .whereNotNull(cn),
          );
        })
        .count(`*`, { as: 'count' });

      const aliasColObjMap = await parentTable.getAliasColObjMap(
        baseModel.context,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      const targetView = await relColOptions.getChildView(baseModel.context);

      await baseModel.getCustomConditionsAndApply({
        column: relColumn,
        view: targetView,
        filters: filterObj,
        args,
        qb,
        rowId: cid,
      });

      return (
        await baseModel.execAndParse(qb, null, { raw: true, first: true })
      )?.count;
    },

    async countExcludedOneToOneChildren(
      { colId, cid = null },
      args,
    ): Promise<any> {
      const { where } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const parentTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);

      const childView = await relColOptions.getChildView(baseModel.context);
      const parentBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: parentTable,
      });
      const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: childTable,
      });
      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = parentBaseModel.getTnPath(parentTable);

      const rtn = parentTn;
      const tn = childTn;

      // pre-load columns for later user
      await childTable.getColumns(baseModel.context);
      await parentTable.getColumns(baseModel.context);

      // one-to-one relation is combination of both hm and bt to identify table which have
      // foreign key column(similar to bt) we are adding a boolean flag `bt` under meta
      const isBt = relColumn.meta?.bt;

      const qb = baseModel
        .dbDriver(isBt ? rtn : tn)
        .where((qb) => {
          qb.whereNotIn(
            isBt ? rcn : cn,
            baseModel
              .dbDriver(isBt ? tn : rtn)
              .select(isBt ? cn : rcn)
              .where(
                _wherePk((isBt ? childTable : parentTable).primaryKeys, cid),
              )
              .whereNotNull(isBt ? cn : rcn),
          ).orWhereNull(isBt ? rcn : cn);
        })
        .count(`*`, { as: 'count' });

      // extract col-alias map based on the correct relation table
      const aliasColObjMap = await (relColumn.meta?.bt
        ? parentTable
        : childTable
      ).getAliasColObjMap(baseModel.context);

      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      await baseModel.getCustomConditionsAndApply({
        column: relColumn,
        view: childView,
        filters: filterObj,
        args,
        qb,
        rowId: cid,
      });

      return (
        await baseModel.execAndParse(qb, null, { raw: true, first: true })
      )?.count;
    },

    async getBtChildrenExcludedList({ colId, cid = null }, args): Promise<any> {
      const { where, sort, ...rest } = baseModel._getListArgs(args as any);
      const relColumn = (
        await baseModel.model.getColumns(baseModel.context)
      ).find((c) => c.id === colId);
      const relColOptions = (await relColumn.getColOptions(
        baseModel.context,
      )) as LinkToAnotherRecordColumn;

      const rcn = (await relColOptions.getParentColumn(baseModel.context))
        .column_name;
      const parentTable = await (
        await relColOptions.getParentColumn(baseModel.context)
      ).getModel(baseModel.context);
      const cn = (await relColOptions.getChildColumn(baseModel.context))
        .column_name;
      const childTable = await (
        await relColOptions.getChildColumn(baseModel.context)
      ).getModel(baseModel.context);
      const parentBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        dbDriver: baseModel.dbDriver,
        model: parentTable,
      });

      const childTn = baseModel.getTnPath(childTable);
      const parentTn = parentBaseModel.getTnPath(parentTable);

      const rtn = parentTn;
      const tn = childTn;
      await childTable.getColumns(baseModel.context);

      const qb = baseModel.dbDriver(rtn).where((qb) => {
        qb.whereNotIn(
          rcn,
          baseModel
            .dbDriver(tn)
            .select(cn)
            // .where(childTable.primaryKey.cn, cid)
            .where(_wherePk(childTable.primaryKeys, cid))
            .whereNotNull(cn),
        );
      });

      if (+rest?.shuffle) {
        await this.shuffle({ qb });
      }

      await parentBaseModel.selectObject({ qb });

      const aliasColObjMap = await parentTable.getAliasColObjMap(
        baseModel.context,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      const targetView = await relColOptions.getChildView(
        baseModel.context,
        parentTable,
      );
      await baseModel.getCustomConditionsAndApply({
        column: relColumn,
        view: relColOptions.fk_target_view_id ? targetView : null,
        filters: filterObj,
        args,
        qb,
        rowId: cid,
      });

      await baseModel.applySortAndFilter({
        table: parentTable,
        view: targetView,
        qb,
        sort,
        where,
        // condition is applied in getCustomConditionsAndApply and we don't want to apply it again
        onlySort: true,
      });

      applyPaginate(qb, rest);

      const proto = await parentBaseModel.getProto();
      const data = await baseModel.execAndParse(
        qb,
        await parentTable.getColumns(baseModel.context),
      );

      return data.map((c) => {
        c.__proto__ = proto;
        return c;
      });
    },
  };
};
