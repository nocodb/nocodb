import {
  type ColumnType,
  NOCO_SERVICE_USERS,
  UITypes,
  type UserFieldRecordType,
  type UserType,
  arrFlatMap,
} from 'nocodb-sdk'

// System users (NocoDB Workflow, Automation, Sync, System, …) that stamp
// CreatedBy / LastModifiedBy when records are created or updated by internal
// actors. They are absent from the base-users list (they don't live in
// nc_users), so expose them as selectable options in the filter dropdown so
// records created by e.g. "NocoDB Workflow" can be filtered.
export const getSystemUserFilterOptions = (column: ColumnType): UserFieldRecordType[] => {
  if (![UITypes.CreatedBy, UITypes.LastModifiedBy].includes(column.uidt as UITypes)) return []

  return Object.values(NOCO_SERVICE_USERS).map((user) => ({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
  }))
}

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

export interface SelectedUserType {
  label: string
  value: string
  meta: any
  display_name?: string
  email: string
  deleted?: boolean
}

/**
 * Note: We are using this function in canvas table also, so be carefull while updating anything
 * @param optionsMap
 * @param modelValue
 * @returns
 */
export const getSelectedUsers = (
  optionsMap: Record<string, UserFieldRecordType>,
  modelValue?: UserFieldRecordType[] | UserFieldRecordType | string | null,
) => {
  let selected: SelectedUserType[] = []

  if (!modelValue) {
    return selected
  }
  let localModelValue = modelValue
  if (Array.isArray(localModelValue) && !localModelValue.filter((k) => typeof k !== 'string').length) {
    localModelValue = arrFlatMap(localModelValue.filter((k) => k).map((u: string) => u?.split?.(','))).join(',')
  }

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
          deleted: user?.deleted,
          display_name: user?.display_name,
          email: user?.email,
        })
      }
      return acc
    }, [] as SelectedUserType[])
  } else {
    selected = localModelValue
      ? (Array.isArray(localModelValue) ? localModelValue : [localModelValue]).reduce((acc, item) => {
          const label = item?.display_name || item?.email
          if (label) {
            const user = optionsMap[item.id]
            acc.push({
              label,
              value: item.id,
              deleted: user?.deleted,
              meta: item?.meta,
              display_name: item?.display_name,
              email: item?.email,
            })
          }
          return acc
        }, [] as SelectedUserType[])
      : []
  }

  return selected
}
