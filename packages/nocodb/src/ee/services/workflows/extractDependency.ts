import { ncIsString, workflowJsep } from 'nocodb-sdk';
import type { WorkflowGeneralNode } from 'nocodb-sdk';

export interface DependencyInfo {
  id: string;
  path: string;
  nodeId?: string;
  nodeType?: string;
}

export interface WorkflowDependencies {
  columns: DependencyInfo[];
  models: DependencyInfo[];
  views: DependencyInfo[];
}

/**
 * Normalize variable key by removing bracket notation for comparison
 * E.g., "record.fields['Title']" -> "record.fields.Title"
 */
function normalizeVariableKey(key: string): string {
  return key.replace(/\['([^']+)']/g, '.$1');
}

/**
 * Convert variable key to proper expression path with bracket notation where needed
 * E.g., "record.fields.Date Title" -> "record.fields['Date Title']"
 */
function toExpressionPath(key: string): string {
  if (key.includes('[')) {
    return key;
  }

  const parts = key.split('.');
  const lastIdx = parts.length - 1;
  const lastPart = parts[lastIdx];

  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(lastPart)) {
    parts[lastIdx] = `['${lastPart}']`;
    return parts.slice(0, -1).join('.') + parts[lastIdx];
  }

  return key;
}

/**
 * Find a variable by key in a variable tree
 */
function findVariableByKey(variables: any[], targetKey: string): any | null {
  if (!Array.isArray(variables)) return null;

  const normalizedTarget = normalizeVariableKey(targetKey);

  for (const variable of variables) {
    const normalizedKey = normalizeVariableKey(variable.key);

    if (variable.key === targetKey || normalizedKey === normalizedTarget) {
      return variable;
    }

    if (variable.children?.length) {
      const found = findVariableByKey(variable.children, targetKey);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extract dependencies from interpolated expressions in config
 * Returns dependencies found in the current node's config
 */
function extractFromInterpolations(
  config: any,
  nodes: WorkflowGeneralNode[],
  currentNodeMetadata: {
    nodeId: string;
    nodeType: string;
    nodeName: string;
  },
): WorkflowDependencies {
  const dependencies: WorkflowDependencies = {
    columns: [],
    models: [],
    views: [],
  };

  function processValue(value: any): void {
    if (typeof value === 'string') {
      const interpolationRegex = /\{\{\s*([^}]+?)\s*}}/g;
      let match;

      while ((match = interpolationRegex.exec(value)) !== null) {
        const expression = match[1];
        if (!expression) continue;

        try {
          const ast = workflowJsep(expression);
          extractDependenciesFromAST(
            ast,
            nodes,
            currentNodeMetadata,
            dependencies,
          );
        } catch (error) {
          console.warn(
            'Failed to parse workflow expression:',
            expression,
            error,
          );
        }
      }
    } else if (value && typeof value === 'object') {
      for (const key in value) {
        processValue(value[key]);
      }
    }
  }

  processValue(config);
  return dependencies;
}

/**
 * Extract dependencies from AST by finding referenced variables
 */
function extractDependenciesFromAST(
  node: any,
  nodes: WorkflowGeneralNode[],
  currentNodeMetadata: any,
  dependencies: WorkflowDependencies,
): void {
  if (!node || typeof node !== 'object') return;

  // Handle MemberExpression: $('Node').record.fields.Title
  if (node.type === 'MemberExpression') {
    // Collect the variable path
    const parts: string[] = [];
    let referencedNodeName: string | null = null;

    // eslint-disable-next-line no-inner-declarations
    function collectParts(n: any): void {
      if (!n || typeof n !== 'object') return;

      if (n.type === 'MemberExpression') {
        collectParts(n.object);

        if (n.property.type === 'Identifier') {
          parts.push(n.property.name);
        } else if (n.property.type === 'Literal') {
          parts.push(String(n.property.value));
        }
      } else if (n.type === 'CallExpression') {
        // This is $('NodeName')
        if (
          n.callee?.type === 'Identifier' &&
          n.callee.name === '$' &&
          n.arguments?.[0]?.type === 'Literal'
        ) {
          referencedNodeName = n.arguments[0].value;
        }
        return;
      } else if (n.type === 'Identifier') {
        parts.push(n.name);
      }
    }

    collectParts(node);

    // If we found a reference to another node, look up the variable
    if (referencedNodeName && parts.length > 0) {
      const variableKey = parts.join('.');

      // Find the referenced node by name
      const referencedNode = nodes.find(
        (n) =>
          n.data?.title === referencedNodeName || n.type === referencedNodeName,
      );

      if (referencedNode) {
        // Look in outputVariables for the variable
        const outputVars =
          referencedNode.data?.outputVariables ||
          referencedNode.data?.testResult?.outputVariables;

        if (outputVars) {
          const variable = findVariableByKey(outputVars, variableKey);

          if (variable) {
            // Check current variable for entity metadata
            let entityId = variable.extra?.entity_id;
            let entity = variable.extra?.entity;

            // If not found, try to find parent variable and check its metadata
            if (!entityId || !entity) {
              const parentPath = variableKey.split('.').slice(0, -1).join('.');
              if (parentPath) {
                const parentVariable = findVariableByKey(
                  outputVars,
                  parentPath,
                );
                if (
                  parentVariable?.extra?.entity_id &&
                  parentVariable?.extra?.entity
                ) {
                  entityId = parentVariable.extra.entity_id;
                  entity = parentVariable.extra.entity;
                }
              }
            }

            if (entityId && entity && ncIsString(entityId)) {
              const expressionPath = toExpressionPath(variableKey);
              const fullPath = `$('${referencedNodeName}').${expressionPath}`;

              const depInfo: DependencyInfo = {
                id: entityId,
                path: fullPath,
                nodeId: currentNodeMetadata.nodeId,
                nodeType: currentNodeMetadata.nodeType,
              };

              if (entity === 'column') {
                dependencies.columns.push(depInfo);
              } else if (entity === 'table') {
                dependencies.models.push(depInfo);
              } else if (entity === 'view') {
                dependencies.views.push(depInfo);
              }
            }
          }
        }
      }
    }
    return;
  }

  // Handle CallExpression and other node types
  if (node.type === 'CallExpression') {
    extractDependenciesFromAST(
      node.callee,
      nodes,
      currentNodeMetadata,
      dependencies,
    );
    if (node.arguments?.length) {
      for (const arg of node.arguments) {
        extractDependenciesFromAST(
          arg,
          nodes,
          currentNodeMetadata,
          dependencies,
        );
      }
    }
    return;
  }

  // Traverse other expression types
  if (node.left)
    extractDependenciesFromAST(
      node.left,
      nodes,
      currentNodeMetadata,
      dependencies,
    );
  if (node.right)
    extractDependenciesFromAST(
      node.right,
      nodes,
      currentNodeMetadata,
      dependencies,
    );
  if (node.argument)
    extractDependenciesFromAST(
      node.argument,
      nodes,
      currentNodeMetadata,
      dependencies,
    );
  if (node.test)
    extractDependenciesFromAST(
      node.test,
      nodes,
      currentNodeMetadata,
      dependencies,
    );
  if (node.consequent)
    extractDependenciesFromAST(
      node.consequent,
      nodes,
      currentNodeMetadata,
      dependencies,
    );
  if (node.alternate)
    extractDependenciesFromAST(
      node.alternate,
      nodes,
      currentNodeMetadata,
      dependencies,
    );
  if (node.elements?.length) {
    for (const element of node.elements) {
      extractDependenciesFromAST(
        element,
        nodes,
        currentNodeMetadata,
        dependencies,
      );
    }
  }
}

/**
 * Extract dependencies from inputVariables (config references)
 */
function extractFromInputVariables(
  variables: any[],
  nodeMetadata: {
    nodeId: string;
    nodeType: string;
    nodeName: string;
  },
): WorkflowDependencies {
  const dependencies: WorkflowDependencies = {
    columns: [],
    models: [],
    views: [],
  };

  function processVariable(variable: any, parentVariable?: any): void {
    // Check current variable for entity metadata
    let entityId = variable.extra?.entity_id;
    let entity = variable.extra?.entity;

    // If not found and parent exists, check parent for entity metadata
    if (
      (!entityId || !entity) &&
      parentVariable?.extra?.entity_id &&
      parentVariable?.extra?.entity
    ) {
      entityId = parentVariable.extra.entity_id;
      entity = parentVariable.extra.entity;
    }

    if (entityId && entity && ncIsString(entityId)) {
      const expressionPath = toExpressionPath(variable.key);
      const fullPath = `$('${nodeMetadata.nodeName}').${expressionPath}`;

      const depInfo: DependencyInfo = {
        id: entityId,
        path: fullPath,
        nodeId: nodeMetadata.nodeId,
        nodeType: nodeMetadata.nodeType,
      };

      if (entity === 'column') {
        dependencies.columns.push(depInfo);
      } else if (entity === 'table') {
        dependencies.models.push(depInfo);
      } else if (entity === 'view') {
        dependencies.views.push(depInfo);
      }
    }

    // Check for entityReferences in extra (for arrays with entity dependencies)
    if (variable.extra?.entityReferences && Array.isArray(variable.extra.entityReferences)) {
      variable.extra.entityReferences.forEach((ref: any) => {
        if (ref.entity_id && ref.entity && ncIsString(ref.entity_id)) {
          const fieldPath = ref.field ? `.${ref.field}` : '';
          const expressionPath = toExpressionPath(variable.key);
          const fullPath = `$('${nodeMetadata.nodeName}').${expressionPath}${fieldPath}`;

          const depInfo: DependencyInfo = {
            id: ref.entity_id,
            path: fullPath,
            nodeId: nodeMetadata.nodeId,
            nodeType: nodeMetadata.nodeType,
          };

          if (ref.entity === 'column') {
            dependencies.columns.push(depInfo);
          } else if (ref.entity === 'table') {
            dependencies.models.push(depInfo);
          } else if (ref.entity === 'view') {
            dependencies.views.push(depInfo);
          }
        }
      });
    }

    if (variable.children?.length) {
      variable.children.forEach((child: any) =>
        processVariable(child, variable),
      );
    }
  }

  if (Array.isArray(variables)) {
    variables.forEach(processVariable);
  }

  return dependencies;
}

/**
 * Extract all dependencies from workflow nodes
 */
export function extractWorkflowDependencies(
  nodes: WorkflowGeneralNode[] | undefined,
): WorkflowDependencies {
  const allDependencies: WorkflowDependencies = {
    columns: [],
    models: [],
    views: [],
  };

  if (!nodes || !Array.isArray(nodes)) {
    return allDependencies;
  }

  nodes.forEach((node) => {
    const nodeMetadata = {
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.data?.title,
    };

    const inputVariables =
      node.data?.inputVariables || node.data?.testResult?.inputVariables;
    if (inputVariables) {
      const inputDeps = extractFromInputVariables(inputVariables, nodeMetadata);
      allDependencies.columns.push(...inputDeps.columns);
      allDependencies.models.push(...inputDeps.models);
      allDependencies.views.push(...inputDeps.views);
    }

    if (node.data?.config) {
      const interpolationDeps = extractFromInterpolations(
        node.data.config,
        nodes,
        nodeMetadata,
      );
      allDependencies.columns.push(...interpolationDeps.columns);
      allDependencies.models.push(...interpolationDeps.models);
      allDependencies.views.push(...interpolationDeps.views);
    }
  });

  return allDependencies;
}
