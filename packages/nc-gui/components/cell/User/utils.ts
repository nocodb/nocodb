import {
  type ColumnType,
  IconType,
  NOCO_SERVICE_USERS,
  ServiceUserType,
  UITypes,
  type UserFieldRecordType,
  type UserType,
  arrFlatMap,
} from 'nocodb-sdk'

// Service users that can stamp CreatedBy / LastModifiedBy: Automation, Sync
// and Workflow write records via jobs; Anonymous via public form submissions.
// The remaining service users (System, Trash Cleanup, Snapshot) are audit-only
// actors that never appear in these columns.
const RECORD_STAMPING_SERVICE_USERS = [
  ServiceUserType.ANONYMOUS_USER,
  ServiceUserType.AUTOMATION_USER,
  ServiceUserType.SYNC_USER,
  ServiceUserType.WORKFLOW_USER,
] as const

/** Service users stamp records (public forms, automations, syncs, workflows) but are never base members. */
export const isRecordStampingServiceUser = (idOrEmail?: string | null) =>
  !!idOrEmail &&
  RECORD_STAMPING_SERVICE_USERS.some((key) => {
    const user = NOCO_SERVICE_USERS[key]
    return user.id === idOrEmail || user.email === idOrEmail
  })

// Absent from the base-users list (they don't live in nc_users), so expose
// them as selectable options in the filter dropdown so records created by
// e.g. "NocoDB Workflow" can be filtered.
export const getSystemUserFilterOptions = (column: ColumnType): UserFieldRecordType[] => {
  if (![UITypes.CreatedBy, UITypes.LastModifiedBy].includes(column.uidt as UITypes)) return []

  return RECORD_STAMPING_SERVICE_USERS.map((key) => {
    const user = NOCO_SERVICE_USERS[key]
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      meta: { icon: 'nocodb1', iconType: IconType.ICON },
    }
  })
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

/**
 * Extract the raw user id/email keys referenced by a User/CreatedBy cell value,
 * without requiring them to exist in any options map. Used to discover ids that
 * need resolving (e.g. external form submitters who are not base collaborators).
 */
export const extractUserKeys = (modelValue?: UserFieldRecordType[] | UserFieldRecordType | string | null): string[] => {
  if (!modelValue) return []

  let value = modelValue

  if (Array.isArray(value) && !value.filter((k) => typeof k !== 'string').length) {
    value = arrFlatMap(value.filter((k) => k).map((u: string) => u?.split?.(','))).join(',')
  }

  if (typeof value === 'string' && /^\s*[{[]/.test(value)) {
    try {
      value = JSON.parse(value)
    } catch (e) {
      // not json — fall through to string handling
    }
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((idOrMail) => idOrMail.trim())
      .filter(Boolean)
  }

  return (Array.isArray(value) ? value : [value]).map((item) => item?.id || item?.email).filter((k): k is string => !!k)
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
          const user = optionsMap[item?.id] ?? (item?.email ? optionsMap[item.email.trim()] : undefined)

          // External submitters (non-collaborators captured by a require-sign-in
          // shared form) arrive identity-stripped as `{ id, email: null,
          // display_name: null }` — fall back to the resolved option so they
          // render instead of being dropped for having no label.
          const label = item?.display_name || item?.email || user?.display_name || user?.email
          if (label) {
            acc.push({
              label,
              value: item.id,
              deleted: user?.deleted,
              meta: item?.meta ?? user?.meta,
              display_name: item?.display_name ?? user?.display_name,
              email: item?.email ?? user?.email,
            })
          }
          return acc
        }, [] as SelectedUserType[])
      : []
  }

  return selected
}
