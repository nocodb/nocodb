import type { ColumnType } from 'ant-design-vue/lib/table'

export enum PageDesignerWidgetType {
  TEXT,
  IMAGE,
  DIVIDER,
  FIELD,
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
}

const BLACK = '#000000'
const WHITE_TRANSPARENT = '#ffffff00'

export class PageDesignerWidgetFactory {
  static createEmptyTextWidget(id: number, { x, y } = { x: 0, y: 0 }): PageDesignerTextWidget {
    return {
      id,
      textColor: BLACK,
      backgroundColor: WHITE_TRANSPARENT,
      borderTop: '0',
      borderRight: '0',
      borderBottom: '0',
      borderLeft: '0',
      borderRadius: '0',
      borderColor: BLACK,
      fontFamily: 'Manrope',
      fontSize: '16',
      fontWeight: '400',
      horizontalAlign: 'flex-start',
      verticalAlign: 'flex-start',
      lineHeight: '1.4',
      type: PageDesignerWidgetType.TEXT,
      value: '',
      zIndex: 0,
      cssStyle: `width: 200px; height: 30px; transform: translate(${x}px, ${y}px); max-width: auto;max-height: auto;min-width: 30px;min-height: 30px;`,
    }
  }

  static createEmptyImageWidget(id: number, { x, y } = { x: 0, y: 0 }): PageDesignerImageWidget {
    return {
      id,
      backgroundColor: WHITE_TRANSPARENT,
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
      cssStyle: `width: 200px; height: 200px; transform: translate(${x}px, ${y}px); max-width: auto;max-height: auto;min-width: 30px;min-height: 30px;`,
    }
  }

  static createEmptyDividerWidget(id: number, { x, y } = { x: 0, y: 0 }): PageDesignerDividerWidget {
    return {
      id,
      backgroundColor: BLACK,
      type: PageDesignerWidgetType.DIVIDER,
      angle: 0,
      zIndex: 0,
      cssStyle: `width: 500px; height: 10px; transform: translate(${x}px, ${y}px) rotate(0deg); max-width: auto;max-height: auto;min-width: 10px;min-height: 5px;`,
    }
  }

  static createEmptyFieldWidget(id: number, field: ColumnType, { x, y } = { x: 0, y: 0 }): PageDesignerFieldWidget {
    return {
      id,
      field,
      borderTop: '0',
      borderRight: '0',
      borderBottom: '0',
      borderLeft: '0',
      borderRadius: '0',
      borderColor: BLACK,
      type: PageDesignerWidgetType.FIELD,
      zIndex: 0,
      cssStyle: `width: 200px; height: 200px; transform: translate(${x}px, ${y}px); max-width: auto;max-height: auto;min-width: 30px;min-height: 30px;`,
    }
  }
}
