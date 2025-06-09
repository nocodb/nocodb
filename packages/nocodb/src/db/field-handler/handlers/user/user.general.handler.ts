import type { Logger } from '@nestjs/common';
import type { NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { MetaService } from '~/meta/meta.service';
import type { Filter } from '~/models';
import type { FilterOptions } from '../../field-handler.interface';
import { handleCurrentUserFilter } from '~/helpers/conditionHelpers';
import { getColumnName } from '~/helpers/dbHelpers';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { NcBaseErrorv2, NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { BaseUser, type Column } from '~/models';

export class UserGeneralHandler extends GenericFieldHandler {
  protected singleLineTextHandler: GenericFieldHandler =
    new GenericFieldHandler();

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

    const finalStatement = this.replaceDelimitedWithKeyValue({
      knex,
      needleColumn: sourceField,
      stack: users.map((user) => ({
        key: user.id,
        value: user.display_name || user.email,
      })),
    });

    if (filter.comparison_op === 'like') {
      return this.singleLineTextHandler.filterLike(
        { val, sourceField: finalStatement },
        rootArgs,
        options,
      );
    } else {
      return this.singleLineTextHandler.filterNlike(
        { val, sourceField: finalStatement },
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
