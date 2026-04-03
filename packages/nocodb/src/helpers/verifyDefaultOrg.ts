import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import {
  MetaTable,
  NC_DEFAULT_ORG_ID,
  NC_STORE_DEFAULT_ORG_ID_KEY,
  RootScopes,
} from '~/utils/globals';
import { isOnPrem } from '~/utils';
import Noco from '~/Noco';

const logger = new Logger('verifyDefaultOrg');

/**
 * Ensures a default org exists for on-prem / CE instances.
 * Cloud manages orgs explicitly — this is a no-op there.
 *
 * Follows the same pattern as verifyDefaultWorkspace().
 */
export const verifyDefaultOrg = async (ncMeta = Noco.ncMeta) => {
  // Cloud EE manages orgs explicitly — skip
  if (Noco.isEE() && !isOnPrem) {
    return;
  }

  // Already cached
  if (Noco.ncDefaultOrgId) {
    return;
  }

  // Check nc_store for persisted org ID
  const storedOrgId = await ncMeta.metaGet(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.STORE,
    {
      key: NC_STORE_DEFAULT_ORG_ID_KEY,
    },
  );

  if (storedOrgId?.value) {
    Noco.ncDefaultOrgId = storedOrgId.value;
    return;
  }

  // Check if org already exists in DB (e.g., created by migration)
  const existingOrg = await ncMeta
    .knexConnection(MetaTable.ORG)
    .where('id', NC_DEFAULT_ORG_ID)
    .first();

  if (existingOrg) {
    // Persist to store and cache
    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.STORE,
      {
        key: NC_STORE_DEFAULT_ORG_ID_KEY,
        value: existingOrg.id,
      },
      true,
    );
    Noco.ncDefaultOrgId = existingOrg.id;
    return;
  }

  // Find super user to set as org owner
  const superUser = await ncMeta
    .knexConnection(MetaTable.USERS)
    .where('roles', 'like', '%super%')
    .first();

  // No user yet — defer to next call (signup will trigger it)
  if (!superUser) {
    return;
  }

  // Create default org with fixed ID "nc"
  await ncMeta.knexConnection(MetaTable.ORG).insert({
    id: NC_DEFAULT_ORG_ID,
    title: 'Default Organization',
    fk_user_id: superUser.id,
    deleted: false,
  });

  // Add super user as org owner
  await ncMeta.knexConnection(MetaTable.ORG_USERS).insert({
    fk_org_id: NC_DEFAULT_ORG_ID,
    fk_user_id: superUser.id,
    roles: EnterpriseOrgUserRoles.ADMIN,
  });

  // Link default workspace to this org (if it exists and isn't already linked)
  if (Noco.ncDefaultWorkspaceId) {
    await ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .where('id', Noco.ncDefaultWorkspaceId)
      .whereNull('fk_org_id')
      .update({ fk_org_id: NC_DEFAULT_ORG_ID });
  }

  // Link any other workspaces with no org
  await ncMeta
    .knexConnection(MetaTable.WORKSPACE)
    .whereNull('fk_org_id')
    .update({ fk_org_id: NC_DEFAULT_ORG_ID });

  // Persist to store
  await ncMeta.metaInsert2(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.STORE,
    {
      key: NC_STORE_DEFAULT_ORG_ID_KEY,
      value: NC_DEFAULT_ORG_ID,
    },
    true,
  );

  Noco.ncDefaultOrgId = NC_DEFAULT_ORG_ID;

  logger.log('Default organization created');
};

/**
 * Ensures a user has an entry in the default org.
 * Used for on-prem user signup / invite.
 */
export const ensureUserInDefaultOrg = async (
  userId: string,
  role: EnterpriseOrgUserRoles = EnterpriseOrgUserRoles.VIEWER,
  ncMeta = Noco.ncMeta,
) => {
  // Cloud EE manages org membership via its own service
  if (Noco.isEE() && !isOnPrem) return;

  if (!Noco.ncDefaultOrgId) {
    await verifyDefaultOrg(ncMeta);
  }
  if (!Noco.ncDefaultOrgId) return;

  try {
    // Check if already exists
    const existing = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', Noco.ncDefaultOrgId)
      .where('fk_user_id', userId)
      .first();

    if (existing) return;

    await ncMeta.knexConnection(MetaTable.ORG_USERS).insert({
      fk_org_id: Noco.ncDefaultOrgId,
      fk_user_id: userId,
      roles: role,
    });
  } catch {
    // Already in org — ignore duplicate
    logger.debug(`User ${userId} already in default org`);
  }
};
