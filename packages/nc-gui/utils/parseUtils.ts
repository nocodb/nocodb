export function parseProp(v: any): any {
  if (!v) return {}
  try {
    return typeof v === 'string' ? JSON.parse(v) : v
  } catch {
    return {}
  }
}

export function stringifyProp(v: any): string | undefined {
  if (!v) return undefined
  try {
    return typeof v === 'string' ? v : JSON.stringify(v)
  } catch {
    return '{}'
  }
}
