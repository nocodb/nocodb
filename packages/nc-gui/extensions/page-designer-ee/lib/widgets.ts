export enum PageDesignerWidgetType {
  TEXT,
  IMAGE,
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

const BLACK = '#000000'
const WHITE = '#ffffff'

export class PageDesignerWidgetFactory {
  static createEmptyTextWidget(id: number, { x, y } = { x: 0, y: 0 }): PageDesignerTextWidget {
    return {
      id,
      textColor: BLACK,
      backgroundColor: WHITE,
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
      backgroundColor: WHITE,
      borderTop: '0',
      borderRight: '0',
      borderBottom: '0',
      borderLeft: '0',
      borderRadius: '0',
      borderColor: BLACK,
      type: PageDesignerWidgetType.IMAGE,
      imageSrc: '',
      objectFit: 'cover',
      zIndex: 0,
      cssStyle: `width: 200px; height: 200px; transform: translate(${x}px, ${y}px); max-width: auto;max-height: auto;min-width: 30px;min-height: 30px;`,
    }
  }
}
