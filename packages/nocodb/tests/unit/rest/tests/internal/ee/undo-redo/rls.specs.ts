import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalGet, internalPost } from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import { tableScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

async function listPolicies(
  ctx: Context,
  env: TestEnv,
  tableId: string,
): Promise<any[]> {
  const r = await internalGet(ctx, env, {
    operation: 'rlsPolicyList',
    tableId,
  });
  return Array.isArray(r.body) ? r.body : r.body?.list ?? [];
}

async function getPolicy(
  ctx: Context,
  env: TestEnv,
  policyId: string,
): Promise<any | undefined> {
  const r = await internalGet(ctx, env, {
    operation: 'rlsPolicyGet',
    policyId,
  });
  return r.body;
}

async function createPolicy(
  ctx: Context,
  env: TestEnv,
  tableId: string,
  title = 'RLS_seed',
): Promise<string> {
  const r = await internalPost(
    ctx,
    env,
    { operation: 'rlsPolicyCreate' },
    { fk_model_id: tableId, title },
  );
  expect(r.status, `rlsPolicyCreate: ${JSON.stringify(r.body)}`).to.eq(200);
  return r.body.id;
}

export const rlsPolicyCreateSpec: RoundTripSpec<{ tableId: string }> = {
  forward_op: 'rlsPolicyCreate',
  setup: async (ctx, env) => {
    const t = await createTable(ctx, env, `rlstbl_${Date.now()}`);
    return { tableId: t.id };
  },
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'rlsPolicyCreate' },
      {
        fk_model_id: fx.tableId,
        title: 'RLS_test',
      }
    ),
  entityId: (r) => r.body.id,
  scope: tableScope,
  // `rlsPolicyList` is a GET op (RlsGet.operations.ts) — must use internalGet.
  assertExists: async (ctx, env, fx, id) => {
    const r = await internalGet(ctx, env, {
      operation: 'rlsPolicyList',
      tableId: fx.tableId,
    });
    const list = Array.isArray(r.body)
      ? r.body
      : r.body?.list ?? [];
    expect(list.map((p: any) => p.id)).to.include(id);
  },
  assertGone: async (ctx, env, fx, id) => {
    const r = await internalGet(ctx, env, {
      operation: 'rlsPolicyList',
      tableId: fx.tableId,
    });
    const list = Array.isArray(r.body)
      ? r.body
      : r.body?.list ?? [];
    expect(list.map((p: any) => p.id)).to.not.include(id);
  },
};

// ── rlsPolicyUpdate ──────────────────────────────────────────────

interface PolicyFx {
  tableId: string;
  policyId: string;
  originalTitle: string;
}

async function setupExistingPolicy(
  ctx: Context,
  env: TestEnv,
): Promise<PolicyFx> {
  const t = await createTable(ctx, env, `rlstbl_${Date.now()}`);
  const title = `RLS_orig_${Date.now()}`;
  const policyId = await createPolicy(ctx, env, t.id, title);
  return { tableId: t.id, policyId, originalTitle: title };
}

export const rlsPolicyUpdateSpec: RoundTripSpec<PolicyFx> = {
  forward_op: 'rlsPolicyUpdate',
  setup: setupExistingPolicy,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'rlsPolicyUpdate' },
      { id: fx.policyId, title: 'RLS_renamed' },
    ),
  entityId: (_r, fx) => fx.policyId,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const p = await getPolicy(ctx, env, fx.policyId);
    expect(p?.title).to.equal('RLS_renamed');
  },
  assertGone: async (ctx, env, fx) => {
    const p = await getPolicy(ctx, env, fx.policyId);
    expect(p?.title).to.equal(fx.originalTitle);
  },
};

export const rlsPolicyDeleteSpec: RoundTripSpec<PolicyFx> = {
  forward_op: 'rlsPolicyDelete',
  forwardIsDelete: true,
  setup: setupExistingPolicy,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'rlsPolicyDelete' },
      { policyId: fx.policyId },
    ),
  entityId: (_r, fx) => fx.policyId,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const list = await listPolicies(ctx, env, fx.tableId);
    expect(list.map((p) => p.id)).to.include(fx.policyId);
  },
  assertGone: async (ctx, env, fx) => {
    const list = await listPolicies(ctx, env, fx.tableId);
    expect(list.map((p) => p.id)).to.not.include(fx.policyId);
  },
};

export const rlsPolicySetSubjectsSpec: RoundTripSpec<PolicyFx> = {
  forward_op: 'rlsPolicySetSubjects',
  setup: setupExistingPolicy,
  // Set a role-based subject — doesn't require a real user/team id.
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'rlsPolicySetSubjects' },
      {
        policyId: fx.policyId,
        subjects: [{ type: 'role', id: 'editor' }],
      },
    ),
  entityId: (_r, fx) => fx.policyId,
  scope: tableScope,
  assertExists: async (ctx, env, fx) => {
    const p = await getPolicy(ctx, env, fx.policyId);
    expect(p?.subjects?.length, 'subjects attached').to.be.greaterThan(0);
  },
  assertGone: async (ctx, env, fx) => {
    const p = await getPolicy(ctx, env, fx.policyId);
    // Original setup created policy without subjects.
    expect(p?.subjects?.length ?? 0, 'subjects cleared').to.equal(0);
  },
};

interface PolicyFilterFx extends PolicyFx {
  colId: string;
}

async function setupPolicyForFilter(
  ctx: Context,
  env: TestEnv,
): Promise<PolicyFilterFx> {
  const t = await createTable(ctx, env, `rlsf_${Date.now()}`);
  const title = `RLS_for_filter_${Date.now()}`;
  const policyId = await createPolicy(ctx, env, t.id, title);
  return { tableId: t.id, policyId, originalTitle: title, colId: t.titleColId };
}

async function listPolicyFilters(
  ctx: Context,
  env: TestEnv,
  rlsPolicyId: string,
): Promise<any[]> {
  const r = await internalGet(ctx, env, {
    operation: 'rlsPolicyFilterList',
    rlsPolicyId,
  });
  if (Array.isArray(r.body)) return r.body;
  return r.body?.list ?? [];
}

function flattenFilterIds(list: any[]): string[] {
  const out: string[] = [];
  const walk = (rows: any[]) => {
    for (const f of rows) {
      if (f?.id) out.push(f.id);
      if (Array.isArray(f?.children) && f.children.length) walk(f.children);
    }
  };
  walk(list);
  return out;
}

export const rlsPolicyFilterCreateSpec: RoundTripSpec<PolicyFilterFx> = {
  forward_op: 'rlsPolicyFilterCreate',
  setup: setupPolicyForFilter,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'rlsPolicyFilterCreate' },
      {
        fk_rls_policy_id: fx.policyId,
        fk_column_id: fx.colId,
        comparison_op: 'eq',
        value: 'foo',
        logical_op: 'and',
      },
    ),
  entityId: (r) => r.body.id,
  scope: tableScope,
  assertExists: async (ctx, env, fx, id) => {
    const filters = await listPolicyFilters(ctx, env, fx.policyId);
    expect(flattenFilterIds(filters)).to.include(id);
  },
  assertGone: async (ctx, env, fx, id) => {
    const filters = await listPolicyFilters(ctx, env, fx.policyId);
    expect(flattenFilterIds(filters)).to.not.include(id);
  },
};

export const rlsSpecs: RoundTripSpec<any>[] = [
  rlsPolicyCreateSpec,
  rlsPolicyUpdateSpec,
  rlsPolicyDeleteSpec,
  rlsPolicySetSubjectsSpec,
  rlsPolicyFilterCreateSpec,
];
