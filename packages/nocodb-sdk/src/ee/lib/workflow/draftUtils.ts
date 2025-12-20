import rfdc from 'rfdc';
import isEqual from 'fast-deep-equal';
import type { WorkflowType } from '~/lib/Api';
import type { WorkflowGeneralNode } from '~/lib/workflow/interface';
import { GeneralNodeID } from '~/lib/workflow/constants';

const clone = rfdc();

/**
 * Check if workflow draft has actual changes, ignoring specified fields
 *
 * @param workflow - The workflow object containing draft and published versions
 * @param ignoreFields - Array of field names to ignore when comparing (default: ['testResult'])
 * @returns true if there are actual differences (excluding ignored fields), false otherwise
 */
export function hasWorkflowDraftChanges(
  workflow: WorkflowType,
  ignoreFields: string[] = ['testResult']
): boolean {
  // If no draft exists, no changes
  if (!workflow.draft) {
    return false;
  }

  // If no published version, any draft is considered a change
  if (!workflow.nodes || !workflow.edges) {
    return !!(workflow.draft.nodes || workflow.draft.edges);
  }

  // Deep clone both objects to avoid mutation
  const draftCleaned = clone({
    nodes: workflow.draft.nodes || [],
    edges: workflow.draft.edges || [],
  });
  const publishedCleaned = clone({
    nodes: workflow.nodes || [],
    edges: workflow.edges || [],
  });

  const cleanNodes = (nodes: Array<WorkflowGeneralNode>) => {
    if (!nodes) return [];
    return nodes.map((node) => {
      if (node.data) {
        ignoreFields.forEach((field) => {
          if (node.data[field] !== undefined) {
            delete node.data[field];
          }
        });
      }
      return node;
    });
  };

  draftCleaned.nodes = cleanNodes(draftCleaned.nodes as Array<WorkflowGeneralNode>);
  publishedCleaned.nodes = cleanNodes(publishedCleaned.nodes as Array<WorkflowGeneralNode>);

  // Compare the cleaned objects
  return !isEqual(draftCleaned, publishedCleaned);
}
