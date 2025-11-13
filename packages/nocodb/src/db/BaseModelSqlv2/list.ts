import { extractFilterFromXwhere, isOrderCol, UITypes } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { NcApiVersion } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import {
  _wherePk,
  applyPaginate,
  extractSortsObject,
  haveFormulaColumn,
} from '~/helpers/dbHelpers';
import { Filter, Sort } from '~/models';
import { chunkArray } from '~/utils/tsUtils';

export const baseModelList = ({
  baseModel,
  logger,
}: {
  baseModel: IBaseModelSqlV2;
  logger: Logger;
}) => {
  async function list(
    args: {
      where?: string;
      limit?;
      offset?;
      filterArr?: Filter[];
      sortArr?: Sort[];
      sort?: string | string[];
      fieldsSet?: Set<string>;
      limitOverride?: number;
      pks?: string;
      customConditions?: Filter[];
      apiVersion?: NcApiVersion;
    } = {},
    options: {
      ignoreViewFilterAndSort?: boolean;
      ignorePagination?: boolean;
      validateFormula?: boolean;
      throwErrorIfInvalidParams?: boolean;
      limitOverride?: number;
      skipSubstitutingColumnIds?: boolean;
      skipSortBasedOnOrderCol?: boolean;
    } = {},
  ): Promise<any> {
    const {
      ignoreViewFilterAndSort = false,
      ignorePagination = false,
      validateFormula = false,
      throwErrorIfInvalidParams = false,
      limitOverride,
      skipSortBasedOnOrderCol = false,
    } = options;

    const columns = await baseModel.model.getColumns(baseModel.context);

    const { where, fields, ...rest } = baseModel._getListArgs(args as any);

    const qb = baseModel.dbDriver(baseModel.tnPath);

    await baseModel.selectObject({
      qb,
      fieldsSet: args.fieldsSet,
      viewId: baseModel.viewId,
      validateFormula,
      columns,
    });
    if (+rest?.shuffle) {
      await baseModel.shuffle({ qb });
    }

    const aliasColObjMap = await baseModel.model.getAliasColObjMap(
      baseModel.context,
      columns,
    );
    let sorts = extractSortsObject(
      baseModel.context,
      rest?.sort,
      aliasColObjMap,
      throwErrorIfInvalidParams,
      args?.apiVersion,
    );
    const { filters: filterObj } = extractFilterFromXwhere(
      baseModel.context,
      where,
      aliasColObjMap,
      throwErrorIfInvalidParams,
    );
    // todo: replace with view id
    if (!ignoreViewFilterAndSort && baseModel.viewId) {
      await conditionV2(
        baseModel,
        [
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children:
              (await Filter.rootFilterList(baseModel.context, {
                viewId: baseModel.viewId,
              })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );

      if (!sorts)
        sorts = args.sortArr?.length
          ? args.sortArr
          : await Sort.list(baseModel.context, { viewId: baseModel.viewId });

      await sortV2(baseModel, sorts, qb, undefined, throwErrorIfInvalidParams);
    } else {
      await conditionV2(
        baseModel,
        [
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );

      if (!sorts) sorts = args.sortArr;

      await sortV2(baseModel, sorts, qb, undefined, throwErrorIfInvalidParams);
    }

    // skip sorting based on order column if specified in options
    if (!skipSortBasedOnOrderCol) {
      const orderColumn = columns.find((c) => isOrderCol(c));

      // sort by order column if present
      if (orderColumn) {
        qb.orderBy(orderColumn.column_name);
      }
    }

    // Ensure stable ordering:
    // - Use auto-increment PK if available
    // - Otherwise, fallback to system CreatedTime
    // this avoids issues when order column has duplicates
    if (baseModel.model.primaryKey && baseModel.model.primaryKey.ai) {
      qb.orderBy(baseModel.model.primaryKey.column_name);
    } else {
      const createdCol = baseModel.model.columns.find(
        (c) => c.uidt === UITypes.CreatedTime && c.system,
      );
      if (createdCol) qb.orderBy(createdCol.column_name);
    }

    if (rest.pks) {
      const pks = rest.pks.split(',');
      qb.where((innerQb) => {
        pks.forEach((pk) => {
          innerQb.orWhere(_wherePk(baseModel.model.primaryKeys, pk));
        });
        return innerQb;
      });
    }

    // if limitOverride is provided, use it as limit for the query (for internal usage eg. calendar, export)
    if (!ignorePagination) {
      if (!limitOverride) {
        applyPaginate(qb, rest);
      } else {
        applyPaginate(qb, { ...rest, limit: limitOverride });
      }
    }
    const proto = await baseModel.getProto();

    let data;
    try {
      data = await baseModel.execAndParse(qb, undefined, {
        apiVersion: args.apiVersion ?? baseModel.context.api_version,
        skipSubstitutingColumnIds: options.skipSubstitutingColumnIds,
      });
    } catch (e) {
      if (validateFormula || !haveFormulaColumn(columns)) throw e;
      logger.log(e);
      return baseModel.list(args, {
        ignoreViewFilterAndSort,
        ignorePagination,
        validateFormula: true,
      });
    }

    return data?.map((d) => {
      d.__proto__ = proto;
      return d;
    });
  }
  async function chunkList(args: {
    pks: string[];
    chunkSize?: number;
    apiVersion?: NcApiVersion;
    args?: Record<string, any>;
  }) {
    const { pks, chunkSize = 1000 } = args;

    const data = [];

    const chunkedPks = chunkArray(pks, chunkSize);

    for (const chunk of chunkedPks) {
      const chunkData = await baseModel.list(
        {
          pks: chunk.join(','),
          apiVersion: args.apiVersion,
          ...(args.args || {}),
        },
        {
          limitOverride: chunk.length,
          ignoreViewFilterAndSort: true,
        },
      );

      data.push(...chunkData);
    }

    return data;
  }

  return {
    list,
    chunkList,
  };
};
