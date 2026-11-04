import {
  type ColumnType,
  type SelectOptionsType,
  UITypes,
  type ViewType,
  ViewTypes,
  dateFormats,
  isBtLikeV2Junction,
  isUtilizationMultiResourceLink,
  parseProp,
  timeFormats,
} from 'nocodb-sdk'

export const valueToTitle = (value: string, col: ColumnType, displayValueProp?: string) => {
  if (col.uidt === UITypes.Checkbox) {
    return value ? GROUP_BY_VARS.TRUE : GROUP_BY_VARS.FALSE
  }

  if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(col.uidt as UITypes)) {
    if (!value) {
      return GROUP_BY_VARS.NULL
    }
  }

  if (
    (col.uidt === UITypes.LinkToAnotherRecord || (col.uidt === UITypes.Links && isBtLikeV2Junction(col))) &&
    displayValueProp &&
    value &&
    typeof value === 'object'
  ) {
    return value[displayValueProp] ?? GROUP_BY_VARS.NULL
  }

  // convert to JSON string if non-string value
  if (value && typeof value === 'object') {
    value = JSON.stringify(value)
  }

  return value ?? GROUP_BY_VARS.NULL
}

export const findKeyColor = (key: string | undefined, col: ColumnType | undefined, getNextColor: () => string): string => {
  if (col) {
    switch (col.uidt) {
      case UITypes.MultiSelect: {
        const keys = key?.split(',') || []
        const colors = []
        for (const k of keys) {
          const option = (col.colOptions as SelectOptionsType).options?.find((o) => o.title === k)
          if (option) {
            colors.push(option.color)
          }
        }
        return colors.join(',')
      }
      case UITypes.SingleSelect: {
        const option = (col.colOptions as SelectOptionsType).options?.find((o) => o.title === key)
        if (option) {
          return option.color || getNextColor()
        }
        return 'gray'
      }
      case UITypes.Checkbox: {
        if (key === '__nc_true__') {
          return themeColors.success
        }
        return themeColors.error
      }
      default:
        return key ? getNextColor() : 'gray'
    }
  }
  return key ? getNextColor() : 'gray'
}

export const shouldRenderCell = (colOrUidt: ColumnType | { uidt: UITypes | string } | UITypes | string) => {
  return [
    UITypes.Lookup,
    UITypes.Attachment,
    UITypes.Barcode,
    UITypes.QrCode,
    UITypes.Links,
    UITypes.User,
    UITypes.DateTime,
    UITypes.CreatedTime,
    UITypes.LastModifiedTime,
    UITypes.CreatedBy,
    UITypes.LongText,
    UITypes.LastModifiedBy,
  ].includes(<UITypes>(typeof colOrUidt === 'object' ? colOrUidt?.uidt : colOrUidt))
}

// a method to parse group key if grouped column type is LTAR or Lookup
// in these 2 scenario it will return json array or `___` separated value
export const parseKey = (group: Group | CanvasGroup) => {
  // One of several linked records sharing a display value: its key also holds the id.
  const splitLabel = (group as Group)?.nestedIn?.[(group as Group).nestedIn.length - 1]?.splitLabel
  if (splitLabel !== undefined) return [splitLabel]

  let key = (group?.key ?? group?.value).toString()

  // parse json array key if it's a lookup or link to another record
  if ((key && group.column?.uidt === UITypes.Lookup) || group.column?.uidt === UITypes.LinkToAnotherRecord) {
    try {
      key = JSON.parse(key)
    } catch {
      // if parsing try to split it by `___` (for sqlite)
      return key.split('___')
    }
  }

  // show the groupBy dateTime field title format as like cell format
  if (key && group.column?.uidt === UITypes.DateTime) {
    return [
      parseStringDateTime(
        key,
        `${parseProp(group.column?.meta)?.date_format ?? dateFormats[0]} ${
          parseProp(group.column?.meta)?.time_format ?? timeFormats[0]
        }`,
      ),
    ]
  }

  // show the groupBy time field title format as like cell format
  if (key && group.column?.uidt === UITypes.Time) {
    return [parseStringDateTime(key, timeFormats[0], false)]
  }

  if (key && [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(group.column?.uidt as UITypes)) {
    try {
      const parsedKey = JSON.parse(key)
      return [parsedKey]
    } catch {
      return null
    }
  }

  return [key]
}

/** A field that can hold several people or records: a multi-user User field or a many-to-many link. */
export const isMultiValueGroupColumn = (col?: ColumnType) =>
  !!col && ((col.uidt === UITypes.User && !!parseProp(col.meta)?.is_multi) || isUtilizationMultiResourceLink(col))

/** Utilization reads per person, so grouping by its resource always splits. */
export const isTimelineGroupSplitForced = (viewMeta: Record<string, any> | undefined, col?: ColumnType) =>
  !!col?.id &&
  viewMeta?.summary?.aggregation === 'utilization' &&
  viewMeta?.summary?.utilization?.fk_resource_column_id === col.id &&
  isMultiValueGroupColumn(col)

/**
 * Whether a timeline groups a multi-value field by each value, so a record
 * shows in every group it belongs to. Always on for Utilization's resource.
 */
export const isTimelineGroupSplit = (view: ViewType | undefined, col?: ColumnType) => {
  if (view?.type !== ViewTypes.TIMELINE || !isMultiValueGroupColumn(col)) return false
  const viewMeta = parseProp((view.view as { meta?: unknown } | undefined)?.meta)
  return !!viewMeta?.group_by_split || isTimelineGroupSplitForced(viewMeta, col)
}

/** A split group's key → its one value (a linked record's display value, or a user object). */
export const splitGroupValue = (key: string) => {
  try {
    const values = JSON.parse(key)
    return Array.isArray(values) ? values[0] : values
  } catch {
    return key
  }
}

/**
 * Breaks group-by rows keyed by a combination (`["Ana","Bo"]`) into one row per
 * value, each keyed `["Ana"]` and carrying the combination's count. Rows with
 * the same key then merge into one group.
 */
export const splitGroupRows = (list: Record<string, any>[], col: ColumnType) => {
  const out: Record<string, any>[] = []
  for (const item of list) {
    let values = item[col.title!]
    if (typeof values === 'string') {
      try {
        values = JSON.parse(values)
      } catch {
        values = null
      }
    }
    if (!Array.isArray(values) || !values.length) {
      out.push({ ...item, [col.title!]: null })
      continue
    }
    // A row linked to two records with one display value counts once in that group.
    for (const key of new Set(values.map((value) => JSON.stringify([value])))) {
      out.push({ ...item, [col.title!]: key })
    }
  }
  return out
}

/** Sort label of a split group: the display value, or a user's name. */
export const splitGroupLabel = (key: string) => {
  const value = splitGroupValue(key)
  if (value && typeof value === 'object') return String(value.display_name || value.email || value.id || '')
  return String(value ?? '')
}
