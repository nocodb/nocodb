import type { ColumnType } from 'nocodb-sdk'
import type { Row } from '~/lib'

export const copyTable = async (rows: Row[], cols: ColumnType[]) => {
  let copyHTML = '<table>'
  let copyPlainText = ''

  rows.forEach((row) => {
    let copyRow = '<tr>'
    cols.forEach((col) => {
      let value = (col.title && row.row[col.title]) ?? ''
      if (typeof value === 'object') {
        value = JSON.stringify(value)
      }
      copyRow += `<td>${value}</td>`
      copyPlainText = `${copyPlainText} ${value} \t`
    })
    copyHTML += `${copyRow}</tr>`
    copyPlainText = `${copyPlainText.trim()}\n`
  })
  copyHTML += '</table>'
  copyPlainText.trim()

  const blobHTML = new Blob([copyHTML], { type: 'text/html' })
  const blobPlainText = new Blob([copyPlainText], { type: 'text/plain' })

  return navigator.clipboard.write([new ClipboardItem({ [blobHTML.type]: blobHTML, [blobPlainText.type]: blobPlainText })])
}
