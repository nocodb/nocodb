/**
 * Converts Atlassian Document Format (ADF) to plain string
 * Recursively processes ADF nodes to extract text content
 * Referenced in: formatTicket
 */
export function adfToString(adf: any): string | null {
  if (!adf) {
    return null;
  }

  if (typeof adf === 'string') {
    return adf;
  }

  if (typeof adf !== 'object') {
    return null;
  }

  if (adf.type === 'doc' && Array.isArray(adf.content)) {
    return processAdfNodes(adf.content);
  }

  if (adf.type && adf.content) {
    return processAdfNodes([adf]);
  }

  return null;
}

/**
 * Processes an array of ADF nodes and converts them to string
 * Handles various node types: paragraphs, headings, lists, code blocks, etc.
 */
export function processAdfNodes(nodes: any[]): string {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node !== 'object') {
      continue;
    }

    const nodeType = node.type;

    switch (nodeType) {
      case 'paragraph': {
        const paraText = extractTextFromNode(node);
        if (paraText) {
          parts.push(paraText);
        }
        if (i < nodes.length - 1) {
          parts.push('\n');
        }
        break;
      }
      case 'heading': {
        const headingText = extractTextFromNode(node);
        if (headingText) {
          const level = node.attrs?.level || 1;
          const prefix = '#'.repeat(level) + ' ';
          parts.push(prefix + headingText);
        }
        parts.push('\n');
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const listText = processAdfNodes(node.content || []);
        if (listText) {
          parts.push(listText);
        }
        break;
      }
      case 'listItem': {
        const itemText = extractTextFromNode(node);
        if (itemText) {
          parts.push('• ' + itemText);
        }
        parts.push('\n');
        break;
      }
      case 'codeBlock': {
        const codeText = extractTextFromNode(node);
        if (codeText) {
          parts.push('\n```\n' + codeText + '\n```\n');
        }
        break;
      }
      case 'blockquote': {
        const quoteText = extractTextFromNode(node);
        if (quoteText) {
          parts.push('> ' + quoteText.split('\n').join('\n> '));
        }
        parts.push('\n');
        break;
      }
      case 'hardBreak': {
        parts.push('\n');
        break;
      }
      case 'rule': {
        parts.push('\n---\n');
        break;
      }
      case 'panel': {
        const panelText = extractTextFromNode(node);
        if (panelText) {
          parts.push(panelText);
        }
        parts.push('\n');
        break;
      }
      default: {
        const defaultText = extractTextFromNode(node);
        if (defaultText) {
          parts.push(defaultText);
        }
        if (Array.isArray(node.content)) {
          const nestedText = processAdfNodes(node.content);
          if (nestedText) {
            parts.push(nestedText);
          }
        }
        break;
      }
    }
  }

  return parts.join('');
}

/**
 * Extracts text content from an ADF node
 * Handles text nodes, links, mentions, and other inline content
 */
export function extractTextFromNode(node: any): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  if (node.text) {
    return node.text;
  }

  if (Array.isArray(node.content)) {
    return processAdfNodes(node.content);
  }

  switch (node.type) {
    case 'text':
      return node.text || '';

    case 'mention':
      return node.attrs?.text || node.attrs?.id || '';

    case 'emoji':
      return node.attrs?.shortName || node.attrs?.text || '';

    case 'inlineCard':
    case 'blockCard':
      return node.attrs?.url || '';

    case 'media':
      return node.attrs?.alt || '';

    default:
      return '';
  }
}
