type RolePermissionEntry =
  | string
  | { include?: Record<string, boolean>; exclude?: Record<string, boolean> };

// Own properties only, so an inherited name is never a grant or a deny.
export function roleAllowsPermission(
  entry: RolePermissionEntry | undefined,
  permission: string,
): boolean {
  if (!entry) return false;
  if (entry === '*') return true;
  if (typeof entry !== 'object') return false;
  if (entry.exclude) {
    return !(
      Object.hasOwn(entry.exclude, permission) && entry.exclude[permission]
    );
  }
  return !!(
    entry.include &&
    Object.hasOwn(entry.include, permission) &&
    entry.include[permission]
  );
}
