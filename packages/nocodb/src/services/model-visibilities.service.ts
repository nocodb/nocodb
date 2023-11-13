import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { VisibilityRuleReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Base, Model, ModelRoleVisibility, View } from '~/models';

@Injectable()
export class ModelVisibilitiesService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async xcVisibilityMetaSetAll(param: {
    visibilityRule: VisibilityRuleReqType;
    baseId: string;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/VisibilityRuleReq',
      param.visibilityRule,
    );

    const base = await Base.getWithInfo(param.baseId);

    if (!base) {
      NcError.badRequest('Base not found');
    }

    for (const d of param.visibilityRule) {
      for (const role of Object.keys(d.disabled)) {
        const view = await View.get(d.id);

        if (view.base_id !== param.baseId) {
          NcError.badRequest('View does not belong to the base');
        }

        const dataInDb = await ModelRoleVisibility.get({
          role,
          fk_view_id: d.id,
        });
        if (dataInDb) {
          if (d.disabled[role]) {
            if (!dataInDb.disabled) {
              await ModelRoleVisibility.update(d.id, role, {
                disabled: d.disabled[role],
              });
            }
          } else {
            await dataInDb.delete();
          }
        } else if (d.disabled[role]) {
          await ModelRoleVisibility.insert({
            fk_view_id: d.id,
            disabled: d.disabled[role],
            role,
          });
        }
      }
    }
    this.appHooksService.emit(AppEvents.UI_ACL_UPDATE, {
      base,
      req: param.req,
    });

    return true;
  }

  async xcVisibilityMetaGet(param: {
    baseId: string;
    includeM2M?: boolean;
    models?: Model[];
  }) {
    const { includeM2M = true, baseId, models: _models } = param ?? {};

    // todo: move to
    const roles = [
      'owner',
      'creator',
      'viewer',
      'editor',
      'commenter',
      'guest',
    ];

    const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

    let models =
      _models ||
      (await Model.list({
        base_id: baseId,
        source_id: undefined,
      }));

    models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

    const result = await models.reduce(async (_obj, model) => {
      const obj = await _obj;

      const views = await model.getViews();
      for (const view of views) {
        obj[view.id] = {
          ptn: model.table_name,
          _ptn: model.title,
          ptype: model.type,
          tn: view.title,
          _tn: view.title,
          table_meta: model.meta,
          ...view,
          disabled: { ...defaultDisabled },
        };
      }

      return obj;
    }, Promise.resolve({}));

    const disabledList = await ModelRoleVisibility.list(baseId);

    for (const d of disabledList) {
      if (result[d.fk_view_id])
        result[d.fk_view_id].disabled[d.role] = !!d.disabled;
    }

    return Object.values(result);
  }
}
