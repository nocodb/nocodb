import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import { iconMap } from '#imports'
import LinkVariant from '~icons/mdi/link-variant'
import ID from '~icons/mdi/identifier'

const uiTypes = [
  {
    name: UITypes.Links,
    icon: iconMap.link,
    virtual: 1,
  },
  {
    name: UITypes.LinkToAnotherRecord,
    icon: iconMap.link,
    virtual: 1,
    deprecated: 1,
  },
  {
    name: UITypes.Lookup,
    icon: iconMap.lookup,
    virtual: 1,
  },
  {
    name: UITypes.SingleLineText,
    icon: iconMap.text,
  },
  {
    name: UITypes.LongText,
    icon: iconMap.longText,
  },
  {
    name: UITypes.Number,
    icon: iconMap.number,
  },
  {
    name: UITypes.Decimal,
    icon: iconMap.decimal,
  },
  {
    name: UITypes.Attachment,
    icon: iconMap.image,
  },
  {
    name: UITypes.Checkbox,
    icon: iconMap.boolean,
  },
  {
    name: UITypes.MultiSelect,
    icon: iconMap.multiSelect,
  },
  {
    name: UITypes.SingleSelect,
    icon: iconMap.singleSelect,
  },
  {
    name: UITypes.Date,
    icon: iconMap.calendar,
  },
  {
    name: UITypes.Year,
    icon: iconMap.calendar,
  },
  {
    name: UITypes.Time,
    icon: iconMap.clock,
  },
  {
    name: UITypes.PhoneNumber,
    icon: iconMap.phone,
  },
  {
    name: UITypes.Email,
    icon: iconMap.email,
  },
  {
    name: UITypes.URL,
    icon: iconMap.web,
  },
  {
    name: UITypes.Currency,
    icon: iconMap.currency,
  },
  {
    name: UITypes.Percent,
    icon: iconMap.percent,
  },
  {
    name: UITypes.Duration,
    icon: iconMap.duration,
  },
  {
    name: UITypes.Rating,
    icon: iconMap.rating,
  },
  {
    name: UITypes.Formula,
    icon: iconMap.formula,
    virtual: 1,
  },
  {
    name: UITypes.Rollup,
    icon: iconMap.rollup,
    virtual: 1,
  },
  {
    name: UITypes.DateTime,
    icon: iconMap.datetime,
  },
  {
    name: UITypes.QrCode,
    icon: iconMap.qrCode,
    virtual: 1,
  },
  {
    name: UITypes.Barcode,
    icon: iconMap.barCode,
    virtual: 1,
  },
  {
    name: UITypes.Geometry,
    icon: iconMap.calculator,
  },

  {
    name: UITypes.GeoData,
    icon: iconMap.geoData,
  },
  {
    name: UITypes.JSON,
    icon: iconMap.json,
  },
  {
    name: UITypes.SpecificDBType,
    icon: iconMap.specificDbType,
  },
]

const getUIDTIcon = (uidt: UITypes | string) => {
  return (
    [
      ...uiTypes,
      {
        name: UITypes.CreateTime,
        icon: iconMap.calendar,
      },
      {
        name: UITypes.ID,
        icon: ID,
      },
      {
        name: UITypes.ForeignKey,
        icon: LinkVariant,
      },
    ].find((t) => t.name === uidt) || {}
  ).icon
}

// treat column as required if `non_null` is true and one of the following is true
// 1. column not having default value
// 2. column is not auto increment
// 3. column is not auto generated
const isColumnRequired = (col?: ColumnType) => col && col.rqd && !col.cdf && !col.ai && !col.meta?.ag

const isVirtualColRequired = (col: ColumnType, columns: ColumnType[]) =>
  col.uidt === UITypes.LinkToAnotherRecord &&
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
  ].includes(uidt)
}

export {
  uiTypes,
  isTypableInputColumn,
  getUIDTIcon,
  getUniqueColumnName,
  isColumnRequiredAndNull,
  isColumnRequired,
  isVirtualColRequired,
}
