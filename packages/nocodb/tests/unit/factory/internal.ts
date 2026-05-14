import { expect } from 'chai';
import request from 'supertest';
import { Model } from '~/models';

/**
 * Test fixtures for the internal API surface — `/api/v2/internal/:ws/:base`.
 * Uses `xc-token` auth. For v3 REST endpoints see `./v3.ts`; for
 * `xc-auth` (session cookie) flows see `view.ts` / `viewColumns.ts`.
 *
 * Set `ctx.tabId` to record calls on the per-tab undo stack — every
 * helper auto-sends the `x-nc-tab-id` header when it's present. For
 * "untraced" setup writes wrap the ctx with `untracedCtx()` below.
 */

/** Structural shape for HTTP client params — any object with these fields works. */
type Ctx = { app: any; xc_token: string; tabId?: string };
type Env = { workspaceId: string; baseId: string };

/** Returns a ctx clone with `tabId` cleared — for setup writes that
 *  shouldn't pollute the per-tab undo stack. */
export function untracedCtx<C extends { tabId?: string }>(ctx: C): C {
  return { ...ctx, tabId: undefined };
}

export function internalGet(
  ctx: Ctx,
  env: Env,
  query: Record<string, string>,
) {
  const req = request(ctx.app)
    .get(`/api/v2/internal/${env.workspaceId}/${env.baseId}`)
    .query(query)
    .set('xc-token', ctx.xc_token);
  if (ctx.tabId) req.set('x-nc-tab-id', ctx.tabId);
  return req;
}

export function internalPost(
  ctx: Ctx,
  env: Env,
  query: Record<string, string>,
  body: Record<string, any> = {},
) {
  const req = request(ctx.app)
    .post(`/api/v2/internal/${env.workspaceId}/${env.baseId}`)
    .query(query)
    .set('xc-token', ctx.xc_token);
  if (ctx.tabId) req.set('x-nc-tab-id', ctx.tabId);
  return req.send(body);
}

export async function readSorts(
  ctx: Ctx,
  env: Env,
  viewId: string,
): Promise<any[]> {
  const r = await internalGet(ctx, env, { operation: 'sortList', viewId });
  expect(r.status, `sortList: ${JSON.stringify(r.body).slice(0, 200)}`).to.eq(200);
  return r.body?.list ?? r.body?.sorts ?? [];
}

export async function readFilters(
  ctx: Ctx,
  env: Env,
  viewId: string,
): Promise<any[]> {
  const r = await internalGet(ctx, env, { operation: 'filterList', viewId });
  expect(r.status, `filterList: ${JSON.stringify(r.body).slice(0, 200)}`).to.eq(200);
  return r.body?.list ?? r.body?.filters ?? [];
}

export async function readViews(
  ctx: Ctx,
  env: Env,
  tableId: string,
): Promise<any[]> {
  const r = await internalGet(ctx, env, { operation: 'viewList', tableId });
  expect(r.status, `viewList: ${JSON.stringify(r.body).slice(0, 200)}`).to.eq(200);
  return r.body?.list ?? r.body?.views ?? [];
}

export async function readViewColumns(
  ctx: Ctx,
  env: Env,
  viewId: string,
): Promise<any[]> {
  const r = await internalGet(ctx, env, { operation: 'viewColumnList', viewId });
  expect(r.status, `viewColumnList: ${JSON.stringify(r.body).slice(0, 200)}`).to.eq(200);
  return r.body?.list ?? r.body?.columns ?? [];
}

export async function createGridView(
  ctx: Ctx,
  env: Env,
  tableId: string,
  title = 'Grid',
): Promise<string> {
  const res = await internalPost(
    ctx,
    env,
    { operation: 'gridViewCreate', tableId },
    { title },
  );
  expect(res.status, `gridViewCreate: ${JSON.stringify(res.body)}`).to.eq(200);
  return res.body.id;
}

/** Direct model read — no HTTP. Returns the table's columns. */
export async function readColumns(
  env: Env,
  tableId: string,
): Promise<any[]> {
  const m = await Model.getWithInfo(
    { workspace_id: env.workspaceId, base_id: env.baseId },
    { id: tableId },
  );
  return (m as any)?.columns ?? [];
}
