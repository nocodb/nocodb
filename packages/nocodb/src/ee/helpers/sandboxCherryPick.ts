import type { SandboxChangelog } from '~/models';

/**
 * Validate that a sequence of changelog commands forms a consistent
 * dependency chain. Each command may reference entities by ID — those
 * entities must exist on production or be created by a prior command in
 * the sequence.
 *
 * Returns an array of error messages. Empty = valid.
 */
export function validateCommandSequence(
  entries: SandboxChangelog[],
  productionEntityIds?: Set<string>,
): string[] {
  const errors: string[] = [];
  const createdEntities = new Set<string>();

  for (const entry of entries) {
    // Check that parent entity exists (in production or created by prior command)
    if (entry.parent_entity_id) {
      const parentExists =
        productionEntityIds?.has(entry.parent_entity_id) ||
        createdEntities.has(entry.parent_entity_id);

      if (!parentExists) {
        errors.push(
          `${entry.event} "${entry.entity_title || entry.entity_id}" ` +
            `requires parent ${entry.parent_entity_id} which is not available`,
        );
      }
    }

    // Track entities created by this command
    if (entry.entity_id && isCreateOperation(entry.event)) {
      createdEntities.add(entry.entity_id);
    }
  }

  return errors;
}

/**
 * Check if an operation creates a new entity.
 */
function isCreateOperation(operation: string): boolean {
  return (
    operation.includes('Create') ||
    operation.includes('create') ||
    operation === 'columnAdd' ||
    operation === 'setPermission'
  );
}

function parseMeta(entry: SandboxChangelog): any {
  if (!entry.meta) return {};
  return typeof entry.meta === 'string' ? JSON.parse(entry.meta) : entry.meta;
}

/**
 * Given a set of selected changelog entry IDs, expand the selection
 * to include all required dependencies.
 *
 * Rules:
 * - If a child is selected (e.g., field), auto-include its parent
 *   (e.g., table) if the parent was created in the sandbox
 * - If a selected entry references other entities via meta.deps
 *   (e.g., formula column referencing other columns), auto-include
 *   those referenced entities when they were created in the sandbox
 * - If a parent is deselected, auto-deselect all its children
 *
 * Returns the expanded set of entry IDs.
 */
export function expandSelectedEntries(
  allEntries: SandboxChangelog[],
  selectedIds: Set<string>,
): Set<string> {
  const expanded = new Set(selectedIds);
  const entryMap = new Map(allEntries.map((e) => [e.id, e]));

  // Build parent→children index from changelog entries
  const createdEntityToEntry = new Map<string, SandboxChangelog>();
  for (const entry of allEntries) {
    if (entry.entity_id && isCreateOperation(entry.event)) {
      createdEntityToEntry.set(entry.entity_id, entry);
    }
  }

  // Upward expansion: walk parents AND referential deps transitively
  const queue = [...expanded];
  while (queue.length) {
    const id = queue.shift()!;
    const entry = entryMap.get(id);
    if (!entry) continue;

    if (entry.parent_entity_id) {
      const parentEntry = createdEntityToEntry.get(entry.parent_entity_id);
      if (parentEntry && !expanded.has(parentEntry.id)) {
        expanded.add(parentEntry.id);
        queue.push(parentEntry.id);
      }
    }

    const meta = parseMeta(entry);
    for (const dep of meta?.deps || []) {
      const depEntry = createdEntityToEntry.get(dep.id);
      if (depEntry && !expanded.has(depEntry.id)) {
        expanded.add(depEntry.id);
        queue.push(depEntry.id);
      }
    }
  }

  // Downward removal: if a CREATE entry is NOT selected,
  // remove all entries that depend on it
  for (const entry of allEntries) {
    if (!entry.parent_entity_id) continue;

    const parentEntry = createdEntityToEntry.get(entry.parent_entity_id);
    if (parentEntry && !expanded.has(parentEntry.id)) {
      expanded.delete(entry.id);
    }
  }

  return expanded;
}
