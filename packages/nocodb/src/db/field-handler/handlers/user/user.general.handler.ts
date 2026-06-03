import type { Logger } from '@nestjs/common';
import type { NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { MetaService } from '~/meta/meta.service';
import type { Filter } from '~/models';
import type { FilterOptions, SortOptions } from '../../field-handler.interface';
import { handleCurrentUserFilter } from '~/helpers/conditionHelpers';
import { getColumnName } from '~/helpers/dbHelpers';
import { sanitize } from '~/helpers/sqlSanitize';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { NcBaseErrorv2, NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { BaseUser, type Column } from '~/models';

export class UserGeneralHandler extends GenericFieldHandler {
  protected singleLineTextHandler: GenericFieldHandler =
    new GenericFieldHandler();

  // For MySQL/MSSQL (and any dialect without a specific User handler),
  // `like`/`nlike` against a User-style column needs the user-id → display-name
  // substitution so the filter matches against the visible name. The
  // dialect-specific PG/SQLite handlers override these to use their own
  // GROUP_CONCAT/string_agg-based replace functions.
  override filterLike = (...args: Parameters<typeof this.filterLikeNlike>) =>
    this.filterLikeNlike(...args);
  override filterNlike = (...args: Parameters<typeof this.filterLikeNlike>) =>
    this.filterLikeNlike(...args);

  /**
   * Shared SQL expression that maps the stored user-ID column to its
   * display-name representation via nested REPLACE() chained over a given
   * user list. Used by `filterLikeNlike` (with a pre-filtered user list)
   * and `applySort` (with all base users) — both need the column to read
   * as display-text, not as a raw user-id.
   *
   * The dialect-specific User handlers (`UserPgHandler`, `UserSqliteHandler`)
   * override `replaceDelimitedWithKeyValue` to use their own
   * `replace_delimited_with_keyvalue` SQL function for efficiency. The
   * MySQL/MSSQL default uses native nested REPLACE().
   */
  protected async buildDisplayNameExpression(
    knex: CustomKnex,
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder,
    users: Awaited<ReturnType<typeof BaseUser.getUsersList>>,
  ): Promise<string> {
    return this.replaceDelimitedWithKeyValue({
      knex,
      needleColumn,
      stack: users.map((user) => ({
        key: user.id,
        value: user.display_name || user.email,
      })),
    });
  }

  /**
   * Sort User/CreatedBy/LastModifiedBy by display name. Stored values are
   * comma-delimited user-ids; nested REPLACE() (or the PG/SQLite
   * `replace_delimited_with_keyvalue` function in dialect overrides) maps
   * each id to its display-name before the ORDER BY.
   */
  override async applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options: SortOptions,
  ): Promise<void> {
    const { nulls, context } = options;
    const knex = options.knex as CustomKnex;

    // For CreatedBy / LastModifiedBy the persisted column name may differ
    // from `column.column_name` (auto-magic columns). Resolve into a local —
    // never mutate the shared/cached `Column`, which would overwrite its
    // metadata for the rest of the request (legacy sortV2 never mutated).
    const columnName = await getColumnName(context, column);

    const baseUsers = await BaseUser.getUsersList(context, {
      base_id: column.base_id,
      include_internal_user: true,
    });
    const expr = await this.buildDisplayNameExpression(
      knex,
      columnName,
      baseUsers,
    );
    qb.orderBy(sanitize(knex.raw(expr)), direction, nulls);
  }

  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    const { alias, context } = options;
    let val = filter.value;
    const field =
      options.customWhereClause ??
      (alias ? `${alias}.${column.column_name}` : column.column_name);

    handleCurrentUserFilter(context, {
      column,
      filter,
      setVal: (newVal) => (val = newVal),
    });
    return await this.handleFilter(
      { val, sourceField: field },
      { knex, filter, column },
      options,
    );
  }

  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
    };
  }): Promise<{ value: any }> {
    const userIds: string[] = [];
    let evalValue: any = params.value;
    if (typeof evalValue === 'string' && /^\s*[{[]/.test(evalValue)) {
      try {
        evalValue = JSON.parse(evalValue);
      } catch (e) {}
    }

    const baseUsers = await BaseUser.getUsersList(
      params.options.context ?? params.options.baseModel.context,
      {
        base_id: params.options.baseModel.model.base_id,
        // deleted user may still exists on some fields
        // it's still valid as a historical record
        include_ws_deleted: true,
        include_internal_user: true,
      },
    );

    if (typeof evalValue === 'object') {
      const users: { id?: string; email?: string }[] = Array.isArray(evalValue)
        ? evalValue
        : [evalValue];
      for (const userObj of users) {
        const user = extractProps(userObj, ['id', 'email']);
        try {
          if ('id' in user) {
            const u = baseUsers.find((u) => u.id === user.id);
            if (!u) {
              NcError.invalidValueForField({
                value: params.value,
                column: params.column.title,
                type: params.column.uidt,
                reason: `User with id '${user.id}' is not part of this workspace`,
              });
            }
            userIds.push(u.id);
          } else if ('email' in user) {
            // skip null input
            if (!user.email) continue;
            // trim extra spaces
            user.email = user.email.trim();
            // skip empty input
            if (user.email.length === 0) continue;
            const u = baseUsers.find((u) => u.email === user.email);
            if (!u) {
              NcError.invalidValueForField({
                value: params.value,
                column: params.column.title,
                type: params.column.uidt,
                reason: `User with email '${user.email}' is not part of this workspace`,
              });
            }
            userIds.push(u.id);
          } else {
            NcError.invalidValueForField({
              value: params.value,
              column: params.column.title,
              type: params.column.uidt,
              reason: `Invalid user object`,
            });
          }
        } catch (e) {
          NcError.invalidValueForField({
            value: params.value,
            column: params.column.title,
            type: params.column.uidt,
            reason: e.message,
          });
        }
      }
    } else if (typeof evalValue === 'string') {
      const users = evalValue.split(',').map((u) => u.trim());
      for (const user of users) {
        try {
          if (user.length === 0) continue;
          if (user.includes('@')) {
            const u = baseUsers.find((u) => u.email === user);
            if (!u) {
              NcError.invalidValueForField({
                value: params.value,
                column: params.column.title,
                type: params.column.uidt,
                reason: `User with email '${user}' is not part of this workspace`,
              });
            }
            userIds.push(u.id);
          } else {
            const u = baseUsers.find((u) => u.id === user);
            if (!u) {
              NcError.invalidValueForField({
                value: params.value,
                column: params.column.title,
                type: params.column.uidt,
                reason: `User with id '${user}' is not part of this workspace`,
              });
            }
            userIds.push(u.id);
          }
        } catch (e) {
          if (e instanceof NcBaseErrorv2) {
            throw e;
          }
          NcError.invalidValueForField({
            value: params.value,
            column: params.column.title,
            type: params.column.uidt,
            reason: e.message,
          });
        }
      }
    } else {
      params.options.logger.error(`${evalValue} is not a valid user input`);
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
        reason: `Invalid user object`,
      });
    }

    if (userIds.length === 0) {
      evalValue = null;
    } else {
      const userSet = new Set(userIds);

      if (userSet.size !== userIds.length) {
        NcError.invalidValueForField({
          value: params.value,
          column: params.column.title,
          type: params.column.uidt,
          reason: 'Duplicate users not allowed for user field',
        });
      }

      if (params.column.meta?.is_multi) {
        evalValue = userIds.join(',');
      } else {
        if (userIds.length > 1) {
          NcError.invalidValueForField({
            value: params.value,
            column: params.column.title,
            type: params.column.uidt,
            reason: `Multiple users not allowed for '${params.column.title}'`,
          });
        } else {
          evalValue = userIds[0];
        }
      }
    }
    return { value: evalValue };
  }

  async filterLikeNlike(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ) {
    const { sourceField } = args;
    const { val } = args;
    const { knex, filter, column } = rootArgs;
    const { context } = options;

    // get column name for CreatedBy, LastModifiedBy
    column.column_name = await getColumnName(context, column);

    const baseUsers = await BaseUser.getUsersList(context, {
      base_id: column.base_id,
      include_internal_user: true,
    });
    const users = baseUsers.filter((user) => {
      const filterVal = val.toLowerCase();

      if (filterVal.startsWith('%') && filterVal.endsWith('%')) {
        return (user.display_name || user.email)
          .toLowerCase()
          .includes(filterVal.substring(1, filterVal.length - 1));
      } else if (filterVal.startsWith('%')) {
        return (user.display_name || user.email)
          .toLowerCase()
          .endsWith(filterVal.substring(1));
      } else if (filterVal.endsWith('%')) {
        return (user.display_name || user.email)
          .toLowerCase()
          .startsWith(filterVal.substring(0, filterVal.length - 1));
      }

      return (user.display_name || user.email)
        .toLowerCase()
        .includes(filterVal.toLowerCase());
    });

    const finalStatement = await this.buildDisplayNameExpression(
      knex,
      sourceField,
      users,
    );

    if (filter.comparison_op === 'like') {
      return this.singleLineTextHandler.filterLike(
        { val, sourceField: knex.raw(finalStatement) },
        rootArgs,
        options,
      );
    } else {
      return this.singleLineTextHandler.filterNlike(
        { val, sourceField: knex.raw(finalStatement) },
        rootArgs,
        options,
      );
    }
  }

  replaceDelimitedWithKeyValue(param: {
    knex: CustomKnex;
    stack: { key: string; value: string }[];
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder;
    delimiter?: string;
  }) {
    const { knex, needleColumn, stack } = param;
    return stack.reduce((acc, each) => {
      const qb = knex.raw(`REPLACE(${acc}, ?, ?)`, [each.key, each.value]);
      return qb.toQuery();
    }, knex.raw(`??`, [needleColumn]).toQuery());
  }
}
