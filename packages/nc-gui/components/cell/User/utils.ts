import type { ColumnType, UserFieldRecordType, UserType } from 'nocodb-sdk'

export const getOptions = (
  column: ColumnType,
  isEditColumn: boolean,
  isForm: boolean,
  baseUsers: (Partial<UserType> | Partial<User>)[],
) => {
  let order = 1
  const limitOptionsById =
    ((parseProp(column.meta)?.limitOptions || []).reduce(
      (o: Record<string, FormFieldsLimitOptionsType>, f: FormFieldsLimitOptionsType) => {
        if (order < (f?.order ?? 0)) {
          order = f.order
        }
        return {
          ...o,
          [f.id]: f,
        }
      },
      {},
    ) as Record<string, FormFieldsLimitOptionsType>) ?? {}

  const collaborators: UserFieldRecordType[] = []

  if (!isEditColumn && isForm && parseProp(column.meta)?.isLimitOption && (parseProp(column.meta)?.limitOptions || []).length) {
    collaborators.push(
      ...(baseUsers || [])
        .filter((user) => {
          if (limitOptionsById[user.id]?.show !== undefined) {
            return limitOptionsById[user.id]?.show
          }
          return false
        })
        .map((user: any) => ({
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          deleted: user.deleted,
          order: user.id && limitOptionsById[user.id] ? limitOptionsById[user.id]?.order ?? user.order : order++,
          meta: user.meta,
        }))
        .sort((a, b) => a.order - b.order),
    )
  } else {
    collaborators.push(
      ...(baseUsers || [])
        .map((user: any) => ({
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          deleted: user.deleted,
          order: order++,
          meta: user.meta,
        }))
        .sort((a, b) => a.order - b.order),
    )
  }
  return collaborators
}

export const getSelectedUsers = (
  optionsMap: Record<string, UserFieldRecordType>,
  modelValue?: UserFieldRecordType[] | UserFieldRecordType | string | null,
) => {
  let selected: { label: string; value: string; meta: any }[] = []

  let localModelValue = modelValue

  // if stringified json
  if (typeof localModelValue === 'string' && /^\s*[{[]/.test(localModelValue)) {
    try {
      localModelValue = JSON.parse(localModelValue)
    } catch (e) {
      // do nothing
    }
  }

  if (typeof localModelValue === 'string') {
    const idsOrMails = localModelValue.split(',').map((idOrMail) => idOrMail.trim())
    selected = idsOrMails.reduce((acc, idOrMail) => {
      const user = optionsMap[idOrMail]
      if (user) {
        acc.push({
          label: user?.display_name || user?.email,
          value: user.id,
          meta: user.meta,
        })
      }
      return acc
    }, [] as { label: string; value: string; meta: any }[])
  } else {
    selected = localModelValue
      ? (Array.isArray(localModelValue) ? localModelValue : [localModelValue]).reduce((acc, item) => {
          const label = item?.display_name || item?.email
          if (label) {
            acc.push({
              label,
              value: item.id,
              meta: item?.meta,
            })
          }
          return acc
        }, [] as { label: string; value: string; meta: any }[])
      : []
  }

  return selected
}
