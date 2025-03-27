import { extractFilterFromXwhere, NcApiVersion } from 'nocodb-sdk';
import groupBy from 'lodash/groupBy';
import type { Logger } from '@nestjs/common';
import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import type { LinkToAnotherRecordColumn } from '~/models';
import { _wherePk } from '~/helpers/dbHelpers';
import { Filter, Model, View } from '~/models';
import sortV2 from '~/db/sortV2';
import conditionV2 from '~/db/conditionV2';

const GROUP_COL = '__nc_group_id';

export const relationListCount = (param: {
  baseModel: IBaseModelSqlV2;
  logger: Logger;
}) => {
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

        const { where, sort, ...rest } = this._getListArgs(args as any);
        // todo: get only required fields
        const relColumn = (await this.model.getColumns(this.context)).find(
          (c) => c.id === colId,
        );

        const relationColOpts = (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn;
        const chilCol = await relationColOpts.getChildColumn(this.context);
        const childTable = await chilCol.getModel(this.context);
        const parentCol = await relationColOpts.getParentColumn(this.context);
        const parentTable = await parentCol.getModel(this.context);
        const childModel = await Model.getBaseModelSQL(this.context, {
          model: childTable,
          dbDriver: this.dbDriver,
        });
        await parentTable.getColumns(this.context);

        const childTn = this.getTnPath(childTable);
        const parentTn = this.getTnPath(parentTable);

        const qb = this.dbDriver(childTn);
        await childModel.selectObject({
          qb,
          extractPkAndPv: true,
          fieldsSet: args.fieldsSet,
        });
        const view = relationColOpts.fk_target_view_id
          ? await View.get(this.context, relationColOpts.fk_target_view_id)
          : await View.getDefaultView(this.context, childModel.model.id);
        await this.applySortAndFilter({
          table: childTable,
          where,
          qb,
          sort,
          view,
          skipViewFilter: true,
        });
        const childQb = this.dbDriver.queryBuilder().from(
          this.dbDriver
            .unionAll(
              ids.map((p) => {
                const query = qb
                  .clone()
                  .select(this.dbDriver.raw('? as ??', [p, GROUP_COL]))
                  .whereIn(
                    chilCol.column_name,
                    this.dbDriver(parentTn)
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

                return this.isSqlite
                  ? this.dbDriver.select().from(query)
                  : query;
              }),
              !this.isSqlite,
            )
            .as('list'),
        );

        const children = await this.execAndParse(
          childQb,
          await childTable.getColumns(this.context),
        );
        const proto = await (
          await Model.getBaseModelSQL(this.context, {
            id: childTable.id,
            dbDriver: this.dbDriver,
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
      const { where, sort, ...rest } = this._getListArgs(args as any, {
        apiVersion,
        nested: true,
      });
      const relColumn = (await this.model.getColumns(this.context)).find(
        (c) => c.id === colId,
      );
      const relColOptions = (await relColumn.getColOptions(
        this.context,
      )) as LinkToAnotherRecordColumn;

      // const tn = this.model.tn;
      // const cn = (await relColOptions.getChildColumn()).title;
      const mmTable = await relColOptions.getMMModel(this.context);
      const vtn = this.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(this.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(this.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(this.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(this.context)).column_name;
      const childTable = await (
        await relColOptions.getParentColumn(this.context)
      ).getModel(this.context);
      const parentTable = await (
        await relColOptions.getChildColumn(this.context)
      ).getModel(this.context);
      await parentTable.getColumns(this.context);
      const childModel = await Model.getBaseModelSQL(this.context, {
        dbDriver: this.dbDriver,
        model: childTable,
      });

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const rtn = childTn;
      const rtnId = childTable.id;

      const qb = this.dbDriver(rtn)
        .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
        .whereIn(
          `${vtn}.${vcn}`,
          this.dbDriver(parentTn)
            .select(cn)
            // .where(parentTable.primaryKey.cn, id)
            .where(_wherePk(parentTable.primaryKeys, parentId)),
        );

      await childModel.selectObject({
        qb,
        fieldsSet: args.fieldsSet,
      });

      await childTable.getViews(this.context);
      const viewId =
        relColumn.colOptions?.fk_target_view_id ?? childTable.views?.[0]?.id;
      let view: View | null = null;
      if (viewId) view = await View.get(this.context, viewId);
      await this.applySortAndFilter({
        table: childTable,
        where,
        view,
        qb,
        sort,
        skipViewFilter: true,
      });

      if (!sort || sort === '') {
        const view = relColOptions.fk_target_view_id
          ? await View.get(this.context, relColOptions.fk_target_view_id)
          : await View.getDefaultView(this.context, childTable.id);
        const childSorts = await view.getSorts(this.context);
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

      const children = await this.execAndParse(
        qb,
        await childTable.getColumns(this.context),
      );
      const proto = await (
        await Model.getBaseModelSQL(this.context, {
          id: rtnId,
          dbDriver: this.dbDriver,
        })
      ).getProto();

      return children.map((c) => {
        c.__proto__ = proto;
        return c;
      });
    },

    async multipleHmListCount({ colId, ids }) {
      try {
        // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
        const relColumn = (await this.model.getColumns(this.context)).find(
          (c) => c.id === colId,
        );
        const chilCol = await (
          (await relColumn.getColOptions(
            this.context,
          )) as LinkToAnotherRecordColumn
        ).getChildColumn(this.context);
        const childTable = await chilCol.getModel(this.context);
        const parentCol = await (
          (await relColumn.getColOptions(
            this.context,
          )) as LinkToAnotherRecordColumn
        ).getParentColumn(this.context);
        const parentTable = await parentCol.getModel(this.context);
        await parentTable.getColumns(this.context);

        const childTn = this.getTnPath(childTable);
        const parentTn = this.getTnPath(parentTable);

        const children = await this.execAndParse(
          this.dbDriver.unionAll(
            ids.map((p) => {
              const query = this.dbDriver(childTn)
                .count(`${chilCol?.column_name} as count`)
                .whereIn(
                  chilCol.column_name,
                  this.dbDriver(parentTn)
                    .select(parentCol.column_name)
                    // .where(parentTable.primaryKey.cn, p)
                    .where(_wherePk(parentTable.primaryKeys, p)),
                )
                .first();

              return this.isSqlite ? this.dbDriver.select().from(query) : query;
            }),
            !this.isSqlite,
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
        const { where, sort, ...rest } = this._getListArgs(args as any, {
          apiVersion,
          nested: true,
        });
        // todo: get only required fields

        const relColumn = (await this.model.getColumns(this.context)).find(
          (c) => c.id === colId,
        );
        const relationColOpts = (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn;
        const chilCol = await relationColOpts.getChildColumn(this.context);
        const childTable = await chilCol.getModel(this.context);
        const parentCol = await relationColOpts.getParentColumn(this.context);
        const parentTable = await parentCol.getModel(this.context);
        const childBaseModel = await Model.getBaseModelSQL(this.context, {
          model: childTable,
          dbDriver: this.dbDriver,
        });
        await parentTable.getColumns(this.context);

        const childTn = childBaseModel.getTnPath(childTable);
        const parentTn = this.getTnPath(parentTable);

        const qb = this.dbDriver(childTn);

        await childTable.getViews(this.context);
        const viewId =
          relColumn.colOptions?.fk_target_view_id ?? childTable.views?.[0]?.id;
        let view: View | null = null;
        if (viewId) view = await View.get(this.context, viewId);

        qb.whereIn(
          chilCol.column_name,
          this.dbDriver(parentTn)
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

        await this.applySortAndFilter({
          table: childTable,
          where,
          qb,
          sort,
          view,
          skipViewFilter: true,
        });

        const children = await this.execAndParse(
          qb,
          await childTable.getColumns(this.context),
        );

        const proto = await (
          await Model.getBaseModelSQL(this.context, {
            id: childTable.id,
            dbDriver: this.dbDriver,
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
        // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
        const { where } = this._getListArgs(args as any);
        const relColumn = (await this.model.getColumns(this.context)).find(
          (c) => c.id === colId,
        );
        const chilCol = await (
          (await relColumn.getColOptions(
            this.context,
          )) as LinkToAnotherRecordColumn
        ).getChildColumn(this.context);
        const childTable = await chilCol.getModel(this.context);
        const parentCol = await (
          (await relColumn.getColOptions(
            this.context,
          )) as LinkToAnotherRecordColumn
        ).getParentColumn(this.context);
        const parentTable = await parentCol.getModel(this.context);
        await parentTable.getColumns(this.context);

        const childBaseModel = await Model.getBaseModelSQL(this.context, {
          dbDriver: this.dbDriver,
          model: childTable,
        });
        const childTn = childBaseModel.getTnPath(childTable);
        const parentTn = this.getTnPath(parentTable);

        const query = this.dbDriver(childTn)
          .count(`${chilCol?.column_name} as count`)
          .whereIn(
            chilCol.column_name,
            this.dbDriver(parentTn)
              .select(parentCol.column_name)
              .where(_wherePk(parentTable.primaryKeys, id)),
          );
        const aliasColObjMap = await childTable.getAliasColObjMap(this.context);
        const { filters: filterObj } = extractFilterFromXwhere(
          this.context,
          where,
          aliasColObjMap,
        );

        await conditionV2(
          this,
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
          await this.execAndParse(query, null, { raw: true, first: true })
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
      const { where, sort, ...rest } = this._getListArgs(args as any);
      const relColumn = (await this.model.getColumns(this.context)).find(
        (c) => c.id === colId,
      );
      const relColOptions = (await relColumn.getColOptions(
        this.context,
      )) as LinkToAnotherRecordColumn;

      // const tn = this.model.tn;
      // const cn = (await relColOptions.getChildColumn(this.context)).title;
      const mmTable = await relColOptions.getMMModel(this.context);

      // if mm table is not present then return
      if (!mmTable) {
        return;
      }

      const vtn = this.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(this.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(this.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(this.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(this.context)).column_name;
      const childTable = await (
        await relColOptions.getParentColumn(this.context)
      ).getModel(this.context);
      const parentTable = await (
        await relColOptions.getChildColumn(this.context)
      ).getModel(this.context);
      await parentTable.getColumns(this.context);
      const childModel = await Model.getBaseModelSQL(this.context, {
        dbDriver: this.dbDriver,
        model: childTable,
      });

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const rtn = childTn;
      const rtnId = childTable.id;

      const qb = this.dbDriver(rtn).join(
        vtn,
        `${vtn}.${vrcn}`,
        `${rtn}.${rcn}`,
      );

      await childModel.selectObject({ qb, fieldsSet: args.fieldsSet });

      const view = relColOptions.fk_target_view_id
        ? await View.get(this.context, relColOptions.fk_target_view_id)
        : await View.getDefaultView(this.context, childTable.id);
      await this.applySortAndFilter({
        table: childTable,
        where,
        qb,
        sort,
        view,
        skipViewFilter: true,
      });

      const finalQb = this.dbDriver.unionAll(
        parentIds.map((id) => {
          const query = qb
            .clone()
            .whereIn(
              `${vtn}.${vcn}`,
              this.dbDriver(parentTn)
                .select(cn)
                // .where(parentTable.primaryKey.cn, id)
                .where(_wherePk(parentTable.primaryKeys, id)),
            )
            .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));
          // get one extra record to check if there are more records in case of v3 api and nested
          query.limit(
            (+rest?.limit || 25) +
              (apiVersion === NcApiVersion.V3 && nested ? 1 : 0),
          );
          query.offset(+rest?.offset || 0);
          return this.isSqlite ? this.dbDriver.select().from(query) : query;
        }),
        !this.isSqlite,
      );

      const children = await this.execAndParse(
        finalQb,
        await childTable.getColumns(this.context),
      );

      const proto = await (
        await Model.getBaseModelSQL(this.context, {
          id: rtnId,
          dbDriver: this.dbDriver,
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
      const relColumn = (await this.model.getColumns(this.context)).find(
        (c) => c.id === colId,
      );
      const relColOptions = (await relColumn.getColOptions(
        this.context,
      )) as LinkToAnotherRecordColumn;

      const mmTable = await relColOptions.getMMModel(this.context);
      const vtn = this.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(this.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(this.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(this.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(this.context)).column_name;
      const childTable = await (
        await relColOptions.getParentColumn(this.context)
      ).getModel(this.context);
      const parentTable = await (
        await relColOptions.getChildColumn(this.context)
      ).getModel(this.context);
      await parentTable.getColumns(this.context);

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const rtn = childTn;

      const qb = this.dbDriver(rtn)
        .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
        // .select({
        //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
        // })
        .count(`${vtn}.${vcn}`, { as: 'count' });

      // await childModel.selectObject({ qb });
      const children = await this.execAndParse(
        this.dbDriver.unionAll(
          parentIds.map((id) => {
            const query = qb
              .clone()
              .whereIn(
                `${vtn}.${vcn}`,
                this.dbDriver(parentTn)
                  .select(cn)
                  // .where(parentTable.primaryKey.cn, id)
                  .where(_wherePk(parentTable.primaryKeys, id)),
              )
              .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));
            // this._paginateAndSort(query, { sort, limit, offset }, null, true);
            return this.isSqlite ? this.dbDriver.select().from(query) : query;
          }),
          !this.isSqlite,
        ),
        null,
        { raw: true },
      );

      const gs = groupBy(children, GROUP_COL);
      return parentIds.map((id) => gs?.[id]?.[0] || []);
    },

    async mmListCount({ colId, parentId }, args) {
      const { where } = this._getListArgs(args as any);

      const relColumn = (await this.model.getColumns(this.context)).find(
        (c) => c.id === colId,
      );
      const relColOptions = (await relColumn.getColOptions(
        this.context,
      )) as LinkToAnotherRecordColumn;

      const mmTable = await relColOptions.getMMModel(this.context);

      const assocBaseModel = await Model.getBaseModelSQL(this.context, {
        model: mmTable,
        dbDriver: this.dbDriver,
      });

      const vtn = assocBaseModel.getTnPath(mmTable);
      const vcn = (await relColOptions.getMMChildColumn(this.context))
        .column_name;
      const vrcn = (await relColOptions.getMMParentColumn(this.context))
        .column_name;
      const rcn = (await relColOptions.getParentColumn(this.context))
        .column_name;
      const cn = (await relColOptions.getChildColumn(this.context)).column_name;
      const childTable = await (
        await relColOptions.getParentColumn(this.context)
      ).getModel(this.context);

      const parentTable = await (
        await relColOptions.getChildColumn(this.context)
      ).getModel(this.context);
      await parentTable.getColumns(this.context);

      const childBaseModel = await Model.getBaseModelSQL(this.context, {
        dbDriver: this.dbDriver,
        model: childTable,
      });

      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const rtn = childTn;

      const qb = this.dbDriver(rtn)
        .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
        // .select({
        //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
        // })
        .count(`${vtn}.${vcn}`, { as: 'count' })
        .whereIn(
          `${vtn}.${vcn}`,
          this.dbDriver(parentTn)
            .select(cn)
            // .where(parentTable.primaryKey.cn, id)
            .where(_wherePk(parentTable.primaryKeys, parentId)),
        );
      const aliasColObjMap = await childTable.getAliasColObjMap(this.context);
      const { filters: filterObj } = extractFilterFromXwhere(
        this.context,
        where,
        aliasColObjMap,
      );

      await conditionV2(
        this,
        [
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );
      return (await this.execAndParse(qb, null, { raw: true, first: true }))
        ?.count;
    },
  };
};
