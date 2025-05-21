import { Injectable } from '@nestjs/common';
import { AppEvents, ProjectRoles, ViewTypes } from 'nocodb-sdk';
import type {
  SharedViewReqType,
  UserType,
  ViewUpdateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  BaseUser,
  CustomUrl,
  Model,
  ModelRoleVisibility,
  User,
  View,
} from '~/models';

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
        id: string;
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
      // if (
      //   view.lock_type === ViewLockType.Personal &&
      //   view.owned_by !== param.user.id &&
      //   !(!view.owned_by && !param.user.base_roles?.[ProjectRoles.OWNER])
      // ) {
      //   return false;
      // }

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
      context,
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
        NcError.unauthorized('Only owner/creator can change to personal view');
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

    // handle view ownership transfer
    if (ownedBy && param.view.owned_by && ownedBy !== param.view.owned_by) {
      // extract user roles and allow creator and owner to change to personal view
      if (
        param.user.id !== ownedBy &&
        !(param.user as any).base_roles?.[ProjectRoles.OWNER] &&
        !(param.user as any).base_roles?.[ProjectRoles.CREATOR]
      ) {
        NcError.unauthorized('Only owner/creator can transfer view ownership');
      }

      ownedBy = param.view.owned_by;

      // verify if the new owned_by is a valid user who have access to the base/workspace
      // if not then throw error
      const baseUser = await BaseUser.get(
        context,
        context.base_id,
        param.view.owned_by,
      );

      if (!baseUser) {
        NcError.badRequest('Invalid user');
      }

      includeCreatedByAndUpdateBy = true;
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

    let owner = param.req.user;

    if (ownedBy && ownedBy !== param.req.user?.id) {
      owner = await User.get(ownedBy);
    }

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view: {
        ...oldView,
        ...param.view,
      },
      oldView,
      user: param.user,
      req: param.req,
      context,
      owner,
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

    let deleteEvent = AppEvents.GRID_DELETE;

    //  decide event based on type
    if (view.type === ViewTypes.FORM) {
      deleteEvent = AppEvents.FORM_DELETE;
    } else if (view.type === ViewTypes.CALENDAR) {
      deleteEvent = AppEvents.CALENDAR_DELETE;
    } else if (view.type === ViewTypes.GALLERY) {
      deleteEvent = AppEvents.GALLERY_DELETE;
    } else if (view.type === ViewTypes.KANBAN) {
      deleteEvent = AppEvents.KANBAN_DELETE;
    } else if (view.type === ViewTypes.MAP) {
      deleteEvent = AppEvents.MAP_DELETE;
    }

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksService.emit(deleteEvent, {
      view,
      user: param.user,
      owner,
      req: param.req,
      context,
    });

    return true;
  }

  async shareViewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      sharedView: SharedViewReqType & {
        custom_url_path?: string;
      };
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

    let customUrl: CustomUrl | undefined = await CustomUrl.get({
      view_id: view.id,
      id: view.fk_custom_url_id,
    });

    // Update an existing custom URL if it exists
    if (customUrl?.id) {
      const original_path = await View.getSharedViewPath(context, view.id);

      if (param.sharedView.custom_url_path) {
        // Prepare updated fields conditionally
        const updates: Partial<CustomUrl> = {
          original_path,
        };

        if (param.sharedView.custom_url_path !== undefined) {
          updates.custom_path = param.sharedView.custom_url_path;
        }

        // Perform the update if there are changes
        if (Object.keys(updates).length > 0) {
          await CustomUrl.update(view.fk_custom_url_id, updates);
        }
      } else if (param.sharedView.custom_url_path !== undefined) {
        // Delete the custom URL if only the custom path is undefined
        await CustomUrl.delete({ id: view.fk_custom_url_id as string });
        customUrl = undefined;
      }
    } else if (param.sharedView.custom_url_path) {
      // Insert a new custom URL if it doesn't exist

      const original_path = await View.getSharedViewPath(context, view.id);

      customUrl = await CustomUrl.insert({
        fk_workspace_id: view.fk_workspace_id,
        base_id: view.base_id,
        fk_model_id: view.fk_model_id,
        view_id: view.id,
        original_path,
        custom_path: param.sharedView.custom_url_path,
      });
    }

    const result = await View.update(context, param.viewId, {
      ...param.sharedView,
      fk_custom_url_id: customUrl?.id ?? null,
    });

    this.appHooksService.emit(AppEvents.SHARED_VIEW_UPDATE, {
      user: param.user,
      sharedView: { ...view, ...param.sharedView },
      oldSharedView: { ...view },
      view,
      req: param.req,
      context,
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
      context,
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
