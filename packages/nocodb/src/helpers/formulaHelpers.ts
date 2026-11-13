import {
  ButtonActionsType,
  findColumnByRef,
  formulaJsep,
  isCurlyIdentifier,
  UITypes,
} from 'nocodb-sdk';
import type FormulaColumn from '../models/FormulaColumn';
import type { NcContext } from '~/interface/config';
import type { ColumnType } from 'nocodb-sdk';
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
 * including hops of `{Link}.{Field}` paths, takes the new title. Only those
 * name tokens change. Null when the two forms cannot be lined up.
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
  try {
    return swapFormulaRawNames(formula, formulaRaw, (idName) =>
      idName === columnId ? title : undefined,
    );
  } catch {
    return null;
  }
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

type NamedColumn = Pick<ColumnType, 'id' | 'title' | 'column_name'>;

interface NameToken {
  start: number;
  end: number;
  name: string;
}

const IDENT_START = /[$_A-Za-z\u0080-￿]/;
const IDENT_PART = /[$_A-Za-z0-9\u0080-￿]/;
const RESERVED_NAMES = new Set(['true', 'false', 'null', 'this']);

// Field-name tokens of a formula in source order, skipping string literals,
// callees and plain member names. Mirrors the jsep curly hook for `{…}`.
function formulaNameTokens(text: string): NameToken[] {
  const tokens: NameToken[] = [];
  const nextNonSpace = (from: number) => {
    while (from < text.length && /\s/.test(text[from])) from++;
    return text[from];
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      i++;
      while (i < text.length && text[i] !== ch) i += text[i] === '\\' ? 2 : 1;
      i++;
    } else if (ch === '{') {
      const close = text.indexOf('}', i + 1);
      if (close === -1) return tokens;
      let raw = text.slice(i, close + 1);
      if (raw.startsWith('{{') && text[close + 1] === '}') {
        raw = text.slice(i, close + 2);
      }
      const end = i + raw.length;
      if (nextNonSpace(end) !== '(') {
        const name = /^{{.*}}$/.test(raw) ? raw.slice(2, -2) : raw.slice(1, -1);
        tokens.push({ start: i, end, name });
      }
      i = end;
    } else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(text[i + 1]))) {
      const m = /^[0-9]*\.?[0-9]*(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));
      i += Math.max(1, m[0].length);
    } else if (IDENT_START.test(ch)) {
      let end = i + 1;
      while (end < text.length && IDENT_PART.test(text[end])) end++;
      const name = text.slice(i, end);
      const prev = text.slice(0, i).trimEnd().slice(-1);
      if (
        prev !== '.' &&
        nextNonSpace(end) !== '(' &&
        !RESERVED_NAMES.has(name)
      ) {
        tokens.push({ start: i, end, name });
      }
      i = end;
    } else {
      i++;
    }
  }
  return tokens;
}

// Field references of a parsed formula in source order, including every hop
// of a `{Link}.{Field}` path. Callees and plain member names are left out.
function collectFieldRefs(pt: any, refs: any[]) {
  switch (pt?.type) {
    case 'Identifier':
      refs.push(pt);
      return;
    case 'MemberExpression':
      collectFieldRefs(pt.object, refs);
      if (pt.computed || isCurlyIdentifier(pt.property)) {
        collectFieldRefs(pt.property, refs);
      }
      return;
    case 'CallExpression':
      return (pt.arguments || []).forEach((a) => collectFieldRefs(a, refs));
    case 'UnaryExpression':
      return collectFieldRefs(pt.argument, refs);
    case 'BinaryExpression':
    case 'LogicalExpression':
      collectFieldRefs(pt.left, refs);
      return collectFieldRefs(pt.right, refs);
    case 'ArrayExpression':
      return (pt.elements || []).forEach((e) => collectFieldRefs(e, refs));
    case 'Compound':
      return (pt.body || []).forEach((e) => collectFieldRefs(e, refs));
    case 'ConditionalExpression':
      collectFieldRefs(pt.test, refs);
      collectFieldRefs(pt.consequent, refs);
      return collectFieldRefs(pt.alternate, refs);
  }
}

function sameShape(node: any, rawNode: any): boolean {
  if (!node || typeof node !== 'object') return true;
  if (!rawNode || typeof rawNode !== 'object' || rawNode.type !== node.type) {
    return false;
  }
  return Object.keys(node).every((key) => sameShape(node[key], rawNode[key]));
}

/**
 * Swap field names in `formulaRaw`, a formula as the user typed it, using
 * `formula`, the same formula with ids. `nameFor` gets each reference's id
 * and raw name and returns the name to write, or undefined to keep it. Only
 * name tokens change; literals, spacing and parentheses stay as saved.
 * Returns null when the two forms cannot be lined up.
 */
function swapFormulaRawNames(
  formula: string,
  formulaRaw: string,
  nameFor: (idName: string, rawName: string) => string | undefined,
): string | null {
  const tree = formulaJsep(formula);
  const rawTree = formulaJsep(formulaRaw);
  if (!sameShape(tree, rawTree)) return null;

  const refs = [];
  const rawRefs = [];
  collectFieldRefs(tree, refs);
  collectFieldRefs(rawTree, rawRefs);
  const tokens = formulaNameTokens(formulaRaw);
  if (
    refs.length !== rawRefs.length ||
    tokens.length !== rawRefs.length ||
    tokens.some((t, i) => t.name !== rawRefs[i].name)
  ) {
    return null;
  }

  let result = formulaRaw;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const name = nameFor(refs[i].name, rawRefs[i].name);
    if (name === undefined || name === tokens[i].name) continue;
    if (name.includes('}')) return null;
    result =
      result.slice(0, tokens[i].start) +
      `{${name}}` +
      result.slice(tokens[i].end);
  }
  return result;
}

/**
 * Swap stale field names in `formulaRaw` for the current titles of the fields
 * that `formula` (ids) points at. Returns `formulaRaw` itself when nothing is
 * stale or the two forms cannot be lined up.
 */
export function refreshFormulaRawNames(
  formula: string,
  formulaRaw: string,
  columns: NamedColumn[],
): string {
  return (
    swapFormulaRawNames(
      formula,
      formulaRaw,
      (idName) => findColumnByRef(columns, idName)?.title,
    ) ?? formulaRaw
  );
}

/**
 * `formula_raw` keeps the names it was saved with; the ids in `formula` follow
 * renames. Refresh the names, leaving the rest of the text as saved.
 */
export function withCurrentFormulaNames(
  column: Column,
  columns: NamedColumn[],
): Column | ColumnType {
  const colOptions = column.colOptions as
    | Partial<FormulaColumn | ButtonColumn>
    | undefined;
  const isFormula =
    column.uidt === UITypes.Formula ||
    (column.uidt === UITypes.Button &&
      (colOptions as Partial<ButtonColumn>)?.type === ButtonActionsType.Url);
  if (!isFormula || !colOptions?.formula || !colOptions.formula_raw) {
    return column;
  }
  try {
    const formula_raw = refreshFormulaRawNames(
      colOptions.formula,
      colOptions.formula_raw,
      columns,
    );
    if (formula_raw === colOptions.formula_raw) return column;
    return { ...column, colOptions: { ...colOptions, formula_raw } };
  } catch {
    // an unparsable stored formula is reported as it was saved
    return column;
  }
}
