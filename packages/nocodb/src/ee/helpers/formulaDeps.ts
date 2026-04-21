/**
 * Walk a parsed formula tree and return a deduplicated list of
 * fk_column_id references. Input is the `parsed_tree` object stored
 * with a Formula column (jsep-style AST used by the formula engine).
 *
 * Handles:
 * - { type: 'column', fk_column_id: '...' }
 * - { type: 'call', arguments: [...] }
 * - { type: 'binop' | 'unop', left, right, operand }
 * - Any other node shape — recurses into all object values
 */
export function extractFormulaColumnRefs(node: any): string[] {
  const found = new Set<string>();
  const seen = new WeakSet<object>();
  walk(node, found, seen);
  return [...found];
}

function walk(node: any, found: Set<string>, seen: WeakSet<object>): void {
  if (node == null || typeof node !== 'object') return;
  if (seen.has(node)) return;
  seen.add(node);

  if (node.type === 'column' && typeof node.fk_column_id === 'string') {
    found.add(node.fk_column_id);
    return;
  }

  // Recurse into known containers first
  if (Array.isArray(node.arguments)) {
    for (const a of node.arguments) walk(a, found, seen);
  }
  if (node.left) walk(node.left, found, seen);
  if (node.right) walk(node.right, found, seen);
  if (node.operand) walk(node.operand, found, seen);

  // Catch-all: recurse into remaining object values for unknown node shapes.
  // The seen-set makes this a no-op for children already walked above and
  // also prevents infinite loops on cyclic references.
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') walk(v, found, seen);
  }
}
