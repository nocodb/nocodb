import type { TextOrNullType } from 'nocodb-sdk'

// Form-state values may include LTAR row objects (single bt/oo/mo) or arrays of rows (hm/mm/om).
// String(rowObj) returns "[object Object]", so extract a display value from the row instead.
// Skips id/system fields and picks the first primitive — works for the typical {Id, <pv>} shape
// LTAR cells store. Falls back to "" if no suitable field exists.
const SKIP_KEYS = new Set([
  'id',
  'Id',
  'ID',
  'CreatedAt',
  'UpdatedAt',
  'CreatedBy',
  'UpdatedBy',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
])

function stringifyTemplateValue(v: any): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) {
    return v
      .map(stringifyTemplateValue)
      .filter((s) => s !== '')
      .join(', ')
  }
  if (typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) {
      if (SKIP_KEYS.has(k) || k.startsWith('nc_') || k.startsWith('_')) continue
      if (val === null || val === undefined) continue
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return String(val)
      }
    }
    return ''
  }
  return String(v)
}

export function useTemplatedMessage(
  template: MaybeRefOrGetter<TextOrNullType | undefined>,
  options: MaybeRefOrGetter<Record<string, any>>,
) {
  const message = computed(() => {
    const temp = toValue(template)
    const opts = toValue(options)

    if (!temp?.trim()) {
      return ''
    }

    let res = temp

    for (const entry of Object.entries(opts)) {
      const pattern = new RegExp(`{\\s*${entry[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}`, 'g')
      res = res.replace(pattern, () => stringifyTemplateValue(entry[1]))
    }

    return res
  })

  return {
    message,
  }
}
