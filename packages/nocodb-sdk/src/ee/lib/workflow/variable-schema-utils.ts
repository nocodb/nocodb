import { VariableDefinition } from '~/lib'

/**
 * Recursively adds port information to all variables in a schema
 *
 * @param variables - Array of variable definitions to process
 * @param port - Port identifier to add to each variable
 * @returns New array with port information added to all variables
 */
export function addPortToSchema(
  variables: VariableDefinition[] | undefined,
  port: string,
): VariableDefinition[] | undefined {
  if (!variables) return undefined;

  return variables.map((variable) => ({
    ...variable,
    extra: {
      ...(variable.extra || {}),
      port,
      // Also add port to itemSchema if it exists
      itemSchema: variable.extra?.itemSchema
        ? addPortToSchema(variable.extra.itemSchema, port)
        : undefined,
    },
    children: variable.children
      ? addPortToSchema(variable.children, port)
      : undefined,
  }));
}

/**
 * Recursively prefixes all variable keys with the given prefix
 * Useful for nested variables that need namespaced keys (e.g., "item.fieldName")
 *
 * @param variables - Array of variable definitions to process
 * @param prefix - Prefix to add to each variable key
 * @returns New array with prefixed keys
 */


export function prefixVariableKeys<
  T extends VariableDefinition | VariableDefinition[] | undefined
>(
  variables: T,
  prefix: string,
): T {
  if (!variables) return variables;

  const isArray = Array.isArray(variables);

  const vars = isArray ? variables : [variables];

  const prefixed = vars.map((variable) => ({
    ...variable,
    key: `${prefix}.${variable.key}`,
    children: variable.children
      ? prefixVariableKeys(variable.children, prefix)
      : undefined,
    extra: variable.extra?.itemSchema
      ? {
        ...variable.extra,
        itemSchema: prefixVariableKeys(
          variable.extra.itemSchema,
          prefix,
        ),
      }
      : variable.extra,
  }));

  return (isArray ? prefixed : prefixed[0]) as T;
}

export function findVariableByPath(
  path: string,
  variables: VariableDefinition[],
): VariableDefinition | undefined {
  for (const variable of variables) {
    if (variable.key === path || variable.key.endsWith(`.${path}`)) {
      return variable;
    }

    if (!variable?.children) continue;
    if (variable.children?.length > 0) {
      const found = this.findVariableByPath(path, variable.children);
      if (found) return found;
    }
  }
  return undefined;
}
