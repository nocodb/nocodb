import type { VariableDefinition, WorkflowValueKind } from 'nocodb-sdk'
import {
  getWorkflowKindAfter,
  getWorkflowValueKind,
  getWorkflowVariableKind,
  parseWorkflowExpressionTransforms,
} from 'nocodb-sdk'

/** Matches one `{{ }}` token; braces can't nest inside, same as the engine. */
const WORKFLOW_EXPRESSION_TOKEN = /\{\{([^{}]*)\}\}/g

/** Every `{{ }}` token in `text` with its range and the expression inside it. */
function findWorkflowExpressionTokens(text: string) {
  return [...text.matchAll(WORKFLOW_EXPRESSION_TOKEN)].map((match) => ({
    from: match.index!,
    to: match.index! + match[0].length,
    expression: match[1].trim(),
  }))
}

/** A variable by its full key, looking through nested fields too. */
function findWorkflowVariable(key: string, variables: VariableDefinition[]): VariableDefinition | undefined {
  for (const variable of variables) {
    if (variable.key === key) return variable
    const nested = variable.children?.length ? findWorkflowVariable(key, variable.children) : undefined
    if (nested) return nested
  }
}

// A plain read of a value: `$('Step')` then property and index access only.
const PLAIN_PATH = /^\$\(\s*['"][^'"]+['"]\s*\)(?:\.[\w$]+|\[['"][^'"]+['"]\]|\[\d+\])*$/

/** The variable `expression` reads from and a short label for its chip, e.g. "Name". */
function getWorkflowVariableChipMeta(expression: string, variables: VariableDefinition[]): { id: string; label: string } {
  const variable = variables.filter((v) => expression.includes(v.key)).sort((a, b) => b.key.length - a.key.length)[0]
  if (!variable) return { id: expression, label: expression }

  // Hand-written code is named after the value it starts from, marked as an expression.
  if (!PLAIN_PATH.test(expression)) {
    const [, path = ''] = expression.split(variable.key)
    const read = /^(?:\.[\w$]+|\[['"][^'"]+['"]\]|\[\d+\])*/.exec(path)?.[0] ?? ''
    const properties = [...read.matchAll(/\.([\w$]+)|\[['"]([^'"]+)['"]\]/g)].map((match) => match[1] || match[2])
    return { id: variable.key, label: `ƒx ${properties.length ? properties[properties.length - 1] : variable.name}` }
  }

  const remainingPath = expression.slice(variable.key.length)
  if (!remainingPath) return { id: variable.key, label: variable.name }

  const properties = [...remainingPath.matchAll(/\.(\w+)|\[['"]([^'"]+)['"]\]/g)].map((match) => match[1] || match[2])
  return { id: variable.key, label: properties.length ? properties[properties.length - 1]! : variable.name }
}

/** A transform's name for the kind of value it gets: "Count" counts a text's characters, a list's items. */
function getWorkflowTransformLabel(id: string, inputKind: WorkflowValueKind, t: (key: string) => string) {
  if (id === 'count' && inputKind === 'text') return t('labels.workflow.transforms.countCharacters')
  return t(`labels.workflow.transforms.${id}`)
}

/** Chip label for a whole expression; transforms on it are named after the value: "Name · Uppercase". */
function getWorkflowExpressionChipMeta(
  expression: string,
  variables: VariableDefinition[],
  t: (key: string) => string,
): { id: string; label: string } {
  const { base, steps } = parseWorkflowExpressionTransforms(expression)
  const meta = getWorkflowVariableChipMeta(base, variables)
  if (!steps.length) return meta
  const baseKind = getWorkflowExpressionKind(base, variables)
  return {
    id: meta.id,
    label: [
      meta.label,
      ...steps.map((step, index) => getWorkflowTransformLabel(step.id, getWorkflowKindAfter(baseKind, steps.slice(0, index)), t)),
    ].join(' · '),
  }
}

/**
 * What kind of value `expression` gives. A sample from test data is the truth; without one the
 * variable's declared type is used, and anything else is unknown.
 */
function getWorkflowExpressionKind(
  expression: string,
  variables: VariableDefinition[],
  sample?: { value?: unknown } | null,
): WorkflowValueKind {
  if (sample && sample.value !== undefined && sample.value !== null) return getWorkflowValueKind(sample.value)
  const variable = findWorkflowVariable(expression, variables)
  return variable ? getWorkflowVariableKind(variable.type, variable.isArray) : 'any'
}

export {
  findWorkflowExpressionTokens,
  findWorkflowVariable,
  getWorkflowExpressionChipMeta,
  getWorkflowExpressionKind,
  getWorkflowTransformLabel,
  getWorkflowVariableChipMeta,
}
