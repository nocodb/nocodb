import { parseProp } from 'nocodb-sdk';
import type { RlsDefaultBehavior, RlsPolicySubjectType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Knex } from 'knex';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/ncError';

export default class RlsPolicy {
  id: string;
  base_id: string;
  source_id?: string;
  fk_model_id: string;
  title?: string;
  enabled: boolean;
  is_default: boolean;
  default_behavior?: RlsDefaultBehavior;
  order?: number;
  meta?: string | Record<string, unknown>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;

  subjects?: RlsPolicySubjectType[];

  constructor(data: Partial<RlsPolicy>) {
    Object.assign(this, data);
  }

  private static getJsonObjectExpression(
    ncMeta = Noco.ncMeta,
    subjectTypeField: string,
    subjectIdField: string,
    hierarchyScopeField: string,
  ) {
    const { knex, knexConnection } = ncMeta;
    const client = knexConnection.client.config.client;

    const exprMap = {
      pg: `json_build_object('type', ${subjectTypeField}, 'id', ${subjectIdField}, 'hierarchy_scope', ${hierarchyScopeField})`,
      mysql2: `JSON_OBJECT('type', ${subjectTypeField}, 'id', ${subjectIdField}, 'hierarchy_scope', ${hierarchyScopeField})`,
      sqlite3: `json_object('type', ${subjectTypeField}, 'id', ${subjectIdField}, 'hierarchy_scope', ${hierarchyScopeField})`,
    };

    return knex.raw(exprMap[client] || exprMap.mysql2);
  }

  private static getJsonArrayAggExpression(
    ncMeta = Noco.ncMeta,
    jsonObjectExpr: Knex.QueryBuilder,
    subjectIdField: string,
  ) {
    const { knex, knexConnection } = ncMeta;
    const client = knexConnection.client.config.client;
    const query = jsonObjectExpr.toQuery();

    const exprMap = {
      pg: `
        COALESCE(
          json_agg(${query}) FILTER (WHERE ${subjectIdField} IS NOT NULL),
          '[]'::json
        )
      `,
      mysql2: `
        COALESCE(
          JSON_ARRAYAGG(
            CASE WHEN ${subjectIdField} IS NOT NULL THEN ${query} END
          ),
          JSON_ARRAY()
        )
      `,
      sqlite3: `
        CASE
          WHEN COUNT(${subjectIdField}) = 0
          THEN '[]'
          ELSE json_group_array(${query})
        END
      `,
    };

    return knex.raw(exprMap[client] || exprMap.mysql2);
  }

  public static async get(
    context: NcContext,
    policyId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let policy = await NocoCache.get(
      context,
      `${CacheScope.RLS_POLICY}:${policyId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!policy) {
      const jsonObjectExpr = this.getJsonObjectExpression(
        ncMeta,
        `${MetaTable.RLS_POLICY_SUBJECTS}.subject_type`,
        `${MetaTable.RLS_POLICY_SUBJECTS}.subject_id`,
        `${MetaTable.RLS_POLICY_SUBJECTS}.hierarchy_scope`,
      );

      const jsonArrayAggExpr = this.getJsonArrayAggExpression(
        ncMeta,
        jsonObjectExpr,
        `${MetaTable.RLS_POLICY_SUBJECTS}.subject_id`,
      );

      const query = ncMeta
        .knexConnection(MetaTable.RLS_POLICIES)
        .select([
          `${MetaTable.RLS_POLICIES}.*`,
          ncMeta.knex.raw(`${jsonArrayAggExpr.toQuery()} as subjects`),
        ])
        .leftJoin(
          MetaTable.RLS_POLICY_SUBJECTS,
          `${MetaTable.RLS_POLICIES}.id`,
          `${MetaTable.RLS_POLICY_SUBJECTS}.fk_rls_policy_id`,
        )
        .where(`${MetaTable.RLS_POLICIES}.id`, policyId)
        .where(`${MetaTable.RLS_POLICIES}.base_id`, context.base_id)
        .groupBy([
          `${MetaTable.RLS_POLICIES}.base_id`,
          `${MetaTable.RLS_POLICIES}.id`,
        ])
        .first();

      policy = await query;

      if (policy) {
        if (typeof policy.subjects === 'string') {
          policy.subjects = parseProp(policy.subjects, []);
        }
        if (!policy.subjects || !Array.isArray(policy.subjects)) {
          policy.subjects = [];
        }

        await NocoCache.set(
          context,
          `${CacheScope.RLS_POLICY}:${policyId}`,
          policy,
        );
      }
    }

    return policy && new RlsPolicy(policy);
  }

  public static async listByModel(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<RlsPolicy[]> {
    const cachedList = await NocoCache.getList(context, CacheScope.RLS_POLICY, [
      modelId,
    ]);

    const { list: policyList } = cachedList;

    if (!cachedList.isNoneList && !policyList.length) {
      const jsonObjectExpr = this.getJsonObjectExpression(
        ncMeta,
        `${MetaTable.RLS_POLICY_SUBJECTS}.subject_type`,
        `${MetaTable.RLS_POLICY_SUBJECTS}.subject_id`,
        `${MetaTable.RLS_POLICY_SUBJECTS}.hierarchy_scope`,
      );

      const jsonArrayAggExpr = this.getJsonArrayAggExpression(
        ncMeta,
        jsonObjectExpr,
        `${MetaTable.RLS_POLICY_SUBJECTS}.subject_id`,
      );

      const query = ncMeta
        .knexConnection(MetaTable.RLS_POLICIES)
        .select([
          `${MetaTable.RLS_POLICIES}.*`,
          ncMeta.knex.raw(`${jsonArrayAggExpr.toQuery()} as subjects`),
        ])
        .leftJoin(
          MetaTable.RLS_POLICY_SUBJECTS,
          `${MetaTable.RLS_POLICIES}.id`,
          `${MetaTable.RLS_POLICY_SUBJECTS}.fk_rls_policy_id`,
        )
        .where(`${MetaTable.RLS_POLICIES}.base_id`, context.base_id)
        .where(`${MetaTable.RLS_POLICIES}.fk_model_id`, modelId)
        .groupBy([
          `${MetaTable.RLS_POLICIES}.base_id`,
          `${MetaTable.RLS_POLICIES}.id`,
        ])
        .orderBy(`${MetaTable.RLS_POLICIES}.order`, 'asc');

      const policies = await query;

      const processedPolicies = policies.map((policy) => {
        if (typeof policy.subjects === 'string') {
          policy.subjects = parseProp(policy.subjects, []);
        }
        if (!policy.subjects || !Array.isArray(policy.subjects)) {
          policy.subjects = [];
        }
        return policy;
      });

      await NocoCache.setList(
        context,
        CacheScope.RLS_POLICY,
        [modelId],
        processedPolicies,
      );

      return processedPolicies.map((p) => new RlsPolicy(p));
    }

    return policyList.map((p) => new RlsPolicy(p));
  }

  public static async insert(
    context: NcContext,
    policy: Partial<RlsPolicy>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(policy, [
      'base_id',
      'source_id',
      'fk_model_id',
      'title',
      'enabled',
      'is_default',
      'default_behavior',
      'order',
      'meta',
      'created_by',
    ]);

    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = JSON.stringify(insertObj.meta);
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.RLS_POLICIES,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        context,
        CacheScope.RLS_POLICY,
        [policy.fk_model_id],
        `${CacheScope.RLS_POLICY}:${id}`,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    policyId: string,
    policy: Partial<RlsPolicy>,
    ncMeta = Noco.ncMeta,
  ) {
    const existingPolicy = await this.get(context, policyId, ncMeta);

    if (!existingPolicy) {
      NcError.genericNotFound('RLS Policy', policyId);
    }

    const updateObj = extractProps(policy, [
      'title',
      'enabled',
      'default_behavior',
      'order',
      'meta',
    ]);

    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = JSON.stringify(updateObj.meta);
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.RLS_POLICIES,
      updateObj,
      policyId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.RLS_POLICY}:${policyId}`,
      updateObj,
    );

    return this.get(context, policyId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    policyId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const policy = await this.get(context, policyId, ncMeta);

    if (!policy) {
      NcError.genericNotFound('RLS Policy', policyId);
    }

    // Delete all associated subjects
    await this.removeAllSubjects(context, policyId, ncMeta);

    // Note: filter cleanup is handled by the service layer via
    // Filter.deleteAllByRlsPolicy() which does recursive deletion with cache eviction.

    // Delete the policy itself
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.RLS_POLICIES,
      policyId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.RLS_POLICY}:${policyId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }

  public static async setSubjects(
    context: NcContext,
    policyId: string,
    subjects: RlsPolicySubjectType[],
    ncMeta = Noco.ncMeta,
  ) {
    const policy = await this.get(context, policyId, ncMeta);

    if (!policy) {
      NcError.genericNotFound('RLS Policy', policyId);
    }

    const existingSubjects = policy.subjects || [];

    // Find subjects to add
    const subjectsToAdd = subjects.filter(
      (subject) =>
        !existingSubjects.some(
          (existing) =>
            existing.type === subject.type && existing.id === subject.id,
        ),
    );

    // Find subjects to remove
    const subjectsToRemove = existingSubjects.filter(
      (existing) =>
        !subjects.some(
          (subject) =>
            subject.type === existing.type && subject.id === existing.id,
        ),
    );

    // Remove subjects that are no longer needed
    if (subjectsToRemove.length > 0) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.RLS_POLICY_SUBJECTS,
        null,
        {
          _and: [
            { fk_rls_policy_id: { eq: policyId } },
            {
              _or: subjectsToRemove.map((subject) => ({
                _and: [
                  { subject_type: { eq: subject.type } },
                  { subject_id: { eq: subject.id } },
                ],
              })),
            },
          ],
        },
      );
    }

    // Add new subjects
    if (subjectsToAdd.length > 0) {
      await ncMeta.bulkMetaInsert(
        context.workspace_id,
        context.base_id,
        MetaTable.RLS_POLICY_SUBJECTS,
        subjectsToAdd.map((subject) => ({
          fk_rls_policy_id: policyId,
          subject_type: subject.type,
          subject_id: subject.id,
          hierarchy_scope: subject.hierarchy_scope || null,
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
        })),
        true,
      );
    }

    // Update existing subjects where hierarchy_scope changed
    const subjectsToUpdate = subjects.filter((subject) =>
      existingSubjects.some(
        (existing) =>
          existing.type === subject.type &&
          existing.id === subject.id &&
          existing.hierarchy_scope !== subject.hierarchy_scope,
      ),
    );

    for (const subject of subjectsToUpdate) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.RLS_POLICY_SUBJECTS,
        { hierarchy_scope: subject.hierarchy_scope || null },
        {
          fk_rls_policy_id: policyId,
          subject_type: subject.type,
          subject_id: subject.id,
        },
      );
    }

    await NocoCache.update(context, `${CacheScope.RLS_POLICY}:${policyId}`, {
      subjects,
    });

    return subjects;
  }

  public static async removeAllSubjects(
    context: NcContext,
    policyId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.RLS_POLICY_SUBJECTS,
      {
        fk_rls_policy_id: policyId,
      },
    );

    await NocoCache.update(context, `${CacheScope.RLS_POLICY}:${policyId}`, {
      subjects: [],
    });

    return res;
  }

  public static async removeSubjectBase(
    context: NcContext,
    subject: { type: 'user' | 'team'; id: string },
    ncMeta = Noco.ncMeta,
  ) {
    const subjectPolicies = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.RLS_POLICY_SUBJECTS,
      {
        xcCondition: {
          _and: [
            { subject_type: { eq: subject.type } },
            { subject_id: { eq: subject.id } },
          ],
        },
      },
    );

    if (!subjectPolicies || subjectPolicies.length === 0) {
      return [];
    }

    const affectedPolicyIds = [
      ...new Set(
        subjectPolicies.map(
          (sp: { fk_rls_policy_id: string }) => sp.fk_rls_policy_id,
        ),
      ),
    ];

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.RLS_POLICY_SUBJECTS,
      null,
      {
        _and: [
          { subject_type: { eq: subject.type } },
          { subject_id: { eq: subject.id } },
        ],
      },
    );

    // Update cache for affected policies
    for (const policyId of affectedPolicyIds) {
      const cacheKey = `${CacheScope.RLS_POLICY}:${policyId}`;
      const cachedPolicy = await NocoCache.get(
        context,
        cacheKey,
        CacheGetType.TYPE_OBJECT,
      );

      if (cachedPolicy && cachedPolicy.subjects) {
        const updatedSubjects = cachedPolicy.subjects.filter(
          (s: RlsPolicySubjectType) =>
            !(s.type === subject.type && s.id === subject.id),
        );

        await NocoCache.update(context, cacheKey, {
          subjects: updatedSubjects,
        });
      }
    }

    return affectedPolicyIds;
  }

  public static async clearModelCache(context: NcContext, modelId: string) {
    await NocoCache.deepDel(
      context,
      `${CacheScope.RLS_POLICY}:${modelId}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
  }

  /**
   * Check if a table has any enabled RLS policies (cached via listByModel).
   */
  public static async hasEnabledPolicies(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const policies = await this.listByModel(context, modelId, ncMeta);
    return policies.some((p) => p.enabled);
  }

  public static async getDefaultPolicy(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<RlsPolicy | null> {
    const policies = await this.listByModel(context, modelId, ncMeta);
    return policies.find((p) => p.is_default) || null;
  }

  public static async countScopedPolicies(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const policies = await this.listByModel(context, modelId, ncMeta);
    return policies.filter((p) => !p.is_default).length;
  }
}
