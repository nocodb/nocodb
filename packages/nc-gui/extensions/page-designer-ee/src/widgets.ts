export interface PageDesignerWidget {
  type: 'text' | 'image'
}

export interface PageDesignerTextWidget extends PageDesignerWidget {
  value: string
  fontSize: number
  fontWeight: number
  fontFamily: string
  backgroundColor: string
  textColor: string
  lineHeight: number
  borderLeft: number
  borderRight: number
  borderTop: number
  borderBottom: number
  borderRadius: number
  borderColor: number
}
