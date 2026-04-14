import { CloudOrgUserRoles, EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { OrgUserType } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';

// todo: caching
export default class OrgUser {
  fk_user_id: string;
  fk_org_id: string;
  roles: string;
  deleted?: boolean;
  deleted_at?: string;

  // SCIM fields (org-specific)
  scim_external_id?: string;
  scim_managed?: boolean;
  scim_user_name?: string;
  scim_meta?: Record<string, any> | string;

  constructor(props: Partial<OrgUser>) {
    Object.assign(this, props);
  }

  /**
   * Filter condition to exclude soft-deleted org users.
   * Reusable across all queries.
   */
  private static notDeleted(qb: any, alias = MetaTable.ORG_USERS) {
    qb.where(function () {
      this.where(`${alias}.deleted`, false).orWhereNull(`${alias}.deleted`);
    });
  }

  /**
   * List org users from nc_org_users with workspace data.
   * Reads membership from nc_org_users (not derived from workspace joins).
   * Workspace data joined back for cloud admin panel display.
   * ARRAY_AGG is PG-only — cloud is always PG.
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
        `${MetaTable.ORG_USERS}.scim_managed`,
        ncMeta.knex.raw(
          `COALESCE(ARRAY_AGG(DISTINCT JSON_BUILD_OBJECT('id', ??, 'created_at', ??, 'roles', ??, 'title', ??)::text) FILTER (WHERE ?? IS NOT NULL), '{}') as workspaces`,
          [
            `${MetaTable.WORKSPACE}.id`,
            `${MetaTable.WORKSPACE_USER}.created_at`,
            `${MetaTable.WORKSPACE_USER}.roles`,
            `${MetaTable.WORKSPACE}.title`,
            `${MetaTable.WORKSPACE}.id`,
          ],
        ),
      )
      .innerJoin(
        MetaTable.USERS,
        `${MetaTable.ORG_USERS}.fk_user_id`,
        `${MetaTable.USERS}.id`,
      )
      .leftJoin(MetaTable.WORKSPACE_USER, function () {
        this.on(
          `${MetaTable.WORKSPACE_USER}.fk_user_id`,
          '=',
          `${MetaTable.ORG_USERS}.fk_user_id`,
        ).andOn(
          ncMeta.knex.raw(`COALESCE(??, false) = false`, [
            `${MetaTable.WORKSPACE_USER}.deleted`,
          ]),
        );
      })
      .leftJoin(MetaTable.WORKSPACE, function () {
        this.on(
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
          '=',
          `${MetaTable.WORKSPACE}.id`,
        ).andOn(
          `${MetaTable.WORKSPACE}.fk_org_id`,
          '=',
          ncMeta.knex.raw('?', [orgId]),
        );
      })
      .where(`${MetaTable.ORG_USERS}.fk_org_id`, orgId)
      .where(function () {
        this.where(`${MetaTable.USERS}.is_deleted`, false).orWhereNull(
          `${MetaTable.USERS}.is_deleted`,
        );
      })
      .groupBy(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.roles`,
        `${MetaTable.USERS}.created_at`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.ORG_USERS}.roles`,
        `${MetaTable.ORG_USERS}.scim_managed`,
      );

    OrgUser.notDeleted(queryBuilder);

    let res = await queryBuilder;

    res = res.map((r) => {
      r.workspaces = (r.workspaces || []).map((w) =>
        typeof w === 'string' ? JSON.parse(w) : w,
      );
      r.meta = parseMetaProp(r);
      return r;
    });

    return res;
  }

  static async get(
    orgId: string,
    userId: string,
    {
      include_deleted = false,
    }: {
      include_deleted?: boolean;
    } = {},
    ncMeta = Noco.ncMeta,
  ) {
    const queryBuilder = ncMeta
      .knex(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.ORG_USERS}.*`,
      )
      .innerJoin(MetaTable.ORG_USERS, function () {
        this.on(
          `${MetaTable.ORG_USERS}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.ORG_USERS}.fk_org_id`,
          '=',
          ncMeta.knex.raw('?', [orgId]),
        );
      })
      .where(`${MetaTable.ORG_USERS}.fk_user_id`, userId);

    if (!include_deleted) {
      OrgUser.notDeleted(queryBuilder);
    }

    const row = await queryBuilder.first();

    if (!row) return null;

    row.meta = parseMetaProp(row);
    row.scim_meta = parseMetaProp(row, 'scim_meta');

    return row;
  }

  static async insert(
    param: OrgUserType & Partial<OrgUser>,
    ncMeta = Noco.ncMeta,
  ) {
    // Reactivate if soft-deleted row exists
    const existing = await ncMeta.metaGet2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_USERS,
      {
        fk_org_id: param.fk_org_id,
        fk_user_id: param.fk_user_id,
      },
    );

    if (existing?.deleted) {
      const updateData: Record<string, any> = {
        deleted: false,
        deleted_at: null,
        roles: param.roles || EnterpriseOrgUserRoles.VIEWER,
      };

      // Restore SCIM fields if provided
      if (param.scim_external_id !== undefined)
        updateData.scim_external_id = param.scim_external_id;
      if (param.scim_managed !== undefined)
        updateData.scim_managed = param.scim_managed;
      if (param.scim_user_name !== undefined)
        updateData.scim_user_name = param.scim_user_name;
      if (param.scim_meta !== undefined)
        updateData.scim_meta = stringifyMetaProp(
          { scim_meta: param.scim_meta },
          'scim_meta',
          null,
        );

      await ncMeta.metaUpdate(
        RootScopes.ORG,
        RootScopes.ORG,
        MetaTable.ORG_USERS,
        updateData,
        {
          fk_org_id: param.fk_org_id,
          fk_user_id: param.fk_user_id,
        },
      );

      await NocoCache.del('root', `orgOwners`);

      return new OrgUser({
        ...existing,
        ...updateData,
        roles: param.roles || existing.roles,
      });
    }

    const insertObj = extractProps(param as Record<string, any>, [
      'fk_org_id',
      'fk_user_id',
      'roles',
      'deleted',
      'scim_external_id',
      'scim_managed',
      'scim_user_name',
      'scim_meta',
    ]);

    // Stringify scim_meta (TEXT column) before insert
    if ('scim_meta' in insertObj) {
      insertObj.scim_meta = stringifyMetaProp(insertObj, 'scim_meta', null);
    }

    if (insertObj.deleted === undefined) {
      insertObj.deleted = false;
    }

    const user = await ncMeta.metaInsert2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG_USERS,
      insertObj,
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
    const updateObj = extractProps(updateBody, [
      'roles',
      'deleted',
      'deleted_at',
      'scim_external_id',
      'scim_managed',
      'scim_user_name',
      'scim_meta',
    ]);

    // Stringify scim_meta (TEXT column) before update
    if ('scim_meta' in updateObj) {
      updateObj.scim_meta = stringifyMetaProp(updateObj, 'scim_meta', null);
    }

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

    // Re-fetch the updated record with user data joined
    return OrgUser.get(orgId, userId, { include_deleted: true }, ncMeta);
  }

  /**
   * Soft-delete a user from an org.
   */
  static async softDelete(orgId: string, userId: string, ncMeta = Noco.ncMeta) {
    await this.update(
      userId,
      orgId,
      {
        deleted: true,
        deleted_at: new Date().toISOString(),
      } as Partial<OrgUser>,
      ncMeta,
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

    return orgs.filter((o) => !o.deleted);
  }

  /**
   * Direct DB lookup by SCIM external ID using the indexed column.
   * Avoids loading all org users into memory.
   */
  static async getByScimExternalId(
    orgId: string,
    scimExternalId: string,
    {
      include_deleted = false,
    }: {
      include_deleted?: boolean;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<any | null> {
    const queryBuilder = ncMeta
      .knex(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.ORG_USERS}.*`,
      )
      .innerJoin(MetaTable.ORG_USERS, function () {
        this.on(
          `${MetaTable.ORG_USERS}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.ORG_USERS}.fk_org_id`,
          '=',
          ncMeta.knex.raw('?', [orgId]),
        );
      })
      .where(`${MetaTable.ORG_USERS}.scim_external_id`, scimExternalId);

    if (!include_deleted) {
      OrgUser.notDeleted(queryBuilder);
    }

    const row = await queryBuilder.first();

    if (!row) return null;

    row.meta = parseMetaProp(row);
    row.scim_meta = parseMetaProp(row, 'scim_meta');

    return row;
  }

  /**
   * SQL-level paginated list for SCIM endpoints.
   * Filters scim_managed=true at the DB level with LIMIT/OFFSET.
   * Returns { list, totalResults } for SCIM ListResponse.
   */
  static async scimList(
    {
      fk_org_id,
      include_deleted = false,
      offset = 0,
      limit = 100,
      filterUserName,
      filterExternalId,
      sortBy,
      sortAscending = true,
    }: {
      fk_org_id: string;
      include_deleted?: boolean;
      offset?: number;
      limit?: number;
      filterUserName?: string;
      filterExternalId?: string;
      sortBy?: string;
      sortAscending?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<{ list: any[]; totalResults: number }> {
    const baseQuery = () => {
      const qb = ncMeta
        .knex(MetaTable.USERS)
        .innerJoin(MetaTable.ORG_USERS, function () {
          this.on(
            `${MetaTable.ORG_USERS}.fk_user_id`,
            '=',
            `${MetaTable.USERS}.id`,
          ).andOn(
            `${MetaTable.ORG_USERS}.fk_org_id`,
            '=',
            ncMeta.knex.raw('?', [fk_org_id]),
          );
        })
        .where(`${MetaTable.ORG_USERS}.scim_managed`, true);

      if (!include_deleted) {
        qb.where(function () {
          this.where(`${MetaTable.ORG_USERS}.deleted`, false).orWhereNull(
            `${MetaTable.ORG_USERS}.deleted`,
          );
        });
      }

      if (filterUserName) {
        qb.where(function () {
          this.whereRaw(`LOWER(${MetaTable.ORG_USERS}.scim_user_name) = ?`, [
            filterUserName.toLowerCase(),
          ]).orWhereRaw(`LOWER(${MetaTable.USERS}.email) = ?`, [
            filterUserName.toLowerCase(),
          ]);
        });
      }

      if (filterExternalId) {
        qb.whereRaw(`LOWER(${MetaTable.ORG_USERS}.scim_external_id) = ?`, [
          filterExternalId.toLowerCase(),
        ]);
      }

      return qb;
    };

    // Count query
    const countResult = await baseQuery().count('* as count').first();
    const totalResults = Number(countResult?.count || 0);

    // Data query with pagination and sorting
    const dataQuery = baseQuery()
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.ORG_USERS}.*`,
      )
      .offset(offset)
      .limit(limit);

    // Apply sorting
    if (sortBy) {
      const sortCol =
        sortBy === 'userName'
          ? `${MetaTable.ORG_USERS}.scim_user_name`
          : sortBy === 'displayName'
          ? `${MetaTable.USERS}.display_name`
          : sortBy === 'externalId'
          ? `${MetaTable.ORG_USERS}.scim_external_id`
          : `${MetaTable.ORG_USERS}.scim_user_name`;
      dataQuery.orderBy(sortCol, sortAscending ? 'asc' : 'desc');
    } else {
      dataQuery.orderBy(`${MetaTable.ORG_USERS}.created_at`, 'asc');
    }

    const rows = await dataQuery;

    const list = rows.map((row) => {
      row.meta = parseMetaProp(row);
      row.scim_meta = parseMetaProp(row, 'scim_meta');
      return row;
    });

    return { list, totalResults };
  }
}
