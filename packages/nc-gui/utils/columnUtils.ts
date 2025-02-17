import type { FunctionalComponent, SVGAttributes } from 'vue'
import type { ButtonType, ColumnType, FormulaType, IntegrationType, LinkToAnotherRecordType } from 'nocodb-sdk'
import {
  ButtonActionsType,
  RelationTypes,
  UITypes,
  LongTextAiMetaProp as _LongTextAiMetaProp,
  checkboxIconList,
  ratingIconList,
} from 'nocodb-sdk'

export interface UiTypesType {
  name: UITypes | string
  icon: FunctionalComponent<SVGAttributes, {}, any, {}> | VNode
  virtual?: number | boolean
  deprecated?: number | boolean
  isNew?: number | boolean
}

export const AIButton = 'AIButton'

export const AIPrompt = 'AIPrompt'

export const LongTextAiMetaProp = _LongTextAiMetaProp

const uiTypes: UiTypesType[] = [
  {
    name: AIButton,
    icon: iconMap.cellAiButton,
    virtual: 1,
    isNew: 1,
    deprecated: 0,
  },
  {
    name: AIPrompt,
    icon: iconMap.cellAi,
    isNew: 1,
    deprecated: 0,
  },
  {
    name: UITypes.Links,
    icon: iconMap.cellLinks,
    virtual: 1,
  },
  {
    name: UITypes.LinkToAnotherRecord,
    icon: iconMap.cellLinks,
    virtual: 1,
    deprecated: 0,
  },
  {
    name: UITypes.Lookup,
    icon: iconMap.cellLookup,
    virtual: 1,
  },
  {
    name: UITypes.SingleLineText,
    icon: iconMap.cellText,
  },
  {
    name: UITypes.LongText,
    icon: iconMap.cellLongText,
  },
  {
    name: UITypes.Number,
    icon: iconMap.cellNumber,
  },
  {
    name: UITypes.Decimal,
    icon: iconMap.cellDecimal,
  },
  {
    name: UITypes.Attachment,
    icon: iconMap.cellAttachment,
  },
  {
    name: UITypes.Checkbox,
    icon: iconMap.cellCheckbox,
  },
  {
    name: UITypes.MultiSelect,
    icon: iconMap.cellMultiSelect,
  },
  {
    name: UITypes.SingleSelect,
    icon: iconMap.cellSingleSelect,
  },
  {
    name: UITypes.Date,
    icon: iconMap.cellDate,
  },
  {
    name: UITypes.Year,
    icon: iconMap.cellYear,
  },
  {
    name: UITypes.Time,
    icon: iconMap.cellTime,
  },
  {
    name: UITypes.PhoneNumber,
    icon: iconMap.cellPhone,
  },
  {
    name: UITypes.Email,
    icon: iconMap.cellEmail,
  },
  {
    name: UITypes.URL,
    icon: iconMap.cellUrl,
  },
  {
    name: UITypes.Currency,
    icon: iconMap.cellCurrency,
  },
  {
    name: UITypes.Percent,
    icon: iconMap.cellPercent,
  },
  {
    name: UITypes.Duration,
    icon: iconMap.cellDuration,
  },
  {
    name: UITypes.Rating,
    icon: iconMap.cellRating,
  },
  {
    name: UITypes.Formula,
    icon: iconMap.cellFormula,
    virtual: 1,
  },
  {
    name: UITypes.Rollup,
    icon: iconMap.cellRollup,
    virtual: 1,
  },
  {
    name: UITypes.DateTime,
    icon: iconMap.cellDatetime,
  },
  {
    name: UITypes.QrCode,
    icon: iconMap.cellQrCode,
    virtual: 1,
  },
  {
    name: UITypes.Barcode,
    icon: iconMap.cellBarcode,
    virtual: 1,
  },
  {
    name: UITypes.Geometry,
    icon: iconMap.cellGeometry,
  },

  {
    name: UITypes.GeoData,
    icon: iconMap.geoData,
  },
  {
    name: UITypes.JSON,
    icon: iconMap.cellJson,
  },
  {
    name: UITypes.SpecificDBType,
    icon: iconMap.cellDb,
  },
  {
    name: UITypes.User,
    icon: iconMap.cellUser,
  },
  {
    name: UITypes.Button,
    icon: iconMap.cellButton,
    virtual: 1,
  },
  {
    name: UITypes.CreatedTime,
    icon: iconMap.cellSystemDate,
  },
  {
    name: UITypes.LastModifiedTime,
    icon: iconMap.cellSystemDate,
  },
  {
    name: UITypes.CreatedBy,
    icon: iconMap.cellSystemUser,
  },
  {
    name: UITypes.LastModifiedBy,
    icon: iconMap.cellSystemUser,
  },
]

const getUIDTIcon = (uidt: UITypes | string) => {
  return (
    [
      ...uiTypes,
      {
        name: UITypes.CreatedTime,
        icon: iconMap.cellSystemDate,
      },
      {
        name: UITypes.ID,
        icon: iconMap.cellSystemKey,
      },
      {
        name: UITypes.ForeignKey,
        icon: iconMap.cellLinks,
      },
    ].find((t) => t.name === uidt) || {}
  ).icon
}

// treat column as required if `non_null` is true and one of the following is true
// 1. column not having default value
// 2. column is not auto increment
// 3. column is not auto generated
const isColumnRequired = (col?: ColumnType) => col && col.rqd && !isValidValue(col?.cdf) && !col.ai && !col.meta?.ag

const isVirtualColRequired = (col: ColumnType, columns: ColumnType[]) =>
  col.uidt === UITypes.LinkToAnotherRecord &&
  col.colOptions &&
  (<LinkToAnotherRecordType>col.colOptions).type === RelationTypes.BELONGS_TO &&
  isColumnRequired(columns.find((c) => c.id === (<LinkToAnotherRecordType>col.colOptions).fk_child_column_id))

const isColumnRequiredAndNull = (col: ColumnType, row: Record<string, any>) => {
  return isColumnRequired(col) && (row[col.title!] === undefined || row[col.title!] === null)
}

const getUniqueColumnName = (initName: string, columns: ColumnType[]) => {
  let name = initName
  let i = 1
  while (columns.find((c) => c.title === name)) {
    name = `${initName}_${i}`
    i++
  }
  return name
}

const isTypableInputColumn = (colOrUidt: ColumnType | UITypes) => {
  let uidt: UITypes
  if (typeof colOrUidt === 'object') {
    uidt = colOrUidt.uidt as UITypes
  } else {
    uidt = colOrUidt
  }
  return [
    UITypes.LongText,
    UITypes.SingleLineText,
    UITypes.Number,
    UITypes.PhoneNumber,
    UITypes.Email,
    UITypes.Decimal,
    UITypes.Currency,
    UITypes.Percent,
    UITypes.Duration,
    UITypes.JSON,
    UITypes.URL,
    UITypes.SpecificDBType,
    UITypes.Geometry,
  ].includes(uidt)
}

const isColumnSupportsGroupBySettings = (colOrUidt: ColumnType) => {
  let uidt: UITypes
  if (typeof colOrUidt === 'object') {
    uidt = colOrUidt.uidt as UITypes
  } else {
    uidt = colOrUidt
  }

  return [UITypes.SingleSelect, UITypes.User, UITypes.CreatedBy, UITypes.Checkbox, UITypes.Rating].includes(uidt)
}

const isColumnInvalid = (
  col: ColumnType,
  aiIntegrations: Partial<IntegrationType>[] = [],
  isReadOnly = false,
): { isInvalid: boolean; tooltip: string; ignoreTooltip?: boolean } => {
  const result = {
    isInvalid: false,
    tooltip: 'msg.invalidColumnConfiguration',
    ignoreTooltip: false,
  }

  switch (col.uidt) {
    case UITypes.Formula:
      result.isInvalid = !!(col.colOptions as FormulaType).error
      break
    case UITypes.Button: {
      const colOptions = col.colOptions as ButtonType

      if (isAiButton(col) && isReadOnly) {
        result.isInvalid = true
        result.ignoreTooltip = true
      } else if (colOptions.type === ButtonActionsType.Webhook) {
        result.isInvalid = !colOptions.fk_webhook_id
      } else if (colOptions.type === ButtonActionsType.Url) {
        result.isInvalid = !!colOptions.error
      } else if (colOptions.type === ButtonActionsType.AI) {
        result.isInvalid =
          !colOptions.fk_integration_id ||
          (isReadOnly
            ? false
            : !!colOptions.fk_integration_id && !ncIsArrayIncludes(aiIntegrations, colOptions.fk_integration_id, 'id'))
        result.tooltip = 'title.aiIntegrationMissing'
      }
      break
    }
    case UITypes.LongText: {
      if (parseProp(col.meta)[LongTextAiMetaProp]) {
        const colOptions = col.colOptions as ButtonType

        result.isInvalid =
          !colOptions.fk_integration_id ||
          (isReadOnly
            ? false
            : !!colOptions.fk_integration_id && !ncIsArrayIncludes(aiIntegrations, colOptions.fk_integration_id, 'id'))

        result.tooltip = 'title.aiIntegrationMissing'
      }
      break
    }
  }

  return result
}

// cater existing v1 cases

function extractCheckboxIcon(meta: string | Record<string, any> = null) {
  const parsedMeta = parseProp(meta)

  const icon = {
    checked: 'mdi-check-circle-outline',
    unchecked: 'mdi-checkbox-blank-circle-outline',
  }

  if (parsedMeta.icon) {
    icon.checked = parsedMeta.icon.checked || icon.checked
    icon.unchecked = parsedMeta.icon.unchecked || icon.unchecked
  } else if (typeof parsedMeta.iconIdx === 'number' && checkboxIconList[parsedMeta.iconIdx]) {
    icon.checked = checkboxIconList[parsedMeta.iconIdx].checked
    icon.unchecked = checkboxIconList[parsedMeta.iconIdx].unchecked
  }
  return icon
}

function extractRatingIcon(meta: string | Record<string, any> = null) {
  const parsedMeta = parseProp(meta)

  const icon = {
    full: 'mdi-star',
    empty: 'mdi-star-outline',
  }

  if (parsedMeta.icon) {
    icon.full = parsedMeta.icon.full || icon.full
    icon.empty = parsedMeta.icon.empty || icon.empty
  } else if (typeof parsedMeta.iconIdx === 'number' && ratingIconList[parsedMeta.iconIdx]) {
    icon.full = ratingIconList[parsedMeta.iconIdx].full
    icon.empty = ratingIconList[parsedMeta.iconIdx].empty
  }
  return icon
}

const formViewHiddenColTypes = [
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.Formula,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.Button,
  UITypes.SpecificDBType,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  AIButton,
]

export {
  uiTypes,
  isTypableInputColumn,
  isColumnSupportsGroupBySettings,
  getUIDTIcon,
  isColumnInvalid,
  getUniqueColumnName,
  isColumnRequiredAndNull,
  isColumnRequired,
  isVirtualColRequired,
  checkboxIconList,
  ratingIconList,
  extractCheckboxIcon,
  extractRatingIcon,
  formViewHiddenColTypes,
}
