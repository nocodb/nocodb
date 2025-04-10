import { type ColumnType, type SelectOptionsType, UITypes, dateFormats, timeFormats } from 'nocodb-sdk'

export const valueToTitle = (value: string, col: ColumnType, displayValueProp?: string) => {
  if (col.uidt === UITypes.Checkbox) {
    return value ? GROUP_BY_VARS.TRUE : GROUP_BY_VARS.FALSE
  }

  if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(col.uidt as UITypes)) {
    if (!value) {
      return GROUP_BY_VARS.NULL
    }
  }

  if (col.uidt === UITypes.LinkToAnotherRecord && displayValueProp && value && typeof value === 'object') {
    return value[displayValueProp] ?? GROUP_BY_VARS.NULL
  }

  // convert to JSON string if non-string value
  if (value && typeof value === 'object') {
    value = JSON.stringify(value)
  }

  return value ?? GROUP_BY_VARS.NULL
}

export const findKeyColor = (key?: string, col?: ColumnType, getNextColor: () => string): string => {
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
