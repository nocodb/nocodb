import { TiptapNodesTypes } from 'nocodb-sdk'

export const dragOptionStyle = ({
  nodeType,
  parentNodeType,
  attrs,
}: {
  nodeType: TiptapNodesTypes
  parentNodeType: TiptapNodesTypes
  attrs: any
}) => {
  let style = {} as any

  if (nodeType === TiptapNodesTypes.task) {
    style = {
      marginTop: '0.2rem',
    }
  } else if (nodeType === TiptapNodesTypes.bullet) {
    style = {
      marginTop: '0.2rem',
      marginRight: '1.1rem',
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
  } else if (
    nodeType === TiptapNodesTypes.infoCallout ||
    nodeType === TiptapNodesTypes.warningCallout ||
    nodeType === TiptapNodesTypes.tipCallout
  ) {
    style = {
      marginTop: '1.25rem',
    }
  } else if (nodeType === TiptapNodesTypes.divider) {
    style = {
      marginTop: '0.55rem',
    }
  } else {
    style = {
      marginTop: '0.7rem',
    }
  }

  if (parentNodeType === TiptapNodesTypes.collapsable) {
    style = {
      ...style,
      marginLeft: '-1.75rem',
    }
  }

  if (!style.marginRight) {
    style.marginRight = '0.18rem'
  }

  return style
}
