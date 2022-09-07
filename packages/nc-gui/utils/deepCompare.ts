export const deepCompare = (a: any, b: any) => {
  if (a === b) return true
  if (a == null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return a === b
  if (Object.keys(a).length !== Object.keys(b).length) return false

  for (const k in a) {
    if (!(k in b)) return false
    if (!deepCompare(a[k], b[k])) return false
  }
  return true
}
