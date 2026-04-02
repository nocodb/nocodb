import { CloudOrgUserRoles } from 'nocodb-sdk';
import type { OrgUserType } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';

// todo: caching
export default class OrgUser {
  fk_user_id: string;
  fk_org_id: string;
  roles: string;

  constructor(props) {
    Object.assign(this, props);
  }

  /**
   * List org users directly from nc_org_users.
   * Previously derived from workspace joins (PG-only ARRAY_AGG).
   * Now that nc_org_users is properly populated, read directly.
   */
  static async list(orgId: string, ncMeta = Noco.ncMeta) {
    const queryBuilder = ncMeta
      .knex(MetaTable.ORG_USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.created_at as created_at`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.ORG_USERS}.roles as cloud_org_roles`,
      )
      .innerJoin(
        MetaTable.USERS,
        `${MetaTable.ORG_USERS}.fk_user_id`,
        `${MetaTable.USERS}.id`,
      )
      .where(`${MetaTable.ORG_USERS}.fk_org_id`, orgId)
      .where(function () {
        this.where(`${MetaTable.USERS}.is_deleted`, false).orWhereNull(
          `${MetaTable.USERS}.is_deleted`,
        );
      });

    const res = await queryBuilder;

    return res.map((r) => {
      r.meta = parseMetaProp(r);
      return r;
    });
  }

  static async get(orgId: string, userId: string, ncMeta = Noco.ncMeta) {
    const user = await ncMeta.metaGet2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_USERS,
      {
        fk_org_id: orgId,
        fk_user_id: userId,
      },
    );

    return new OrgUser(user);
  }

  static async insert(param: OrgUserType, ncMeta = Noco.ncMeta) {
    const user = await ncMeta.metaInsert2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_USERS,
      {
        fk_org_id: param.fk_org_id,
        fk_user_id: param.fk_user_id,
        roles: param.roles,
      },
      true,
    );

    await NocoCache.del('root', `orgOwners`);

    return new OrgUser(user);
  }

  static async update(
    userId: string,
    orgId: string,
    updateBody: Partial<OrgUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(updateBody, ['role']);

    await ncMeta.metaUpdate(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_USERS,
      updateObj,
      {
        fk_user_id: userId,
        fk_org_id: orgId,
      },
    );
  }

  static async getOwnedOrgs(userId: string, ncMeta = Noco.ncMeta) {
    const orgs = await ncMeta.metaList2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_USERS,
      {
        condition: {
          fk_user_id: userId,
          roles: CloudOrgUserRoles.OWNER,
        },
      },
    );

    return orgs;
  }
}
