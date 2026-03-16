/**
 * Shared helpers for agent prompt builders.
 */

import type { SpecialistPromptParams } from '~/integrations/ai/chat/agents/types';

interface DynamicSectionOptions {
  /** Include "Viewer → read-only | Editor → + records, views | ..." role descriptions */
  roleDescription?: boolean;
  /** Skip user roles section entirely (e.g. UI agent) */
  skipRoles?: boolean;
}

/**
 * Appends the standard dynamic sections (task, roles, schema, turn summaries)
 * to a specialist prompt's parts array.
 */
export function appendDynamicSections(
  parts: string[],
  params: SpecialistPromptParams,
  options: DynamicSectionOptions = {},
): void {
  // Router instruction
  if (params.routerInstruction) {
    parts.push(`
## Current Task

${params.routerInstruction}`);
  }

  // User roles
  if (!options.skipRoles) {
    const roleLines = [`Workspace role: ${params.userRoles.workspaceRole}`];
    if (params.userRoles.baseRole) {
      roleLines.push(`Base role: ${params.userRoles.baseRole}`);
    }
    parts.push(`
## User Context

${roleLines.join(' | ')}${
      options.roleDescription
        ? '\n\nViewer → read-only | Editor → + records, views | Creator → + tables, fields | Owner → full access'
        : ''
    }`);
  }

  // Schema
  if (params.schemaContext) {
    const heading = params.baseName
      ? `## Active Base: ${params.baseName}`
      : '## Active Base';
    parts.push(`
${heading}

${params.schemaContext}`);
  }

  // Turn summaries
  if (params.turnSummaries?.length) {
    parts.push(`
## Context from Other Agents

${params.turnSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }
}
