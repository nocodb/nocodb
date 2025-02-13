import { UITypes, UITypesName } from 'nocodb-sdk'

export function columnTypeName(column: CanvasGridColumn) {
  if (column?.columnObj.uidt === UITypes.LongText) {
    if (parseProp(column?.columnObj?.meta)?.richMode) {
      return UITypesName.RichText
    }

    if (parseProp(column.columnObj?.meta)?.[LongTextAiMetaProp]) {
      return UITypesName.AIPrompt
    }
  }

  return column.columnObj.uidt ? UITypesName[column.columnObj.uidt!] : ''
}
