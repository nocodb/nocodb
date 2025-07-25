import { type ColumnType, UITypes, isLinksOrLTAR, isMultiUser } from 'nocodb-sdk'
import type { PageDesignerPayload } from './payload'

export interface PageDesignerWidgetComponentProps {
  id: number | string
}

export enum PageDesignerWidgetType {
  TEXT,
  IMAGE,
  DIVIDER,
  FIELD,
  LINKED_FIELD,
}

export interface PageDesignerWidget {
  type: PageDesignerWidgetType
  zIndex: number
  cssStyle: string
  id: number
}

export interface PageDesignerTextWidget extends PageDesignerWidget {
  type: PageDesignerWidgetType.TEXT
  value: string
  fontSize: string
  fontWeight: string
  fontFamily: string
  backgroundColor: string
  textColor: string
  lineHeight: string
  borderLeft: string
  borderRight: string
  borderTop: string
  borderBottom: string
  borderRadius: string
  borderColor: string
  horizontalAlign: 'flex-start' | 'center' | 'flex-end'
  verticalAlign: 'flex-start' | 'center' | 'flex-end'
}

export interface PageDesignerImageWidget extends PageDesignerWidget {
  type: PageDesignerWidgetType.IMAGE
  imageSrc: string
  backgroundColor: string
  borderLeft: string
  borderRight: string
  borderTop: string
  borderBottom: string
  borderRadius: string
  borderColor: string
  objectFit: 'fill' | 'contain' | 'cover'
}

export interface PageDesignerDividerWidget extends PageDesignerWidget {
  type: PageDesignerWidgetType.DIVIDER
  backgroundColor: string
  angle: number
  thickness: number
}

export interface PageDesignerFieldWidget extends PageDesignerWidget {
  type: PageDesignerWidgetType.FIELD
  field: ColumnType
  borderLeft: string
  borderRight: string
  borderTop: string
  borderBottom: string
  borderRadius: string
  borderColor: string
  backgroundColor: string
  fontSize: string
  fontWeight: string
  fontFamily: string
  textColor: string
  lineHeight: string
  objectFit: 'fill' | 'contain' | 'cover'
  horizontalAlign: 'flex-start' | 'center' | 'flex-end'
  verticalAlign: 'flex-start' | 'center' | 'flex-end'
  displayAs?: SelectTypeFieldDisplayAs
  listType?: SelectTypeFieldListType
}

export enum LinkedFieldDisplayAs {
  LIST = 'List',
  INLINE = 'Inline',
  TABLE = 'Table',
}

export enum LinkedFieldListType {
  Bullet = 'Bulleted',
  Number = 'Numbered',
}

export enum SelectTypeFieldDisplayAs {
  LIST = 'List',
  INLINE = 'Inline',
}

export enum SelectTypeFieldListType {
  Bullet = 'Bulleted',
  Number = 'Numbered',
  None = 'None',
}

export interface PageDesignerLinkedFieldWidget extends PageDesignerWidget {
  type: PageDesignerWidgetType.LINKED_FIELD
  field: ColumnType
  displayAs: LinkedFieldDisplayAs
  borderLeft: string
  borderRight: string
  borderTop: string
  borderBottom: string
  borderRadius: string
  borderColor: string
  backgroundColor: string
  fontSize: string
  fontWeight: string
  fontFamily: string
  textColor: string
  lineHeight: string
  tableSettings: {
    borderLeft: string
    borderRight: string
    borderTop: string
    borderBottom: string
    borderRadius: string
    borderColor: string
    row: {
      fontSize: string
      fontWeight: string
      textColor: string
      lineHeight: string
    }
    header: {
      fontSize: string
      fontWeight: string
      textColor: string
      lineHeight: string
    }
  }
  listType: LinkedFieldListType
  tableColumns: Array<{ id: string; selected: boolean }>
  objectFit: 'fill' | 'contain' | 'cover'
  horizontalAlign: 'flex-start' | 'center' | 'flex-end'
  verticalAlign: 'flex-start' | 'center' | 'flex-end'
}

const BLACK = '#000000'
const WHITE = '#ffffff'

export class PageDesignerWidgetFactory {
  static create(payload: Ref<PageDesignerPayload>, widget: PageDesignerWidget) {
    widget.id = ++payload.value.lastWidgetId
    payload.value.widgets[widget.id] = widget
    payload.value.currentWidgetId = widget.id
  }

  static createEmptyTextWidget({ x, y } = { x: 0, y: 0 }): PageDesignerTextWidget {
    const { width, height } = getInitialSizeHeightOfWidget(PageDesignerWidgetType.TEXT)
    const { x: newX, y: newY } = centerCursor({ x, y }, { width, height })
    return {
      id: 0,
      textColor: BLACK,
      backgroundColor: WHITE,
      borderTop: '0',
      borderRight: '0',
      borderBottom: '0',
      borderLeft: '0',
      borderRadius: '0',
      borderColor: BLACK,
      fontFamily: 'Inter',
      fontSize: '16',
      fontWeight: '400',
      horizontalAlign: 'flex-start',
      verticalAlign: 'flex-start',
      lineHeight: '1.4',
      type: PageDesignerWidgetType.TEXT,
      value: '',
      zIndex: 0,
      cssStyle: `width: ${width}px; height: ${height}px; transform: translate(${newX}px, ${newY}px); max-width: auto;max-height: auto;min-width: 30px;min-height: 30px;`,
    }
  }

  static createEmptyImageWidget({ x, y } = { x: 0, y: 0 }): PageDesignerImageWidget {
    const { width, height } = getInitialSizeHeightOfWidget(PageDesignerWidgetType.IMAGE)
    const { x: newX, y: newY } = centerCursor({ x, y }, { width, height })
    return {
      id: 0,
      backgroundColor: WHITE,
      borderTop: '0',
      borderRight: '0',
      borderBottom: '0',
      borderLeft: '0',
      borderRadius: '0',
      borderColor: BLACK,
      type: PageDesignerWidgetType.IMAGE,
      imageSrc: '',
      objectFit: 'contain',
      zIndex: 0,
      cssStyle: `width: ${width}px; height: ${height}px; transform: translate(${newX}px, ${newY}px); max-width: auto;max-height: auto;min-width: 30px;min-height: 30px;`,
    }
  }

  static createEmptyDividerWidget({ x, y } = { x: 0, y: 0 }): PageDesignerDividerWidget {
    const { width, height: thickness } = getInitialSizeHeightOfWidget(PageDesignerWidgetType.DIVIDER)
    const { x: newX, y: newY } = centerCursor({ x, y }, { width, height: thickness })
    return {
      id: 0,
      backgroundColor: BLACK,
      type: PageDesignerWidgetType.DIVIDER,
      angle: 0,
      zIndex: 0,
      thickness,
      cssStyle: `width: ${width}px; height: ${thickness}px; transform: translate(${newX}px, ${newY}px) rotate(0deg); max-width: auto;max-height: auto;min-width: 10px;min-height: 1px;`,
    }
  }

  static createEmptyFieldWidget(field: ColumnType, { x, y } = { x: 0, y: 0 }): PageDesignerFieldWidget {
    const { width, height } = getInitialSizeHeightOfWidget(PageDesignerWidgetType.FIELD, field)
    const { x: newX, y: newY } = centerCursor({ x, y }, { width, height })

    const isSelectTypeField = isMultiSelect(field) || isMultiUser(field)

    return {
      id: 0,
      field,
      displayAs: isSelectTypeField ? SelectTypeFieldDisplayAs.INLINE : undefined,
      listType: SelectTypeFieldListType.None,
      borderTop: '0',
      borderRight: '0',
      borderBottom: '0',
      borderLeft: '0',
      borderRadius: '0',
      borderColor: BLACK,
      backgroundColor: WHITE,
      textColor: BLACK,
      fontFamily: 'Inter',
      fontSize: '16',
      fontWeight: '400',
      lineHeight: '1.4',
      horizontalAlign: 'flex-start',
      verticalAlign: 'flex-start',
      objectFit: 'contain',
      type: PageDesignerWidgetType.FIELD,
      zIndex: 0,
      cssStyle: `width: ${width}px; height: ${height}px; transform: translate(${newX}px, ${newY}px); max-width: auto;max-height: auto;min-width: 30px;min-height: 20px;`,
    }
  }

  static createEmptyLinkedFieldWidget(field: ColumnType, { x, y } = { x: 0, y: 0 }): PageDesignerLinkedFieldWidget {
    const { width, height } = getInitialSizeHeightOfWidget(PageDesignerWidgetType.LINKED_FIELD, field)
    const { x: newX, y: newY } = centerCursor({ x, y }, { width, height })
    return {
      id: 0,
      field,
      displayAs: LinkedFieldDisplayAs.LIST,
      tableColumns: [],
      borderTop: '0',
      borderRight: '0',
      borderBottom: '0',
      borderLeft: '0',
      borderRadius: '0',
      borderColor: BLACK,
      backgroundColor: WHITE,
      textColor: BLACK,
      fontFamily: 'Inter',
      fontSize: '16',
      fontWeight: '400',
      lineHeight: '1.4',
      horizontalAlign: 'flex-start',
      verticalAlign: 'flex-start',
      objectFit: 'contain',
      listType: LinkedFieldListType.Bullet,
      type: PageDesignerWidgetType.LINKED_FIELD,
      tableSettings: {
        borderTop: '1',
        borderRight: '1',
        borderBottom: '1',
        borderLeft: '1',
        borderRadius: '0',
        borderColor: BLACK,
        row: {
          fontSize: '12',
          fontWeight: '400',
          textColor: BLACK,
          lineHeight: '1.5',
        },
        header: {
          fontSize: '12',
          fontWeight: '700',
          textColor: BLACK,
          lineHeight: '1.5',
        },
      },
      zIndex: 0,
      cssStyle: `width: ${width}px; height: ${height}px; transform: translate(${newX}px, ${newY}px); max-width: auto;max-height: auto;min-width: 30px;min-height: 20px;`,
    }
  }
}

export const plainCellFields = new Set([
  UITypes.ID,
  UITypes.ForeignKey,
  UITypes.SingleLineText,
  UITypes.Date,
  UITypes.Year,
  UITypes.Time,
  UITypes.PhoneNumber,
  UITypes.GeoData,
  UITypes.Email,
  UITypes.URL,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.Formula,
  UITypes.Count,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.AutoNumber,
  UITypes.Geometry,
  UITypes.JSON,
  UITypes.SpecificDBType,
  UITypes.Order,
  UITypes.CreatedBy,
  UITypes.Collaborator,
  UITypes.LastModifiedBy,
  UITypes.LongText,
  UITypes.Rollup,
])

export const fontWeightToLabel: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra Light',
  '300': 'Light',
  '400': 'Normal',
  '500': 'Medium',
  '600': 'Semi Bold',
  '700': 'Bold',
  '800': 'Extra Bold',
  '900': 'Heavy',
}

export const fonts = [
  'Arial',
  'Tahoma',
  'Times New Roman',
  'Verdana',
  'Courier New',
  'Georgia',
  'Impact',
  'Trebuchet MS',
  'Manrope',
  'Inter',
]
export const fontWeights = ['400', '700']

export const objectFitLabels: Record<string, string> = {
  contain: 'Fit',
  cover: 'Fill',
  fill: 'Stretch',
}

export function getInitialSizeHeightOfWidget(type: PageDesignerWidgetType, field?: ColumnType) {
  let width = 200
  let height = 200
  if (field) {
    width = 200
    height = 30
    if ([UITypes.Barcode, UITypes.QrCode].includes(field.uidt! as UITypes)) {
      width = 100
      height = 100
    }
    if (isAttachment(field) || isTextArea(field)) {
      width = 200
      height = 200
    }
    if (isLinksOrLTAR(field)) {
      width = 300
      height = 200
    }
  } else if (type === PageDesignerWidgetType.DIVIDER) {
    width = 500
    height = 2
  } else if (type === PageDesignerWidgetType.IMAGE) {
    width = 200
    height = 200
  } else if (type === PageDesignerWidgetType.TEXT) {
    width = 200
    height = 30
  }
  return { height, width }
}

export function centerCursor({ x, y }: { x: number; y: number }, { width, height }: { width: number; height: number }) {
  if (x === 0 && y === 0) return { x, y }

  x -= width / 2
  y -= height / 2
  return { x, y }
}

export const horizontalAlignTotextAlignMap = {
  'flex-start': 'left',
  'center': 'center',
  'flex-end': 'right',
} as const
