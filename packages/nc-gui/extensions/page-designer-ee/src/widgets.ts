export interface PageDesignerWidget {
  type: 'text' | 'image'
}

export interface PageDesignerTextWidget extends PageDesignerWidget {
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
  static: boolean
  column: string
  url: string
  backgroundColor: string
  borderLeft: string
  borderRight: string
  borderTop: string
  borderBottom: string
  borderRadius: string
  borderColor: string
}
