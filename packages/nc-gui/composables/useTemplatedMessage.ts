import type { ColumnType, TableType, TextOrNullType } from 'nocodb-sdk'

export function useTemplatedMessage(
  template: MaybeRefOrGetter<TextOrNullType | undefined>,
  options: MaybeRefOrGetter<Record<string, any>>,
  columns?: MaybeRefOrGetter<ColumnType[] | undefined>,
  meta?: MaybeRefOrGetter<TableType | undefined>,
) {
  const { t } = useI18n()
  const { metas } = useMetas()
  const { isMysql, isXcdbBase } = useBase()
  const { basesUser } = storeToRefs(useBases())

  const message = computed(() => {
    const temp = toValue(template)
    const opts = toValue(options)

    if (!temp?.trim()) {
      return ''
    }

    const cols = toValue(columns)
    const tableMeta = toValue(meta)

    let res = temp

    for (const entry of Object.entries(opts)) {
      const fieldName = entry[0]
      const value = entry[1]

      // Use parsePlainCellValue when column metadata is available — handles every cell type
      // (LTAR / Lookup / User / Date / Multi-select / etc.) using the existing display-value rules
      // instead of relying on String(value), which renders linked-record objects as "[object Object]".
      let stringValue: string | undefined
      const col = cols?.find((c) => c.title === fieldName)
      if (col && tableMeta) {
        stringValue = parsePlainCellValue(value, {
          col,
          abstractType: undefined,
          meta: tableMeta,
          metas: metas.value,
          baseUsers: basesUser.value,
          isMysql,
          isXcdbBase,
          t,
        })
      }

      if (stringValue === undefined) {
        stringValue = value === null || value === undefined ? '' : String(value)
      }

      const pattern = new RegExp(`{\\s*${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}`, 'g')
      res = res.replace(pattern, () => stringValue!)
    }

    return res
  })

  return {
    message,
  }
}
