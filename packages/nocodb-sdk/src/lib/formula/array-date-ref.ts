import UITypes from '~/lib/UITypes';
import { parseProp } from '~/lib/helperFunctions';
import { FormulaDataTypes, JSEPNode } from '~/lib/formula/enums';
import type { ParsedFormulaNode } from '~/lib/formula/types';

/**
 * Id of the multi-value date field a formula only references, as in
 * `{LkDue}` over a has-many date lookup.
 */
export function getFormulaArrayDateRefColumnId(
  parsedTree?: ParsedFormulaNode | null
): string | undefined {
  if (
    parsedTree?.type === JSEPNode.IDENTIFIER &&
    parsedTree.dataType === FormulaDataTypes.DATE &&
    parsedTree.isDataArray
  ) {
    return parsedTree.name;
  }
  return undefined;
}

/**
 * The Lookup a formula filters through: follows `{Ref}`-only formulas
 * (`F2 = {F1}`, `F1 = {LkDue}`) until a Lookup, or undefined if the chain
 * ends anywhere else. A date condition then matches when any of its dates
 * does. Formula columns in `columns` need their colOptions loaded.
 */
export function resolveFormulaArrayDateRef<
  T extends { id?: string; uidt?: unknown; colOptions?: unknown }
>(column: T, columns: T[]): T | undefined {
  const seen = new Set<string>();
  let current: T | undefined = column;
  while (current?.uidt === UITypes.Formula && !seen.has(current.id!)) {
    seen.add(current.id!);
    const refId = getFormulaArrayDateRefColumnId(
      parseProp(current.colOptions)?.parsed_tree
    );
    if (!refId) return undefined;
    current = columns.find((c) => c.id === refId);
  }
  return current !== column && current?.uidt === UITypes.Lookup
    ? current
    : undefined;
}
