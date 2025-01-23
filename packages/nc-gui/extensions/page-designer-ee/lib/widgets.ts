export interface PageDesignerWidget {
  type: 'text' | 'image'
  zIndex: number
}

export interface PageDesignerTextWidget extends PageDesignerWidget {
  type: 'text'
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
  type: 'image'
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
  static createEmptyTextWidget(): PageDesignerTextWidget {
    return {
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
      type: 'text',
      value: '',
      zIndex: 0,
    }
  }

  static createEmptyImageWidget(): PageDesignerImageWidget {
    return {
      backgroundColor: WHITE,
      borderTop: '0',
      borderRight: '0',
      borderBottom: '0',
      borderLeft: '0',
      borderRadius: '0',
      borderColor: BLACK,
      type: 'image',
      imageSrc: '',
      objectFit: 'cover',
      zIndex: 0,
    }
  }
}
