import { ButtonActionsType, type ColumnType, FieldNameFromUITypes, UITypes, UITypesName } from 'nocodb-sdk'
import isURL from 'validator/lib/isURL'
import { pluralize } from 'inflection'

// This regex pattern matches email addresses by looking for sequences that start with characters before the "@" symbol, followed by the domain.
// It's designed to capture most email formats, including those with periods and "+" symbols in the local part.
const validateEmail = (v: string) =>
  /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(v)

export const extractEmail = (v: string) => {
  const matches = v.match(
    /(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})/i,
  )
  return matches ? matches[0] : null
}

const booleanOptions = [
  { checked: true, unchecked: false },
  { 'x': true, '': false },
  { yes: true, no: false },
  { y: true, n: false },
  { 1: true, 0: false },
  { '[x]': true, '[]': false, '[ ]': false },
  { '☑': true, '': false },
  { '✅': true, '': false },
  { '✓': true, '': false },
  { '✔': true, '': false },
  { enabled: true, disabled: false },
  { on: true, off: false },
  { 'done': true, '': false },
  { true: true, false: false },
]
const aggBooleanOptions: any = booleanOptions.reduce((obj, o) => ({ ...obj, ...o }), {})

const getColVal = (row: any, col?: number) => {
  return row && col !== undefined ? row[col] : row
}

export const isCheckboxType: any = (values: [], col?: number) => {
  let options = booleanOptions
  for (let i = 0; i < values.length; i++) {
    const val = getColVal(values[i], col)
    if (val === null || val === undefined || val.toString().trim() === '') {
      continue
    }
    options = options.filter((v) => val in v)
    if (!options.length) {
      return false
    }
  }
  return true
}

export const getCheckboxValue = (value: any) => {
  return value && aggBooleanOptions[value]
}

export const isMultiLineTextType = (values: [], col?: number) => {
  return values.some(
    (r) => (getColVal(r, col) || '').toString().match(/[\r\n]/) || (getColVal(r, col) || '').toString().length > 255,
  )
}

export const extractMultiOrSingleSelectProps = (colData: []) => {
  const maxSelectOptionsAllowed = 64
  const colProps: any = {}
  if (colData.some((v: any) => v && (v || '').toString().includes(','))) {
    const flattenedVals = colData.flatMap((v: any) =>
      v
        ? v
            .toString()
            .trim()
            .split(/\s*,\s*/)
        : [],
    )

    const uniqueVals = [
      ...new Set(flattenedVals.filter((v) => v !== null && v !== undefined).map((v: any) => v.toString().trim())),
    ]

    if (uniqueVals.length > maxSelectOptionsAllowed) {
      // too many options are detected, convert the column to SingleLineText instead
      colProps.uidt = UITypes.SingleLineText
      // _disableSelect is used to disable the <a-select-option/> in TemplateEditor
      colProps._disableSelect = true
    } else {
      // assume the column type is multiple select if there are repeated values
      if (flattenedVals.length > uniqueVals.length && uniqueVals.length <= Math.ceil(flattenedVals.length / 2)) {
        colProps.uidt = UITypes.MultiSelect
      }
      // set dtxp here so that users can have the options even they switch the type from other types to MultiSelect
      // once it's set, dtxp needs to be reset if the final column type is not MultiSelect
      colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`
    }
  } else {
    const uniqueVals = [...new Set(colData.filter((v) => v !== null && v !== undefined).map((v: any) => v.toString().trim()))]

    if (uniqueVals.length > maxSelectOptionsAllowed) {
      // too many options are detected, convert the column to SingleLineText instead
      colProps.uidt = UITypes.SingleLineText
      // _disableSelect is used to disable the <a-select-option/> in TemplateEditor
      colProps._disableSelect = true
    } else {
      // assume the column type is single select if there are repeated values
      // once it's set, dtxp needs to be reset if the final column type is not Single Select
      if (colData.length > uniqueVals.length && uniqueVals.length <= Math.ceil(colData.length / 2)) {
        colProps.uidt = UITypes.SingleSelect
      }
      // set dtxp here so that users can have the options even they switch the type from other types to SingleSelect
      // once it's set, dtxp needs to be reset if the final column type is not SingleSelect
      colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`
    }
    return colProps
  }
}

export const extractSelectOptions = (colData: [], type: UITypes.SingleSelect | UITypes.MultiSelect): { dtxp: string } => {
  const colProps: any = {}

  if (type === UITypes.MultiSelect) {
    const flattenedVals = colData.flatMap((v: any) =>
      v
        ? v
            .toString()
            .trim()
            .split(/\s*,\s*/)
        : [],
    )
    const uniqueVals = [...new Set(flattenedVals.map((v: any) => v.toString().trim()))]
    colProps.uidt = UITypes.MultiSelect
    colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`
  } else {
    const uniqueVals = [...new Set(colData.map((v: any) => v.toString().trim()))]
    colProps.uidt = UITypes.SingleSelect
    colProps.dtxp = `${uniqueVals.map((v) => `'${v.replace(/'/gi, "''")}'`).join(',')}`
  }
  return colProps
}

export const isDecimalType = (colData: []) =>
  colData.some((v: any) => {
    return v && parseInt(v) !== +v
  })

export const isEmailType = (colData: [], col?: number) =>
  colData.some((r: any) => {
    const v = getColVal(r, col)
    return v && validateEmail(v)
  })

export const isUrlType = (colData: [], col?: number) =>
  colData.some((r: any) => {
    const v = getColVal(r, col)
    // convert to string since isURL only accepts string
    // and cell data value can be number or any other types
    return v && isURL(v.toString())
  })

export const getColumnUIDTAndMetas = (colData: [], defaultType: string) => {
  const colProps = { uidt: defaultType }

  if (colProps.uidt === UITypes.SingleLineText) {
    // check for long text
    if (isMultiLineTextType(colData)) {
      colProps.uidt = UITypes.LongText
    }
    if (isEmailType(colData)) {
      colProps.uidt = UITypes.Email
    }
    if (isUrlType(colData)) {
      colProps.uidt = UITypes.URL
    } else {
      if (isCheckboxType(colData)) {
        colProps.uidt = UITypes.Checkbox
      } else {
        Object.assign(colProps, extractMultiOrSingleSelectProps(colData))
      }
    }
  } else if (colProps.uidt === UITypes.Number) {
    if (isDecimalType(colData)) {
      colProps.uidt = UITypes.Decimal
    }
  }
  // TODO(import): currency
  // TODO(import): date / datetime
  return colProps
}

export const filterNullOrUndefinedObjectProperties = <T extends Record<string, any>>(obj: T): T => {
  return Object.keys(obj).reduce((result, propName) => {
    const value = obj[propName]

    if (value !== null && value !== undefined) {
      if (!Array.isArray(value) && typeof value === 'object') {
        // Recursively filter nested objects
        result[propName] = filterNullOrUndefinedObjectProperties(value)
      } else {
        result[propName] = value
      }
    }

    return result
  }, {} as Record<string, any>) as T
}

/**
 * Extracts the next default name based on the provided namesData, defaultName, and splitOperator.
 *
 * @param namesData - An array of strings containing existing names data.
 * @param defaultName - The default name to extract and generate the next name from.
 * @param splitOperator - The separator used to split the defaultName and numbers in existing namesData.
 *                        Defaults to '-'. Example: If defaultName is 'Token' and splitOperator is '-',
 *                        existing names like 'Token-1', 'Token-2', etc., will be considered.
 * @returns The next default name with an incremented number based on existing namesData.
 */
export const extractNextDefaultName = (namesData: string[], defaultName: string, splitOperator = '-'): string => {
  // Extract and sort numbers associated with the provided defaultName
  const extractedSortedNumbers =
    (namesData
      .map((name) => {
        const [_defaultName, number] = name.split(splitOperator)
        if (_defaultName === defaultName && !isNaN(Number(number?.trim()))) {
          return Number(number?.trim())
        }
        return undefined
      })
      .filter((e) => e)
      .sort((a, b) => {
        if (a !== undefined && b !== undefined) {
          return a - b
        }
        return 0
      }) as number[]) || []

  return extractedSortedNumbers.length
    ? `${defaultName}${splitOperator}${extractedSortedNumbers[extractedSortedNumbers.length - 1] + 1}`
    : `${defaultName}${splitOperator}1`
}

export const getFormattedViewTabTitle = ({
  viewName,
  tableName,
  baseName,
  isDefaultView = false,
  charLimit = 20,
  isSharedView = false,
}: {
  viewName: string
  tableName: string
  baseName: string
  isDefaultView?: boolean
  charLimit?: number
  isSharedView?: boolean
}) => {
  if (isSharedView) {
    return viewName || 'NocoDB'
  }

  let title = `${viewName} | ${tableName} | ${baseName}`

  if (isDefaultView) {
    charLimit = 30
    title = `${tableName} | ${baseName}`
  }

  if (title.length <= 60) {
    return title
  }

  // Function to truncate text and add ellipsis if needed
  const truncateText = (text: string) => {
    return text.length > charLimit ? `${text.substring(0, charLimit - 3)}...` : text
  }

  if (isDefaultView) {
    title = `${truncateText(tableName)} | ${truncateText(baseName)}`
  } else {
    title = `${truncateText(viewName)} | ${truncateText(tableName)} | ${truncateText(baseName)}`
  }

  return title
}

export const generateUniqueColumnSuffix = ({
  tableExplorerColumns,
  metaColumns,
}: {
  tableExplorerColumns?: ColumnType[]
  metaColumns: ColumnType[]
}) => {
  let suffix = (metaColumns?.length || 0) + 1
  let columnName = `title${suffix}`
  while (
    (tableExplorerColumns || metaColumns)?.some(
      (c) =>
        (c.column_name || '').toLowerCase() === columnName.toLowerCase() ||
        (c.title || '').toLowerCase() === columnName.toLowerCase(),
    )
  ) {
    suffix++
    columnName = `title${suffix}`
  }
  return suffix
}

const extractNextDefaultColumnName = ({
  tableExplorerColumns,
  metaColumns,
  defaultColumnName,
  newFieldTitles,
  formState,
}: {
  tableExplorerColumns?: ColumnType[]
  metaColumns: ColumnType[]
  defaultColumnName: string
  newFieldTitles: string[]
  formState: Record<string, any>
}): string => {
  // Extract and sort numbers associated with the provided defaultName
  const namesData = ((tableExplorerColumns || metaColumns)
    ?.flatMap((c) => {
      if (formState?.temp_id && c?.temp_id && formState?.temp_id === c?.temp_id) {
        return []
      }

      if (c.title !== c.column_name) {
        return [c.title?.toLowerCase(), c.column_name?.toLowerCase()]
      }
      return [c.title?.toLowerCase()]
    })
    .filter((t) => t && t.startsWith(defaultColumnName.toLowerCase())) || []) as string[]

  if (![...namesData, ...newFieldTitles].includes(defaultColumnName.toLowerCase())) {
    return defaultColumnName
  }

  const extractedSortedNumbers =
    (namesData
      .map((name) => {
        const [_defaultName, number] = name.split(/ (?!.* )/)
        if (_defaultName === defaultColumnName.toLowerCase() && !isNaN(Number(number?.trim()))) {
          return Number(number?.trim())
        }
        return undefined
      })
      .filter((e) => e)
      .sort((a, b) => {
        if (a !== undefined && b !== undefined) {
          return a - b
        }
        return 0
      }) as number[]) || []

  return extractedSortedNumbers.length
    ? `${defaultColumnName} ${extractedSortedNumbers[extractedSortedNumbers.length - 1] + 1}`
    : `${defaultColumnName} 1`
}

export const generateUniqueColumnName = ({
  tableExplorerColumns,
  metaColumns,
  formState,
  newFieldTitles,
}: {
  tableExplorerColumns?: ColumnType[]
  metaColumns: ColumnType[]
  formState: Record<string, any>
  newFieldTitles?: string[]
}) => {
  let defaultColumnName = FieldNameFromUITypes[formState.uidt as UITypes]

  if (!defaultColumnName) {
    return `title${generateUniqueColumnSuffix({ tableExplorerColumns, metaColumns })}`
  }

  switch (formState.uidt) {
    case UITypes.User: {
      if (formState.meta.is_multi) {
        defaultColumnName = `${defaultColumnName}s`
      }
      break
    }

    case UITypes.Links:
    case UITypes.LinkToAnotherRecord: {
      if (!formState.childTableTitle) {
        return `title${generateUniqueColumnSuffix({ tableExplorerColumns, metaColumns })}`
      }

      let childTableTitle = formState.childTableTitle

      // Use plural for links except oo relation type
      if (formState.uidt === UITypes.Links && formState?.type !== 'oo') {
        childTableTitle = pluralize(childTableTitle)
      }

      // Calculate the remaining length available for childTableTitle
      const maxLength = 255 - (defaultColumnName.length - 11 + '{TableName}'.length)

      // Truncate childTableTitle if it exceeds the maxLength
      if (childTableTitle.length > maxLength) {
        childTableTitle = `${childTableTitle.slice(0, maxLength - 3)}...`
      }

      // Replace {TableName} with the potentially truncated childTableTitle
      defaultColumnName = defaultColumnName.replace('{TableName}', childTableTitle)

      // Ensure the final defaultColumnName is less than 255 characters
      if (defaultColumnName.length >= 255) {
        defaultColumnName = `${defaultColumnName.slice(0, 252)}...`
      }

      break
    }

    case UITypes.Lookup: {
      if (!formState.lookupTableTitle || !formState.lookupColumnTitle) {
        return `title${generateUniqueColumnSuffix({ tableExplorerColumns, metaColumns })}`
      }

      let lookupTableTitle = formState.lookupTableTitle
      let lookupColumnTitle = formState.lookupColumnTitle

      // Calculate the lengths of the placeholders
      const placeholderLength = '{TableName}'.length + '{FieldName}'.length
      const baseLength = defaultColumnName.length - placeholderLength

      // Calculate the maximum length allowed for both titles combined
      const maxTotalLength = 255 - baseLength
      const maxLengthPerTitle = Math.floor(maxTotalLength / 2)

      // Truncate the titles if necessary
      if (lookupTableTitle.length > maxLengthPerTitle) {
        lookupTableTitle = `${lookupTableTitle.slice(0, maxLengthPerTitle - 3)}...`
      }

      if (lookupColumnTitle.length > maxLengthPerTitle) {
        lookupColumnTitle = `${lookupColumnTitle.slice(0, maxLengthPerTitle - 3)}...`
      }

      // Replace placeholders
      defaultColumnName = defaultColumnName.replace('{TableName}', lookupTableTitle).replace('{FieldName}', lookupColumnTitle)

      break
    }

    case UITypes.Rollup: {
      if (!formState.rollupTableTitle || !formState.rollupColumnTitle || !formState?.rollup_function_name) {
        return `title${generateUniqueColumnSuffix({ tableExplorerColumns, metaColumns })}`
      }
      let rollupTableTitle = formState.rollupTableTitle
      let rollupColumnTitle = formState.rollupColumnTitle

      // Update rollup function name
      defaultColumnName = defaultColumnName.replace('{RollupFunction}', formState.rollup_function_name)

      // Calculate the lengths of the placeholders
      const placeholderLength = '{TableName}'.length + '{FieldName}'.length
      const baseLength = defaultColumnName.length - placeholderLength

      // Calculate the maximum length allowed for both titles combined
      const maxTotalLength = 255 - baseLength
      const maxLengthPerTitle = Math.floor(maxTotalLength / 2)

      // Truncate the titles if necessary
      if (rollupTableTitle.length > maxLengthPerTitle) {
        rollupTableTitle = `${rollupTableTitle.slice(0, maxLengthPerTitle - 3)}...`
      }

      if (rollupColumnTitle.length > maxLengthPerTitle) {
        rollupColumnTitle = `${rollupColumnTitle.slice(0, maxLengthPerTitle - 3)}...`
      }

      // Replace placeholders
      defaultColumnName = defaultColumnName.replace('{TableName}', rollupTableTitle).replace('{FieldName}', rollupColumnTitle)
      break
    }

    case UITypes.Button: {
      if (formState?.type === ButtonActionsType.Ai) {
        defaultColumnName = UITypesName.AIButton
      }
      break
    }

    case UITypes.LongText: {
      if (formState?.meta?.[LongTextAiMetaProp] === true) {
        defaultColumnName = UITypesName.AIPrompt
      }
      break
    }
  }

  return extractNextDefaultColumnName({
    tableExplorerColumns,
    metaColumns,
    defaultColumnName,
    newFieldTitles: newFieldTitles || [],
    formState,
  })
}
