import type { Context, ScopeRef, TestEnv } from './harness';
import { createGridView, readColumns, readViews } from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import { Model } from '~/models';

export interface NoFx {}

export interface TableFx {
  tableId: string;
  titleColId: string;
  fields: any[];
}

export interface TableViewFx extends TableFx {
  viewId: string;
  colId: string;
}

export async function noSetup(): Promise<NoFx> {
  return {};
}

export async function setupTable(
  ctx: Context,
  env: TestEnv,
  title?: string,
  fields?: Array<{ title: string; type: string }>,
): Promise<TableFx> {
  const t = await createTable(ctx, env, title ?? `tbl_${Date.now()}`, fields);
  return { tableId: t.id, titleColId: t.titleColId, fields: t.fields };
}

export async function setupTableView(
  ctx: Context,
  env: TestEnv,
): Promise<TableViewFx> {
  const t = await setupTable(ctx, env);
  const viewId = await createGridView(ctx, env, t.tableId);
  return { ...t, viewId, colId: t.titleColId };
}

export function baseScope(env: TestEnv): ScopeRef[] {
  return [{ type: 'base', id: env.baseId }];
}

export function tableScope(env: TestEnv, fx: { tableId: string }): ScopeRef[] {
  return [
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ];
}

export function viewScope(
  env: TestEnv,
  fx: { viewId: string; tableId: string },
): ScopeRef[] {
  return [
    { type: 'view', id: fx.viewId },
    { type: 'table', id: fx.tableId },
    { type: 'base', id: env.baseId },
  ];
}

export async function tableExists(
  _ctx: Context,
  env: TestEnv,
  tableId: string,
): Promise<boolean> {
  const m = await Model.get(
    { workspace_id: env.workspaceId, base_id: env.baseId },
    tableId,
  ).catch(() => null);
  return !!m && !(m as any).deleted;
}

export async function colExists(
  env: TestEnv,
  tableId: string,
  columnId: string,
): Promise<boolean> {
  const cols = await readColumns(env, tableId);
  return cols.some((c: any) => c.id === columnId);
}

export async function viewExists(
  ctx: Context,
  env: TestEnv,
  tableId: string,
  viewId: string,
): Promise<boolean> {
  const views = await readViews(ctx, env, tableId);
  return views.some((v: any) => v.id === viewId);
}
