import { expect } from 'chai';
import request from 'supertest';

/**
 * Test fixtures for the v3 REST surface — `/api/v3/meta/...`,
 * `/api/v3/data/...`, etc. Uses `xc-token` auth. For internal API
 * (`/api/v2/internal/...`) see `./internal.ts`; for `xc-auth` (session
 * cookie) flows see `view.ts` / `viewColumns.ts`.
 *
 * Set `ctx.tabId` to record calls on the per-tab undo stack — every
 * helper auto-sends the `x-nc-tab-id` header when it's present. For
 * "untraced" setup writes wrap the ctx with `untracedCtx()` from
 * `./internal`.
 */

type Ctx = { app: any; xc_token: string; tabId?: string };
type Env = { workspaceId: string; baseId: string };

export function v3Get(ctx: Ctx, path: string) {
  const req = request(ctx.app).get(path).set('xc-token', ctx.xc_token);
  if (ctx.tabId) req.set('x-nc-tab-id', ctx.tabId);
  return req;
}

export function v3Post(
  ctx: Ctx,
  path: string,
  body: Record<string, any> = {},
) {
  const req = request(ctx.app).post(path).set('xc-token', ctx.xc_token);
  if (ctx.tabId) req.set('x-nc-tab-id', ctx.tabId);
  return req.send(body);
}

export function v3Patch(
  ctx: Ctx,
  path: string,
  body: Record<string, any> = {},
) {
  const req = request(ctx.app).patch(path).set('xc-token', ctx.xc_token);
  if (ctx.tabId) req.set('x-nc-tab-id', ctx.tabId);
  return req.send(body);
}

export function v3Put(
  ctx: Ctx,
  path: string,
  body: Record<string, any> = {},
) {
  const req = request(ctx.app).put(path).set('xc-token', ctx.xc_token);
  if (ctx.tabId) req.set('x-nc-tab-id', ctx.tabId);
  return req.send(body);
}

export function v3Delete(ctx: Ctx, path: string) {
  const req = request(ctx.app).delete(path).set('xc-token', ctx.xc_token);
  if (ctx.tabId) req.set('x-nc-tab-id', ctx.tabId);
  return req;
}

export async function createTable(
  ctx: Ctx,
  env: Env,
  title: string,
  fields: Array<{ title: string; type: string }> = [
    { title: 'Title', type: 'SingleLineText' },
  ],
): Promise<{ id: string; titleColId: string; fields: any[] }> {
  const res = await v3Post(
    ctx,
    `/api/v3/meta/bases/${env.baseId}/tables`,
    { title, fields },
  );
  expect(res.status, `createTable ${title}: ${JSON.stringify(res.body)}`).to.eq(200);
  const titleColId = res.body.fields.find((f: any) => f.title === 'Title')?.id
    ?? res.body.fields[0].id;
  return { id: res.body.id, titleColId, fields: res.body.fields };
}
