import { JSEPNode } from 'nocodb-sdk';
import type { ParsedFormulaNode } from 'nocodb-sdk';
import type { FnHandlerKey } from './fn-handler.interface';

/**
 * Node helpers shared by the handlers and the query plan, so both agree on what
 * a node's key is and where its operands are.
 */

/**
 * A parsed-tree node as both sides see it: the emitter holds a typed node, the
 * plan walks a persisted tree it only knows the shape of.
 */
export type FnNode = ParsedFormulaNode | Record<string, unknown>;

/** The registry key this node would be handled under, if any. */
export function fnKeyOf(node: FnNode | undefined): FnHandlerKey | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const n = node as Record<string, unknown>;
  if (n.type === JSEPNode.BINARY_EXP) {
    return String(n.operator) as FnHandlerKey;
  }
  if (n.type === JSEPNode.CALL_EXP) {
    const name = (n.callee as { name?: string })?.name;
    return name ? (name.toUpperCase() as FnHandlerKey) : undefined;
  }
  return undefined;
}

/** Is this node a single-argument call to `name`? */
export function isCallTo(node: FnNode | undefined, name: string): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  return (
    n.type === JSEPNode.CALL_EXP &&
    (n.callee as { name?: string })?.name?.toUpperCase() === name &&
    (n.arguments as unknown[])?.length === 1
  );
}

/**
 * Where a node sits in its own parsed tree, as `$.left.arguments.0`. Stable for
 * a given tree object: the only mutation the builder makes is `setFnSlots`,
 * which replaces existing keys rather than adding them.
 */
export type FnSitePath = string;

/**
 * Keys that are not part of the expression and must not be descended into by a
 * generic walk: `callee` is a function name rather than an operand position, and
 * `optimization` is the plan's own verdict hung on the node, which would
 * otherwise be walked as if it were a subtree.
 */
export const FN_NON_OPERAND_KEYS: ReadonlySet<string> = new Set([
  'callee',
  'optimization',
]);

/**
 * A path for every node in the tree, from one generic walk. The single place a
 * position is named — the duplication walk and the emitter both read from here
 * rather than labelling from their own traversals, which would let the two
 * drift.
 *
 * A node object reachable twice keeps its first path; parsed trees come from
 * JSON so this does not arise in practice.
 */
export function fnSitePaths(tree: unknown): Map<object, FnSitePath> {
  const paths = new Map<object, FnSitePath>();
  const visit = (node: unknown, path: FnSitePath) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${path}.${i}`));
      return;
    }
    if (paths.has(node)) return;
    paths.set(node, path);
    for (const [key, child] of Object.entries(node)) {
      if (FN_NON_OPERAND_KEYS.has(key)) continue;
      if (child && typeof child === 'object') visit(child, `${path}.${key}`);
    }
  };
  visit(tree, '$');
  return paths;
}

/**
 * Operand slots in the order the multiplicity arrays index them: `[left, right]`
 * for a binary expression, `arguments` for a call.
 */
export function fnSlots(node: FnNode | undefined): ParsedFormulaNode[] {
  if (!node || typeof node !== 'object') return [];
  const n = node as Record<string, unknown>;
  if (n.type === JSEPNode.BINARY_EXP) {
    return [n.left, n.right] as ParsedFormulaNode[];
  }
  if (n.type === JSEPNode.CALL_EXP) {
    return ((n.arguments as ParsedFormulaNode[]) ?? []).slice();
  }
  return [];
}

/** Replace the operand slots in place, positionally matching `fnSlots`. */
export function setFnSlots(
  node: FnNode | undefined,
  slots: ParsedFormulaNode[],
): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  if (n.type === JSEPNode.BINARY_EXP) {
    n.left = slots[0];
    n.right = slots[1];
    return;
  }
  if (n.type === JSEPNode.CALL_EXP) {
    n.arguments = slots;
  }
}
