import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { UIAclEvent } from '~/services/app-hooks/interfaces';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Base, Model, ColumnRoleVisibility, Column } from '~/models';

export interface ColumnVisibilityRuleReqType {
  id: string;
  disabled: Record<string, boolean>;
}

@Injectable()
export class ColumnVisibilitiesService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async xcVisibilityMetaSetAll(
    context: NcContext,
    param: {
      visibilityRule: ColumnVisibilityRuleReqType[];
      baseId: string;
      tableId: string;
      req: NcRequest;
    },
  ) {
    // TODO: Add swagger validation once schema is updated
    // validatePayload(
    //   'swagger.json#/components/schemas/ColumnVisibilityRuleReq',
    //   param.visibilityRule,
    // );

    const base = await Base.getWithInfo(context, param.baseId);

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    // Verify table exists and belongs to base
    const model = await Model.getByIdOrName(context, { id: param.tableId });
    if (model.base_id !== param.baseId) {
      NcError.badRequest('Table does not belong to the base');
    }

    for (const d of param.visibilityRule) {
      for (const role of Object.keys(d.disabled)) {
        const column = await Column.get(context, { colId: d.id });

        if (column.fk_model_id !== param.tableId) {
          NcError.badRequest('Column does not belong to the table');
        }

        const dataInDb = await ColumnRoleVisibility.get(context, {
          role,
          fk_column_id: d.id,
        });
        if (dataInDb) {
          if (d.disabled[role]) {
            if (!dataInDb.disabled) {
              await ColumnRoleVisibility.update(context, d.id, role, {
                disabled: d.disabled[role],
              });
            }
          } else {
            await dataInDb.delete(context);
          }
        } else if (d.disabled[role]) {
          await ColumnRoleVisibility.insert(context, {
            fk_column_id: d.id,
            disabled: d.disabled[role],
            role,
          });
        }
        if (!!d.disabled[role] !== !!dataInDb?.disabled) {
          // Emit hook for UI ACL change
          this.appHooksService.emit(AppEvents.UI_ACL, {
            base,
            req: param.req,
            context,
            model,
            column,
            role,
            disabled: !!d.disabled[role],
          } as UIAclEvent);
        }
      }
    }

    return true;
  }

  async xcVisibilityMetaGet(
    context: NcContext,
    param: {
      baseId?: string;
      tableId: string;
    },
  ) {
    const { tableId } = param;

    // Get the model/table
    const model = await Model.getByIdOrName(context, { id: tableId });
    if (!model) {
      NcError.tableNotFound(tableId);
    }

    // Use the model's base_id
    const baseId = model.base_id;

    const roles = ['owner', 'creator', 'editor', 'commenter', 'viewer'];

    const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

    const columns = await Column.list(context, {
      fk_model_id: tableId,
    });

    const result = columns.reduce((obj, column) => {
      obj[column.id] = {
        id: column.id,
        column_name: column.column_name,
        title: column.title,
        uidt: column.uidt,
        disabled: { ...defaultDisabled },
      };
      return obj;
    }, {});

    const disabledList = await ColumnRoleVisibility.list(context, baseId);

    for (const d of disabledList) {
      if (result[d.fk_column_id]) {
        result[d.fk_column_id].disabled[d.role] = !!d.disabled;
      }
    }

    return Object.values(result);
  }
}
