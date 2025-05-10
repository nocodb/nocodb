import { NcError } from 'src/helpers/catchError';
import { extractProps } from 'src/helpers/extractProps';
import type { Logger } from '@nestjs/common';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { BaseUser, type Column } from '~/models';

export class UserGeneralHandler extends GenericFieldHandler {
  override async parseValue(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: {
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

    const baseUsers = await BaseUser.getUsersList(params.baseModel.context, {
      base_id: params.baseModel.model.base_id,
      // deleted user may still exists on some fields
      // it's still valid as a historical record
      include_ws_deleted: true,
    });

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
              });
            }
            userIds.push(u.id);
          } else {
            NcError.invalidValueForField({
              value: params.value,
              column: params.column.title,
              type: params.column.uidt,
            });
          }
        } catch (e) {
          NcError.invalidValueForField({
            value: params.value,
            column: params.column.title,
            type: params.column.uidt,
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
              });
            }
            userIds.push(u.id);
          }
        } catch (e) {
          NcError.invalidValueForField({
            value: params.value,
            column: params.column.title,
            type: params.column.uidt,
          });
        }
      }
    } else {
      params.options.logger.error(`${evalValue} is not a valid user input`);
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
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
          });
        } else {
          evalValue = userIds[0];
        }
      }
    }
    return { value: evalValue };
  }
}
