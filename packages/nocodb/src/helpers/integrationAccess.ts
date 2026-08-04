/**
 * A private integration's decrypted connection config may only be read or
 * cloned by its creator. Mirrors the ownership check in
 * base-integrations.service.ts.
 *
 * @returns true when access must be denied.
 */
export function isPrivateIntegrationForbidden(
  isPrivate: boolean | null | undefined,
  createdBy: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!isPrivate) return false;
  return createdBy !== userId;
}
