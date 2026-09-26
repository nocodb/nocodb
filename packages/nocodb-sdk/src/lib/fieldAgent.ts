import { SelectFieldAgentMetaProp } from '~/lib/globals';
import { parseProp } from './helperFunctions';
import type { ColumnType } from './Api';

/**
 * Field names an agent prompt references, from its `{Field}` tokens, in order of
 * first appearance and without duplicates. Prompts store references this way
 * whichever trigger character the editor used to insert them.
 */
export function extractFieldAgentReferences(promptRaw?: string | null): string[] {
  if (!promptRaw) return [];

  const refs: string[] = [];
  for (const [, token] of promptRaw.matchAll(/\{([^}]+)\}/g)) {
    if (!refs.includes(token)) refs.push(token);
  }
  return refs;
}

/** Empty for the purposes of "fill this cell" — select cells can hold `[]`. */
export function isFieldAgentValueEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && !value.length)
  );
}

/**
 * Whether automatic generation should run an agent for one written row.
 *
 * - On insert: only when the agent's cell is still empty and at least one
 *   referenced field has a value (a value supplied at insert is the user's).
 * - On update: only when one of the fields the prompt reads actually changed.
 */
export function shouldAutoGenerateRow(params: {
  isInsert: boolean;
  row: Record<string, unknown> | undefined;
  agentTitle: string;
  referencedTitles: string[];
  referencedIds: string[];
  changedColumnIds?: string[];
}): boolean {
  const { isInsert, row, agentTitle, referencedTitles, referencedIds } = params;

  if (!row || !referencedIds.length) return false;

  if (isInsert) {
    return (
      isFieldAgentValueEmpty(row[agentTitle]) &&
      referencedTitles.some((title) => !isFieldAgentValueEmpty(row[title]))
    );
  }

  return !!params.changedColumnIds?.some((id) => referencedIds.includes(id));
}

/**
 * Order agents so one whose prompt references another agent in the list runs
 * after it — each run reads its rows fresh, so it then sees the value just
 * generated. Anything left in a reference cycle keeps its original order.
 */
export function orderFieldAgentsByDependency<T extends ColumnType>(
  agents: T[]
): T[] {
  const byTitle = new Map(agents.map((agent) => [agent.title, agent]));

  const deps = new Map<T, Set<T>>();
  for (const agent of agents) {
    const promptRaw = parseProp(agent.meta)?.[SelectFieldAgentMetaProp]
      ?.prompt_raw;
    const refs = new Set<T>();
    for (const title of extractFieldAgentReferences(promptRaw)) {
      const dep = byTitle.get(title);
      if (dep && dep !== agent) refs.add(dep);
    }
    deps.set(agent, refs);
  }

  const ordered: T[] = [];
  const done = new Set<T>();
  let pending = [...agents];

  while (pending.length) {
    const ready = pending.filter((agent) =>
      [...deps.get(agent)!].every((dep) => done.has(dep))
    );
    // Cycle: nothing is ready, so release the rest in their original order
    const next = ready.length ? ready : pending;

    for (const agent of next) {
      ordered.push(agent);
      done.add(agent);
    }
    pending = pending.filter((agent) => !done.has(agent));
  }

  return ordered;
}
