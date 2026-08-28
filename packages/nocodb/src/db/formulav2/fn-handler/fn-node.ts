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
