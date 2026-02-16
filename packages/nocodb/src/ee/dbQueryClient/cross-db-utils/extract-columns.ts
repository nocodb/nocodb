import { type NcApiVersion, UITypes } from 'nocodb-sdk';
import type { ExtractColumnFunc } from '~/ee/dbQueryClient/types';
import type { XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { BaseUser, type Column, type Model } from '~/models';
import { ROOT_ALIAS } from '~/utils';

export function extractColumns({
  extractColumn,
}: {
  extractColumn: ExtractColumnFunc;
}) {
  return async function ({
    columns,
    // allowedCols,
    knex,
    qb,
    getAlias,
    params,
    // dependencyFields,
    alias = ROOT_ALIAS,
    baseModel,
    ast,
    throwErrorIfInvalidParams,
    validateFormula,
    apiVersion,
  }: {
    columns: Column[];
    // allowedCols?: Record<string, boolean>;
    knex: XKnex;
    qb;
    getAlias: () => string;
    params: any;
    alias?: string;
    baseModel: IBaseModelSqlV2;
    // dependencyFields: DependantFields;
    ast: Record<string, any> | boolean | 0 | 1;
    throwErrorIfInvalidParams: boolean;
    validateFormula: boolean;
    apiVersion: NcApiVersion;
  }) {
    // since this operation is meta-heavy,
    // we set context to true
    const lastUseCache = baseModel.context.cache;
    baseModel.context.cache = true;

    const extractPromises = [];

    const baseUsers = await BaseUser.getUsersList(baseModel.context, {
      base_id: baseModel.model.base_id,
    });

    const model: Model = baseModel.model;

    await model.getColumns(baseModel.context);

    const aliasToColumn = {};
    const columnIdToUidt: Record<string, UITypes> = {};

    const firstFormula = columns.find(
      (col) =>
        col.uidt === UITypes.Formula &&
        (ast === true || ast === 1 || (ast?.[col.title] ?? ast?.[col.id])),
    );

    if (firstFormula) {
      await extractColumn({
        column: firstFormula,
        knex,
        rootAlias: alias,
        qb,
        getAlias,
        params: {
            ...params?.nested?.[firstFormula.title],
            linksAsLtar: params?.linksAsLtar,
          },
        baseModel,
        ast: ast?.[firstFormula.title] ?? ast?.[firstFormula.id],
        throwErrorIfInvalidParams,
        validateFormula,
        columns,
        apiVersion,
        model,
        aliasToColumn,
        columnIdToUidt,
        baseUsers,
      });
    }

    for (const column of columns) {
      if (column.id === firstFormula?.id) continue;

      if (
        // if ast is `true` then extract primary key and primary value
        !((ast === true || ast === 1) && (column.pv || column.pk)) &&
        !(ast?.[column.title] ?? ast?.[column.id])
      )
        continue;

      // skip meta column
      if (column.uidt === UITypes.Meta) continue;

      extractPromises.push(
        extractColumn({
          column,
          knex,
          rootAlias: alias,
          qb,
          getAlias,
          params: {
            ...params?.nested?.[column.title],
            linksAsLtar: params?.linksAsLtar,
          },
          baseModel,
          ast: ast?.[column.title] ?? ast?.[column.id],
          throwErrorIfInvalidParams,
          validateFormula,
          columns,
          apiVersion,
          model,
          aliasToColumn,
          columnIdToUidt,
          baseUsers,
        }),
      );
    }

    await Promise.all(extractPromises);
    // we reset the use cache
    baseModel.context.cache = lastUseCache;
  };
}
