import { Injectable } from '@nestjs/common';
import { AppEvents, ProjectRoles } from 'nocodb-sdk';
import type {
  SharedViewReqType,
  UserType,
  ViewUpdateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Model, ModelRoleVisibility, View } from '~/models';
import {WorkspaceUser} from "~/ee/models";

// todo: move
async function xcVisibilityMetaGet(
  context: NcContext,
  param: {
    baseId: string;
    includeM2M?: boolean;
    models?: Model[];
  },
) {
  const { includeM2M = true, baseId, models: _models } = param ?? {};

  // todo: move to
  const roles = ['owner', 'creator', 'viewer', 'editor', 'commenter', 'guest'];

  const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

  let models =
    _models ||
    (await Model.list(context, {
      base_id: baseId,
      source_id: undefined,
    }));

  models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

  const result = await models.reduce(async (_obj, model) => {
    const obj = await _obj;

    const views = await model.getViews(context);
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

  const disabledList = await ModelRoleVisibility.list(context, baseId);

  for (const d of disabledList) {
    if (result[d.fk_view_id])
      result[d.fk_view_id].disabled[d.role] = !!d.disabled;
  }

  return Object.values(result);
}

@Injectable()
export class ViewsService {
  constructor(private appHooksService: AppHooksService) {}

  async viewList(
    context: NcContext,
    param: {
      tableId: string;
      user: {
        roles?: Record<string, boolean> | string;
        base_roles?: Record<string, boolean>;
      };
    },
  ) {
    const model = await Model.get(context, param.tableId);

    if (!model) {
      NcError.tableNotFound(param.tableId);
    }

    const viewList = await xcVisibilityMetaGet(context, {
      baseId: model.base_id,
      models: [model],
    });

    // todo: user roles
    //await View.list(param.tableId)
    const filteredViewList = viewList.filter((view: any) => {
      return Object.values(ProjectRoles).some(
        (role) => param?.user?.['base_roles']?.[role] && !view.disabled[role],
      );
    });

    return filteredViewList;
  }

  async shareView(
    context: NcContext,
    param: { viewId: string; user: UserType; req: NcRequest },
  ) {
    const res = await View.share(context, param.viewId);

    const view = await View.get(context, param.viewId);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    this.appHooksService.emit(AppEvents.SHARED_VIEW_CREATE, {
      user: param.user,
      view,
      req: param.req,
    });

    return res;
  }

  async viewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      view: ViewUpdateReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewUpdateReq',
      param.view,
    );
    const oldView = await View.get(context, param.viewId);

    if (!oldView) {
      NcError.viewNotFound(param.viewId);
    }

    let ownedBy = oldView.owned_by;
    let createdBy = oldView.created_by;
    let includeCreatedByAndUpdateBy = false;

    // check if the lock_type changing to `personal` and only allow if user is the owner
    // if the owned_by is not the same as the user, then throw error
    // if owned_by is empty, then only allow owner of project to change
    if (
      param.view.lock_type === 'personal' &&
      param.view.lock_type !== oldView.lock_type
    ) {
      // if owned_by is not empty then check if the user is the owner of the project
      if (ownedBy && ownedBy !== param.user.id) {
        NcError.unauthorized('Only owner can change to personal view');
      }

      // if empty then check if current user is the owner of the project then allow and update the owned_by
      if (!ownedBy && (param.user as any).base_roles?.[ProjectRoles.OWNER]) {
        includeCreatedByAndUpdateBy = true;
        ownedBy = param.user.id;
        if (!createdBy) {
          createdBy = param.user.id;
        }
      } else if (!ownedBy) {
        // todo: move to catchError
        NcError.unauthorized('Only owner can change to personal view');
      }
    }

    if(ownedBy && param.view.owned_by && param.user.id === ownedBy) {
      ownedBy = param.view.owned_by

      // verify if the new owned_by is a valid user who have access to the base/workspace
      // if not then throw error
      const baseUser = await BaseUser.get(context,param.view.owned_by, context.base_id);

      if(!baseUser){
        NcError.badRequest('Invalid user');
      }

      // // todo: ee only
      // if(!baseUser) {
      //   const workspace = await WorkspaceUser
      // }
    }

    const result = await View.update(
      context,
      param.viewId,
      {
        ...param.view,
        owned_by: ownedBy,
        created_by: createdBy,
      },
      includeCreatedByAndUpdateBy,
    );

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view: {
        ...oldView,
        ...param.view,
      },
      user: param.user,

      req: param.req,
    });
    return result;
  }

  async viewDelete(
    context: NcContext,
    param: { viewId: string; user: UserType; req: NcRequest },
  ) {
    const view = await View.get(context, param.viewId);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    await View.delete(context, param.viewId);

    this.appHooksService.emit(AppEvents.VIEW_DELETE, {
      view,
      user: param.user,
      req: param.req,
    });

    return true;
  }

  async shareViewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      sharedView: SharedViewReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/SharedViewReq',
      param.sharedView,
    );

    const view = await View.get(context, param.viewId);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    const result = await View.update(context, param.viewId, param.sharedView);

    this.appHooksService.emit(AppEvents.SHARED_VIEW_UPDATE, {
      user: param.user,
      view,
      req: param.req,
    });

    return result;
  }

  async shareViewDelete(
    context: NcContext,
    param: {
      viewId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    const view = await View.get(context, param.viewId);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }
    await View.sharedViewDelete(context, param.viewId);

    this.appHooksService.emit(AppEvents.SHARED_VIEW_DELETE, {
      user: param.user,
      view,
      req: param.req,
    });

    return true;
  }

  async showAllColumns(
    context: NcContext,
    param: { viewId: string; ignoreIds?: string[] },
  ) {
    await View.showAllColumns(context, param.viewId, param.ignoreIds || []);
    return true;
  }

  async hideAllColumns(
    context: NcContext,
    param: { viewId: string; ignoreIds?: string[] },
  ) {
    await View.hideAllColumns(context, param.viewId, param.ignoreIds || []);
    return true;
  }

  async shareViewList(context: NcContext, param: { tableId: string }) {
    return await View.shareViewList(context, param.tableId);
  }
}
