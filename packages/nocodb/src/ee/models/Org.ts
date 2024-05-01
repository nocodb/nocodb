import type { AttachmentResType, OrgType } from 'nocodb-sdk';
import {
  parseMetaProp,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { deserializeJSON, serializeJSON } from '~/utils/serialize';

type OrganizationType = Omit<OrgType, 'image'> & {
  image?: AttachmentResType | string;
};

export default class Org implements OrganizationType {
  id: string;
  title: string;
  slug: string;
  deleted?: boolean;
  fk_user_id: string;
  meta: string;

  constructor(org: Partial<OrgType>) {
    Object.assign(this, org);
  }

  public static async baseList(orgId: string, ncMeta = Noco.ncMeta) {
    // TODO: Caching

    let bases = await ncMeta
      .knex(MetaTable.PROJECT)
      .select(
        `${MetaTable.PROJECT}.id`,
        `${MetaTable.PROJECT}.title`,
        `${MetaTable.PROJECT}.created_at`,
        `${MetaTable.PROJECT}.updated_at`,
        `${MetaTable.PROJECT}.meta as base_meta`,
        `${MetaTable.WORKSPACE}.id as workspace_id`,
        `${MetaTable.WORKSPACE}.title as workspace_title`,
        `${MetaTable.WORKSPACE}.meta as workspace_meta`,
        `${MetaTable.WORKSPACE}.fk_org_id as org_id`,
        ncMeta.knex.raw(`
  (SELECT ARRAY_AGG(DISTINCT JSON_BUILD_OBJECT(
      'fk_user_id', ${MetaTable.WORKSPACE_USER}.fk_user_id, 
      'display_name', ${MetaTable.USERS}.display_name, 
      'email', ${MetaTable.USERS}.email, 
      'roles', ${MetaTable.WORKSPACE_USER}.roles,
      'base_roles', ${MetaTable.PROJECT_USERS}.roles
  )::TEXT)
  FROM ${MetaTable.WORKSPACE_USER}
  INNER JOIN ${MetaTable.USERS} ON ${MetaTable.USERS}.id = ${MetaTable.WORKSPACE_USER}.fk_user_id
  LEFT JOIN ${MetaTable.PROJECT_USERS} ON ${MetaTable.PROJECT_USERS}.fk_user_id = ${MetaTable.USERS}.id
  WHERE ${MetaTable.WORKSPACE_USER}.fk_workspace_id = ${MetaTable.WORKSPACE}.id
) AS members`),
      )
      .innerJoin(
        MetaTable.WORKSPACE,
        `${MetaTable.PROJECT}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .innerJoin(
        MetaTable.WORKSPACE_USER,
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .innerJoin(
        MetaTable.ORG,
        `${MetaTable.ORG}.id`,
        `${MetaTable.WORKSPACE}.fk_org_id`,
      )
      .where({
        [`${MetaTable.ORG}.id`]: orgId,
        [`${MetaTable.WORKSPACE}.deleted`]: false,
        [`${MetaTable.WORKSPACE_USER}.deleted`]: false,
      })
      .groupBy(
        `${MetaTable.PROJECT}.id`,
        `${MetaTable.PROJECT}.title`,
        `${MetaTable.PROJECT}.created_at`,
        `${MetaTable.PROJECT}.updated_at`,
        `${MetaTable.PROJECT}.meta`,
        `${MetaTable.WORKSPACE}.id`,
        `${MetaTable.WORKSPACE}.title`,
        `${MetaTable.WORKSPACE}.meta`,
        `${MetaTable.WORKSPACE}.fk_org_id`,
      );

    bases = bases.map((base) => {
      base.members = base.members.map((member) => {
        return JSON.parse(member);
      });
      return base;
    });

    return bases;
  }

  public static async get(orgId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.ORG}:${orgId}`;
    let org = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!org) {
      org = await ncMeta.metaGet2(null, null, MetaTable.ORG, {
        id: orgId,
      });

      if (!org) return null;

      org.config = parseMetaProp(org, 'config');
      await NocoCache.set(key, org);
    }

    return new Org(org);
  }

  public static async insert(org: Partial<Org>, ncMeta = Noco.ncMeta) {
    const insertObj: Record<string, any> = extractProps(org, [
      'title',
      'slug',
      'deleted',
      'fk_user_id',
      'meta',
      'image',
    ]);

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj, 'meta');
    }

    if (insertObj?.image) {
      insertObj.image = this.serializeAttachmentJSON(insertObj.logo_url);
    }

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.ORG,
      insertObj,
    );
    return this.get(id, ncMeta);
  }

  public static async update(
    orgId: string,
    org: Partial<OrgType>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(org, [
      'title',
      'slug',
      'deleted',
      'fk_user_id',
      'meta',
      'image',
    ]);

    if (updateObj?.image) {
      updateObj.image = this.serializeAttachmentJSON(updateObj.logo_url);
    }

    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj, 'meta');
    }

    await ncMeta.metaUpdate(null, null, MetaTable.ORG, updateObj, orgId);

    await NocoCache.update(
      `${CacheScope.ORG}:${orgId}`,
      prepareForResponse(updateObj, 'meta'),
    );

    return true;
  }

  public static async delete(orgId: string, ncMeta = Noco.ncMeta) {
    // delete from cache
    await ncMeta.metaDelete(null, null, MetaTable.ORG, orgId);

    const key = `${CacheScope.ORG}:${orgId}`;

    await NocoCache.del(key);

    return true;
  }

  static serializeAttachmentJSON(attachment): string | null {
    if (attachment) {
      return serializeJSON(
        extractProps(deserializeJSON(attachment), [
          'url',
          'path',
          'title',
          'mimetype',
          'size',
          'icon',
        ]),
      );
    }
    return attachment;
  }
}
