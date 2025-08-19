export const extractObjectValue = (node: any) => {
  if (!node) return undefined

  if (node.type === 'TemplateLiteral') {
    return node.quasis[0].value.cooked
  } else if (node.type === 'Literal') {
    return node.value
  } else if (node.type === 'ArrayExpression') {
    return node.elements.map((element: any) => extractObjectValue(element))
  } else if (node.type === 'ObjectExpression') {
    const obj: any = {}
    node.properties.forEach((prop: any) => {
      obj[prop.key.name || prop.key.value] = extractObjectValue(prop.value)
    })
    return obj
  }
  return undefined
}