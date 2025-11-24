import TipTapMention from '@tiptap/extension-mention'
import type { VariableDefinition } from 'nocodb-sdk'

export const WorkflowExpression = TipTapMention.extend({
  name: 'workflowExpression',

  addOptions() {
    return {
      ...this.parent?.(),
      variables: [] as VariableDefinition[],
      nodeId: '',
    }
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {}
          }
          return {
            'data-id': attributes.id,
          }
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {}
          }
          return {
            'data-label': attributes.label,
          }
        },
      },
      expression: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-expression'),
        renderHTML: (attributes) => {
          if (!attributes.expression) {
            return {}
          }
          return {
            'data-expression': attributes.expression,
          }
        },
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.label || node.attrs.expression || node.attrs.id

    return [
      'span',
      {
        ...HTMLAttributes,
        'class': 'nc-workflow-expression',
        'data-type': 'workflowExpression',
        'data-id': node.attrs.id,
        'data-label': node.attrs.label,
        'data-expression': node.attrs.expression,
        'contenteditable': 'false',
      },
      label,
    ]
  },

  deleteTriggerWithBackspace: true,

  addStorage() {
    return {
      serialize(node: any) {
        return node.attrs.expression || ''
      },
      // Parse NocoDB expression format
      parse(text: string) {
        const expressionRegex = /\{\{([^}]+)\}\}/g
        const matches = text.matchAll(expressionRegex)

        const expressions: Array<{ expression: string; position: number }> = []
        for (const match of matches) {
          expressions.push({
            expression: match[1].trim(),
            position: match.index!,
          })
        }

        return expressions
      },
    }
  },
})
