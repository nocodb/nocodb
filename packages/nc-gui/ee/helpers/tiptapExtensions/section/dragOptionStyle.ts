import { TiptapNodesTypes } from 'nocodb-sdk'
import type { Node } from 'prosemirror-model'

export const dragOptionStyle = ({
  currentNode,
  parentNode,
  attrs,
}: {
  currentNode: Node
  parentNode: Node | undefined
  attrs: any
}) => {
  let style = {} as any
  const nodeType = currentNode.type.name as TiptapNodesTypes
  const parentNodeType = parentNode?.type.name as TiptapNodesTypes | undefined

  if (nodeType === TiptapNodesTypes.column) {
    style = {
      marginLeft: '-2rem',
      marginTop: '0.2rem',
      display: 'none',
    }
  } else if (nodeType === TiptapNodesTypes.task) {
    style = {
      marginTop: '0.2rem',
    }
  } else if (nodeType === TiptapNodesTypes.bullet) {
    style = {
      marginTop: '0.2rem',
    }
  } else if (nodeType === TiptapNodesTypes.ordered) {
    style = {
      marginTop: '0.2rem',
    }
  } else if (nodeType === TiptapNodesTypes.table) {
    style = {
      marginTop: '1.4rem',
    }
  } else if (nodeType === TiptapNodesTypes.heading && attrs.level === 1) {
    style = {
      marginTop: '0.7rem',
    }
  } else if (nodeType === TiptapNodesTypes.heading && attrs.level === 2) {
    style = {
      marginTop: '0.35rem',
    }
  } else if (nodeType === TiptapNodesTypes.heading && attrs.level === 3) {
    style = {
      marginTop: '0.1rem',
    }
  } else if (nodeType === TiptapNodesTypes.paragraph) {
    style = {
      marginTop: '0.2rem',
    }
  } else if (nodeType === TiptapNodesTypes.image) {
    style = {
      marginTop: '0.5rem',
    }
  } else if (nodeType === TiptapNodesTypes.quote) {
    style = {
      marginTop: '0.8rem',
    }
  } else if (nodeType === TiptapNodesTypes.codeBlock) {
    style = {
      marginTop: '1.2rem',
    }
  } else if (nodeType === TiptapNodesTypes.callout) {
    style = {
      marginTop: '1.3rem',
    }
  } else if (nodeType === TiptapNodesTypes.divider) {
    style = {
      marginTop: '0.55rem',
    }
  } else if (nodeType === TiptapNodesTypes.linkToPage && currentNode.attrs?.pageId) {
    style = {
      marginTop: '0.45rem',
    }
  } else {
    style = {
      marginTop: '0.7rem',
    }
  }

  if (parentNodeType === TiptapNodesTypes.collapsable) {
    style = {
      ...style,
      marginLeft: '-1.85rem',
    }
  }

  if (!style.marginRight) {
    style.marginRight = '0.18rem'
  }

  return style
}
