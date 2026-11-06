export interface RecordUpdateAuditDetails {
  old_data?: Record<string, unknown>
  data?: Record<string, unknown>
  column_meta?: Record<string, { type?: string; options?: { choices?: { id?: string }[] } } | undefined>
}

export const isSameRecordAuditValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const dropAuditField = (details: RecordUpdateAuditDetails, title: string) => {
  delete details.old_data?.[title]
  delete details.data?.[title]
  delete details.column_meta?.[title]
}

/** Drops the fields of an update whose old and new values are the same. */
export const dropNoopRecordAuditFields = (details: RecordUpdateAuditDetails) => {
  for (const title of Object.keys(details.column_meta ?? {})) {
    if (isSameRecordAuditValue(details.old_data?.[title], details.data?.[title])) dropAuditField(details, title)
  }
}

/**
 * Folds `next` into the earlier update `prev`: each field keeps its first old value and its
 * latest new value, and a field that ends where it started is dropped.
 */
export const mergeRecordUpdateAuditDetails = (prev: RecordUpdateAuditDetails, next: RecordUpdateAuditDetails) => {
  prev.old_data ??= {}
  prev.data ??= {}
  prev.column_meta ??= {}

  for (const [title, meta] of Object.entries(next.column_meta ?? {})) {
    const prevMeta = prev.column_meta[title]
    if (prevMeta) {
      const choices = prevMeta.options?.choices
      for (const option of (choices && meta?.options?.choices) || []) {
        if (!choices!.some((it) => it.id === option.id)) choices!.push(option)
      }
    } else {
      prev.column_meta[title] = meta
      prev.old_data[title] = next.old_data?.[title]
    }
    prev.data[title] = next.data?.[title]

    if (isSameRecordAuditValue(prev.old_data[title], prev.data[title])) dropAuditField(prev, title)
  }
}
