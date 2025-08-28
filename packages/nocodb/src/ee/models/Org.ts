import type { AttachmentResType, OrgType } from 'nocodb-sdk';
import {
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { deserializeJSON, serializeJSON } from '~/utils/serialize';
import { BaseUser, PresignedUrl } from '~/models';
import { getActivePlanAndSubscription } from '~/helpers/paymentHelpers';

type OrganizationType = Omit<OrgType, 'image'> & {
  image?: AttachmentResType | string;
};

export default class Org implements OrganizationType {
  id: string;
  title: string;
  slug: string;
  deleted?: boolean;
  fk_user_id: string;
  stripe_customer_id?: string;
  meta: string;

  fk_db_instance_id?: string;

  created_at?: string;
  updated_at?: string;

  constructor(org: Partial<OrgType>) {
    Object.assign(this, org);
  }

  public static async baseList(orgId: string, ncMeta = Noco.ncMeta) {
    // TODO: Caching

    const bases = await ncMeta
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
      .andWhere(`${MetaTable.ORG}.id`, orgId)
      .where((kn) => {
        kn.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
        kn.where(`${MetaTable.WORKSPACE}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE}.deleted`,
        );
        kn.where(`${MetaTable.WORKSPACE_USER}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE_USER}.deleted`,
        );
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

    await Promise.all(
      bases.map(async (base) => {
        base.members = await BaseUser.getUsersList(
          {
            workspace_id: base.workspace_id,
            base_id: base.id,
          },
          {
            base_id: base.id,
            include_ws_deleted: false,
          },
        );

        await PresignedUrl.signMetaIconImage(base.members);
      }),
    );

    return bases;
  }

  public static async get(orgId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.ORG}:${orgId}`;
    let org = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!org) {
      org = await ncMeta.metaGet2(
        RootScopes.ORG,
        RootScopes.ORG,
        MetaTable.ORG,
        {
          id: orgId,
        },
      );

      if (org) {
        org.meta = deserializeJSON(org.meta);
        org.config = deserializeJSON(org.config);
        await NocoCache.set(key, org);
      }
      if (!org) return null;
    }

    org.payment = await getActivePlanAndSubscription(org.id, false, ncMeta);

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
      'stripe_customer_id',
      'fk_db_instance_id',
    ]);

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj, 'meta');
    }

    if (insertObj?.image) {
      insertObj.image = this.serializeAttachmentJSON(insertObj.logo_url);
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG,
      insertObj,
    );
    return this.get(id, ncMeta);
  }

  public static async update(
    orgId: string,
    org: Partial<OrgType> & { fk_db_instance_id?: string },
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(org, [
      'title',
      'slug',
      'deleted',
      'fk_user_id',
      'meta',
      'image',
      'stripe_customer_id',
      'fk_db_instance_id',
    ]);

    if (updateObj?.image) {
      updateObj.image = this.serializeAttachmentJSON(updateObj.image);
    }

    const res = await ncMeta.metaUpdate(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG,
      prepareForDb(updateObj),
      orgId,
    );

    await NocoCache.update(
      `${CacheScope.ORG}:${orgId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }

  public static async delete(orgId: string, ncMeta = Noco.ncMeta) {
    // delete from cache
    await ncMeta.metaDelete(
      RootScopes.ORG,
      RootScopes.ORG,
      MetaTable.ORG,
      orgId,
    );

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
