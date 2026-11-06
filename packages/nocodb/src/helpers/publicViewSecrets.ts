import {
  extractRolesObj,
  NC_VIEW_PASSWORD_PROTECTED_SENTINEL,
  ProjectRoles,
} from 'nocodb-sdk';

// `Model.getWithInfo` hydrates `views` with the stored view rows, so a
// password-protected sibling share's uuid + bcrypt hash rides along to whoever
// receives the model. Return a copy — the argument is a cached instance.
export function withoutViewSecrets<T extends { views?: any[] }>(model: T): T {
  if (!model?.views?.length) return model;

  return Object.assign(Object.create(Object.getPrototypeOf(model)), model, {
    views: model.views.map((view) =>
      Object.assign(Object.create(Object.getPrototypeOf(view)), view, {
        password: undefined,
        uuid: undefined,
      }),
    ),
  });
}

type ShareCaller = {
  id?: string;
  base_roles?: string | Record<string, boolean> | null;
  isPublicBase?: boolean;
};

// Base members who may create or edit a view's share link (`shareView` ACL).
export function canManageViewShare(user?: ShareCaller): boolean {
  if (!user || user.isPublicBase) return false;
  const roles = extractRolesObj(user.base_roles);
  return !!(
    roles?.[ProjectRoles.OWNER] ||
    roles?.[ProjectRoles.CREATOR] ||
    roles?.[ProjectRoles.EDITOR]
  );
}

// A view row in a view list or table meta. The stored share password (bcrypt
// or legacy plaintext) never leaves: share managers get the sentinel when one
// is set, others get nothing, and only share managers get the share uuid.
export function viewWithoutShareSecrets<
  T extends { password?: string | null; uuid?: string | null },
>(view: T, canManageShare: boolean): T {
  if (!view) return view;
  return Object.assign(Object.create(Object.getPrototypeOf(view)), view, {
    password:
      canManageShare && view.password
        ? NC_VIEW_PASSWORD_PROTECTED_SENTINEL
        : undefined,
    uuid: canManageShare ? view.uuid : undefined,
  });
}

// Realtime broadcasts reach the whole base room whatever each member's role,
// so a view row leaves without its share uuid and stored password at all.
export function viewForBroadcast<T extends object>(view: T): T {
  if (!view) return view;
  const copy = Object.assign(Object.create(Object.getPrototypeOf(view)), view);
  delete copy.uuid;
  delete copy.password;
  return copy;
}

// A table (or column event's table) hydrated with its `views`.
export function tableForBroadcast<T extends { views?: any[] }>(table: T): T {
  if (!table?.views?.length) return table;
  return Object.assign(Object.create(Object.getPrototypeOf(table)), table, {
    views: table.views.map((view) => viewForBroadcast(view)),
  });
}
