import {
  ButtonActionsType,
  formulaJsep,
  jsepTreeToFormula,
  UITypes,
} from 'nocodb-sdk';
import type FormulaColumn from '../models/FormulaColumn';
import type { NcContext } from '~/interface/config';
import type { ButtonColumn } from '~/models';
import Column from '~/models/Column';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Whether a parsed formula references any of `refs` — as a plain `{Field}` or
 * as any hop of a `{Link}.{Field}` path. Function names never match.
 */
export function formulaTreeReferencesColumn(
  node: any,
  refs: string[],
): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    return node.some((child) => formulaTreeReferencesColumn(child, refs));
  }
  if (node.type === 'Identifier') return refs.includes(node.name);
  if (node.type === 'CallExpression') {
    return formulaTreeReferencesColumn(node.arguments, refs);
  }
  return Object.keys(node).some((key) =>
    formulaTreeReferencesColumn(node[key], refs),
  );
}

/** Column ids referenced by a stored formula, including every path hop */
export function getFormulaColumnRefs(formula: string): string[] {
  const refs = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === 'Identifier') {
      refs.add(node.name);
      return;
    }
    if (node.type === 'CallExpression') return walk(node.arguments);
    Object.keys(node).forEach((key) => walk(node[key]));
  };
  try {
    walk(formulaJsep(formula));
  } catch {
    // unparsable formulas reference nothing resolvable
  }
  return [...refs];
}

/**
 * Formula and Url button columns of OTHER tables that reach `columnId` through
 * a `{Link}.{Field}` path. Same-table references are handled by the callers.
 */
export async function getFormulasReferringColumnViaPath(
  context: NcContext,
  column: Pick<Column, 'id' | 'fk_model_id'>,
  ncMeta = Noco.ncMeta,
): Promise<{ column: Column; context: NcContext }[]> {
  const rows = [
    ...(await ncMeta
      .knex(MetaTable.COL_FORMULA)
      .where('fk_workspace_id', context.workspace_id)
      .where('formula', 'like', `%${column.id}%`)
      .select('fk_column_id', 'base_id', 'formula')),
    ...(await ncMeta
      .knex(MetaTable.COL_BUTTON)
      .where('fk_workspace_id', context.workspace_id)
      .where('type', ButtonActionsType.Url)
      .where('formula', 'like', `%${column.id}%`)
      .select('fk_column_id', 'base_id', 'formula')),
  ];

  const result = [];
  for (const row of rows) {
    let tree;
    try {
      tree = formulaJsep(row.formula);
    } catch {
      continue;
    }
    if (!formulaTreeReferencesColumn(tree, [column.id])) continue;

    const formulaContext = { ...context, base_id: row.base_id };
    const formulaColumn = await Column.get(
      formulaContext,
      { colId: row.fk_column_id },
      ncMeta,
    );
    if (formulaColumn && formulaColumn.fk_model_id !== column.fk_model_id) {
      result.push({ column: formulaColumn, context: formulaContext });
    }
  }
  return result;
}

/**
 * Rewrites `formula_raw` after a column rename: every reference to the column,
 * including hops of `{Link}.{Field}` paths, takes the new title.
 */
export function renameColumnInFormulaRaw({
  formula,
  formulaRaw,
  columnId,
  title,
}: {
  formula: string;
  formulaRaw: string;
  columnId: string;
  title: string;
}): string | null {
  let tree;
  let rawTree;
  try {
    tree = formulaJsep(formula);
    rawTree = formulaJsep(formulaRaw);
  } catch {
    return null;
  }

  let structureMatches = true;
  const walk = (node: any, rawNode: any) => {
    if (!node || typeof node !== 'object') return;
    if (!rawNode || typeof rawNode !== 'object' || rawNode.type !== node.type) {
      structureMatches = false;
      return;
    }
    if (node.type === 'Identifier' && node.name === columnId) {
      rawNode.name = title;
    }
    for (const key of Object.keys(node)) walk(node[key], rawNode[key]);
  };
  walk(tree, rawTree);

  return structureMatches ? jsepTreeToFormula(rawTree) : null;
}

export async function getFormulasReferredTheColumn(
  context: NcContext,
  {
    column,
    columns,
  }: {
    column: Column;
    columns: Column[];
  },
  ncMeta = Noco.ncMeta,
): Promise<Column[]> {
  const fn = (pt) => formulaTreeReferencesColumn(pt, [column.id, column.title]);

  return columns.reduce(async (columnsPromise, c) => {
    const columns = await columnsPromise;
    if (c.uidt !== UITypes.Formula && c.uidt !== UITypes.Button) return columns;

    const formula = await c.getColOptions<FormulaColumn | ButtonColumn>(ncMeta);

    if (UITypes.Button === c.uidt && (formula as ButtonColumn)?.type !== 'url')
      return columns;

    if (formula.formula && fn(formulaJsep(formula.formula))) {
      columns.push(c);
    }
    return columns;
  }, Promise.resolve([]));
}
