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

  static async list(orgId: string, ncMeta = Noco.ncMeta) {
    //TODO: Add caching
    const queryBuilder = ncMeta
      .knex(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.created_at as created_at`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.ORG_USERS}.roles as cloud_org_roles`,
        ncMeta.knex.raw(
          "ARRAY_AGG(DISTINCT JSON_BUILD_OBJECT('id', ??, 'created_at', ??, 'roles', ??, 'title', ??)::text) as workspaces",
          [
            `${MetaTable.WORKSPACE}.id`,
            `${MetaTable.WORKSPACE_USER}.created_at`,
            `${MetaTable.WORKSPACE_USER}.roles`,
            `${MetaTable.WORKSPACE}.title`,
          ],
        ),
      )
      .innerJoin(
        MetaTable.WORKSPACE_USER,
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
        `${MetaTable.USERS}.id`,
      )
      .innerJoin(
        MetaTable.WORKSPACE,
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .innerJoin(
        MetaTable.ORG,
        `${MetaTable.WORKSPACE}.fk_org_id`,
        `${MetaTable.ORG}.id`,
      )
      .leftJoin(
        MetaTable.ORG_USERS,
        `${MetaTable.ORG_USERS}.fk_user_id`,
        `${MetaTable.USERS}.id`,
      )
      .where({
        [`${MetaTable.WORKSPACE}.fk_org_id`]: orgId,
      })
      .where((kn) => {
        kn.where(`${MetaTable.WORKSPACE_USER}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE_USER}.deleted`,
        );
      })
      .groupBy(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.ORG_USERS}.roles`,
      );

    let res = await queryBuilder;

    res = res.map((r) => {
      r.workspaces = r.workspaces.map((w) => JSON.parse(w));
      r.meta = parseMetaProp(r);
      return r;
    });
    return res;
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
